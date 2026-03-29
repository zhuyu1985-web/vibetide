# Vibetide 核心模块功能清单

> 版本：v1.0 | 日期：2026-03-22
> 分析范围：任务中心（Missions）、AI员工市场（Employee Marketplace）、技能管理（Skills Management）

---

## 一、任务中心（Missions）

| 序号 | 功能大类 | 功能点 | 功能描述 | 实现状态 | 代码位置 | 备注 |
|------|---------|--------|---------|---------|---------|------|
| 1 | 任务创建 | 场景选择式任务创建 | 用户选择场景(突发新闻/深度报道等10个模板)，填写标题和指令 | ✅ 已实现 | `missions-client.tsx` (Sheet), `actions/missions.ts` | 支持多场景分类Tab |
| 2 | 任务创建 | 队长自动选配 | 创建时自动查找/生成 leader 员工 | ✅ 已实现 | `actions/missions.ts` | 无leader时自动创建 |
| 3 | 任务创建 | 场景模板指令 | 每个场景预配模板指令 | ✅ 已实现 | `constants.ts` (SCENARIO_CONFIG) | |
| 4 | 任务规划 | 队长智能拆解 | 队长AI分析指令，拆解为DAG子任务 | ✅ 已实现 | `leader-plan.ts`, `mission-executor.ts` | 双模式：Inngest+直连 |
| 5 | 任务规划 | 团队自动组建 | 根据任务需求自动选择团队成员 | ✅ 已实现 | `leader-plan.ts` | 基于员工技能匹配 |
| 6 | 任务规划 | DAG依赖管理 | 子任务间支持依赖关系 | ✅ 已实现 | `missions.ts` (schema), `check-task-dependencies.ts` | |
| 7 | 任务执行 | 并行任务执行 | 无依赖任务并行，有依赖等前置完成 | ✅ 已实现 | `execute-mission-task.ts`, `check-task-dependencies.ts` | |
| 8 | 任务执行 | Agent组装与调用 | 每个子任务用分配员工的7层Agent | ✅ 已实现 | `execute-mission-task.ts` | |
| 9 | 任务执行 | 上下文传递 | 前置任务输出→下游输入 | ✅ 已实现 | `check-task-dependencies.ts` | |
| 10 | 任务执行 | 员工状态自动切换 | working↔idle 自动管理 | ✅ 已实现 | `execute-mission-task.ts` | |
| 11 | 任务执行 | Token预算管理 | 跟踪token消耗 | ✅ 已实现 | `missions.ts` (schema) | 仅记录，未强制检查 |
| 12 | 任务汇总 | 队长汇总交付 | 所有子任务完成后生成最终交付物 | ✅ 已实现 | `leader-consolidate.ts` | |
| 13 | 错误处理 | 任务失败重试 | 最多重试2次 | ✅ 已实现 | `handle-task-failure.ts` | MAX_RETRIES=2 |
| 14 | 错误处理 | 下游阻塞检测 | 关键任务失败时决定是否终止Mission | ✅ 已实现 | `handle-task-failure.ts` | |
| 15 | 任务取消 | Mission取消 | 支持Inngest cancelOn | ✅ 已实现 | `actions/missions.ts` | |
| 16 | 消息系统 | P2P协作消息 | 员工间协调/结果/状态消息 | ✅ 已实现 | `missions.ts` (schema) | |
| 17 | 任务列表 | 统计面板 | 总数/执行中/已完成/异常/排队 | ✅ 已实现 | `missions-client.tsx` | |
| 18 | 任务列表 | 多维筛选 | 状态+场景+关键字 | ✅ 已实现 | `missions-client.tsx` | |
| 19 | 任务列表 | 无限滚动 | IntersectionObserver | ✅ 已实现 | `missions-client.tsx` | |
| 20 | 任务列表 | 自动刷新 | 活跃任务5秒刷新 | ✅ 已实现 | `missions-client.tsx` | |
| 21 | 任务列表 | 行展开详情 | 阶段管道+子任务分布+团队 | ✅ 已实现 | `missions-client.tsx` | |
| 22 | 任务详情 | 控制台概览 | 阶段进度条+用时统计 | ✅ 已实现 | `mission-console-client.tsx` | |
| 23 | 任务详情 | 看板视图 | 三列Kanban+动画 | ✅ 已实现 | `mission-console-client.tsx` | |
| 24 | 任务详情 | 协作消息流 | 按时间展示通信记录 | ✅ 已实现 | `mission-console-client.tsx` | |
| 25 | 任务详情 | 最终输出查看 | 查看+一键复制 | ✅ 已实现 | `mission-console-client.tsx` | |
| 26 | 数据层 | DAL批量查询 | 避免N+1 | ✅ 已实现 | `dal/missions.ts` | |
| 27 | 数据层 | 员工负载统计 | 各员工活跃任务数 | ✅ 已实现 | `dal/missions.ts` | |
| 28 | 数据层 | 员工活动摘要 | 当前执行任务信息 | ✅ 已实现 | `dal/missions.ts` | |
| 29 | 进化学习 | 完成后触发学习 | 发送learn事件 | ✅ 已实现 | `leader-consolidate.ts` | |
| 30 | 任务详情 | 人工介入/审批节点 | 关键节点人工干预 | ❌ 未实现 | — | 全自动执行，无审批 |
| 31 | 任务详情 | 任务重新执行 | 失败/完成的任务重新发起 | ❌ 未实现 | — | |
| 32 | 任务列表 | 任务删除/归档 | 删除或归档历史任务 | ❌ 未实现 | — | |
| 33 | 任务详情 | 子任务输出详情 | 展开查看完整输出 | ⚠️ 部分实现 | `mission-console-client.tsx` | 仅显示summary |

