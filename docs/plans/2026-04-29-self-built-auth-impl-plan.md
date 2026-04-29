# 自建 Auth — Implementation Plan

> **目标**：彻底解耦 Supabase Auth，把用户认证从 GoTrue 服务迁到自建系统。Supabase 仅作为 Postgres 与可选 Storage 使用。
> **不在范围**：邮件验证、密码找回、OAuth（v1 不做，后续按需补 Phase 7+）。
> **关键原则**：每个 Phase commit 后 `npx tsc --noEmit` 零错误且 `npm run build` 成功；不可拆成跨 commit 的 broken 状态。

## 设计决策

| 项 | 选型 | 理由 |
|---|---|---|
| 密码哈希 | `argon2id`（@node-rs/argon2） | 现代默认；成本参数 m=19MiB / t=2 / p=1 |
| 兼容旧哈希 | **不做** | 项目仅 1 个真实账号 zhuyu1985@gmail.com，迁移时直接强制重置密码（cli 脚本 prompt 一次性写入 argon2 hash） |
| Session 载体 | `iron-session`（HttpOnly Cookie，AES-256 GCM） | 无需 DB；7 天滑动过期；签名密钥从 env 读 |
| Cookie 名 | `vibetide-session` | 不与原 `sb-vibetide-auth-token` 冲突，便于灰度共存 |
| Token 内容 | `{ userId, organizationId, displayName, isSuperAdmin, iat, exp }` | 减少每请求查 DB |
| 用户 id 类型 | `uuid`（保持） | 避免改 145 张表的 FK |
| 用户表载体 | **扩展现有 `user_profiles` 加 email/password_hash 列**，不新建表 | 现有 145 表 FK 已指 user_profiles.id；不增表语义最简 |
| 数据迁移 | 一次性 SQL：`UPDATE user_profiles SET email/password_hash FROM auth.users WHERE id = id` | 单条 UPDATE，无新表创建 |

## Phase 0: Pre-flight

### Step 0.1: 备份
- 执行 `pg_dump` 全量备份当前 cloud DB
- 备份到 `backups/` 目录（已在 .gitignore）

### Step 0.2: 新增依赖
```bash
pnpm add iron-session @node-rs/argon2
```

### Step 0.3: 新增 env
在 `.env.local` 与 `.env.example` 加：
```
# Self-built auth
AUTH_SESSION_SECRET=<32+ char random>     # iron-session 加密密钥
AUTH_SESSION_TTL_SECONDS=604800            # 7 天
```

---

## Phase 1: 数据层基础（无行为变更）

### Step 1.1: 扩展 `user_profiles` 表
- 文件：`src/db/schema/users.ts`（修改现有 `userProfiles` 定义）
- 在原字段基础上**追加 4 列**（不动其他字段）：
  - `email text` + unique index（nullable，历史数据迁入后再补 NOT NULL）
  - `passwordHash text`（nullable —— 没密码的账号无法登录）
  - `passwordHashAlgo text` default `'argon2id'`（迁入历史数据时写 `'bcrypt'`）
  - `lastLoginAt timestamp with time zone`
- 不新建表、不动 `userProfilesRelations`、不动现有 145 张表的 FK 关系

### Step 1.2: 生成迁移
```bash
npm run db:generate
```
- 检查生成的 SQL 应为 `ALTER TABLE user_profiles ADD COLUMN ...` × 4 + 一个 unique index
- 确认**不**生成 CREATE TABLE / DROP / 任何对其他表的改动
- `npm run db:migrate` 应用到 cloud DB

### Step 1.3: 数据迁移脚本（仅迁 email）
- 文件：`src/db/migrate-auth-users.ts`
- 逻辑（一句 UPDATE，只迁 email，password 留空）：
  ```sql
  UPDATE public.user_profiles up
  SET email = au.email,
      updated_at = now()
  FROM auth.users au
  WHERE up.id = au.id
    AND up.email IS NULL;  -- 幂等
  ```
- 执行：`npx tsx src/db/migrate-auth-users.ts`
- 验证：`SELECT id, email, password_hash FROM user_profiles` —— 应有 email 全部为 NULL 的 password_hash

### Step 1.4: 一次性设置 zhuyu1985 的初始密码
- 文件：`src/db/set-initial-password.ts`
- 逻辑：
  ```ts
  const email = process.argv[2];
  const password = process.argv[3];
  const hash = await argon2.hash(password, { algorithm: argon2.Algorithm.Argon2id });
  await db.update(userProfiles)
    .set({ passwordHash: hash, passwordHashAlgo: 'argon2id' })
    .where(eq(userProfiles.email, email));
  ```
