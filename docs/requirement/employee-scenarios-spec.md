# 员工预设场景（Employee Scenarios）— 产品需求与数据规约

**文档用途**：在需要删除/重写相关代码时，根据本文件能快速重建这个功能。包含**功能需求** + **现有 8 位员工的场景清单**（含欢迎词、输入参数、系统指令）。

**最后更新**：2026-04-20

---

## 1. 背景与定位

### 1.1 功能定位

"预设场景" 是每位 AI 员工暴露给用户的**一键触发任务入口**。用户无需写自由提示词，直接点场景 → 填简短参数 → 员工按预定义的"系统指令"执行。场景=**员工的 API 化能力**。

展示在：
- **首页（`/home`）**：用户选中员工后，输入框上方显示该员工的 3 个场景（聊天模式下显示全部）
- **对话中心（`/chat`）**：员工详情页顶部和底部列出该员工全部场景

### 1.2 角色边界

| 角色 | 场景能力 |
|---|---|
| 超管 / `ai:manage` 权限持有者 | 创建、编辑、启停、删除、重排序 |
| 普通用户 | 只读使用；不可编辑 |

---

## 2. 数据模型

### 2.1 数据库表 `employee_scenarios`

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | uuid | PK, defaultRandom | 主键 |
| `organization_id` | uuid | NOT NULL, FK→organizations | 多租户隔离 |
| `employee_slug` | text | NOT NULL | 员工唯一标识（如 `xiaolei`） |
| `name` | text | NOT NULL | 场景名称（UI 上展示的芯片文字） |
| `description` | text | NOT NULL | 一句话描述，场景详情页展示 |
| `icon` | text | NOT NULL, default 'Zap' | Lucide 图标名 |
| `welcome_message` | text | nullable | 进入场景时的第一条 assistant 消息（支持 Markdown 和 `{{var}}`） |
| `system_instruction` | text | NOT NULL | 发送给 LLM 的系统指令，支持 `{{var}}` 占位符 |
| `input_fields` | jsonb | default `[]` | 输入参数定义（见 2.2） |
| `tools_hint` | jsonb | default `[]` | 该场景倾向使用的技能工具名（数组） |
| `sort_order` | int | default 0 | 员工内场景排序 |
| `enabled` | bool | default true | 启用开关（停用的场景不展示给用户） |
| `created_at` / `updated_at` | timestamptz | default now() | 时间戳 |

**唯一索引**：`(organization_id, employee_slug, name)` — 同一员工下场景名不重复。

### 2.2 `input_fields` 结构

```ts
type InputFieldDef = {
  name: string;              // 变量名，合法 JS 标识符，用于 {{name}} 占位符
  label: string;             // UI 显示名
  type: "text" | "textarea" | "select";
  required: boolean;
  placeholder?: string;
  options?: string[];        // 仅 type=select 时使用
};
```

### 2.3 占位符规则

- 在 `system_instruction` 和 `welcome_message` 中可以用 `{{name}}` 引用输入参数
- 保存前强校验：所有 `{{foo}}` 必须在 `input_fields` 里有对应 `name`，否则拒绝保存
- 渲染时未填写的变量保留 `{{var}}` 文本（方便看到哪里没填）

---

## 3. 功能需求清单

### 3.1 浏览（所有登录用户）

- **R-1** 用户选中某员工时，首页/对话中心展示该员工的 `enabled=true` 场景列表，按 `sort_order ASC` 排列
- **R-2** 首页"普通模式"只显示前 3 个场景；点击展开进入"聊天模式"显示全部
- **R-3** 场景芯片显示 `icon + name`，悬停或长按显示 `description`

### 3.2 触发（所有登录用户）

- **R-4** 点击芯片：
  - 若 `input_fields` 为空 → 直接发送"执行场景：{name}"消息
  - 若 `input_fields` 非空 → 在对话区展示内联表单，要求填完再提交
- **R-5** 进入场景时（表单打开前），若 `welcome_message` 非空，作为首条 assistant 消息插入对话历史
- **R-6** 表单提交后，用户输入通过 `{{var}}` 替换注入 `system_instruction`，发送给 LLM
- **R-7** 场景触发的对话可正常保存到对话历史，与自由对话统一管理

### 3.3 管理（管理员 / `ai:manage` 权限）

- **R-8** 员工详情页（`/employee/[slug]`）新增 "预设场景" Tab
- **R-9** Tab 内容为场景列表，展示字段：名称/描述/参数数量/是否配欢迎词/启用开关/操作按钮
- **R-10** "新建场景" 按钮 → 打开编辑器抽屉（Sheet）
- **R-11** 编辑器分三段：
  - **基本信息**：名称 / 描述 / 图标（Lucide 选择器）/ 启用 / 排序
  - **欢迎词**（可选）：Textarea，提示支持 Markdown 和 `{{var}}`
  - **系统指令 + 输入参数**：Textarea + 动态字段组件（增删改、上下移）
- **R-12** 编辑器**实时校验**：`{{foo}}` 若未在 `input_fields` 中定义，显示黄色警告并禁用保存
- **R-13** 支持启用开关（软停用）与永久删除
- **R-14** 场景名称同员工下唯一，重名保存时给出清晰错误提示
- **R-15** 输入参数名必须是合法 JS 标识符且场景内唯一

### 3.4 搜索与排序（未来增强，v1 不做）

- 场景搜索
- 跨员工复制场景
- 场景版本历史与回滚
- 场景执行次数/成功率统计
- AI 辅助生成 `system_instruction`
- 场景模板市场

---

## 4. 权限模型

| 操作 | 所需权限 |
|---|---|
| 读（浏览、触发） | 登录即可 |
| 创建 / 更新 / 删除 / 启停 / 排序 | `ai:manage`（super admin 自动拥有所有权限） |

服务器端**统一校验**（不依赖前端），所有 server action 入口调 `requireManagePermission()`。

---

## 5. 现有 8 位员工 × 27 个场景 — 完整清单

以下是**种子数据**。重建时作为初始数据一次性 upsert 到 `employee_scenarios` 表。

---

### 5.1 小雷 (xiaolei) — 热点猎手（5 场景）

#### 5.1.1 全网热点扫描
- **icon**: `Radar`
- **welcome**: 你好，我是小雷。接下来我会帮你扫描各平台的热点话题，你来选领域。
- **system**: 请对`{{domain}}`领域进行全网热点扫描，覆盖微博、百度、头条、抖音、知乎等主流平台。输出格式：按热度排序的 Top 10 热点列表，每个热点包含标题、热度值、来源平台、上升趋势、建议追踪角度。最后给出整体热点态势总结。
- **inputFields**:
  - `domain` (select, required): 关注领域 — 选项: 全部/科技/财经/娱乐/体育/社会/教育/汽车/健康
