# Vibetide (数智全媒平台) 总体测试方案

> 版本: v1.0 | 日期: 2026-03-08 | 状态: 待评审

---

## 1. 引言 (Introduction)

### 1.1 项目背景

Vibetide（Vibe Media）是一个面向中文媒体团队的 AI 驱动内容管理平台。平台核心理念为"两个编辑 + 一支 AI 团队 = 一个全能新媒体军团"，通过 8 个专业化 AI 员工（热点侦察、内容策划、素材管理、文案写作、视频制作、质量审核、渠道运营、数据分析）协作完成内容生产全流程。

**系统规模:**
- 60+ 数据库表，37 个枚举类型，27 个 Schema 文件
- 34 个仪表盘页面（含 3 个重定向）
- 32 个 Server Action 文件（~4,200 行）
- 35 个 DAL 文件（~5,000 行）
- 9 个 Agent 相关文件（~600 行）
- 6 个 Inngest 后台任务函数

**四大模块:**

| 模块 | 名称 | 状态 | 优先级 |
|:---|:---|:---|:---|
| Module 4 | AI 团队引擎（基座） | 4.1 已实现，连接真实 DB | P0 |
| Module 1 | AI 资产重构 | Mock 数据阶段 | P0-P1 |
| Module 2 | 智创生产 | Mock 数据阶段 | P0-P1 |
| Module 3 | 全渠道传播 | Mock 数据阶段 | P1 |

### 1.2 测试目标

1. **功能正确性**: 确保已实现模块（Module 4.1）的核心业务流程无阻断性 Bug，数据持久化完整可靠
2. **数据完整性**: 验证多租户隔离（organization_id 作用域）在全链路上生效，防止数据泄漏
3. **Auth 安全性**: 确保认证鉴权链路（Supabase Auth → Middleware → requireAuth → DAL org-scope）无绕过漏洞
4. **Agent 可靠性**: 验证 AI Agent 组装流程（7 层 prompt、工具过滤、权限控制）输出符合预期
5. **工作流引擎稳定性**: 验证 Inngest 驱动的工作流执行（审批门禁、质量评分、升级策略）在各种分支条件下正确运行
6. **构建可靠性**: 确保 TypeScript 类型检查和 Next.js 生产构建 100% 通过
7. **回归保护**: 建立自动化回归测试基线，防止新功能引入破坏

### 1.3 参考文档

| 文档 | 路径 |
|:---|:---|
| 平台基础架构需求 | `docs/requirement/00-平台基础架构.md` |
| AI 资产重构需求 | `docs/requirement/01-AI资产重构.md` |
| 智创生产需求 | `docs/requirement/02-智创生产.md` |
| 全渠道传播需求 | `docs/requirement/03-全渠道传播.md` |
| AI 团队引擎需求 | `docs/requirement/04-AI团队引擎.md` |
| 技术架构文档 | `docs/technical-architecture.md` |
| Module 4 实施计划 | `docs/plans/2026-03-06-module4-ai-team-engine.md` |
| Agent 架构优化设计 | `docs/plans/2026-03-07-agent-architecture-optimization-design.md` |
| 系统功能清单 | `docs/plans/system-function-list.md` |
| 项目分析报告 | `docs/project-analysis-report.md` |

### 1.4 当前测试基础设施现状

> **重要: 项目当前零测试基础设施。** 无测试文件、无测试框架配置、无 CI/CD 流水线。
> 唯一的验证手段为 `npx tsc --noEmit`（类型检查）和 `npm run build`（生产构建）。

---

## 2. 测试范围 (Test Scope)

### 2.1 测试内容 (In-Scope)

#### 2.1.1 功能模块

**第一优先级 (P0) — Module 4 已实现部分:**

