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
  runtime:
    type: api_call
    avgLatencyMs: 5000
    maxConcurrency: 8
    timeoutMs: 30000
  requires:
    env:
      - AIGC_HOST
      - AIGC_TOKEN
      - AIGC_PROVIDER
      - AIGC_CALLBACK_SECRET
      - NEXT_PUBLIC_APP_URL
    dependencies:
      - provider.register (至少注册一个 AigcVideoProvider)
---

# AIGC 脚本推送（aigc_script_push）

## Language

输出语言**简体中文**；日志/错误中文；HTTP 层使用 UTF-8。

## When to Use

✅ **应调用场景**：
- 视频/音频脚本已生成且通过审核（新闻视频、种草、探店、播客、短剧等）
- 需要把脚本提交给外部 AIGC 平台进行渲染/音频合成
- 重试已失败的推送任务（手动触发）

❌ **不应调用场景**：
- 脚本未通过审核（`script.status != "approved"`）
- 纯图文稿（应直接走 `cms_publish`，不走 AIGC）
- 脚本 schema 校验失败（必须先修复）
- AIGC Provider 不可达（Pre-flight 失败时不强推）

## Input Schema

```typescript
export const AigcScriptPushInputSchema = z.object({
  // 脚本本体（5 种之一）
  scriptPayload: z.union([
    NewsVideoScriptSchema,
    ZhongcaoScriptSchema,
    TandianScriptSchema,
    PodcastAudioScriptSchema,
    DuanjuScriptSchema,
  ]),
  // 可选：指定 provider（默认 env AIGC_PROVIDER）
  providerId: z.string().optional(),
  // 关联 mission（便于任务中心展示）
  missionId: z.string().uuid().optional(),
  // 关联 article（如有配套图文稿）
  articleId: z.string().uuid().optional(),
  // 触发源
  triggerSource: z.enum(["manual", "workflow", "scheduled", "daily_plan"]).default("workflow"),
  // 操作者
  operatorId: z.string(),
  // 扩展元数据（追溯用，会回传给 provider）
  metadata: z.record(z.string()).optional(),
});
```

## Output Schema

```typescript
export const AigcScriptPushOutputSchema = z.object({
  success: z.boolean(),
  submissionId: z.string().uuid(),        // aigc_submissions.id
  providerJobId: z.string().optional(),   // provider 返回的 jobId
  state: z.enum(["submitting", "submitted", "failed"]),
  estimatedCompleteAt: z.string().optional(),  // ISO
  callbackUrl: z.string().url(),           // 本次推送用的回调地址
  provider: z.string(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    stage: z.enum(["validation", "provider_select", "submit", "persist"]),
    retriable: z.boolean(),
  }).optional(),
});
```

## Pre-flight Check

```bash
# Check 1: 环境变量
[ -n "$AIGC_HOST" ] && [ -n "$AIGC_TOKEN" ] && [ -n "$AIGC_PROVIDER" ] && [ -n "$AIGC_CALLBACK_SECRET" ]

# Check 2: Provider 已注册
# 代码内：getProvider(providerId) !== undefined

# Check 3: Provider 健康检查（非强制）
# provider.healthCheck() → ok: true

# Check 4: 脚本必填字段（schema 层已做，此处再次确认）
# scriptPayload.scriptId, scriptPayload.scenario, scriptPayload.type

# Check 5: 回调地址可构造
[ -n "$NEXT_PUBLIC_APP_URL" ]
```

### 失败处理

| Check | 失败 | 处理 |
|-------|------|------|
| 1 | env 缺失 | `throw AigcConfigError("env not set")`；不重试 |
| 2 | provider 未注册 | `throw AigcConfigError("provider_not_registered: ${id}")`；不重试 |
| 3 | healthCheck 失败 | 写 warning；**仍继续推送**（provider 可能短暂抖动）；超时策略由 Inngest 兜底 |
| 4 | schema 无效 | `throw AigcSchemaError`；不重试；返回详细字段错误 |
| 5 | 回调 URL 不可构造 | `throw AigcConfigError("callback url unresolved")`；不重试 |

## Workflow Checklist

```
AIGC 推送进度：
- [ ] Step 0: 加载 Provider + 配置
- [ ] Step 1: 脚本 Schema 校验（zod）
- [ ] Step 2: 生成幂等 key + 回调 URL
- [ ] Step 3: 查重（同 key 是否已推送过）
- [ ] Step 4: 落库 aigc_submissions（state=submitting）
- [ ] Step 5: 调用 provider.submit
- [ ] Step 6: 更新 state=submitted + 记录 jobId
- [ ] Step 7: 触发 Inngest 超时监控事件
- [ ] Step 8: 通知 mission / SSE 任务中心
```

