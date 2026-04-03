# Supabase 云端迁移到本地化部署 — 完整处理记录

> 日期：2026-04-03
> 项目：Vibetide (Vibe Media 数智全媒平台)
> 环境：macOS + Docker 自托管 Supabase (sup-vibetide)

---

## 一、问题背景

项目原来使用 Supabase Cloud（`urccnaegmhvztpidezmt.supabase.co`）提供的云端数据库和认证服务。为了降低成本和提升数据安全性，决定将 Supabase 完整本地化部署。

本地 Supabase 通过 Docker Compose 部署在 `/Users/zhuyu/dev/sup-vibetide/`，数据库和业务数据已同步到本地，但**用户认证体系无法使用**——登录失败且无明确错误提示。

---

## 二、架构说明

### 认证数据分布

| 存储位置 | 内容 | 管理者 |
|----------|------|--------|
| `auth.users`（Supabase 内部） | 邮箱、密码 hash、session | GoTrue 服务 |
| `public.user_profiles`（应用表） | 显示名、角色、组织关联 | 应用代码 (Drizzle ORM) |
| `public.organizations`（应用表） | 租户/工作空间 | 应用代码 |

`user_profiles.id` 直接引用 `auth.users.id`（同一个 UUID），两者必须一致。

### 本地 Docker 服务架构

```
浏览器 → Kong (端口 8000, API 网关)
              ├── GoTrue (supabase-auth, 端口 9999, 认证服务)
              ├── PostgREST (supabase-rest, REST API)
              └── ...
         PostgreSQL (supabase-db, 端口 5432 内部)
         Supavisor (supabase-pooler, 连接池, 端口 5432→宿主机)
```

---

## 三、排查与修复过程（共修复 5 个问题）

### 问题 1：auth.users 表为空（用户数据未迁移）

**现象**：本地数据库中 `auth.users` 表没有任何记录，用户无法登录。

**原因**：业务数据通过 Drizzle 迁移到了本地，但 `auth.users` 属于 Supabase 内部 auth schema，不在 Drizzle 管理范围内。

**分析迁移方案**：

| 方案 | 方式 | 优缺点 |
|------|------|--------|
| 方案一 | Supabase Admin API 创建用户 | 简单但无法保留密码 hash |
| 方案二 | pg_dump 导出 auth schema SQL | 最完整，但需要 DB 直连 |
| 方案三 | Auth 继续用云端，DB 用本地 | 零迁移成本但架构分裂 |

**实际执行**：由于代理软件（Surge/ClashX）将 DNS 解析为虚拟 IP（`198.18.0.x`），Docker 容器内无法直连云端数据库，pg_dump 方案不可行。最终采用**混合方案**：

1. **通过云端 Supabase Admin REST API（HTTP）导出用户元数据**（宿主机可走代理访问 HTTPS）：

```bash
# 使用云端 service_role_key 调用 Admin API
curl -s 'https://urccnaegmhvztpidezmt.supabase.co/auth/v1/admin/users?per_page=50' \
  -H 'Authorization: Bearer <CLOUD_SERVICE_ROLE_KEY>' \
  -H 'apikey: <CLOUD_SERVICE_ROLE_KEY>'
```

获取到 2 个用户的完整元数据（id、email、user_metadata 等）。

2. **通过 docker exec 在容器内直接执行 SQL 插入**（绕过网络问题）：

```sql
-- 插入 GoTrue 需要的 instance 记录
INSERT INTO auth.instances (id, uuid, raw_base_config, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', '{}', now(), now())
ON CONFLICT DO NOTHING;

-- 插入用户（保持原始 UUID，使用 bcrypt 生成新密码 hash）
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  confirmed_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token, email_change
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '769de19f-59b7-4e84-8ec2-908feac3a3af',  -- 保持原 UUID
  'authenticated', 'authenticated',
  'zhuyu1985@gmail.com',
  crypt('Vibetide@2026', gen_salt('bf')),   -- bcrypt 新密码
  '2026-03-02T08:10:53.447111Z',            -- 保持原确认时间
  '2026-03-14T13:35:21.12269Z',
  '{"provider":"email","providers":["email"]}',
  '{"display_name":"朱愚","email":"zhuyu1985@gmail.com","email_verified":true}',
  false,
  '2026-03-02T08:10:39.227742Z',
  '2026-04-02T11:04:20.085209Z',
  '', '', '', ''
) ON CONFLICT (id) DO NOTHING;
```