- **tools**: `trending_topics`, `web_search`

#### 5.1.2 话题深度追踪
- **icon**: `Search`
- **welcome**: 好的，我来深挖这个话题。告诉我关键词，我给你还原传播路径与舆论变化。
- **system**: 请对话题「`{{topic}}`」进行深度追踪分析。包含：1) 话题起源和发展时间线 2) 各平台传播路径 3) 关键节点和转折 4) 舆论情绪变化 5) 相关利益方观点汇总 6) 预测后续发展趋势 7) 建议的内容切入角度。
- **inputFields**:
  - `topic` (text, required): 追踪话题
- **tools**: `web_search`, `web_deep_read`, `trending_topics`

#### 5.1.3 平台热榜查看
- **icon**: `BarChart3`
- **welcome**: 我来取最新的热榜。先告诉我看哪个平台，我按 Top 20 给你拉回来。
- **system**: 请查看`{{platform}}`平台的实时热榜数据，列出当前 Top 20 热门话题，每个话题标注热度指数、上榜时长、趋势（上升/下降/平稳）。对排名前 5 的话题给出简要分析和内容制作建议。
- **inputFields**:
  - `platform` (select, required): 目标平台 — 选项: 微博/百度/头条/抖音/知乎/B站/微信
- **tools**: `trending_topics`

#### 5.1.4 热点分析报告
- **icon**: `FileText`
- **welcome**: 稍等，我为你准备一份热点分析报告。你先定话题和报告深度。
- **system**: 请针对话题「`{{topic}}`」生成一份`{{depth}}`的热点分析报告。报告结构：1) 热点概述 2) 数据分析（热度趋势、平台分布、用户画像） 3) 舆情分析（正面/负面/中性占比、典型观点） 4) 竞品响应（主流媒体的报道角度） 5) 内容机会（建议的选题角度、体裁、发布时机） 6) 风险提示（敏感点、合规注意事项）
- **inputFields**:
  - `topic` (text, required): 分析话题
  - `depth` (select, required): 报告深度 — 选项: 快速摘要/标准报告/深度研报
- **tools**: `trending_topics`, `web_search`, `web_deep_read`

#### 5.1.5 关键词热度监测
- **icon**: `Activity`
- **welcome**: 可以的，我来监测这个关键词的热度。你给我关键词和时间范围。
- **system**: 请监测关键词「`{{keyword}}`」在`{{timeRange}}`内的热度变化情况。输出：1) 各平台当前热度指数 2) 热度趋势变化曲线描述 3) 关联热词和话题 4) 主要讨论内容摘要 5) 情感倾向分析 6) 是否建议跟进及原因。
- **inputFields**:
  - `keyword` (text, required): 监测关键词
  - `timeRange` (select, required): 时间范围 — 选项: 最近1小时/最近24小时/最近7天/最近30天
- **tools**: `web_search`, `trending_topics`

---

### 5.2 小策 (xiaoce) — 选题策划师（3 场景）

#### 5.2.1 选题策划
- **icon**: `Lightbulb`
- **welcome**: 我来帮你策划选题。告诉我方向和需要几个候选，我给出不同角度的方案。
- **inputFields**:
  - `direction` (text, required): 策划方向
  - `count` (select, required): 候选数量 — 选项: 3/5/10
- **tools**: `topic_generation`

#### 5.2.2 受众分析
- **icon**: `Users`
- **welcome**: 我来帮你摸清目标受众。你描述受众画像和发布平台，我给出内容偏好建议。
- **inputFields**:
  - `target` (text, required): 目标受众描述
  - `platform` (select, required): 发布平台
- **tools**: `audience_analysis`

#### 5.2.3 内容日历规划
- **icon**: `CalendarDays`
- **welcome**: 我来做一份内容日历。你定主题方向和周期，我排好发布节奏。
- **inputFields**:
  - `theme` (text, required): 主题方向
  - `period` (select, required): 规划周期 — 选项: 一周/一月/一季度
- **tools**: `content_calendar`

---

### 5.3 小资 (xiaozi) — 素材研究员（3 场景）

#### 5.3.1 素材搜集
- **icon**: `Package`
- **welcome**: 收到，我去收集素材。先告诉我话题和素材类型，图文/数据/案例都可以。
- **inputFields**: `topic` (text, required), `type` (select, required): 图文/数据/案例/视频

#### 5.3.2 案例参考
- **icon**: `BookOpen`
- **welcome**: 我来找对标案例。选行业和案例类型，我给你一批值得借鉴的参考。
- **inputFields**: `industry` (select, required), `type` (select, required)

#### 5.3.3 资料整理
- **icon**: `FolderOpen`
- **welcome**: 我来整理资料。发给我主题和想要的输出格式，我整理成可直接用的结构。
- **inputFields**: `subject` (text, required), `format` (select, required): 思维导图/表格/提纲/文档

---

### 5.4 小文 (xiaowen) — 内容创作师（4 场景）

#### 5.4.1 文章创作
- **icon**: `PenTool`
- **welcome**: 我来起稿。给我标题、风格和字数，我按结构写成完整文章。
- **inputFields**: `title` (text, required), `style` (select, required), `wordCount` (select, required)

#### 5.4.2 标题生成
- **icon**: `Type`
- **welcome**: 我来想几个好标题。把正文或主题发我，我给你 N 个备选。
- **inputFields**: `content` (textarea, required): 正文/主题, `count` (select, required): 数量

#### 5.4.3 脚本创作
- **icon**: `Film`
- **welcome**: 我来写脚本。告诉我主题、时长和平台，我按镜头+口播结构输出。
- **inputFields**: `topic` (text, required), `duration` (select, required), `platform` (select, required)

#### 5.4.4 内容改写
- **icon**: `RefreshCw`
- **welcome**: 我来改写这段内容。贴原文，告诉我目标风格，我改写后保留核心信息。
- **inputFields**: `original` (textarea, required): 原文, `targetStyle` (select, required): 目标风格

---

### 5.5 小剪 (xiaojian) — 视频制片人（3 场景）

#### 5.5.1 视频策划
- **icon**: `Film`
- **welcome**: 我来做视频策划。内容大纲和形式告诉我，我给你一份可执行的拍摄方案。
- **inputFields**: `content` (textarea, required), `format` (select, required): 横屏短视频/竖屏短视频/长视频

