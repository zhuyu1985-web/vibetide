# 任务中心全链路打通实施计划

## Phase 1: 修复核心执行引擎

### Step 1.1: 注入协作工具
- Modify: `src/lib/mission-executor.ts` — executeTaskDirect 中调用 createMissionTools 并合并到工具集
- Modify: `src/inngest/functions/execute-mission-task.ts` — 同上

### Step 1.2: 实现 content_generate 和 fact_check
- Modify: `src/lib/agent/tool-registry.ts` — 替换 mock 实现，用 AI SDK generateText

### Step 1.3: 持久化产物
- Modify: `src/lib/mission-executor.ts` — 任务完成后写入 missionArtifacts
- Modify: `src/inngest/functions/execute-mission-task.ts` — 同上

### Step 1.4: 实时进度更新
- Modify: `src/lib/mission-executor.ts` — 任务完成后更新 missions.progress

## Phase 2: 跨模块触发 API

### Step 2.1: 新增 sourceModule 字段
- Modify: `src/db/schema/missions.ts` — 添加 source_module, source_entity_id, source_entity_type 列
- Create: `supabase/migrations/0011_mission_source_module.sql`
- Modify: `src/lib/types.ts` — Mission 类型增加字段

### Step 2.2: 创建 startMissionFromModule
- Modify: `src/app/actions/missions.ts` — 新增 startMissionFromModule server action

### Step 2.3: 接入灵感雷达
- Modify: `src/app/actions/hot-topics.ts` — 高热度话题自动触发任务

### Step 2.4: 接入全渠道发布
- Modify: `src/inngest/functions/publishing-events.ts` — 审核/异常事件触发任务

### Step 2.5: 接入对标监控
- Modify: `src/app/actions/competitor-alerts.ts` — 竞品预警触发任务

### Step 2.6: 接入数据分析
- Modify: `src/inngest/functions/analytics-report.ts` — 定期报告触发任务

## Phase 3: UI 集成

### Step 3.1: 任务列表显示来源徽章
- Modify: `src/app/(dashboard)/missions/missions-client.tsx` — MissionRow 显示来源模块
- Modify: `src/lib/dal/missions.ts` — MissionSummary 增加 sourceModule 字段

### Step 3.2: 任务详情显示来源信息
- Modify: `src/app/(dashboard)/missions/[id]/mission-console-client.tsx` — ScenarioInfoCard 显示来源

### Step 3.3: 各模块添加触发按钮
- Modify: `src/app/(dashboard)/inspiration/page.tsx` — 灵感池"一键追踪"
- Modify: `src/app/(dashboard)/benchmarking/benchmarking-client.tsx` — 对标"创建应对方案"
