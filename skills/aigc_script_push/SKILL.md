---
name: aigc_script_push
displayName: AIGC 脚本推送
description: 把 VibeTide 生成的视频/音频脚本通过统一 Provider 抽象推送到外部 AIGC 渲染平台（当前支持华栖云自研，未来可扩展 kie.ai / 可灵 / Runway / Sora）。包含脚本 schema 校验、provider 路由、幂等推送、状态机、回调监听、任务中心闭环展示。当用户提及"推送到 AIGC""提交渲染""生成视频""把脚本送去"时调用。
version: 1.0.0
category: management

metadata:
  skill_kind: action  # DB enum 只有 6 个 category，action 作为 management 下的细分 kind
  scenario_tags: [news, politics, sports, variety, livelihood, podcast, drama]
  compatibleEmployees: [xiaojian, xiaowen, xiaofa, leader]
  requires:
    env: [AIGC_HOST, AIGC_TOKEN, AIGC_PROVIDER, AIGC_CALLBACK_SECRET, NEXT_PUBLIC_APP_URL]
    knowledgeBases: []
    dependencies: [provider.register]
  implementation:
    scriptPath: src/app/actions/
    testPath: src/lib/cms/__tests__/
  openclaw:
    referenceSpec: docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md
---

# AIGC 脚本推送（aigc_script_push）

## 使用条件

✅ **应调用场景**：
- 视频/音频脚本已生成且通过审核（新闻视频、种草、探店、播客、短剧等）
- 需要把脚本提交给外部 AIGC 平台进行渲染/音频合成
- 重试已失败的推送任务（手动触发）

❌ **不应调用场景**：
- 脚本未通过审核（`script.status != "approved"`）
- 纯图文稿（应走 `cms_publish`，不走 AIGC）
- 脚本 schema 校验失败（必须先修复）
- AIGC Provider 不可达（Pre-flight 失败时不强推）

**前置依赖**：env 齐全；至少注册一个 `AigcVideoProvider`；上游已产出 `approved` 脚本。

## 输入 / 输出

**输入简要表：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| scriptPayload | 5 种脚本 union | ✓ | news / zhongcao / tandian / podcast / duanju 脚本之一 |
| providerId | string | ✗ | 指定 provider（默认 env `AIGC_PROVIDER`） |
| missionId | uuid | ✗ | 关联 mission（便于任务中心展示） |
| articleId | uuid | ✗ | 关联 article（如有配套图文稿） |
| triggerSource | enum | ✗ | `manual` / `workflow` / `scheduled` / `daily_plan`，默认 `workflow` |
| operatorId | string | ✓ | 操作者（AI 员工 slug 或 user id） |
| metadata | record | ✗ | 追溯用，会回传给 provider |

**输出简要表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| success | boolean | 提交是否成功 |
| submissionId | uuid | `aigc_submissions.id` |
| providerJobId | string | provider 返回的 jobId |
| state | enum | `submitting` / `submitted` / `failed` |
| estimatedCompleteAt | ISO string | provider 预估完成时间（可选） |
| callbackUrl | url | 本次推送用的回调地址 |
| provider | string | 使用的 provider id |
| error | object | `{ code, message, stage, retriable }`（失败时） |

完整 Zod Schema 与类型定义见 [scriptPath 对应实现文件](../../src/app/actions/)。

## Provider 架构（多 provider 抽象）

VibeTide 对 AIGC 渲染平台做统一抽象，所有 provider 实现 `AigcVideoProvider` 接口。当前仅华栖云自研落地，kie.ai / 可灵 / Runway / Sora 为未来扩展位。

**接口契约：**

```typescript
interface AigcVideoProvider {
  readonly id: string;              // "huashengyun" / "kie" / "keling" / "runway" / "sora" / "mock"
  readonly displayName: string;
  readonly supportedScriptTypes: ScriptType[];

  submit(payload: ScriptPayload, opts: SubmitOptions): Promise<SubmitResult>;
  getStatus(jobId: string): Promise<ProviderStatus>;
  healthCheck(): Promise<{ ok: boolean; latencyMs?: number }>;
}
```

**默认注册流程（`initAigcProviders()`）：**

| Provider | 注册条件 | 支持脚本类型 | 回调签名 |
|---------|---------|------------|---------|
| huashengyun | `AIGC_HOST` + `AIGC_TOKEN` | 全部（news / zhongcao / tandian / podcast / duanju / zongyi） | HMAC-SHA256 |
| kie | `KIE_API_KEY`（未接入） | zhongcao_video / tandian_video | HMAC-SHA256 |
| keling | `KELING_API_KEY`（未接入） | news_video / zhongcao_video / tandian_video / duanju_video | Token |
| runway | `RUNWAY_API_KEY`（未接入） | news_video / zhongcao_video | Token |
| sora | `SORA_API_KEY`（未接入） | news_video / duanju_video | Token |
| mock | `NODE_ENV=test` 或 `AIGC_PROVIDER=mock` | 全部 | 无 |

**路由决策（`routeProvider`）：** 用户显式 `providerId` → `scenarioRouting[scriptType]`（EXTEND.md 配置）→ env `AIGC_PROVIDER` 默认。

## 工作流 Checklist