#### 5.5.2 封面设计建议
- **icon**: `Image`
- **welcome**: 我来给封面建议。标题和平台给我，我按平台规范给出视觉方向。
- **inputFields**: `title` (text, required), `platform` (select, required)

#### 5.5.3 音频方案
- **icon**: `Music`
- **welcome**: 我来配音频方案。视频类型和情绪定下来，我推荐 BGM 与音效配比。
- **inputFields**: `videoType` (select, required), `mood` (select, required): 情绪

---

### 5.6 小审 (xiaoshen) — 质量审核官（3 场景）

#### 5.6.1 内容审核
- **icon**: `CheckCircle`
- **welcome**: 我来帮你审核这段内容。贴内容+选审核标准，我标出问题和修改建议。
- **inputFields**: `content` (textarea, required), `standard` (select, required): 标准

#### 5.6.2 合规检查
- **icon**: `Shield`
- **welcome**: 我按该平台最新规范扫一遍。内容+目标平台给我，输出合规风险清单。
- **inputFields**: `content` (textarea, required), `platform` (select, required)

#### 5.6.3 事实核查
- **icon**: `Search`
- **welcome**: 我来核对事实。列出需要核查的断言，我逐条查证并标注可信度。
- **inputFields**: `claims` (textarea, required), `rigor` (select, required): 严格程度

---

### 5.7 小发 (xiaofa) — 渠道运营师（3 场景）

#### 5.7.1 发布策略
- **icon**: `Radio`
- **welcome**: 我来排发布策略。内容和候选渠道给我，我给出适配+时段建议。
- **inputFields**: `content` (textarea, required), `channels` (select, required): 候选渠道

#### 5.7.2 渠道分析
- **icon**: `BarChart3`
- **welcome**: 我来分析该渠道的表现。选渠道和周期，我给出数据看板和优化建议。
- **inputFields**: `channel` (select, required), `period` (select, required)

#### 5.7.3 推广方案
- **icon**: `Radio`
- **welcome**: 我来做推广方案。目标+预算给我，我按投放节奏和渠道组合出一版。
- **inputFields**: `target` (text, required), `budget` (select, required): 预算档

---

### 5.8 小数 (xiaoshu) — 数据分析师（3 场景）

#### 5.8.1 数据报告
- **icon**: `BarChart3`
- **welcome**: 我来做数据报告。选主题和输出格式，我给出关键指标+图表解读。
- **inputFields**: `topic` (select, required), `format` (select, required)

#### 5.8.2 趋势分析
- **icon**: `TrendingUp`
- **welcome**: 我来做趋势分析。领域和分析维度告诉我，我输出时间序列与洞察。
- **inputFields**: `field` (select, required), `dimension` (select, required)

#### 5.8.3 效果复盘
- **icon**: `RotateCcw`
- **welcome**: 我来帮你复盘项目。项目名+关注指标给我，我出一份结构化复盘报告。
- **inputFields**: `project` (text, required), `metrics` (select, required): 传播效果/用户互动/转化效果/全面复盘

---

## 6. 完整种子数据来源

上述场景的完整结构（含所有 `system_instruction` 全文、每个 `inputField` 的 options 列表）保存在：

```
src/db/seed-data/scenarios.ts
```

（本文档未贴完整 system_instruction 是为了可读性；如需完整文本以代码为准）

---

## 7. 关键实现点（重建时的落地提示）

### 7.1 必要的代码骨架

```
src/db/schema/employee-scenarios.ts     # Drizzle schema
src/db/seed-data/scenarios.ts           # 种子数据（DEFAULT_SCENARIOS 数组）
src/lib/dal/scenarios.ts                # 查询 DAL：getAllScenariosByOrg / listScenariosForEmployeeAdmin
src/app/actions/scenarios.ts            # Server Actions：create/update/delete/toggle/reorder
src/lib/scenario-template.ts            # 占位符替换工具：renderScenarioTemplate(template, inputs)
src/app/(dashboard)/employee/[id]/scenarios-tab.tsx  # 员工详情页 Tab
src/components/scenarios/scenario-editor-sheet.tsx   # 编辑器抽屉
src/components/scenarios/input-fields-editor.tsx     # 动态字段组件
src/app/(dashboard)/chat/chat-panel.tsx              # 触发点：在 handleSelectScenario 注入 welcome
src/app/(dashboard)/home/home-client.tsx             # 触发点：在 handleEmployeeScenarioClick 注入 welcome
```

### 7.2 必要的数据库迁移

1. 建表 `employee_scenarios`（含所有字段、唯一索引 `(org, slug, name)`）
2. 保证 `welcome_message` 列存在（历史 0029 迁移）

### 7.3 必要的种子行为

- 主 seed (`src/db/seed.ts`) 必须 `import { DEFAULT_SCENARIOS } from "./seed-data/scenarios"` 并做 `onConflictDoUpdate` upsert
- **千万不要**再拆出副 seed 脚本（这是历史踩过的坑：主/副 seed 分裂导致新建组织漏数据）

### 7.4 触发流程

```
用户点芯片
  → [如 welcome_message 非空] 向消息列表追加 assistant 欢迎词
  → [如 input_fields 非空] 显示内联表单；否则直接发送
  → 表单提交
  → 调用 /api/scenarios/execute（或等价流式端点）
  → 服务端渲染 system_instruction 模板（{{var}} 替换）
  → LLM 响应流回前端
```

---

## 8. 不变量（重建时必须遵守）

- **I-1** 多租户：所有查询必须 `WHERE organization_id = <当前用户 org>`，禁止跨租户读/写
- **I-2** 场景名称在 `(org, slug)` 范围内唯一，DB 层用 uniqueIndex 强约束
- **I-3** 输入参数名必须是合法 JS 标识符（`/^[a-zA-Z_][a-zA-Z0-9_]*$/`），单场景内不重复
- **I-4** 占位符必须闭合（`system_instruction` + `welcome_message` 中所有 `{{name}}` 都能在 `input_fields` 找到）
- **I-5** 写操作统一权限门：`ai:manage` 权限，super admin 自动放行
- **I-6** 软停用优先于硬删除：默认鼓励管理员使用启用开关，删除需要二次确认

---

## 9. 重建后的验收清单