执行命令：
```bash
docker exec supabase-db psql -U supabase_admin -d postgres -c "<上述 SQL>"
```

3. **验证密码 hash 正确性**：

```bash
docker exec supabase-db psql -U supabase_admin -d postgres \
  -c "SELECT email, (encrypted_password = crypt('Vibetide@2026', encrypted_password)) as password_valid FROM auth.users;"
```

输出 `password_valid = t`，确认密码匹配。

> **关键点**：保持原始 UUID 不变，这样 `user_profiles` 表中已有的记录（通过 id 关联）不需要任何修改。

---

### 问题 2：GoTrue 认证服务无法启动（数据库密码不匹配）

**现象**：GoTrue 日志持续报错：
```
password authentication failed for user "supabase_auth_admin" (SQLSTATE 28P01)
```

**原因**：本地 PostgreSQL 中 `supabase_auth_admin` 角色的密码与 GoTrue 环境变量中配置的密码不一致。GoTrue 配置的连接串为：
```
GOTRUE_DB_DATABASE_URL=postgres://supabase_auth_admin:<POSTGRES_PASSWORD>@db:5432/postgres
```

**修复**：
```bash
docker exec supabase-db psql -U supabase_admin -d postgres \
  -c "ALTER ROLE supabase_auth_admin WITH PASSWORD '<POSTGRES_PASSWORD>';"

docker restart supabase-auth
```

---

### 问题 3：GoTrue 迁移脚本执行失败（auth 函数权限不足）

**现象**：密码修复后，GoTrue 日志报新错误：
```
ERROR: must be owner of function uid (SQLSTATE 42501)
```

**原因**：GoTrue 启动时会执行 `CREATE OR REPLACE FUNCTION auth.uid()` 等迁移 SQL。但这些函数的 owner 是 `postgres`，而 GoTrue 以 `supabase_auth_admin` 身份执行，权限不够。

**修复**：将 auth schema 及其所有对象的所有权转移给 `supabase_auth_admin`：

```bash
docker exec supabase-db psql -U supabase_admin -d postgres -c "
  ALTER SCHEMA auth OWNER TO supabase_auth_admin;
  ALTER TABLE auth.users OWNER TO supabase_auth_admin;
  ALTER TABLE auth.refresh_tokens OWNER TO supabase_auth_admin;
  ALTER TABLE auth.instances OWNER TO supabase_auth_admin;
  ALTER TABLE auth.audit_log_entries OWNER TO supabase_auth_admin;
  ALTER TABLE auth.schema_migrations OWNER TO supabase_auth_admin;
  ALTER FUNCTION auth.uid() OWNER TO supabase_auth_admin;
  ALTER FUNCTION auth.role() OWNER TO supabase_auth_admin;
  ALTER FUNCTION auth.email() OWNER TO supabase_auth_admin;
  GRANT ALL ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO supabase_auth_admin;
  GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
"

docker restart supabase-auth
```

重启后 GoTrue 日志显示：
```
GoTrue migrations applied successfully
GoTrue API started on: 0.0.0.0:9999
```

---

### 问题 4：浏览器登录请求被代理拦截（返回 403）

**现象**：GoTrue API 已正常运行，但浏览器登录仍失败。curl 测试发现返回 `403 Forbidden`，响应体为空。

**原因**：系统配置了全局代理 `ALL_PROXY=socks5://127.0.0.1:7897`（Surge/ClashX 等），浏览器和 Node.js 对 `localhost` 的请求也被代理转发，代理对非 HTTP 协议或不认识的请求返回 403。

**验证**：
```bash
# 走代理 → 403
curl -v -X POST "http://localhost:8000/auth/v1/token?grant_type=password" ...
# 结果: HTTP/1.1 403 Forbidden

# 绕过代理 → 成功
curl --noproxy localhost -s -X POST "http://localhost:8000/auth/v1/token?grant_type=password" ...
# 结果: 返回 access_token
```

**修复**：将 `.env.local` 中 `NEXT_PUBLIC_SUPABASE_URL` 从 `http://localhost:8000` 改为 `http://127.0.0.1:8000`（部分代理软件对 `127.0.0.1` 自动直连）。

同时建议在代理软件中将 `localhost`、`127.0.0.1` 加入绕过/直连规则。

---

### 问题 5：Drizzle ORM 数据库查询失败（连接池 Supavisor 崩溃）

**现象**：登录成功后跳转到 missions 页面时报错：
```
Failed query: select ... from "user_profiles" where "userProfiles"."id" = $1
```