- 执行：`npx tsx src/db/set-initial-password.ts zhuyu1985@gmail.com '<新密码>'`
- 验证：`SELECT email, password_hash FROM user_profiles WHERE email = 'zhuyu1985@gmail.com'` —— password_hash 不为 NULL

### Step 1.5: 收紧约束（迁移完成后单独跑）
- 待 Phase 6 验收通过后，再加一次迁移：
  ```sql
  ALTER TABLE user_profiles ALTER COLUMN email SET NOT NULL;
  ```

**Phase 1 验收**：tsc 零错误 / build 成功 / `user_profiles.email` + `password_hash` 已填充；现有 supabase 登录行为不受影响（旧 cookie 还能用）。

---

## Phase 2: Auth lib 模块（新代码与旧并存）

### Step 2.1: `src/lib/auth/hash.ts`
- `hashPassword(plain): Promise<string>` — argon2id
- `verifyPassword(plain, hash): Promise<boolean>` — argon2 verify（只支持 argon2id；其他算法直接 false）

### Step 2.2: `src/lib/auth/session.ts`
- 用 iron-session：`getIronSession<SessionPayload>(cookies(), { password, cookieName, ttl })`
- `SessionPayload`：见上文 Token 内容
- 导出 `getSession(): Promise<SessionPayload | null>`、`setSession(payload)`、`destroySession()`

### Step 2.3: `src/lib/auth/current-user.ts`
- `getCurrentUser()` — 替代 `supabase.auth.getUser()`：从 cookie 读 session，返回 `{ userId, organizationId, displayName, isSuperAdmin }` 或 `null`
- `requireAuth()` — 包装 `getCurrentUser()`，未登录抛错并 redirect("/login")
- 用 `cache()` 装饰，per-request 去重

### Step 2.4: `src/lib/auth/index.ts` —— barrel export

**Phase 2 验收**：tsc 零错误；新模块能在 REPL/单元测试里调通；旧 supabase auth 仍工作。

---

## Phase 3: Server actions 重写 + 入口切换

### Step 3.1: 重写 `src/app/actions/auth.ts`
- `signIn(formData)`：
  1. 读 email + password
  2. `db.query.userProfiles.findFirst({ where: eq(userProfiles.email, email) })` —— 一次查询拿全
  3. 没找到 / 没 passwordHash → `{ error: "邮箱或密码错误" }`
  4. `verifyPassword(password, profile.passwordHash)`
  5. 失败 → `{ error: "邮箱或密码错误" }`
  6. update `lastLoginAt = now()`
  7. `setSession({ userId: profile.id, organizationId, displayName, isSuperAdmin })`
  8. `redirect("/home")`
- `signUp(formData)`：
  1. 校验 email 唯一
  2. `hashPassword(password)`
  3. 单条 INSERT `user_profiles`（id 用 randomUUID()，关联到默认 org，email + passwordHash 一并写入）
  4. setSession + redirect
- `signOut()`：`destroySession()` + redirect("/login")

### Step 3.2: 改 `proxy.ts`
- 不再 import `updateSession`
- 改为：直接 `await getSession()` 判断登录态；同样的 isPublicPath / redirect 逻辑
- 删除 `src/lib/supabase/middleware.ts` —— 已无人调用

### Step 3.3: 改 `src/app/(dashboard)/layout.tsx`
- `getCurrentUserProfile()` 改读自家 session（Phase 4 完成后这一步已自然完成）
- 临时方案：layout 暂保持 supabase（Phase 4 一起改）

**Phase 3 验收**：用 Phase 1 迁移后的账号能成功登录；session cookie 设置正确；登出清空 cookie。

---

## Phase 4: 批量替换 83 处调用

> 这一步必须**单 commit** 完成，避免中间态 broken。

### Step 4.1: 改写 `src/lib/dal/auth.ts`
- `getCurrentUserAndOrg / getCurrentUserOrg / getCurrentUserProfile` 全部改读 `getCurrentUser()`
- 删除 `import { createClient } from "@/lib/supabase/server"`
- `ensureUserProfile` 保留逻辑但改为基于 session 已有的 userId
- 不再处理 `user.user_metadata` —— displayName 直接从 `userProfiles` 查

### Step 4.2: 替换 server actions（82 个文件）
- 通用模式（保留 import 中的 `createClient` 用于其他用途时除外）：
  ```ts
  // before
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  
  // after
  const { userId } = await requireAuth();
  ```
- 用脚本 `scripts/replace-auth-calls.ts` 半自动批改 + 人工 review
- 对每个文件：
  1. 删 `createClient` import 若仅用于 auth
  2. 加 `import { requireAuth } from "@/lib/auth"`
  3. 替换调用点