- [ ] 主 seed 运行一次后，每个组织都有 27 条种子场景（8 员工完整覆盖）
- [ ] 所有场景都带 `welcome_message`（非空）
- [ ] 首页选中员工 → 场景芯片出现
- [ ] 点击芯片 → 欢迎词作为 assistant 消息出现 → 表单弹出
- [ ] 提交表单 → LLM 响应基于渲染后的 system_instruction 返回
- [ ] 员工详情页 "预设场景" Tab 可增删改查 + 启停 + 排序
- [ ] 非 `ai:manage` 用户只读，管理按钮隐藏/禁用
- [ ] 系统指令中写未定义的 `{{foo}}` 时，编辑器实时提示并禁止保存
- [ ] 重名保存被 server action 拒绝，返回清晰错误
- [ ] `npx tsc --noEmit` 零错误，`npm run build` 通过
## 附录 A：27 个场景完整定义（从 seed 代码提取）

> 本附录是 §5 的**完整版**，含每个场景的完整 `system_instruction`、全部 `inputFields` 选项和 `toolsHint`。

> 重建时直接按此数据插入 `employee_scenarios` 表即可。


### 小雷 — 热点猎手 (xiaolei)


#### 1. 全网热点扫描

- **icon**: `Radar`
- **description**: 扫描各平台热点话题，生成热点速报
- **welcomeMessage**: 你好，我是小雷。接下来我会帮你扫描各平台的热点话题，你来选领域。
- **toolsHint**: `trending_topics`, `web_search`
- **sortOrder**: 1

**systemInstruction**:

```
请对{{domain}}领域进行全网热点扫描，覆盖微博、百度、头条、抖音、知乎等主流平台。输出格式：按热度排序的 Top 10 热点列表，每个热点包含标题、热度值、来源平台、上升趋势、建议追踪角度。最后给出整体热点态势总结。
```

**inputFields**:

| name | label | type | required | placeholder | options |
|---|---|---|---|---|---|
| `domain` | 关注领域 | select | true | 选择领域 | 全部 / 科技 / 财经 / 娱乐 / 体育 / 社会 / 教育 / 汽车 / 健康 |


#### 2. 话题深度追踪

- **icon**: `Search`
- **description**: 深入分析特定话题的发展脉络
- **welcomeMessage**: 好的，我来深挖这个话题。告诉我关键词，我给你还原传播路径与舆论变化。
- **toolsHint**: `web_search`, `web_deep_read`, `trending_topics`
- **sortOrder**: 2

**systemInstruction**:

```
请对话题「{{topic}}」进行深度追踪分析。包含：1) 话题起源和发展时间线 2) 各平台传播路径 3) 关键节点和转折 4) 舆论情绪变化 5) 相关利益方观点汇总 6) 预测后续发展趋势 7) 建议的内容切入角度。
```

**inputFields**:

| name | label | type | required | placeholder | options |
|---|---|---|---|---|---|
| `topic` | 追踪话题 | text | true | 输入要追踪的话题关键词 | — |


#### 3. 平台热榜查看

- **icon**: `BarChart3`
- **description**: 查看指定平台的实时热榜
- **welcomeMessage**: 我来取最新的热榜。先告诉我看哪个平台，我按 Top 20 给你拉回来。
- **toolsHint**: `trending_topics`
- **sortOrder**: 3

**systemInstruction**:

```
请查看{{platform}}平台的实时热榜数据，列出当前 Top 20 热门话题，每个话题标注热度指数、上榜时长、趋势（上升/下降/平稳）。对排名前 5 的话题给出简要分析和内容制作建议。
```

**inputFields**:

| name | label | type | required | placeholder | options |
|---|---|---|---|---|---|
| `platform` | 目标平台 | select | true | 选择平台 | 微博 / 百度 / 头条 / 抖音 / 知乎 / B站 / 微信 |


#### 4. 热点分析报告

- **icon**: `FileText`
- **description**: 生成深度热点分析报告
- **welcomeMessage**: 稍等，我为你准备一份热点分析报告。你先定话题和报告深度。
- **toolsHint**: `trending_topics`, `web_search`, `web_deep_read`
- **sortOrder**: 4

**systemInstruction**:

```
请针对话题「{{topic}}」生成一份{{depth}}的热点分析报告。报告结构：1) 热点概述 2) 数据分析（热度趋势、平台分布、用户画像） 3) 舆情分析（正面/负面/中性占比、典型观点） 4) 竞品响应（主流媒体的报道角度） 5) 内容机会（建议的选题角度、体裁、发布时机） 6) 风险提示（敏感点、合规注意事项）
```

**inputFields**:

| name | label | type | required | placeholder | options |
|---|---|---|---|---|---|
| `topic` | 分析话题 | text | true | 输入要分析的话题 | — |
| `depth` | 报告深度 | select | true | 选择深度 | 快速摘要 / 标准报告 / 深度研报 |


#### 3. 关键词热度监测

- **icon**: `Activity`
- **description**: 监测关键词在各平台的热度变化
- **welcomeMessage**: 可以的，我来监测这个关键词的热度。你给我关键词和时间范围。
- **toolsHint**: `web_search`, `web_deep_read`, `trending_topics`
- **sortOrder**: 3

**systemInstruction**:

```
请监测关键词「{{keyword}}」在{{timeRange}}内的热度变化情况。输出：1) 各平台当前热度指数 2) 热度趋势变化曲线描述 3) 关联热词和话题 4) 主要讨论内容摘要 5) 情感倾向分析 6) 是否建议跟进及原因。
```

**inputFields**:

| name | label | type | required | placeholder | options |
|---|---|---|---|---|---|
| `keyword` | 监测关键词 | text | true | 输入关键词 | — |
| `timeRange` | 时间范围 | select | true | 选择时间范围 | 最近1小时 / 最近24小时 / 最近7天 / 最近30天 |


### 小策 — 选题策划师 (xiaoce)


#### 1. 选题策划

- **icon**: `Lightbulb`
- **description**: 围绕指定方向策划优质内容选题
- **welcomeMessage**: 我来帮你策划选题。告诉我方向和需要几个候选，我给出不同角度的方案。
- **toolsHint**: `web_search`, `trending_topics`
- **sortOrder**: 1

**systemInstruction**:

```
请围绕「{{direction}}」方向，策划{{count}}个优质内容选题。要求：1. 每个选题包含标题、角度、目标受众 2. 分析选题的传播潜力和时效性 3. 给出差异化切入点 4. 标注推荐优先级
```

**inputFields**:

| name | label | type | required | placeholder | options |
|---|---|---|---|---|---|
| `direction` | 内容方向 | text | true | 如：AI教育、新能源汽车 | — |
| `count` | 选题数量 | select | true | — | 3个 / 5个 / 10个 |


#### 2. 受众分析

- **icon**: `Users`
- **description**: 分析目标受众的内容偏好和行为特征
- **welcomeMessage**: 我来帮你摸清目标受众。你描述受众画像和发布平台，我给出内容偏好建议。
- **toolsHint**: `web_search`, `web_deep_read`
- **sortOrder**: 2

**systemInstruction**:

```
请分析{{platform}}平台上{{target}}群体的内容偏好。要求：1. 画出受众画像（年龄、兴趣、消费习惯）2. 分析他们喜欢的内容类型和风格 3. 总结最佳发布时间和频率 4. 给出内容策略建议
```

**inputFields**:

| name | label | type | required | placeholder | options |
|---|---|---|---|---|---|
| `target` | 目标受众 | text | true | 如：25-35岁科技爱好者 | — |
| `platform` | 目标平台 | select | true | — | 微信公众号 / 抖音 / 小红书 / B站 / 微博 / 全平台 |


#### 3. 内容日历规划

- **icon**: `CalendarDays`
- **description**: 为指定主题规划内容发布日历
- **welcomeMessage**: 我来做一份内容日历。你定主题方向和周期，我排好发布节奏。
- **toolsHint**: `web_search`, `trending_topics`
- **sortOrder**: 3

**systemInstruction**:

```
请为「{{theme}}」主题规划{{period}}的内容发布日历。要求：1. 每天/每周安排具体选题 2. 标注内容类型（图文/视频/直播）3. 结合热点节点和行业事件 4. 给出内容矩阵分布建议
```

**inputFields**:

| name | label | type | required | placeholder | options |
|---|---|---|---|---|---|
| `theme` | 主题方向 | text | true | 如：AI技术科普 | — |
| `period` | 规划周期 | select | true | — | 一周 / 两周 / 一个月 |


### 小资 — 素材研究员 (xiaozi)


#### 1. 素材搜集

- **icon**: `Package`
- **description**: 围绕主题搜集互联网和媒资库素材
- **welcomeMessage**: 收到，我去收集素材。先告诉我话题和素材类型，图文/数据/案例都可以。
- **toolsHint**: `media_search`, `web_search`
- **sortOrder**: 1

**systemInstruction**:

```
请围绕「{{topic}}」搜集{{type}}素材。要求：1. 搜索互联网最新相关素材 2. 检索媒资库已有素材 3. 按相关度和质量排序 4. 标注素材来源和使用建议
```

**inputFields**:

| name | label | type | required | placeholder | options |
|---|---|---|---|---|---|
| `topic` | 主题关键词 | text | true | 如：AI芯片、自动驾驶 | — |
| `type` | 素材类型 | select | true | — | 图文素材 / 视频素材 / 数据图表 / 全部 |


#### 2. 案例参考

- **icon**: `BookOpen`
- **description**: 搜索行业优秀案例并提炼方法论
- **welcomeMessage**: 我来找对标案例。选行业和案例类型，我给你一批值得借鉴的参考。
- **toolsHint**: `web_search`, `web_deep_read`
- **sortOrder**: 2

**systemInstruction**:

```
请搜索{{industry}}领域的优秀{{type}}案例。要求：1. 至少找到5个典型案例 2. 分析每个案例的成功要素 3. 提炼可复用的方法论 4. 给出借鉴建议
```

**inputFields**:

| name | label | type | required | placeholder | options |
|---|---|---|---|---|---|
| `industry` | 行业/领域 | text | true | 如：短视频运营、品牌营销 | — |
| `type` | 案例类型 | select | true | — | 爆款内容 / 营销活动 / 品牌传播 / 全部 |


#### 3. 资料整理

- **icon**: `FolderOpen`
- **description**: 搜集并结构化整理指定主题的资料
- **welcomeMessage**: 我来整理资料。发给我主题和想要的输出格式，我整理成可直接用的结构。
- **toolsHint**: `web_search`, `web_deep_read`, `media_search`
- **sortOrder**: 3

**systemInstruction**:

```
请围绕「{{subject}}」进行资料搜集和整理，以{{format}}格式输出。要求：1. 多源搜索相关资料 2. 去重和筛选高质量信息 3. 按逻辑结构组织 4. 标注信息来源
```

**inputFields**:

| name | label | type | required | placeholder | options |
|---|---|---|---|---|---|
| `subject` | 整理主题 | text | true | 如：2024年AI大模型发展报告 | — |
| `format` | 输出格式 | select | true | — | 要点摘要 / 结构化报告 / 思维导图大纲 |


### 小文 — 内容创作师 (xiaowen)


#### 1. 文章创作

- **icon**: `PenTool`
- **description**: 根据选题和风格要求创作高质量文章
- **welcomeMessage**: 我来起稿。给我标题、风格和字数，我按结构写成完整文章。
- **toolsHint**: `content_generate`, `web_search`
- **sortOrder**: 1

**systemInstruction**:

```
请以「{{style}}」风格，围绕选题「{{title}}」创作一篇约{{wordCount}}的文章。要求：1. 开头吸引眼球 2. 逻辑清晰、论据充分 3. 适当引用数据和案例 4. 结尾有力，引发思考
```

**inputFields**:

| name | label | type | required | placeholder | options |
|---|---|---|---|---|---|
| `title` | 文章选题 | text | true | 如：AI如何改变新闻行业 | — |
| `style` | 写作风格 | select | true | — | 深度报道 / 轻松科普 / 评论观点 / 新闻快讯 |
| `wordCount` | 目标字数 | select | true | — | 800字 / 1500字 / 3000字 / 5000字 |


#### 2. 标题生成

- **icon**: `Type`
- **description**: 为文章生成多种风格的备选标题
- **welcomeMessage**: 我来想几个好标题。把正文或主题发我，我给你 N 个备选。
- **toolsHint**: `content_generate`
- **sortOrder**: 2

**systemInstruction**:

```
请根据以下内容生成{{count}}个备选标题：\n\n{{content}}\n\n要求：1. 涵盖不同风格（悬念型、数字型、观点型等）2. 适合微信公众号传播 3. 控制在20字以内 4. 标注每个标题的风格类型
```

**inputFields**:

| name | label | type | required | placeholder | options |
|---|---|---|---|---|---|
| `content` | 文章内容/摘要 | textarea | true | 粘贴文章内容或简述文章主题... | — |
| `count` | 标题数量 | select | true | — | 5个 / 10个 / 15个 |


