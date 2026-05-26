# P0.3 Supabase Storage 配额边界 spike 报告

**Date:** 2026-05-26
**Result:** BLOCKED — Supabase Storage endpoint 在当前本地开发环境不可达,无法实测上传配额

## 验证内容

- [x] 80MB 文件上传 (期望 P3 Step 6c 市级 tier 文件量级) — **未执行**(env 缺失)
- [x] 120MB 文件上传 (上限测试) — **未执行**(env 缺失)

## 跑通脚本输出

```
$ npx tsx scripts/spike-storage-upload.ts
[dotenv@17.3.1] injecting env (32) from .env.local -- tip: 🤖 agentic secret storage: https://dotenvx.com/as2
[dotenv@17.3.1] injecting env (0) from .env -- tip: ⚙️  override existing env vars with { override: true }
✗ BLOCKED: NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 未设置(检查 .env.local;ADR 2026-05-01 用 self-hosted Supabase REST API)

缺失的 env(见 .env.example):
  - NEXT_PUBLIC_SUPABASE_URL=https://<host>
  - SUPABASE_SERVICE_ROLE_KEY=<service-role JWT>
```

退出码 `2`(BLOCKED,区别于上传失败的 `1`)。

## 根因分析

1. **`.env.local` 里 `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` 两行被注释掉**(行 2-5),user 当前工作模式只走 `DATABASE_URL=postgresql://...@127.0.0.1:5433/postgres` 直连 PostgreSQL,Storage REST API 不启用。

2. **两个候选 Storage gateway 都不可达**(用 curl 主动 ping 验证):

   | Endpoint | 状态 |
   |---|---|
   | `http://127.0.0.1:8000/` (本地 self-hosted) | gateway 在线(HTTP 401),但 `/storage/v1/` 子路径 5s 超时 → storage 子服务未启 |
   | `https://supabase-byakmiyz.sealosbja.site/storage/v1/` (Sealos 远程) | HTTP 503 → 实例已下线 |

   所以即便临时启用注释里的 URL/key 也跑不了,问题不只是环境变量缺失,是底层 Storage 服务不在线。

## 后续 implication

P3 实施前必须解决之一(按优先级):

1. **首选 — 启用本地 self-hosted Storage 子服务**:user 在本地 docker-compose 里把 storage 容器拉起来,在 `.env.local` 取消注释 `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:8000/` + `SUPABASE_SERVICE_ROLE_KEY=...`,重跑 `npx tsx scripts/spike-storage-upload.ts` 拿到真实配额数字。
2. **备选 — 用云端 Supabase project**:在 Supabase Cloud 起 project,把 URL/key 填进 `.env.local`,跑 spike。开发环境跟生产对齐,实测最可信。
3. **保险路线(无依赖 spike 也能继续)**:**P3 Step 6 直接按 tier 拆 4 文件**(central / industry / municipal / district),每文件预期 ≤ 80MB(单 tier 一年最大估算)。这条路线即便配额是 50MB 默认值也安全,牺牲一次"少一个 zip 打包"便利换稳健。Plan 里已计划"按 tier 拆 4 文件"作为兜底,与本结论一致。

## 不阻塞 P0 总结的理由

- P0.1 (docx 图片嵌入) + P0.2 (chartjs-node-canvas 字体) 已 PASS — 两个最关键的"会不会有库不能用"的风险已消除
- P0.3 的 spike 目的是"提前确认 Storage 配额是否需要拆文件",**不是 hard gate**:即便不实测,P3 按 tier 拆 4 文件的保守方案天然规避配额风险
- BLOCKED 不是 implementer 实施问题,是本地环境配置问题,需要 user 决定开发模式

## 行动建议

P1 继续推进。P3 实施前(预计 ~7 天后),user 把 Supabase Storage 服务配置好,重跑 `npx tsx scripts/spike-storage-upload.ts` 一次,把结果追加到本文档底部。若 80MB / 120MB 都 PASS,P3 Step 6 可不拆文件;否则按 tier 拆。