| 功能域 | 覆盖范围 | 关键路由 |
|:---|:---|:---|
| AI 员工管理 | 创建/删除/启用/禁用、技能绑定/解绑、性能统计、导出/导入、工作偏好 | `/employee/[id]`, `/employee-marketplace` |
| 团队管理 | 创建/删除团队、添加/移除成员、角色变更、升级策略配置、审批步骤配置 | `/team-hub`, `/team-builder`, `/team-builder/[id]` |
| 工作流引擎 | 模板 CRUD、启动实例、步骤审批/拒绝、质量门禁、自动升级、批量审批 | `/team-hub` (workflow panel) |
| 消息系统 | 团队消息发送/已读追踪、审批请求通知、状态变更推送 | `/team-hub` (message feed) |
| Agent 系统 | Agent 组装、7 层 prompt 构建、工具过滤、执行与质量评分 | Agent API |
| 认证鉴权 | 登录/注册/登出、Session 刷新、路由保护、requireAuth 强制 | `/login`, `/register`, middleware |

**第二优先级 (P1) — 已有页面和 Server Action 但使用 Mock/部分实现:**

| 功能域 | 覆盖范围 | 关键路由 |
|:---|:---|:---|
| 文章管理 | 文章 CRUD、分类管理 | `/articles`, `/categories` |
| 发布管理 | 发布计划、频道管理、发布日历、最佳时间推荐 | `/publishing` |
| 数据分析 | 周报、频道对比、Top 内容、六维评分、趋势预测 | `/analytics` |
| 审批管理 | 待审列表、审批统计、历史记录 | `/approvals` |
| 热点感知 | 热点列表、热度曲线、角度建议、竞品追踪 | `/inspiration` |
| 超级创作 | 创作目标、任务管理 | `/super-creation` |
| 竞品对标 | 竞品分析、KPI 对比 | `/benchmarking` |
| 频道顾问 | 顾问 CRUD、知识源管理、A/B 测试 | `/channel-advisor` |
| 素材管理 | 媒资库、智能理解、知识图谱 | `/asset-intelligence`, `/media-assets` |

#### 2.1.2 非功能特性

| 类别 | 测试内容 |
|:---|:---|
| 安全性 | 多租户数据隔离、权限越权检测、CSRF/XSS 防护、Supabase RLS 验证 |
| 性能 | 首屏加载时间、DAL 查询响应时间、大数据量分页性能、Agent 组装耗时 |
| 可靠性 | 数据库连接中断恢复、Inngest 任务幂等性、Session 过期处理 |
| 兼容性 | 主流浏览器（Chrome/Safari/Firefox/Edge 最新两版本） |
| 可访问性 | 基本键盘导航、屏幕阅读器支持（P2） |

#### 2.1.3 端侧覆盖

- **Web (Desktop)**: Chrome, Safari, Firefox, Edge — 主要测试目标
- **Web (Mobile)**: Safari iOS, Chrome Android — 响应式布局验证
- **旗舰 APP (3.2)**: 不在本期范围

### 2.2 不测试内容 (Out-of-Scope)

| 排除项 | 原因 |
|:---|:---|
| 第三方 API 内部逻辑 | Supabase Auth、Anthropic Claude API、Inngest 平台本身的内部实现 |
| 旗舰 APP (Module 3.2) | C 端产品，独立于 Dashboard，未启动开发 |
| 可视化工作流编辑器 (F4.2.x) | Q4 计划，React Flow 未集成 |
| 自学习进化基座 (F4.3.x) | Q4 计划，除执行日志外均未实现 |
| 协作模式 (F4.C.x) | 未实现 |
| 并行/条件分支工作流 (F4.1.99-100) | 未实现 |
| RAG/向量检索 (F4.1.134-135) | 需 Embedding 基础设施，未实现 |
| 真实搜索 API (F4.1.125) | 需外部 API Key，当前为 Mock |
| 历史数据迁移 | 本期不涉及 |
| 性能压力测试（高并发） | 建议在正式上线前单独开展 |

---

## 3. 测试策略 (Test Strategy)

### 3.1 测试分层与方法

采用经典测试金字塔模型，结合项目 Server/Client Component 架构特点进行分层：