### Step 0: 加载 Provider + 配置

```typescript
const providerId = input.providerId ?? process.env.AIGC_PROVIDER ?? "huashengyun";
const provider = getProvider(providerId);
if (!provider) throw new AigcConfigError(`provider_not_registered: ${providerId}`);

// 检查脚本类型是否受 provider 支持
if (!provider.supportedScriptTypes.includes(input.scriptPayload.type)) {
  throw new AigcConfigError(
    `provider ${provider.id} does not support script type ${input.scriptPayload.type}`
  );
}
```

### Step 1: 脚本 Schema 校验

```typescript
const schema = getSchemaFor(input.scriptPayload.type);
const parsed = schema.parse(input.scriptPayload); // zod throws on invalid
```

**宽松策略**：schema 层只管结构，不卡内容（内容质量由脚本生成 skill 保证）。

### Step 2: 生成幂等 key + 回调 URL

```typescript
const idempotencyKey = `${parsed.scriptId}-${provider.id}`;
const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/aigc-video/callback?key=${encodeURIComponent(idempotencyKey)}`;
```

**idempotency key 设计原则**：
- 基于 `scriptId + providerId`，保证同一脚本送同一 provider 多次只产生一条推送
- 跨 provider 推送（如 A/B 测试）视为不同任务
- 若需重发相同脚本到同一 provider（场景：之前失败），通过 `retry=true` 参数清除旧 key 后重建

### Step 3: 查重

```typescript
const existing = await db.query.aigcSubmissions.findFirst({
  where: eq(aigcSubmissions.idempotencyKey, idempotencyKey),
});

if (existing) {
  if (["submitted", "rendering", "rendered", "cms_published", "app_published"].includes(existing.state)) {
    // 已成功推送；直接返回
    return {
      success: true,
      submissionId: existing.id,
      providerJobId: existing.providerJobId,
      state: existing.state,
      callbackUrl: existing.callbackUrl,
      provider: existing.providerId,
    };
  }
  if (existing.state === "failed" && !input.retry) {
    // 之前失败且未请求重试
    throw new AigcRetryRequiredError("previous submission failed, pass retry=true to re-attempt");
  }
  // state=submitting → 并发冲突，行锁等待
  // state=failed + retry=true → 进 Step 4 覆写
}
```

### Step 4: 落库 aigc_submissions

```typescript
const [record] = await db.insert(aigcSubmissions).values({
  scriptId: parsed.scriptId,
  missionId: input.missionId,
  articleId: input.articleId,
  providerId: provider.id,
  scenario: parsed.scenario,
  scriptType: parsed.type,
  state: "submitting",
  scriptPayload: parsed,
  idempotencyKey,
  callbackUrl,
  operatorId: input.operatorId,
  triggerSource: input.triggerSource,
  metadata: input.metadata,
}).onConflictDoUpdate({
  target: aigcSubmissions.idempotencyKey,
  set: { state: "submitting", lastAttemptAt: new Date() }, // 用于 retry
}).returning();
```

### Step 5: 调用 provider.submit

```typescript
try {
  const result = await provider.submit(parsed, {
    idempotencyKey,
    callbackUrl,
    metadata: { ...input.metadata, submissionId: record.id, scenario: parsed.scenario },
  });
  // 进 Step 6
} catch (err) {
  await db.update(aigcSubmissions).set({
    state: "failed",
    errorMessage: String(err),
    failedAt: new Date(),
  }).where(eq(aigcSubmissions.id, record.id));

  // 错误分类决定是否重试
  if (isRetriableError(err)) {
    await scheduleRetry(record.id);  // Inngest
  }
  throw err;
}
```

### Step 6: 更新 state=submitted

```typescript
await db.update(aigcSubmissions).set({
  state: "submitted",
  providerJobId: result.jobId,
  submittedAt: result.acceptedAt,
  estimatedCompleteAt: result.estimatedCompleteAt,
  rawResponse: result.rawResponse,
}).where(eq(aigcSubmissions.id, record.id));
```

### Step 7: 触发 Inngest 超时监控

```typescript
await inngest.send({
  name: "aigc/submission.submitted",
  data: {
    submissionId: record.id,
    estimatedCompleteAt: result.estimatedCompleteAt?.toISOString(),
    providerJobId: result.jobId,
  },
});
```

Inngest 函数 `aigc-submission-timeout` 会在 ETA + 2h 后检查是否仍为中间态，若是则标记 failed + 告警。

### Step 8: 通知 mission / SSE

```typescript
if (input.missionId) {
  await notifyMissionChannel(input.missionId, {
    type: "aigc_submission_created",
    submissionId: record.id,
    providerJobId: result.jobId,
    provider: provider.id,
    estimatedCompleteAt: result.estimatedCompleteAt,
  });
}

