# Intent Recognition System Design

## Overview

Build an intent recognition layer for the chat center that automatically understands user input, identifies required skills and employees, and routes execution accordingly. Replaces manual scenario selection with intelligent, transparent intent-driven routing.

## Architecture

```
User Input
  |
  v
[POST /api/chat/intent] -- DeepSeek structured JSON output
  |
  v
+-------------------------------+
| Layer 1: Intent Type          |
| information_retrieval /       |
| content_creation /            |
| data_analysis / ...           |
+-------------------------------+
| Layer 2: Skill + Employee     |
| Chain                         |
| xiaolei(web_search) ->        |
| xiaowen(content_generate)     |
+-------------------------------+
| Confidence Score 0~1          |
| >= 0.8 -> auto-execute        |
|    (inline hint bar)          |
| < 0.8  -> editable intent     |
|    card for user confirmation  |
+-------------------------------+
  |
  v
[POST /api/chat/intent-execute]
  Sequential employee execution,
  prior step output as next context
  |
  v
SSE stream (reuse existing protocol)
```

## Core Types

```typescript
// Intent recognition result
interface IntentResult {
  intentType: string;           // "content_creation" | "information_retrieval" | ...
  summary: string;              // "搜索AI领域热点并撰写深度分析"
  confidence: number;           // 0.0 ~ 1.0
  steps: IntentStep[];          // Execution chain
  reasoning: string;            // LLM reasoning (debug)
}

interface IntentStep {
  employeeSlug: EmployeeId;
  employeeName: string;
  skills: string[];             // ["web_search", "trend_monitor"]
  taskDescription: string;      // "搜索最近AI领域热点趋势"
  dependsOn?: number;           // Index of prerequisite step
}
```

## Intent Types

| Type | Description | Typical Skills |
|------|------------|----------------|
| `information_retrieval` | Search, aggregate, monitor | web_search, trending_topics, news_aggregation |
| `content_creation` | Write articles, scripts, headlines | content_generate, script_generate, headline_generate |
| `deep_analysis` | In-depth research and analysis | web_search, web_deep_read, sentiment_analysis, fact_check |
| `data_analysis` | Metrics, audience, competitor intel | audience_analysis, competitor_analysis, heat_scoring |
| `content_review` | Quality check, compliance, fact-check | quality_review, compliance_check, fact_check |
| `media_production` | Video, audio, layout planning | video_edit_plan, audio_plan, layout_design |
| `publishing` | Distribution strategy and execution | publish_strategy, task_planning |
| `general_chat` | Casual conversation, no specific skill needed | (none — free chat) |

## Data Flow

### Phase 1: Intent Recognition

Client sends user message to `POST /api/chat/intent`:

**Request:**
```json
{
  "message": "帮我查一下最近AI领域的热点，然后写一篇深度分析文章",
  "employeeSlug": "xiaolei",
  "recentIntents": []
}
```

**Server-side:**
1. Load user's recent 10 intent memories (few-shot examples)
2. Load all available employees + their skills for this org
3. Call DeepSeek with structured intent prompt → JSON output
4. Return IntentResult

**Response:**
```json
{
  "intentType": "deep_analysis",
  "summary": "搜索AI热点趋势 → 撰写深度分析文章",
  "confidence": 0.92,
  "steps": [
    {
      "employeeSlug": "xiaolei",
      "employeeName": "小雷",
      "skills": ["web_search", "trend_monitor", "heat_scoring"],
      "taskDescription": "搜索最近AI领域的热点趋势和重要事件"
    },
    {
      "employeeSlug": "xiaowen",
      "employeeName": "小文",
      "skills": ["content_generate", "web_deep_read"],
      "taskDescription": "基于热点搜索结果撰写深度分析文章",
      "dependsOn": 0
    }
  ],
  "reasoning": "用户需要先搜索热点信息再创作内容，属于典型的调研+写作流程"
}
```

### Phase 2: Client-Side Decision