---

## 二、AI员工市场（Employee Marketplace）

| 序号 | 功能大类 | 功能点 | 功能描述 | 实现状态 | 代码位置 | 备注 |
|------|---------|--------|---------|---------|---------|------|
| 1 | 员工浏览 | 员工市场列表 | 卡片式展示所有AI员工 | ✅ 已实现 | `employee-marketplace-client.tsx` | |
| 2 | 员工浏览 | 状态筛选 | 按工作中/空闲/学习中/审核中过滤 | ✅ 已实现 | `employee-marketplace-client.tsx` | |
| 3 | 员工浏览 | 员工计数 | Badge显示总数 | ✅ 已实现 | `employee-marketplace-client.tsx` | |
| 4 | 员工浏览 | 容错重试 | SSR失败时客户端重试 | ✅ 已实现 | `employee-marketplace-client.tsx` | 最多3次 |
| 5 | 员工创建 | 创建自定义员工 | 弹窗设置slug/名称/角色等 | ✅ 已实现 | `employee-create-dialog.tsx`, `employees.ts` | |
| 6 | 员工管理 | 删除自定义员工 | 预置禁删，自定义可删（含确认） | ✅ 已实现 | `employee-marketplace-client.tsx`, `employees.ts` | |
| 7 | 员工档案 | 员工详情页 | 完整档案+头像+状态+绩效统计 | ✅ 已实现 | `employee-profile-client.tsx` | |
| 8 | 员工档案 | Tab式多面板 | 技能/知识库/偏好/权限/绩效/进化/版本/场景 | ✅ 已实现 | `employee-profile-client.tsx` | |
| 9 | 技能配置 | 技能绑定/解绑 | 含兼容性校验 | ✅ 已实现 | `employees.ts`, `skill-browser-dialog.tsx` | |
| 10 | 技能配置 | 核心技能保护 | core类型不可解绑 | ✅ 已实现 | `employees.ts` | |
| 11 | 技能配置 | 技能熟练度 | 0-100滑块调整 | ✅ 已实现 | `employees.ts`, `employee-profile-client.tsx` | |
| 12 | 技能配置 | 技能推荐 | 基于角色兼容性推荐 | ✅ 已实现 | `dal/skills.ts` | |
| 13 | 知识库配置 | 知识库绑定/解绑 | 关联/解除知识库 | ✅ 已实现 | `employees.ts` | |
| 14 | 权限管理 | 权限等级设置 | observer/advisor/executor/coordinator | ✅ 已实现 | `employees.ts`, `employee-profile-client.tsx` | |
| 15 | 权限管理 | 自主/审批行动配置 | 可自主执行和需审批的操作列表 | ✅ 已实现 | `employees.ts` | |
| 16 | 权限管理 | 绩效自动权限调整 | 基于准确率/满意度自动升降 | ✅ 已实现 | `employee-advanced.ts` | |
| 17 | 沟通配置 | 工作偏好设置 | 主动性/汇报频率/自主等级/沟通风格 | ✅ 已实现 | `employees.ts`, `employee-profile-client.tsx` | |
| 18 | 员工管理 | 员工克隆 | 克隆含技能绑定 | ✅ 已实现 | `employees.ts` | |
| 19 | 员工管理 | 员工启用/禁用 | Toggle启停 | ✅ 已实现 | `employees.ts` | |
| 20 | 员工管理 | 员工导出/导入 | JSON格式 | ✅ 已实现 | `employees.ts` | |
| 21 | 绩效看板 | 绩效统计展示 | 任务数/准确率/响应时长/满意度 | ✅ 已实现 | `employee-profile-client.tsx` | |
| 22 | 绩效看板 | 绩效趋势图 | 30天趋势折线图 | ✅ 已实现 | `performance-charts.tsx` | |
| 23 | 进化学习 | 进化曲线 | 能力进化可视化 | ✅ 已实现 | `evolution-tab.tsx` | |
| 24 | 进化学习 | 用户反馈统计 | 采纳/拒绝/修改数及采纳率 | ✅ 已实现 | `dal/evolution.ts` | |
| 25 | 进化学习 | 学习模式管理 | 查看/删除学习到的偏好模式 | ✅ 已实现 | `actions/evolution.ts` | |
| 26 | 进化学习 | 主动触发学习 | 从未处理反馈中触发 | ✅ 已实现 | `actions/learning.ts` | |
| 27 | 进化学习 | 效果归因分析 | 效果提升归因到配置变更 | ✅ 已实现 | `dal/evolution.ts` | |
| 28 | 版本管理 | 配置版本历史 | 变更自动存快照 | ✅ 已实现 | `employee-advanced.ts` | |
| 29 | 版本管理 | 配置回滚 | 回滚到历史版本 | ✅ 已实现 | `employee-advanced.ts` | |
| 30 | 版本管理 | 版本历史展示 | UI组件 | ✅ 已实现 | `version-history.tsx` | |
| 31 | 场景工作台 | 场景卡片入口 | 每个员工预配场景 | ✅ 已实现 | `scenario-workbench.tsx` | |
| 32 | 场景工作台 | 场景对话执行 | SSE流式与员工对话 | ✅ 已实现 | `scenario-chat-sheet.tsx`, `api/scenarios/` | |
| 33 | Agent调试 | System Prompt预览 | 查看完整7层prompt | ✅ 已实现 | `employee-advanced.ts` | |
| 34 | Agent调试 | 技能在线测试 | 真实LLM测试 | ✅ 已实现 | `employee-advanced.ts`, `skill-test-dialog.tsx` | |
| 35 | 技能组合 | Skill Combo管理 | 创建/删除/应用技能组合 | ✅ 已实现 | `employee-advanced.ts`, `skill-combo-manager.tsx` | |
| 36 | 员工管理 | 员工搜索 | 文本搜索 | ❌ 未实现 | — | 仅有状态筛选 |
| 37 | 员工管理 | 员工排序 | 按绩效/时间/状态排序 | ❌ 未实现 | — | 固定按创建时间 |
| 38 | 员工档案 | 基本信息编辑 | 在线编辑名称/头衔 | ⚠️ 部分实现 | `employees.ts` (Action有但UI无入口) | |