await db.insert(workflowArtifacts).values({
  missionId: input.missionId,
  artifactType: "aigc_submission",
  title: `AIGC 推送：${parsed.title}`,
  content: { submissionId: record.id, providerJobId: result.jobId },
  producerEmployeeId: input.operatorId,
});
```

## Decision Table（Provider 路由策略）

| 场景 | 默认 Provider | 触发条件 |
|------|--------------|--------|
| 视频类脚本（news/zhongcao/tandian/duanju/zongyi）| `huashengyun` | env `AIGC_PROVIDER` 默认 |
| 音频类脚本（podcast_audio） | `huashengyun` | 同上 |
| 临时测试/本地开发 | `mock` | `NODE_ENV=test` 或 `AIGC_PROVIDER=mock` |
| 未来扩展：kie.ai / 可灵 / Runway / Sora | 按场景路由 | 独立配置中心（后续模块） |

**路由决策逻辑**：
```typescript
function routeProvider(scriptType: ScriptType, config?: RoutingConfig): string {
  // 1. 用户显式指定
  if (config?.providerId) return config.providerId;
  // 2. 按场景 routing table 查找
  if (config?.scenarioRouting?.[scriptType]) return config.scenarioRouting[scriptType];
  // 3. 默认 env
  return process.env.AIGC_PROVIDER ?? "huashengyun";
}
```

## HTTP 接口签名（占位 — 待华栖云正式文档）

```bash
# 推送脚本
curl -X POST "${AIGC_HOST}/script/submit" \
  -H "Authorization: Bearer ${AIGC_TOKEN}" \
  -H "X-Idempotency-Key: <idempotencyKey>" \
  -H "Content-Type: application/json" \
  -d '{
    "scriptType": "news_video",
    "scriptBody": { /* ... */ },
    "callbackUrl": "https://vibetide.example.com/api/aigc-video/callback?key=...",
    "metadata": { "submissionId": "...", "scenario": "news_standard" }
  }'

# 预期响应
{
  "jobId": "aigc-job-12345",
  "acceptedAt": "2026-04-18T10:00:00Z",
  "estimatedSeconds": 300
}

# 回调（AIGC → VibeTide）
# POST https://vibetide.example.com/api/aigc-video/callback?key=xxx
# Header: X-Aigc-Signature: <hmac_sha256(rawBody, CALLBACK_SECRET)>
# Body: { event, jobId, occurredAt, videoUrl?, cmsArticleId?, ... }
```

## 幂等性 & 重试

### 幂等原则

| 场景 | 行为 |
|------|------|
| 同 `idempotencyKey` 多次推送（非 retry） | 直接返回已有记录 |
| 同 key + retry=true + 上次 failed | 覆写记录并重新推送 |
| 同 key + 上次成功 | 直接返回（幂等） |

### 重试错误分类

| 错误类型 | 是否重试 | 退避 |
|---------|---------|------|
| 网络超时 / DNS / 5xx | ✓ | 1s/2s/4s |
| Provider 限流（429） | ✓ | 60s/120s/300s |
| 鉴权 401 | ✗ | — |
| Schema 错误 | ✗ | — |
| Provider 不支持此脚本类型 | ✗ | — |
| 未知 4xx | ✗ | — |

## Provider 扩展路径

未来添加新 Provider（比如 kie.ai）的步骤：

```typescript
// 1. 实现 AigcVideoProvider 接口
class KieProvider implements AigcVideoProvider {
  readonly id = "kie" as const;
  readonly displayName = "kie.ai";
  readonly supportedScriptTypes = ["zhongcao_video", "tandian_video"];

  async submit(payload, options) { /* ... */ }
  async getStatus(jobId) { /* ... */ }
  async healthCheck() { /* ... */ }
}

// 2. 在 initAigcProviders() 注册
if (process.env.KIE_API_KEY) {
  registerProvider(new KieProvider({ apiKey: process.env.KIE_API_KEY }));
}

// 3. 配置 routing（EXTEND.md 或管理 UI）
// scenarioRouting: { zhongcao_video: "kie" }
```

## EXTEND.md 用户配置

```yaml
# .vibetide-skills/aigc_script_push/EXTEND.md

# Provider 路由策略
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
callback_allowed_ips: []        # 为空表示不限制