**原因**：Next.js 通过 Drizzle ORM 使用 `DATABASE_URL` 连接数据库。DATABASE_URL 指向 `127.0.0.1:5432`，这个端口由 Supavisor（连接池）映射。但 Supavisor 自身一直在崩溃：

```
cat: /etc/pooler/pooler.exs: Is a directory
ERROR: EVAL expects an expression as argument
```

配置文件挂载成了目录导致 Supavisor 无法启动。

**修复**：绕过 Supavisor，让 PostgreSQL 直接暴露端口。修改 docker-compose.yml：

```yaml
# /Users/zhuyu/dev/sup-vibetide/docker-compose.yml
db:
  container_name: supabase-db
  image: supabase/postgres:15.8.1.085
  restart: unless-stopped
  ports:
    - 5433:5432          # 新增：直接暴露 DB 端口到宿主机 5433
  volumes:
    ...
```

```bash
# 重建 DB 容器
cd /Users/zhuyu/dev/sup-vibetide && docker compose up -d db

# 容器重建后需要再次修复密码（因为角色密码存储在 PGDATA 中，但可能需要重置）
docker exec supabase-db psql -U supabase_admin -d postgres \
  -c "ALTER ROLE postgres WITH PASSWORD '<POSTGRES_PASSWORD>';"
docker exec supabase-db psql -U supabase_admin -d postgres \
  -c "ALTER ROLE supabase_auth_admin WITH PASSWORD '<POSTGRES_PASSWORD>';"

# 重启 GoTrue（因为 DB 容器重建了）
docker restart supabase-auth
```

更新 `.env.local`：
```bash
# 从
DATABASE_URL=postgresql://postgres:<password>@127.0.0.1:5432/postgres
# 改为
DATABASE_URL=postgresql://postgres:<password>@127.0.0.1:5433/postgres
```

---

## 四、最终配置清单

### .env.local 关键配置

```env
# Supabase API（通过 Kong 网关）
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:8000/
NEXT_PUBLIC_SUPABASE_ANON_KEY=<本地 anon key>
SUPABASE_SERVICE_ROLE_KEY=<本地 service_role key>

# 数据库直连（绕过 Supavisor，端口 5433）
DATABASE_URL=postgresql://postgres:<POSTGRES_PASSWORD>@127.0.0.1:5433/postgres
```

### Docker 端口映射总览

| 服务 | 容器 | 宿主机端口 | 用途 |
|------|------|-----------|------|
| Kong | supabase-kong | 8000 | API 网关（Auth, REST, Storage 等） |
| PostgreSQL | supabase-db | **5433** | 数据库直连（Drizzle ORM） |
| Studio | supabase-studio | 8000 (内部) | 可视化管理界面 |
| GoTrue | supabase-auth | 9999 (内部) | 认证服务（通过 Kong 访问） |

### 迁移后的用户账号

| 用户 | Email | 密码 |
|------|-------|------|
| 朱愚 | zhuyu1985@gmail.com | Vibetide@2026 |
| Test User | test@vibetide.com | Vibetide@2026 |

> 迁移后密码为统一临时密码，登录后应及时修改。

---

## 五、注意事项

1. **代理软件**：开发环境如果使用 Surge/ClashX/Clash Verge 等代理，必须将 `localhost` 和 `127.0.0.1` 加入直连/绕过规则，否则本地服务请求会被代理拦截。

2. **容器重建后密码丢失**：如果 `docker compose up -d db` 重建了 DB 容器，需要重新执行 `ALTER ROLE` 修复 `postgres` 和 `supabase_auth_admin` 的密码，并重启 `supabase-auth`。

3. **Supavisor 问题**：当前 Supavisor 配置有 bug（`pooler.exs` 挂载为目录），暂时通过 DB 直连绕过。后续如需连接池功能，需修复 Supavisor 的 volume 挂载配置。

4. **auth schema 权限**：GoTrue 要求 `supabase_auth_admin` 角色拥有 auth schema 的完整所有权。如果数据库初始化脚本由其他用户（如 `postgres`）创建了 auth 对象，需手动转移所有权。

5. **密码迁移局限**：Supabase Admin API 不返回密码 hash，因此无法无感迁移密码。如果用户量大，建议：
   - 通过数据库直连（需解决网络问题）使用 `pg_dump --data-only --schema=auth` 导出完整 auth 数据
   - 或实现"首次登录强制重置密码"的应用层逻辑