```
                    ┌─────────────┐
                    │   E2E 测试   │  ← 核心主流程（Playwright）
                   ─┤   (少量)    ├─
                  / └─────────────┘ \
                 /   ┌─────────────┐  \
                │    │  集成测试    │   │ ← Server Action + DAL（Vitest）
                │   ─┤  (中等量)   ├─  │
                │  / └─────────────┘ \  │
                │ /   ┌─────────────┐ \ │
                ││    │  单元测试    │  ││ ← Agent、工具函数、类型转换（Vitest）
                 \   ─┤  (大量)     ├─  /
                  \  / └─────────────┘ \ /
                   \/                   \/
```

#### 3.1.1 单元测试 (Unit Tests)

**负责方**: 开发团队
**覆盖率要求**: 核心模块 > 80%，整体 > 60%
**工具**: Vitest (与 Next.js / TypeScript / ESM 兼容性最佳)

**重点覆盖:**

| 目标 | 文件/模块 | 测试要点 |
|:---|:---|:---|
| Agent 组装 | `src/lib/agent/assembly.ts` | 7 层 prompt 正确构建、技能过滤、权限映射 |
| Prompt 模板 | `src/lib/agent/prompt-templates.ts` | 不同员工身份生成正确 prompt |
| 工具注册 | `src/lib/agent/tool-registry.ts` | 权限级别对应正确的工具集 |
| 意图解析 | `src/lib/agent/intent-parser.ts` | 自然语言指令映射正确工作流步骤 |
| 步骤 I/O | `src/lib/agent/step-io.ts` | 输出解析、质量评分提取 |
| 模型路由 | `src/lib/agent/model-router.ts` | 不同技能类别路由到正确模型 |
| 类型转换 | `src/lib/dal/*.ts` (transform 逻辑) | DB Row → Frontend Type 映射正确 |
| 工具函数 | `src/lib/utils.ts`, `src/lib/constants.ts` | cn() 合并、常量完整性 |
| Zod Schema | 各 Server Action 中的输入验证 | 边界值、非法输入拒绝 |

#### 3.1.2 集成测试 (Integration Tests)

**负责方**: 开发团队 + QA 团队
**工具**: Vitest + Drizzle 测试数据库（独立 Supabase 项目或本地 PostgreSQL）

**重点覆盖:**

| 目标 | 测试要点 |
|:---|:---|
| Server Actions (CRUD) | 完整 create → read → update → delete 链路验证 |
| DAL 查询 + Org 隔离 | 确认 `getCurrentUserOrg()` 过滤器在所有 DAL 函数中生效 |
| Auth 链路 | signIn/signUp → session → requireAuth → action 执行 |
| 工作流执行 | 启动实例 → 步骤推进 → 审批 → 质量门禁 → 完成/升级 |
| 消息系统 | 发送消息 → 已读标记 → 通知推送 |
| 员工生命周期 | 创建 → 技能绑定 → 启用 → 执行工作流 → 状态自动切换 → 禁用 |
| Agent 执行 | 组装 Agent → 调用 AI SDK → 解析输出 → 保存 Artifact |
| Inngest 事件 | 事件触发 → 函数执行 → 数据库副作用验证 |

**关键集成场景:**

```
场景1: 端到端内容工作流
  创建团队 → 添加 AI 员工 → 配置工作流模板 → 启动实例
  → 逐步执行（Monitor → Plan → Material → Create → Produce → Review → Publish → Analyze）
  → 每步验证: Agent 组装正确、工具调用合理、审批门禁生效、质量评分记录

场景2: 多租户数据隔离
  创建 OrgA 用户 → OrgA 创建数据 → 切换 OrgB 用户
  → 验证 OrgB 无法通过任何 DAL/Action 访问 OrgA 数据

场景3: 审批流程完整性
  配置多步审批 → 提交审批请求 → 第一步批准 → 第二步拒绝
  → 验证反馈注入 → 重新提交 → 全部批准 → 工作流继续
  → 超时策略验证（auto_approve/auto_reject/escalate）
```