#### 3. 脚本创作

- **icon**: `Film`
- **description**: 为视频创作包含分镜和口播文案的完整脚本
- **welcomeMessage**: 我来写脚本。告诉我主题、时长和平台，我按镜头+口播结构输出。
- **toolsHint**: `content_generate`, `web_search`
- **sortOrder**: 3

**systemInstruction**:

```
请为{{platform}}平台创作一个{{duration}}的视频脚本，主题为「{{topic}}」。要求：1. 开头3秒抓住注意力 2. 包含分镜描述和口播文案 3. 标注画面建议和字幕 4. 结尾引导互动
```

**inputFields**:

| name | label | type | required | placeholder | options |
|---|---|---|---|---|---|
| `topic` | 视频主题 | text | true | 如：5分钟讲清楚大模型原理 | — |
| `duration` | 目标时长 | select | true | — | 1分钟短视频 / 3-5分钟 / 10分钟以上 |
| `platform` | 发布平台 | select | true | — | 抖音 / B站 / 视频号 / 通用 |


#### 4. 内容改写

- **icon**: `RefreshCw`
- **description**: 将已有内容改写为指定风格
- **welcomeMessage**: 我来改写这段内容。贴原文，告诉我目标风格，我改写后保留核心信息。
- **toolsHint**: `content_generate`
- **sortOrder**: 4

**systemInstruction**:

```
请将以下内容改写为{{targetStyle}}的风格：\n\n{{original}}\n\n要求：1. 保持核心信息不变 2. 调整语言风格和表达方式 3. 优化段落结构 4. 提升可读性
```

**inputFields**:

| name | label | type | required | placeholder | options |
|---|---|---|---|---|---|
| `original` | 原始内容 | textarea | true | 粘贴需要改写的内容... | — |
| `targetStyle` | 目标风格 | select | true | — | 更口语化 / 更正式 / 更简洁 / 更详细 / 更有趣 |


### 小剪 — 视频制片人 (xiaojian)


#### 1. 视频策划

- **icon**: `Film`
- **description**: 为视频内容制定完整制作方案
- **welcomeMessage**: 我来做视频策划。内容大纲和形式告诉我，我给你一份可执行的拍摄方案。
- **toolsHint**: `content_generate`, `media_search`
- **sortOrder**: 1

**systemInstruction**:

```
请为「{{content}}」策划一个{{format}}制作方案。要求：1. 详细的分镜脚本和时间轴 2. 画面构图和转场建议 3. 字幕、特效和音效标注 4. 素材清单和拍摄要点
```

**inputFields**:

| name | label | type | required | placeholder | options |
|---|---|---|---|---|---|
| `content` | 视频主题/内容 | text | true | 如：AI手机评测对比 | — |
| `format` | 视频形式 | select | true | — | 横屏长视频 / 竖屏短视频 / 直播 / Vlog |


#### 2. 封面设计建议

- **icon**: `Image`
- **description**: 为视频或文章设计封面创意方案
- **welcomeMessage**: 我来给封面建议。标题和平台给我，我按平台规范给出视觉方向。
- **toolsHint**: `web_search`, `media_search`
- **sortOrder**: 2

**systemInstruction**:

```
请为「{{title}}」设计{{platform}}平台的封面方案。要求：1. 3个不同风格的封面创意 2. 配色方案和字体建议 3. 构图布局描述 4. 标注平台封面尺寸规范
```

**inputFields**:

| name | label | type | required | placeholder | options |
|---|---|---|---|---|---|
| `title` | 视频/文章标题 | text | true | 如：ChatGPT使用技巧大全 | — |
| `platform` | 发布平台 | select | true | — | 公众号 / 抖音 / B站 / 小红书 / 通用 |


#### 3. 音频方案

- **icon**: `Music`
- **description**: 为视频规划背景音乐、配音和音效方案
- **welcomeMessage**: 我来配音频方案。视频类型和情绪定下来，我推荐 BGM 与音效配比。
- **toolsHint**: `content_generate`
- **sortOrder**: 3

**systemInstruction**:

```
请为「{{videoType}}」类型的视频规划{{mood}}基调的音频方案。要求：1. 背景音乐风格和推荐 2. 配音风格和语速建议 3. 音效使用时机标注 4. 音量层次和混音建议
```

**inputFields**:

| name | label | type | required | placeholder | options |
|---|---|---|---|---|---|
| `videoType` | 视频类型 | text | true | 如：科技评测、美食探店 | — |
| `mood` | 情绪基调 | select | true | — | 轻松愉快 / 严肃专业 / 激情热血 / 温馨感人 / 悬疑紧张 |


### 小审 — 质量审核官 (xiaoshen)


#### 1. 内容审核

- **icon**: `CheckCircle`
- **description**: 按审核标准检查内容质量和准确性
- **welcomeMessage**: 我来帮你审核这段内容。贴内容+选审核标准，我标出问题和修改建议。
- **toolsHint**: `fact_check`, `web_search`
- **sortOrder**: 1

**systemInstruction**:

```
请按照{{standard}}标准审核以下内容：\n\n{{content}}\n\n要求：1. 检查事实准确性 2. 检查逻辑连贯性 3. 检查语法和表达 4. 检查敏感词和合规风险 5. 给出质量评分（1-100）和修改建议
```

**inputFields**:

| name | label | type | required | placeholder | options |
|---|---|---|---|---|---|
| `content` | 待审核内容 | textarea | true | 粘贴需要审核的文章或脚本... | — |
| `standard` | 审核标准 | select | true | — | 基础审核 / 严格审核 / 发布前终审 |


#### 2. 合规检查

- **icon**: `Shield`
- **description**: 检查内容是否符合平台发布规范
- **welcomeMessage**: 我按该平台最新规范扫一遍。内容+目标平台给我，输出合规风险清单。
- **toolsHint**: `fact_check`, `web_deep_read`
- **sortOrder**: 2

**systemInstruction**:

```
请检查以下内容是否符合{{platform}}平台的发布规范：\n\n{{content}}\n\n要求：1. 检查是否含有违规敏感词 2. 检查是否涉及版权风险 3. 检查广告法合规性 4. 给出合规评分和修改建议
```

**inputFields**:

| name | label | type | required | placeholder | options |
|---|---|---|---|---|---|
| `content` | 待检查内容 | textarea | true | 粘贴需要合规检查的内容... | — |
| `platform` | 目标平台 | select | true | — | 微信公众号 / 抖音 / 微博 / B站 / 通用 |