# 超时监控
submission_timeout_extra_hours: 2   # ETA + N 小时仍未完成 → 失败
```

## Feature Comparison（多 Provider 能力表）

| Feature | huashengyun | kie.ai（未来） | 可灵（未来） | Runway（未来） | mock |
|---------|-------------|---------------|------------|---------------|------|
| 新闻视频 | ✓ | — | ✓ | ✓ | ✓ |
| 种草视频 | ✓ | ✓ | ✓ | ✗ | ✓ |
| 探店视频 | ✓ | ✓ | ✓ | ✗ | ✓ |
| 播客音频 | ✓ | ✗ | ✗ | ✗ | ✓ |
| 短剧视频 | ✓ | ✗ | ✓ | ✗ | ✓ |
| 回调支持 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 状态查询 | TBD | ✓ | ✓ | ✓ | ✓ |
| 签名验证 | HMAC-SHA256 | HMAC-SHA256 | Token | Token | 无 |
| 成本 | 内部 | $X/次 | ¥Y/次 | $Z/次 | 0 |

## Troubleshooting

| 问题 | 原因 | 解决 |
|------|------|------|
| `provider_not_registered` | Provider 未在应用启动时注册 | 1) 检查 env `AIGC_PROVIDER` 值；2) 检查 `initAigcProviders()` 是否被调用；3) 检查对应 env 是否齐全 |
| `AigcSchemaError: type=xxx invalid` | 脚本 schema 不合法 | 查看错误字段明细；检查上游脚本生成 skill 输出；运行 schema test |
| 推送后长时间无回调 | AIGC 服务未回调 / 回调 URL 错误 | 1) 检查 `NEXT_PUBLIC_APP_URL`；2) 验证 AIGC 侧 callback 配置；3) Inngest 超时兜底会标 failed |
| 回调签名错误 | `AIGC_CALLBACK_SECRET` 与 AIGC 侧不一致 | 同步密钥 |
| 429 限流频繁 | 并发推送过多 | 调整 `maxConcurrency`；分散到不同时间段 |
| 任务中心看不到状态 | SSE 未广播 / missionId 未关联 | 1) 检查 `input.missionId` 是否传入；2) 检查 SSE 通道是否连接 |
| mock provider 本地测试不触发回调 | mock 不发回调 | 本地用 `curl` 手动 POST 回调 endpoint 测试闭环 |

## Quality Self-Eval Checklist

- [ ] Schema 校验通过
- [ ] providerJobId 非空
- [ ] callbackUrl 可解析
- [ ] submittedAt 时间合理
- [ ] estimatedCompleteAt 存在（provider 支持时）
- [ ] Inngest 超时事件已发
- [ ] SSE 已通知（如有 missionId）
- [ ] 记录完整存入 `aigc_submissions`

## Completion Report

```
🚀 AIGC 推送完成！

📜 脚本
   • 类型：{scriptPayload.type}
   • 场景：{scriptPayload.scenario}
   • 标题：{scriptPayload.title}

🎬 推送目标
   • Provider：{provider.displayName}
   • Job ID：{providerJobId}
   • 预计完成：{estimatedCompleteAt ?? "未知（依回调）"}

📡 回调监听
   • URL：{callbackUrl}
   • 签名：HMAC-SHA256
   • 超时兜底：ETA + 2h

📊 记录
   • Submission ID：{submissionId}
   • State：{state}
   • 关联 Mission：{missionId ?? "—"}

📝 后续
   → 任务中心实时展示 AIGC 进度
   → 收到回调时自动更新（rendering → rendered → cms_published → app_published）
   → 超时或失败时告警 + 人工处理入口
```

## 上下游协作

### 上游
- `zhongcao_script` / `tandian_script` / `podcast_script` / `duanju_script` / `zongyi_highlight` / `script_generate` → 产出脚本
- `quality_review`（严档） → 审核通过
- `compliance_check` → 合规检查通过

### 下游
- AIGC Provider（华栖云等）→ 渲染 + 入 CMS + APP 发布（异步）
- `aigc-video-callback` API endpoint → 接收阶段性回调
- 任务中心 SSE → 实时展示

## Changelog

| Version | Date | 变更 |
|---------|------|------|
| 1.0.0 | 2026-04-18 | 初版；多 Provider 抽象 + 回调闭环 |

## 开放问题

- Q1：华栖云正式接口文档到位后需要调整 schema
- Q2：Provider 成本追踪（未来引入计费字段）
- Q3：批量推送 API（当前单脚本）
- Q4：A/B 多 Provider 对比实验机制

## 参考实现文件

| 文件 | 路径 |
|------|------|
| Skill Runtime | `src/lib/agent/tools/aigc-script-push.ts` |
| Provider 抽象 | `src/lib/aigc-video/provider.ts` |
| 华栖云 Provider | `src/lib/aigc-video/providers/huashengyun.ts` |
| Submission 逻辑 | `src/lib/aigc-video/submission.ts` |
| Callback API | `src/app/api/aigc-video/callback/route.ts` |
| Timeout Inngest | `src/inngest/functions/aigc-submission-timeout.ts` |
| DAL | `src/lib/dal/aigc-submissions.ts` |