#### 3.1.3 E2E 测试 (End-to-End Tests)

**负责方**: QA 团队
**覆盖率要求**: 核心主流程 100%
**工具**: Playwright (支持多浏览器、Next.js 原生集成)

**核心主流程用例:**

| # | 流程 | 步骤概要 |
|:---|:---|:---|
| E2E-01 | 用户注册登录 | 注册 → 邮箱验证 → 登录 → 进入 Dashboard → 登出 |
| E2E-02 | 员工浏览与管理 | 进入市场 → 查看员工详情 → 绑定技能 → 修改偏好 → 导出 JSON |
| E2E-03 | 团队创建与配置 | 创建团队 → 添加成员 → 设置角色 → 配置升级策略 → 配置审批步骤 |
| E2E-04 | 工作流启动与执行 | 选择模板 → 启动实例 → 查看步骤进度 → 审批/拒绝 → 查看完成结果 |
| E2E-05 | 消息与通知 | 发送消息 → 查看 Feed → 标记已读 → 验证未读计数 |
| E2E-06 | 导航与布局 | 侧边栏导航全页面 → 响应式布局 → 面包屑导航 |

#### 3.1.4 手工测试

**负责方**: QA 团队
**场景:**

- **探索性测试**: 无脚本自由探索，关注边界条件和异常路径
- **UI/UX 体验测试**: Glass UI 设计一致性、动画流畅度（Framer Motion）、中文文本显示
- **AI 输出质量**: Agent 生成内容的质量、准确性、中文语言表达
- **跨浏览器视觉一致性**: Tailwind CSS v4 在不同浏览器的渲染差异

### 3.2 专项测试策略

#### 3.2.1 安全测试

| 测试项 | 方法 | 工具/手段 |
|:---|:---|:---|
| 多租户隔离 | 构造跨租户请求，验证 DAL org-scope 过滤器 | 集成测试 + 手工验证 |
| 权限越权 | 低权限用户尝试高权限操作（observer → executor） | 集成测试 |
| Auth 绕过 | 直接访问 Dashboard 路由、构造无 session 请求 | Playwright + 手工 |
| Server Action 鉴权 | 未认证用户调用 Server Action | 集成测试 |
| XSS 防护 | 在输入字段注入 `<script>` 标签 | 手工测试 + OWASP ZAP |
| SQL 注入 | 在搜索/过滤参数中注入 SQL | Drizzle ORM 参数化查询验证 |
| 敏感信息泄露 | 检查 API 响应中是否包含 service_role_key 等敏感信息 | 手工审计 |
| CSRF | 验证 Next.js Server Actions 的内置 CSRF 保护 | 手工测试 |

#### 3.2.2 性能测试

| 场景 | 指标 | 基准值 |
|:---|:---|:---|
| Dashboard 首屏加载 | LCP (Largest Contentful Paint) | < 2.5s |
| 页面导航切换 | FCP (First Contentful Paint) | < 1.0s |
| DAL 查询（员工列表） | 响应时间 | < 500ms |
| DAL 查询（团队 + 成员 + 工作流） | 响应时间 | < 1s |
| Agent 组装（含 DB 查询） | 端到端耗时 | < 3s |
| Server Action 执行 | 响应时间 | < 1s |
| 工作流单步执行（含 AI 调用） | 端到端耗时 | < 30s |
| 大数据量分页（1000+ 记录） | 渲染时间 | < 2s |

**工具**: Lighthouse (Web Vitals)、Playwright 性能断言、Server-Timing header

#### 3.2.3 兼容性测试

**浏览器矩阵:**

| 浏览器 | 版本 | 优先级 |
|:---|:---|:---|
| Chrome | 最新两个大版本 | P0 |
| Safari | 最新两个大版本 (macOS + iOS) | P0 |
| Firefox | 最新大版本 | P1 |
| Edge | 最新大版本 | P1 |