#### 3. 事实核查

- **icon**: `Search`
- **description**: 逐条核查事实性陈述的准确性
- **welcomeMessage**: 我来核对事实。列出需要核查的断言，我逐条查证并标注可信度。
- **toolsHint**: `fact_check`, `web_search`, `web_deep_read`
- **sortOrder**: 3

**systemInstruction**:

```
请对以下事实性陈述进行{{rigor}}：\n\n{{claims}}\n\n要求：1. 逐条核查每个事实陈述 2. 标注信息来源和可信度 3. 指出存疑或错误之处 4. 给出核查结论和修正建议
```

**inputFields**:

| name | label | type | required | placeholder | options |
|---|---|---|---|---|---|
| `claims` | 待核查内容 | textarea | true | 列出需要核查的事实性陈述... | — |
| `rigor` | 核查严格度 | select | true | — | 快速核查 / 标准核查 / 深度核查 |


### 小发 — 渠道运营师 (xiaofa)


#### 1. 发布策略

- **icon**: `Radio`
- **description**: 为内容制定多渠道发布策略
- **welcomeMessage**: 我来排发布策略。内容和候选渠道给我，我给出适配+时段建议。
- **toolsHint**: `web_search`, `data_report`
- **sortOrder**: 1

**systemInstruction**:

```
请为「{{content}}」制定{{channels}}发布策略。要求：1. 推荐发布渠道组合 2. 各渠道最佳发布时间 3. 内容适配建议（标题、封面、描述差异化）4. 预期效果和KPI建议
```

**inputFields**:

| name | label | type | required | placeholder | options |
|---|---|---|---|---|---|
| `content` | 内容类型/主题 | text | true | 如：AI科普长文、产品评测视频 | — |
| `channels` | 目标渠道 | select | true | — | 全渠道 / 图文渠道 / 视频渠道 / 社交媒体 |


#### 2. 渠道分析

- **icon**: `BarChart3`
- **description**: 分析渠道运营表现并给出优化建议
- **welcomeMessage**: 我来分析该渠道的表现。选渠道和周期，我给出数据看板和优化建议。
- **toolsHint**: `web_search`, `data_report`
- **sortOrder**: 2

**systemInstruction**:

```
请分析{{channel}}渠道在{{period}}的运营表现。要求：1. 关键数据指标总结 2. 内容表现排名分析 3. 受众互动趋势 4. 优化建议和下一步行动
```

**inputFields**:

| name | label | type | required | placeholder | options |
|---|---|---|---|---|---|
| `channel` | 分析渠道 | text | true | 如：公众号、抖音、B站 | — |
| `period` | 分析周期 | select | true | — | 近7天 / 近30天 / 近90天 |


#### 3. 推广方案

- **icon**: `Radio`
- **description**: 制定不同预算级别的内容推广方案
- **welcomeMessage**: 我来做推广方案。目标+预算给我，我按投放节奏和渠道组合出一版。
- **toolsHint**: `web_search`
- **sortOrder**: 3

**systemInstruction**:

```
请为「{{target}}」制定{{budget}}级别的推广方案。要求：1. 推广渠道和方式选择 2. 内容传播路径设计 3. KOL/社群合作建议 4. 预算分配和效果预估
```

**inputFields**:

| name | label | type | required | placeholder | options |
|---|---|---|---|---|---|
| `target` | 推广目标 | text | true | 如：新品发布推广、品牌知名度提升 | — |
| `budget` | 预算等级 | select | true | — | 零预算 / 小预算 / 中等预算 / 大预算 |


### 小数 — 数据分析师 (xiaoshu)


#### 1. 数据报告

- **icon**: `BarChart3`
- **description**: 生成数据驱动的运营分析报告
- **welcomeMessage**: 我来做数据报告。选主题和输出格式，我给出关键指标+图表解读。
- **toolsHint**: `data_report`, `web_search`
- **sortOrder**: 1

**systemInstruction**:

```
请生成「{{topic}}」的{{format}}。要求：1. 核心数据指标汇总 2. 趋势分析和同比环比 3. 异常数据标注和解读 4. 数据驱动的建议
```

**inputFields**:

| name | label | type | required | placeholder | options |
|---|---|---|---|---|---|
| `topic` | 报告主题 | text | true | 如：本月内容运营数据分析 | — |
| `format` | 报告格式 | select | true | — | 简要概览 / 详细报告 / 数据看板 |


#### 2. 趋势分析

- **icon**: `TrendingUp`
- **description**: 分析行业趋势并预测发展方向
- **welcomeMessage**: 我来做趋势分析。领域和分析维度告诉我，我输出时间序列与洞察。
- **toolsHint**: `web_search`, `trending_topics`, `data_report`
- **sortOrder**: 2

**systemInstruction**:

```
请对{{field}}领域进行{{dimension}}分析。要求：1. 搜索最新行业数据和报告 2. 识别关键趋势信号 3. 预测未来发展方向 4. 给出策略建议
```

**inputFields**:

| name | label | type | required | placeholder | options |
|---|---|---|---|---|---|
| `field` | 分析领域 | text | true | 如：短视频行业、AI应用 | — |
| `dimension` | 分析维度 | select | true | — | 技术趋势 / 市场趋势 / 内容趋势 / 综合分析 |


#### 3. 效果复盘

- **icon**: `RotateCcw`
- **description**: 对已完成项目进行效果复盘分析
- **welcomeMessage**: 我来帮你复盘项目。项目名+关注指标给我，我出一份结构化复盘报告。
- **toolsHint**: `data_report`
- **sortOrder**: 3

**systemInstruction**:

```
请对「{{project}}」进行{{metrics}}方面的效果复盘。要求：1. 梳理项目执行过程 2. 核心数据指标分析 3. 亮点和不足总结 4. 可复用经验提炼 5. 改进建议
```

**inputFields**:

| name | label | type | required | placeholder | options |
|---|---|---|---|---|---|
| `project` | 复盘项目 | text | true | 如：某某专题报道、某某活动 | — |
| `metrics` | 关注指标 | select | true | — | 传播效果 / 用户互动 / 转化效果 / 全面复盘 |

---

## 附录 B：API 契约

### B.1 场景执行 — `POST /api/scenarios/execute`

场景触发后的**流式执行端点**。实现位于 `src/app/api/scenarios/execute/route.ts`。

#### Request

```http
POST /api/scenarios/execute
Content-Type: application/json
Cookie: <Supabase session cookie>
```