```
confidence >= 0.8
  → Show inline hint bar: "已识别：小雷搜索热点 → 小文撰写分析"
  → Auto-start execution after 1.5s (user can click to cancel/edit)

confidence < 0.8
  → Show editable intent card:
    - Intent summary (editable)
    - Step list (can reorder, remove, change employee)
    - "Execute" / "Cancel" buttons
  → Wait for user confirmation
```

### Phase 3: Multi-Step Execution

Client sends confirmed intent to `POST /api/chat/intent-execute`:

**Request:**
```json
{
  "message": "帮我查一下最近AI领域的热点，然后写一篇深度分析文章",
  "intent": { ... },  // IntentResult (possibly user-edited)
  "conversationHistory": [...]
}
```

**Server-side execution loop:**
```
For each step in intent.steps:
  1. assembleAgent(employee, { skillOverrides: step.skills })
  2. Build step prompt = systemPrompt + step.taskDescription + priorStepOutput
  3. streamText() with step-specific tools
  4. Emit SSE events:
     - "step-start": { stepIndex, employeeSlug, employeeName, taskDescription }
     - "thinking" / "source" / "text-delta" (existing events)
     - "step-complete": { stepIndex, summary }
  5. Collect step output as context for next step
After all steps:
  - Emit "done" event
```

### Phase 4: User Memory

After execution completes, record to `intent_logs` table:
- User's original message
- Recognized intent type + skill combo
- Whether user edited the intent card
- Whether user continued chatting (satisfaction signal)

On next intent recognition, inject user's recent 10 intent logs as few-shot examples in the prompt.

## Database Schema

### New table: `intent_logs`

```sql
CREATE TABLE intent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  employee_slug TEXT NOT NULL,
  user_message TEXT NOT NULL,
  intent_type TEXT NOT NULL,
  intent_result JSONB NOT NULL,       -- Full IntentResult
  user_edited BOOLEAN DEFAULT false,  -- Did user modify the intent card?
  edited_intent JSONB,                -- Modified IntentResult if edited
  execution_success BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_intent_logs_user ON intent_logs(user_id, created_at DESC);
CREATE INDEX idx_intent_logs_org ON intent_logs(organization_id, created_at DESC);
```

## File Changes

| Type | File | Description |
|------|------|-------------|
| NEW | `src/lib/agent/intent-recognition.ts` | Core intent recognition: prompt building, LLM call, response parsing |
| NEW | `src/app/api/chat/intent/route.ts` | Intent recognition API endpoint |
| NEW | `src/app/api/chat/intent-execute/route.ts` | Multi-step intent execution API |
| NEW | `src/db/schema/intent-logs.ts` | intent_logs table schema |
| NEW | `src/components/chat/intent-hint-bar.tsx` | Lightweight auto-execute hint bar |
| NEW | `src/components/chat/intent-card.tsx` | Editable intent card for low-confidence |
| MOD | `src/app/(dashboard)/chat/chat-center-client.tsx` | Integrate intent flow before message send |
| MOD | `src/app/(dashboard)/chat/chat-panel.tsx` | Render intent hint bar / intent card |
| MOD | `src/lib/chat-utils.ts` | Handle `step-start` and `step-complete` SSE events |
| MOD | `src/lib/agent/assembly.ts` | Accept skill overrides from intent |
| MOD | `src/db/schema/index.ts` | Export intent-logs schema |

## Decisions

- **Model**: DeepSeek (same as chat) for intent recognition
- **Identification granularity**: Two-layer — intent type first, then skill + employee chain
- **Multi-employee**: Auto-switch with sequential execution, prior output as context
- **Transparency**: Confidence-driven — auto-execute at >= 0.8, editable card at < 0.8
- **Learning**: User-level memory via intent_logs, injected as few-shot examples

## Out of Scope

- Embedding/vector similarity matching (LLM classification sufficient)
- Model fine-tuning (prompt + few-shot memory approach)
- Parallel multi-employee execution (sequential for now)
- Changes to existing scenario system (scenarios remain as shortcuts)