**分辨率:**

| 设备类型 | 分辨率 | 优先级 |
|:---|:---|:---|
| Desktop | 1920x1080, 1440x900 | P0 |
| Tablet | 1024x768 (iPad) | P1 |
| Mobile | 375x812 (iPhone), 360x800 (Android) | P2 |

#### 3.2.4 数据库测试

| 测试项 | 验证内容 |
|:---|:---|
| Schema 完整性 | 所有 60+ 表的外键约束、NOT NULL 约束、DEFAULT 值 |
| 枚举一致性 | 37 个枚举类型在 Schema 和代码中保持同步 |
| 级联删除 | 删除团队/员工时关联数据正确清理 |
| 并发写入 | 多用户同时操作同一资源的竞态条件 |
| 数据迁移 | `db:push` / `db:migrate` 的幂等性和回滚能力 |
| 连接池 | PgBouncer (`prepare: false`) 配置下的连接稳定性 |

### 3.3 测试工具栈

| 用途 | 工具 | 说明 |
|:---|:---|:---|
| 单元/集成测试 | **Vitest** | 原生 ESM、TypeScript 支持，与 Next.js 兼容 |
| E2E 测试 | **Playwright** | 多浏览器支持，Next.js 官方推荐 |
| 测试数据库 | **Supabase Local** / **Docker PostgreSQL** | 隔离测试环境 |
| API 模拟 | **MSW (Mock Service Worker)** | 拦截 AI SDK / Supabase 请求 |
| 覆盖率报告 | **Vitest Coverage (v8/istanbul)** | 代码覆盖率统计 |
| 性能测试 | **Lighthouse CI** + **Playwright Perf** | Web Vitals 监控 |
| 安全扫描 | **OWASP ZAP** / **eslint-plugin-security** | 自动化安全检查 |
| 缺陷管理 | **GitHub Issues** | 缺陷跟踪与分类 |
| CI/CD | **GitHub Actions** | 自动化流水线 |
| 视觉回归 | **Playwright 截图对比** | UI 一致性验证 |

---

## 4. 环境与数据 (Environment & Data)

### 4.1 环境拓扑

| 环境 | 用途 | 部署方式 | 数据库 | AI 服务 | 备注 |
|:---|:---|:---|:---|:---|:---|
| **Local Dev** | 开发自测 | `npm run dev` | Supabase Local (Docker) | Mock (MSW) | 每人独立 |
| **CI** | 自动化测试 | GitHub Actions | Docker PostgreSQL | Mock (MSW) | 每次 Push 触发 |
| **SIT (测试)** | 功能全量测试 | Vercel Preview | 独立 Supabase 项目 | Anthropic Sandbox | QA 团队使用 |
| **UAT (预发)** | 验收/回归 | Vercel Staging | 生产脱敏数据库 | Anthropic Production | 产品验收 |
| **PROD (生产)** | 线上服务 | Vercel Production | 生产 Supabase | Anthropic Production | 最终部署 |

### 4.2 数据准备

#### 4.2.1 基础数据 (Seed Data)

利用现有 `src/db/seed.ts` 扩展，确保测试环境包含：

| 数据类型 | 数量 | 说明 |
|:---|:---|:---|
| 组织 (Organizations) | 2+ | 至少两个组织用于多租户隔离测试 |
| 用户 (Users) | 5+ | 不同角色（管理员、编辑、只读） |
| AI 员工 | 8 预设 + 2 自定义 | 覆盖全部 EmployeeId |
| 技能 | 20+ | 覆盖各类别（content、video、review 等） |
| 团队 | 3+ | 不同规模和配置 |
| 工作流模板 | 2+ | 标准 8 步 + 精简模板 |
| 工作流实例 | 5+ | 各种状态（running、completed、failed） |
| 消息 | 20+ | 覆盖全部消息类型 |

#### 4.2.2 测试账号池