- [ ] Step 0: 加载 Provider 配置，校验 `supportedScriptTypes`
- [ ] Step 1: 脚本 zod schema 校验（宽松策略：只查结构，不卡内容）
- [ ] Step 2: 生成幂等 key（`${scriptId}-${providerId}`）+ 回调 URL
- [ ] Step 3: 查重 `aigc_submissions.idempotency_key`，已成功则直接返回；失败 + `retry=true` 进 Step 4 覆写
- [ ] Step 4: 落库 `aigc_submissions`（state=submitting），行锁 `FOR UPDATE SKIP LOCKED`
- [ ] Step 5: 调用 `provider.submit(payload, { idempotencyKey, callbackUrl, metadata })`
- [ ] Step 6: 更新 state=submitted + 记录 `providerJobId` / `submittedAt` / `estimatedCompleteAt`
- [ ] Step 7: 触发 Inngest `aigc/submission.submitted` 事件（ETA + 2h 超时兜底）
- [ ] Step 8: 写入 `workflow_artifacts` + SSE 通知任务中心

## HTTP 接口签名（华栖云占位契约）

```bash
# 推送
POST ${AIGC_HOST}/script/submit
  Authorization: Bearer ${AIGC_TOKEN}
  X-Idempotency-Key: <idempotencyKey>
  Body: { scriptType, scriptBody, callbackUrl, metadata }
→ { jobId, acceptedAt, estimatedSeconds }

# 回调（AIGC → VibeTide）
POST ${NEXT_PUBLIC_APP_URL}/api/aigc-video/callback?key=<idempotencyKey>
  X-Aigc-Signature: hmac_sha256(rawBody, AIGC_CALLBACK_SECRET)
  Body: { event, jobId, occurredAt, videoUrl?, cmsArticleId? }
```

## 幂等 & 重试

**幂等原则：** `idempotencyKey = ${scriptId}-${providerId}`。同 key 多次推送非 `retry` → 直接返回已有记录；同 key + 上次 failed + `retry=true` → 覆写重发；跨 provider 视为不同任务。

**重试错误分类：**

| 错误类型 | 是否重试 | 退避 |
|---------|---------|------|
| 网络超时 / DNS / 5xx | ✓ | 1s / 2s / 4s |
| 限流 429 | ✓ | 60s / 120s / 300s |
| 鉴权 401 / Schema 错误 / 不支持脚本类型 / 其他 4xx | ✗ | — |

**Inngest 超时兜底：** `aigc-submission-timeout` 在 `estimatedCompleteAt + 2h` 检查仍在中间态则标 failed + 告警。

## 质量把关

**自检阈值表：**

| # | 检查点 | 通过条件 |
|---|-------|---------|
| 1 | Schema 校验 | zod 通过 |
| 2 | providerJobId 返回 | 非空字符串 |
| 3 | callbackUrl 可解析 | URL 合法 + host 在 `NEXT_PUBLIC_APP_URL` 域内 |
| 4 | submittedAt 合理 | 不早于 now - 60s |
| 5 | Inngest 超时事件已发 | event id 返回 |
| 6 | SSE 已通知（如有 missionId） | channel push 成功 |
| 7 | `aigc_submissions` 记录完整 | state / providerJobId / idempotencyKey 均写入 |

**Top-3 典型失败模式：**

| 失败模式 | 表现 | 修正 hint |
|---------|------|----------|
| provider_not_registered | 抛 `AigcConfigError`，env `AIGC_PROVIDER` 对应 provider 未 `initAigcProviders()` 注册 | 检查 env 齐全 + `initAigcProviders()` 是否在启动时调用 |
| 推送后长时间无回调 | submission 卡在 `submitted`，callback 一直没到 | 1) 检查 `NEXT_PUBLIC_APP_URL`；2) AIGC 侧 callback 配置；3) 等 Inngest 超时兜底 |
| 回调签名错误 | callback API 返回 403 | 同步 `AIGC_CALLBACK_SECRET` 与 provider 侧密钥 |

## 输出模板 / 示例

```json
{
  "success": true,
  "submissionId": "ed8f2a10-7b4c-4e1d-9c8f-3a5b7d9e0f12",
  "providerJobId": "aigc-job-12345",
  "state": "submitted",
  "estimatedCompleteAt": "2026-04-18T10:05:00Z",
  "callbackUrl": "https://vibetide.example.com/api/aigc-video/callback?key=scr_abc-huashengyun",
  "provider": "huashengyun"
}
```

## EXTEND.md 示例

```yaml
# .vibetide-skills/aigc_script_push/EXTEND.md

# Provider 路由
scenario_routing:
  news_video: huashengyun
  zhongcao_video: huashengyun   # 未来可切 kie
  duanju_video: huashengyun
  podcast_audio: huashengyun

# 推送策略
default_retry_on_failure: true
max_retries: 3
timeout_ms: 30000

# 回调安全
callback_require_signature: true
callback_allowed_ips: []

# 超时监控
submission_timeout_extra_hours: 2
```

## 上下游协作

- **上游**：`script_generate` / `zhongcao_script` / `tandian_script` / `podcast_script` / `duanju_script` / `zongyi_highlight` 产出脚本 → `quality_review`（严档）+ `compliance_check` 通过 → 本 skill
- **下游**：AIGC Provider 异步渲染 + 入 CMS + APP 发布 → `/api/aigc-video/callback` 接收阶段性回调 → 任务中心 SSE 实时展示 → `cms_publish` 消费回调里的 `cmsArticleId`

## 参考资料

- 实现入口：[src/app/actions/](../../src/app/actions/)（AIGC 推送相关 server actions 待落地）
- 测试目录：[src/lib/cms/__tests__/](../../src/lib/cms/__tests__/)
- 参考 Spec：[docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md](../../docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md)
- 历史版本：`git log --follow skills/aigc_script_push/SKILL.md`

- **媒体行业专业标准（共享）**：[../../docs/skills/media-industry-standards.md](../../docs/skills/media-industry-standards.md)