- 大文件（如 admin.ts）单独处理

### Step 4.3: 改写 `src/app/actions/admin.ts`
- 创建用户：单条 `db.insert(userProfiles).values({ id: randomUUID(), email, passwordHash: await hashPassword(initialPassword), displayName, organizationId, role, ... })`
- 更新用户：直接 `update userProfiles`，不调 `supabase.auth.admin`
- 重置密码：`update userProfiles set password_hash = await hashPassword(...) where id = ?`
- 删除用户：`delete from userProfiles where id = ?`（其他表的 ON DELETE 行为按现有 FK 设计走）

**Phase 4 验收**：
- `grep -rn "supabase\.auth\." src/` 返回 0 行（除可能保留的 storage 调用）
- 所有 dashboard 页面正常工作
- tsc 零错误 + build 成功

---

## Phase 5: 清理 Supabase Auth 残留

### Step 5.1: 删除 Supabase auth 相关文件
- 删 `src/lib/supabase/server.ts`
- 删 `src/lib/supabase/client.ts`
- 删 `src/lib/supabase/middleware.ts`（若 Phase 3 还没删）
- 删 `src/lib/supabase/diagnostic-fetch.ts`
- 整个 `src/lib/supabase/` 目录留空可考虑直接 `rmdir`

### Step 5.2: 移除依赖（不用 Storage 全删）
```bash
pnpm remove @supabase/ssr @supabase/supabase-js
```
- 保留 `postgres` driver（Drizzle 用于直连 DB）— 这个只是 PostgreSQL 客户端，不依赖任何 Supabase 服务

### Step 5.3: 更新 CLAUDE.md
- 删除 `### Auth Flow` 段所有 Supabase 描述，改写为自建 auth 流程
- `### Tech Stack` 删除 `**Auth:** Supabase Auth (@supabase/ssr for SSR cookie management)`，改为 `**Auth:** Self-built (iron-session + argon2id)`
- `### Database` 删除 `Connection in src/db/index.ts` 关于 PgBouncer 的说明若无关；`auth.users` schema 保留但不再依赖

### Step 5.4: 可选 — drop `auth.users`
- 极激进；推荐先观察 1-2 周再做：`DROP SCHEMA IF EXISTS auth CASCADE;`

**Phase 5 验收**：依赖瘦身、CLAUDE.md 同步、build 成功。

---

## Phase 6: 验证 + 切换环境验证

### Step 6.1: 本地验证
- 切到 cloud Supabase env：登录正常
- 切到 local Supabase env（只要 DB 一致）：登录正常 ✓ 关键收益验收

### Step 6.2: 错误注入测试
- 临时把 `DATABASE_URL` 改坏 → 应看到清晰错误，不是无限挂起
- Supabase Auth 服务挂掉？已无关，自建 auth 不依赖

### Step 6.3: 安全检查
- AUTH_SESSION_SECRET 是否够强（≥ 32 字符）
- Cookie 标志：HttpOnly ✓、Secure（prod）✓、SameSite=Lax
- 密码最小长度（注册时校验 ≥ 8）
- 防爆破：登录失败计数（v1 可缓 / 用 IP rate-limit middleware 后续加）

---

## 风险与回滚

| 风险 | 缓解 |
|---|---|
| Phase 1 迁移漏数据 | 用 `auth.users` 与 `public.users` count 比对，差额报警 |
| Phase 4 漏改一处导致 401 | grep 检查 + 手动遍历 actions 目录 + 测试覆盖关键页面 |
| Cookie 冲突 | 新 cookie 名独立；老 cookie 浏览器端自然失效 |
| 用户首次登录 bcrypt 慢（云端 verify ~200ms） | 可接受；rehash 后下次就 argon2 |
| 回滚 | 每个 Phase 独立 commit；revert 单 commit 即可（除 Phase 4 是大 commit，需保留 supabase auth 备份分支策略变更说明） |

## 时间估算

| Phase | 估时 |
|---|---|
| 0 + 1 | 0.25 天（一句 UPDATE 比建表 + 双写简单） |
| 2 | 0.5 天 |
| 3 | 0.5 天 |
| 4 | 1.5 天（机械工作 + 测试） |
| 5 | 0.25 天 |
| 6 | 0.5 天 |
| **总计** | **~3.5 人天** |

## 后续可选 Phase

- Phase 7：邮件验证（Resend + 验证码表）
- Phase 8：密码找回（reset_tokens 表 + 邮件）
- Phase 9：登录失败 rate-limit（Redis / DB）
- Phase 10：OAuth（Google / GitHub）—— 接 Auth.js 或自实现