| 角色 | 邮箱模式 | 权限 | 组织 |
|:---|:---|:---|:---|
| 超级管理员 | `admin@test-org-a.com` | 全部权限 | OrgA |
| 编辑人员 | `editor@test-org-a.com` | 编辑权限 | OrgA |
| 只读用户 | `viewer@test-org-a.com` | 只读权限 | OrgA |
| 跨租户用户 | `admin@test-org-b.com` | 全部权限 | OrgB |
| 新用户 | `new@test.com` | 待注册 | 无 |

#### 4.2.3 Mock 策略

| 外部依赖 | Mock 方式 | 说明 |
|:---|:---|:---|
| Anthropic Claude API | MSW 拦截 + 固定响应 | 单元/集成测试中避免真实 AI 调用 |
| Supabase Auth | MSW 拦截 / Supabase Local | 控制认证状态 |
| Inngest | `inngest/test` 工具包 | 同步测试事件和函数执行 |
| 外部搜索 API | MSW 拦截 | web_search 等工具的固定返回 |

---

## 5. 准入与准出标准 (Criteria)

### 5.1 提测标准 (Entry Criteria)

以下条件必须 **全部满足** 方可进入测试阶段：

- [ ] `npx tsc --noEmit` 类型检查 100% 通过
- [ ] `npm run build` 生产构建 100% 通过
- [ ] `npm run lint` ESLint 检查 0 Error（Warning 可接受）
- [ ] 开发完成单元测试，核心模块覆盖率 > 60%
- [ ] 冒烟测试通过率 100%（核心路由可访问、关键按钮可点击、数据正常加载）
- [ ] 提供数据库变更脚本（`db:generate` 输出）
- [ ] 提供功能变更说明文档
- [ ] 相关 API/外部依赖 Mock 就绪

### 5.2 上线标准 (Exit Criteria)

以下条件必须 **全部满足** 方可上线发布：

- [ ] 100% 执行计划内的测试用例
- [ ] **P0 (阻断)** 级 Bug 修复率 **100%**
- [ ] **P1 (严重)** 级 Bug 修复率 **100%**
- [ ] **P2 (一般)** 级 Bug 修复率 **> 95%**（遗留问题需产品经理书面确认）
- [ ] P3 (建议) 级 Bug 可遗留，但需记录到下一迭代 Backlog
- [ ] 单元测试覆盖率: 核心模块 > 80%，整体 > 60%
- [ ] E2E 核心流程通过率 100%
- [ ] 多租户数据隔离测试通过
- [ ] 安全扫描无高危漏洞
- [ ] 性能指标满足 3.2.2 基准值
- [ ] 回归测试全部通过

### 5.3 Bug 优先级定义

| 级别 | 定义 | 示例 |
|:---|:---|:---|
| **P0 (阻断)** | 核心功能不可用，无法绕过 | 无法登录、数据丢失、白屏崩溃 |
| **P1 (严重)** | 主要功能异常，影响核心业务 | 工作流执行中断、审批操作失败、数据不一致 |
| **P2 (一般)** | 功能缺陷但有替代方案 | 筛选条件失效、分页异常、UI 错位 |
| **P3 (建议)** | 体验优化建议 | 动画卡顿、文案优化、交互改进 |

---

## 6. 进度与资源 (Schedule & Resources)

### 6.1 阶段规划

本测试方案分为 **基础设施搭建** 和 **分模块测试** 两个维度：

#### 阶段零: 测试基础设施搭建

| 任务 | 开始时间 | 结束时间 | 关键产出 | 负责方 |
|:---|:---|:---|:---|:---|
| 选型与配置 Vitest | [TBD] | [TBD] | `vitest.config.ts`、示例测试 | 开发 |
| 选型与配置 Playwright | [TBD] | [TBD] | `playwright.config.ts`、示例 E2E | 开发 |
| 搭建 CI/CD (GitHub Actions) | [TBD] | [TBD] | `.github/workflows/test.yml` | DevOps |
| 配置测试数据库 | [TBD] | [TBD] | Docker Compose / Supabase Local | DevOps |
| 编写 Seed 脚本扩展 | [TBD] | [TBD] | 多租户测试数据 | 开发 |
| MSW Mock 层搭建 | [TBD] | [TBD] | AI SDK / Supabase Mock | 开发 |