---

## 三、技能管理（Skills Management）

| 序号 | 功能大类 | 功能点 | 功能描述 | 实现状态 | 代码位置 | 备注 |
|------|---------|--------|---------|---------|---------|------|
| 1 | 技能库 | 技能列表查询 | 按分类/类型获取，多租户隔离 | ✅ 已实现 | `dal/skills.ts` | 组织覆盖全局同名 |
| 2 | 技能库 | 技能详情查询 | 完整信息含绑定员工 | ✅ 已实现 | `dal/skills.ts` | |
| 3 | 技能库 | 未绑定技能查询 | 指定员工尚未绑定的技能 | ✅ 已实现 | `dal/skills.ts` | |
| 4 | 技能CRUD | 创建自定义技能 | custom类型 | ✅ 已实现 | `actions/skills.ts` | |
| 5 | 技能CRUD | 更新技能 | 自动创建版本快照 | ✅ 已实现 | `actions/skills.ts` | |
| 6 | 技能CRUD | 删除技能 | 内置禁删 | ✅ 已实现 | `actions/skills.ts` | |
| 7 | 技能测试 | 技能在线测试 | 真实LLM执行+验证+质量自评 | ✅ 已实现 | `employee-advanced.ts` | |
| 8 | 技能测试 | 批量测试脚本 | CLI批量测试29个内置技能 | ✅ 已实现 | `scripts/test-skills.ts` | |
| 9 | 版本管理 | 版本历史记录 | 自动保存版本快照 | ✅ 已实现 | `skill-versions.ts`, `dal/skills.ts` | |
| 10 | 版本管理 | 版本回滚 | 事务回滚到历史版本 | ✅ 已实现 | `actions/skills.ts` | |
| 11 | 版本管理 | 版本号递增 | 自动管理 | ✅ 已实现 | `dal/skills.ts` | |
| 12 | 插件接入 | 第三方插件注册 | endpoint/auth/请求模板/响应映射 | ✅ 已实现 | `actions/skills.ts` | |
| 13 | 插件接入 | 插件配置更新 | 修改API配置 | ✅ 已实现 | `actions/skills.ts` | |
| 14 | 技能组合 | Combo创建 | 多技能串联(≥2个) | ✅ 已实现 | `employee-advanced.ts` | |
| 15 | 技能组合 | Combo应用 | 一键批量绑定到员工 | ✅ 已实现 | `employee-advanced.ts` | |
| 16 | 技能组合 | Combo删除 | 删除组合 | ✅ 已实现 | `employee-advanced.ts` | |
| 17 | 使用记录 | 使用记录存储 | 成功/失败/质量分/耗时/token | ✅ 已实现 | `actions/skills.ts` | |
| 18 | 使用记录 | 使用统计 | 聚合查询 | ✅ 已实现 | `actions/skills.ts` | |
| 19 | 技能文件 | 文件管理 | 附加参考文件/脚本CRUD | ✅ 已实现 | `actions/skills.ts` | |
| 20 | 技能文件 | 技能包导入 | 导入技能+文件 | ✅ 已实现 | `actions/skills.ts` | |
| 21 | 技能推荐 | 智能推荐算法 | 角色兼容+分类覆盖评分Top10 | ✅ 已实现 | `dal/skills.ts` | |
| 22 | 技能库 | 技能库浏览UI页面 | 独立的 /skills 路由 | ❌ 未实现 | — | 技能仅嵌入员工档案 |
| 23 | 技能库 | 技能详情UI页面 | 独立的 /skills/[id] 路由 | ❌ 未实现 | — | |
| 24 | 版本管理 | 灰度发布 | 技能版本灰度分发到部分员工 | ❌ 未实现 | — | 需求中提及 |
| 25 | 插件接入 | 插件健康检测 | 定期检测API可用性 | ❌ 未实现 | — | |
| 26 | 使用记录 | 使用记录UI展示 | 可视化图表 | ❌ 未实现 | — | 有API无前端 |

---

## 四、汇总统计

### 完成率

| 模块 | ✅ 已实现 | ⚠️ 部分实现 | ❌ 未实现 | 总功能点 | 完成率 |
|------|----------|-------------|----------|---------|--------|
| 任务中心 | 29 | 1 | 3 | 33 | **87.9%** |
| AI员工市场 | 35 | 1 | 2 | 38 | **92.1%** |
| 技能管理 | 21 | 0 | 5 | 26 | **80.8%** |
| **合计** | **85** | **2** | **10** | **97** | **87.6%** |

### 差距分析

**任务中心** — 核心引擎层（规划/执行/汇总/错误处理/消息）完整，差距在用户交互层：
- 缺少人工审批节点（需求"关键节点人工介入"无实现）
- 缺少任务重新执行和删除/归档
- 子任务输出详情不完整

**AI员工市场** — 三个模块中完成度最高，差距仅在：
- 市场页缺文本搜索和多维排序
- 基本信息编辑的UI入口缺失（Action已有）

**技能管理** — 后端实现完备，差距在前端展示：
- 缺独立的技能库浏览/详情页面
- 使用统计数据有API无前端可视化
- 版本灰度发布未实现
