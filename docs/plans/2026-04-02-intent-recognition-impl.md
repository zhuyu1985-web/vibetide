# Intent Recognition System — Implementation Plan

## Phase 1: DB Schema + Core Recognition Engine

### Step 1.1: intent_logs table
- Create `src/db/schema/intent-logs.ts` with intent_logs table
- Add export to `src/db/schema/index.ts`
- Run `npm run db:push`

### Step 1.2: Intent recognition core
- Create `src/lib/agent/intent-recognition.ts`
- Implement `recognizeIntent(message, employeeSlug, userIntentHistory, availableEmployees)` function
- Build structured prompt that outputs IntentResult JSON
- Include intent type taxonomy, employee roster with skills, user's recent intent memories
- Parse and validate LLM response with fallback to `general_chat`

### Step 1.3: Intent recognition API
- Create `src/app/api/chat/intent/route.ts`
- Auth + org lookup (same pattern as chat/stream)
- Load user's recent 10 intent logs from DB
- Load available employees + skills
- Call `recognizeIntent()`, return IntentResult
- Log to intent_logs table

## Phase 2: Multi-Step Execution Engine

### Step 2.1: Modify assembleAgent for skill overrides
- Add optional `skillOverrides?: string[]` parameter to `assembleAgent()`
- When provided, filter tools to only include the specified skills
- Keep system prompt and memories intact

### Step 2.2: Intent execution API
- Create `src/app/api/chat/intent-execute/route.ts`
- Accept `{ message, intent: IntentResult, conversationHistory }`
- Implement sequential step execution loop:
  - For each step: assembleAgent with skillOverrides → streamText
  - Emit `step-start` / `step-complete` SSE events between steps
  - Pass prior step output as context to next step
- Single-step intents: same flow as current chat/stream but with filtered tools
- Wrap everything in robust error handling (outer try-catch, controller guards)

### Step 2.3: Update chat-utils.ts
- Add `step-start` and `step-complete` SSE event types
- Add callbacks: `onStepStart`, `onStepComplete` to StreamingChatCallbacks
- Update `executeStreamingChat` to handle new events

## Phase 3: Client-Side Integration

### Step 3.1: Intent hint bar component
- Create `src/components/chat/intent-hint-bar.tsx`
- Compact bar showing: intent summary + employee chain icons + "执行中..." / "取消"
- Auto-dismiss after execution starts
- Animate in from top of chat area

### Step 3.2: Intent card component
- Create `src/components/chat/intent-card.tsx`
- Editable card for low-confidence intents
- Show: intent summary, step list with employee avatars, skill tags
- Allow: reorder steps, remove steps, confirm/cancel
- Compact design matching existing chat bubble style

### Step 3.3: Integrate into chat-center-client.tsx
- Modify `handleSendMessage` flow:
  1. Call `/api/chat/intent` with user message
  2. If confidence >= 0.8: show hint bar, auto-call `/api/chat/intent-execute`
  3. If confidence < 0.8: show intent card, wait for user action
  4. If intentType === "general_chat": fall through to existing `/api/chat/stream`
- Add state for: `pendingIntent`, `showIntentCard`, `intentLoading`

### Step 3.4: Update chat-panel.tsx
- Render IntentHintBar above message area during auto-execution
- Render IntentCard as a message-like bubble for low-confidence intents
- Handle `step-start` / `step-complete` events to show employee switching UI
- Show "小雷正在搜索... → 小文正在创作..." progress indicators

## Phase 4: Memory & Polish

### Step 4.1: Intent memory injection
- In intent recognition prompt, inject user's recent intent logs as few-shot examples
- Format: "用户说'{message}' → 意图: {intentType}, 技能: {skills}"
- After execution, update intent_logs with execution_success based on user behavior

### Step 4.2: Scenario integration
- When intent matches an existing scenario closely, show it as a suggestion
- Scenario cards in empty chat state remain as quick shortcuts
- Add "推荐场景" badge when intent aligns with a scenario

## Verification

After each phase:
1. `npx tsc --noEmit` — Type check passes
2. `npm run build` — Production build passes
3. Manual test in browser