#### 阶段一: Module 4 核心测试 (P0)

| 任务 | 开始时间 | 结束时间 | 关键产出 |
|:---|:---|:---|:---|
| Agent 系统单元测试 | [TBD] | [TBD] | 6 个 Agent 文件的完整测试 |
| Server Action 集成测试 | [TBD] | [TBD] | employees、teams、workflows、messages 测试 |
| DAL 集成测试 | [TBD] | [TBD] | org-scope 隔离验证 |
| 工作流引擎集成测试 | [TBD] | [TBD] | 完整 8 步流程 + 分支条件测试 |
| Auth 链路 E2E | [TBD] | [TBD] | 注册/登录/路由保护 |
| 团队管理 E2E | [TBD] | [TBD] | 核心 CRUD 流程 |
| 安全测试 | [TBD] | [TBD] | 多租户隔离 + 权限越权报告 |
| 第一轮缺陷报告 | [TBD] | [TBD] | Bug 列表 + 统计 |
| 回归测试 | [TBD] | [TBD] | 修复验证 + 全量回归 |

#### 阶段二: Module 1-3 增量测试 (P1)

> 随各模块从 Mock 迁移到真实 DB，同步编写对应测试

| 模块 | 测试重点 | 预计时间 |
|:---|:---|:---|
| Module 1 (AI 资产重构) | 媒资理解、频道顾问、资产盘活 | Q1-Q2 |
| Module 2 (智创生产) | 热点感知、超级创作、竞品对标、批量生产 | Q1-Q3 |
| Module 3 (全渠道传播) | 发布矩阵、数据分析、精品率提升 | Q3-Q4 |

### 6.2 资源需求

| 角色 | 人数 | 职责 |
|:---|:---|:---|
| 测试经理 | 1 | 测试计划制定、进度跟踪、质量评估 |
| QA 工程师 | 1-2 | E2E 测试编写、手工测试执行、缺陷管理 |
| 开发工程师 | 参与 | 单元测试、集成测试编写 |
| DevOps | 参与 | CI/CD 搭建、测试环境维护 |

---

## 7. 风险分析与缓解 (Risk Analysis)

| # | 风险描述 | 概率 | 影响 | 缓解措施 |
|:---|:---|:---|:---|:---|
| R1 | **零测试基础设施**: 从零搭建测试框架需要较长时间 | 高 | 高 | 优先搭建 Vitest + Playwright 最小可用配置，先写核心模块测试，逐步扩展覆盖率 |
| R2 | **Supabase 连接不稳定**: 测试环境 DB 连接超时 | 中 | 高 | 使用 Supabase Local (Docker) 作为测试数据库；CI 中使用纯 Docker PostgreSQL |
| R3 | **AI 调用不确定性**: Anthropic API 返回不确定，影响测试稳定性 | 高 | 中 | 单元/集成测试中全量 Mock AI 响应；仅 E2E/手工测试使用真实 AI 调用 |
| R4 | **多模块并行开发**: Module 1-3 从 Mock 迁移时可能引入回归 | 中 | 高 | 每个模块迁移前建立 Mock 阶段的 E2E 基线，迁移后对比验证 |
| R5 | **Inngest 测试困难**: 异步事件驱动架构难以同步测试 | 中 | 中 | 使用 `inngest/test` 测试工具包，实现事件注入和同步等待 |
| R6 | **需求频繁变更**: 产品需求迭代可能导致测试用例失效 | 中 | 中 | 测试用例与需求文档强关联，需求变更时同步更新用例 |
| R7 | **多租户隔离遗漏**: 新增 DAL 函数忘记添加 org-scope 过滤 | 中 | 高 | 编写 lint 规则或集成测试用例，自动检测所有 DAL 函数是否包含 org 过滤 |
| R8 | **大数据量性能**: 随数据增长，查询性能下降 | 低 | 中 | 在测试数据库中预置大量测试数据（1000+ 记录），验证分页和索引 |