```ts
{
  employeeDbId: string;        // ai_employees.id（非 slug）
  scenarioId: string;          // employee_scenarios.id
  userInputs: Record<string, string>;  // 用户在表单里填的参数，key = inputField.name
  conversationHistory?: {      // 可选：已有对话上下文，最多取最后 10 条
    role: "user" | "assistant";
    content: string;
  }[];
}
```

#### Response — Server-Sent Events

`Content-Type: text/event-stream`，事件分 5 种：

| event | data payload | 何时触发 |
|---|---|---|
| `thinking` | `{ tool, label, skillName }` | 每当 LLM 发起 tool call（如 web_search） |
| `source` | `{ tool, sources, totalSources, totalReferences }` | tool 返回结果并提取到 URL/域名时 |
| `text-delta` | `{ text }` | LLM 文本 token 增量流回 |
| `done` | `{ sources, referenceCount, finishReason, skillsUsed }` | 流结束时；`skillsUsed` 是本次用到的技能列表 |
| `error` | `{ message }` | 流处理异常 |

**示例事件**（原始 SSE 格式）：
```
event: thinking
data: {"tool":"web_search","label":"正在搜索互联网资料","skillName":"全网搜索"}

event: text-delta
data: {"text":"根据最新"}

event: text-delta
data: {"text":"的数据，"}

event: source
data: {"tool":"web_search","sources":["weibo.com","zhihu.com"],"totalSources":2,"totalReferences":5}

event: done
data: {"sources":["weibo.com","zhihu.com"],"referenceCount":5,"finishReason":"stop","skillsUsed":[{"tool":"web_search","skillName":"全网搜索"}]}
```

#### Error Responses

| Status | 语义 |
|---|---|
| `401` | 未登录 |
| `403` | 无组织 / 员工不在当前组织 |
| `404` | 场景不存在 |
| `500` | Agent 组装失败 / LLM 初始化失败 / 未捕获异常（返回 JSON `{error}`）|

#### 服务端内部流程

```
1. Supabase 认证 → user
2. 查 user_profiles → organizationId
3. 校验 employee 属于当前 org
4. 查 scenario 属于当前 org
5. assembleAgent(employeeDbId)              # 组装 Agent（含技能、知识库、记忆、系统提示词）
6. resolveTemplate(scenario.systemInstruction, userInputs)  # {{var}} 替换
7. getLanguageModel(agent.modelConfig)      # 获取 LLM 实例
8. resolveTools(scenario.toolsHint) 或 agent.tools  # 场景工具优先
9. streamText({ system, messages, tools, stopWhen: stepCountIs(10), maxOutputTokens: 8192, temperature: 0.5 })
10. 遍历 result.fullStream → 按 part.type 转成 SSE 事件
11. 流结束后 fire-and-forget：notifyChatMessage(...)  # 对话记录入 chat 频道
```

**重要实现细节**：
- System prompt 构造：`${agent.systemPrompt}\n\n# 当前场景任务\n${resolvedInstruction}` — agent 的人格设定 + 当前场景的任务指令
- `conversationHistory` 如提供，追加到 messages 中（最多最后 10 条）；否则 messages 只含 `{role: "user", content: resolvedInstruction}`
- 占位符模板解析用最简版正则：`/\{\{(\w+)\}\}/g`，未命中变量替换为空字符串
- Stream 错误处理：controller 关闭后 send 事件可能抛错，所有 enqueue 都包 try/catch 静默失败

### B.2 员工场景列表 — `GET /api/employees/[slug]/scenarios`

读取某员工在当前组织下**已启用**的场景列表。实现位于 `src/app/api/employees/[slug]/scenarios/route.ts`。

#### Request

```http
GET /api/employees/:slug/scenarios
Cookie: <Supabase session cookie>
```

#### Response

```ts
// 200 OK
[
  {
    id: string;
    name: string;
    description: string;
    icon: string;
    inputFields: InputFieldDef[];
    toolsHint: string[];
  },
  // ... 按 sort_order 升序
]
```

**过滤条件**：`organization_id = 当前用户 org` AND `employee_slug = :slug` AND `enabled = true`

**错误**：401 未登录 / 403 无组织

### B.3 Server Actions（`src/app/actions/scenarios.ts`）

以下是写操作的 server action 契约。全部需要 `ai:manage` 权限（super admin 自动放行）。

```ts
type ScenarioWritePayload = {
  employeeSlug: string;
  name: string;
  description: string;
  icon: string;
  welcomeMessage?: string | null;
  systemInstruction: string;
  inputFields: InputFieldDef[];
  toolsHint: string[];
  sortOrder: number;
  enabled: boolean;
};

// 创建
createScenario(payload: ScenarioWritePayload): Promise<{ id: string }>

// 更新（禁止跨员工迁移）
updateScenario(scenarioId: string, payload: ScenarioWritePayload): Promise<{ id: string }>

// 启用/停用（软）
toggleScenarioEnabled(scenarioId: string, enabled: boolean): Promise<void>

// 永久删除（硬）
deleteScenario(scenarioId: string): Promise<void>

// 批量重排序（按传入数组顺序重写 sort_order）
reorderScenarios(employeeSlug: string, orderedIds: string[]): Promise<void>
```

**调用后的缓存失效**：所有写操作都会 `revalidatePath(/ai-employees/[slug])` + `/home` + `/chat`，保证 UI 立即反映最新数据。

### B.4 校验规则（服务端抛错即返回）

| 错误场景 | 错误消息（示例） |
|---|---|
| 未登录 | `Unauthorized` |
| 无 `ai:manage` 权限 | `FORBIDDEN: 需要 AI 管理权限` |
| 场景名重复 | `场景名称「${name}」已存在` |
| 场景不存在或无权操作 | `场景不存在或无权操作` |
| 跨员工修改 | `不允许跨员工修改场景` |
| 输入参数名为空 | `输入参数名不能为空` |
| 输入参数名不合法 | `输入参数名「${name}」不合法（只允许字母/数字/下划线，不能以数字开头）` |
| 输入参数名重复 | `输入参数名「${name}」重复` |
| 输入参数缺 label | `输入参数「${name}」缺少显示名` |
| 输入参数类型不合法 | `输入参数「${name}」类型不合法` |
| 下拉参数无选项 | `下拉参数「${name}」至少需要一个选项` |
| 占位符未闭合 | `指令/欢迎词中引用了未定义的输入参数：{{x}}, {{y}}` |