---

## 8. CI/CD 集成建议 (Recommended Pipeline)

### 8.1 推荐 GitHub Actions 流水线

```yaml
# 建议流水线结构 (非实际配置文件)
触发条件:
  - Push to main/master
  - Pull Request

阶段:
  1. Lint & Type Check
     - npm run lint
     - npx tsc --noEmit

  2. Unit Tests
     - vitest run --coverage
     - 覆盖率门禁: 核心模块 > 80%

  3. Integration Tests
     - 启动 Docker PostgreSQL
     - 执行 db:push + db:seed
     - vitest run --project=integration

  4. Build
     - npm run build

  5. E2E Tests (PR only)
     - 启动 Next.js Preview
     - playwright test
     - 上传截图/视频 Artifact

  6. Security Scan (weekly)
     - OWASP ZAP baseline scan
```

### 8.2 质量门禁

| 检查项 | 阻断条件 |
|:---|:---|
| TypeScript 类型检查 | 任何 Error 即阻断 |
| ESLint | 任何 Error 即阻断 |
| 单元测试 | 任何失败即阻断 |
| 覆盖率 | 核心模块低于 80% 即阻断 |
| 集成测试 | 任何失败即阻断 |
| 构建 | 失败即阻断 |
| E2E 测试 | 核心流程失败即阻断 |

---

## 9. 测试优先级排序 (Implementation Roadmap)

考虑到项目当前零测试基础设施的现状，建议按以下优先级逐步建设：

### 第一步: 立即可做 (Week 1-2)

1. **安装 Vitest** + 基础配置
2. **Agent 系统单元测试** — 最高 ROI，核心业务逻辑集中、纯函数多、无 DB 依赖
3. **工具函数单元测试** — 类型转换、常量验证
4. **GitHub Actions 基础流水线** — lint + type-check + build

### 第二步: 短期目标 (Week 3-4)

5. **Docker PostgreSQL 测试数据库** 搭建
6. **Server Action 集成测试** — employees、teams 优先
7. **DAL Org-Scope 隔离测试** — 安全性保障
8. **MSW Mock 层** — AI SDK / Supabase Auth

### 第三步: 中期目标 (Week 5-8)

9. **Playwright E2E** — 核心 6 条主流程
10. **工作流引擎集成测试** — 完整 8 步 + 审批 + 升级
11. **Inngest 函数测试**
12. **性能基线建立**

### 第四步: 持续完善

13. 随 Module 1-3 迁移同步扩展测试覆盖
14. 视觉回归测试
15. 安全专项扫描
16. 性能优化与监控

---

## 附录 A: 测试工具安装参考

```bash
# 单元/集成测试
npm install -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom jsdom

# E2E 测试
npm install -D @playwright/test
npx playwright install

# Mock
npm install -D msw

# Inngest 测试
npm install -D inngest/test
```

## 附录 B: 关键文件路径速查

| 类别 | 路径 |
|:---|:---|
| Server Actions | `src/app/actions/*.ts` (32 文件) |
| DAL | `src/lib/dal/*.ts` (35 文件) |
| Agent 系统 | `src/lib/agent/*.ts` (9 文件) |
| DB Schema | `src/db/schema/*.ts` (37 文件) |
| Inngest 函数 | `src/inngest/functions/*.ts` |
| 页面路由 | `src/app/(dashboard)/*/page.tsx` (34 路由) |
| 中间件 | `src/middleware.ts` |
| 类型定义 | `src/lib/types.ts`, `src/db/types.ts` |
| 常量 | `src/lib/constants.ts` |
| 种子数据 | `src/db/seed.ts` |
