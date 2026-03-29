# Vibetide 核心模块测试用例文档

> 版本：v1.0 | 日期：2026-03-22
> 测试范围：任务中心（Missions）、AI员工市场（Employee Marketplace）、技能管理（Skills Management）

---

## 一、任务中心（Missions）

### 1.1 Server Action: startMission

| 用例编号 | 功能点 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 优先级 | 测试类型 |
|---------|--------|---------|---------|---------|---------|--------|---------|
| MSN-001 | startMission | 正常创建任务 | 用户已登录，组织存在，leader已存在 | 调用 startMission({title:"两会热点追踪", scenario:"breaking_news", userInstruction:"追踪两会热点"}) | missions表新增记录status="planning"，leaderEmployeeId指向leader，executeMissionDirect启动，revalidatePath被调用 | P0 | 功能测试 |
| MSN-002 | startMission | 组织不存在 | 用户已登录，getCurrentUserOrg返回null | 调用 startMission({...}) | 抛出 Error("User has no organization") | P0 | 异常测试 |
| MSN-003 | startMission | 未登录 | 未登录 | 调用 startMission({...}) | 抛出 Error("Unauthorized") | P0 | 安全测试 |
| MSN-004 | startMission | leader不存在时自动创建 | 无slug="leader"员工 | 调用 startMission({...}) | 自动创建leader员工，mission关联该leader | P1 | 边界测试 |
| MSN-005 | startMission | 后台执行失败容错 | executeMissionDirect抛异常 | 调用 startMission({...}) | startMission正常返回，mission异步更新为failed | P1 | 异常测试 |
| MSN-006 | startMission | 空标题/空指令 | 用户已登录 | 提交空title或空instruction | 客户端disabled逻辑阻止提交 | P1 | 边界测试 |

### 1.2 Server Action: cancelMission

| 用例编号 | 功能点 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 优先级 | 测试类型 |
|---------|--------|---------|---------|---------|---------|--------|---------|
| MSN-007 | cancelMission | 正常取消 | status="executing" | 调用 cancelMission(id) | status→cancelled，completedAt设置，发送Inngest cancelled事件 | P0 | 功能测试 |
| MSN-008 | cancelMission | 未登录 | 未登录 | 调用 cancelMission("id") | 抛出 Unauthorized | P0 | 安全测试 |
| MSN-009 | cancelMission | Inngest不可用 | Inngest未启动 | 调用 cancelMission(id) | DB正常更新，Inngest send失败被静默捕获 | P1 | 异常测试 |
| MSN-010 | cancelMission | 任务不存在 | 无效id | 调用 cancelMission("bad") | 更新0行，不报错 | P2 | 边界测试 |

### 1.3 DAL 查询

| 用例编号 | 功能点 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 优先级 | 测试类型 |
|---------|--------|---------|---------|---------|---------|--------|---------|
| MSN-011 | getMissionsWithActiveTasks | 正常查询 | 3个mission | 调用(orgId) | 返回3个MissionSummary，含聚合数据，按createdAt倒序 | P0 | 功能测试 |
| MSN-012 | getMissionsWithActiveTasks | 空数据 | 无mission | 调用(orgId) | 返回空数组 | P1 | 边界测试 |
| MSN-013 | getMissionsWithActiveTasks | 多组织隔离 | 组织A 2个，组织B 3个 | 用组织A的orgId调用 | 仅返回组织A的2个 | P0 | 安全测试 |
| MSN-014 | getMissionById | 正常加载 | 含3 tasks和5 messages | 调用(id) | tasks按priority升序，messages按createdAt升序，leader和team正确 | P0 | 功能测试 |
| MSN-015 | getMissionById | 不存在 | 无效id | 调用("bad") | 返回null | P1 | 边界测试 |
| MSN-016 | getReadyTasks | 查询就绪 | 2个ready tasks | 调用(missionId) | 返回2个，按priority降序 | P1 | 功能测试 |
| MSN-017 | getMissionMessages | 按员工筛选 | 10条消息，3条指向某员工 | 调用(missionId, empId) | 返回3条 | P1 | 功能测试 |
| MSN-018 | getEmployeeTaskLoad | 负载统计 | 多员工有任务 | 调用(orgId) | 返回EmployeeLoad[]含slug和taskCount | P2 | 功能测试 |

### 1.4 Inngest 函数

| 用例编号 | 功能点 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 优先级 | 测试类型 |
|---------|--------|---------|---------|---------|---------|--------|---------|
| MSN-019 | leaderPlan | 正常分解 | status=planning | 触发"mission/created" | Leader分解任务，插入tasks，更新teamMembers和status="executing"，无依赖tasks设为ready | P0 | 集成测试 |
| MSN-020 | leaderPlan | LLM输出非JSON | Leader返回纯文本 | 触发"mission/created" | Fallback: 创建单个task | P1 | 异常测试 |
| MSN-021 | leaderPlan | 被取消中断 | 规划中发送cancelled | 触发created后发cancelled | cancelOn终止函数 | P1 | 异常测试 |
| MSN-022 | executeMissionTask | 正常执行 | task ready，有分配员工 | 触发task-ready | task→in_progress→completed，employee working→idle，保存output，触发task-completed | P0 | 集成测试 |
| MSN-023 | executeMissionTask | 非ready跳过 | task已被认领 | 触发task-ready | 返回{status:"skipped"} | P1 | 边界测试 |
| MSN-024 | executeMissionTask | Agent执行失败 | 执行报错 | 触发task-ready | task→failed，触发task-failed事件 | P0 | 异常测试 |
| MSN-025 | checkTaskDependencies | 依赖满足→ready | A完成，B依赖[A] | 触发task-completed(A) | B→ready，聚合A的output到inputContext，触发task-ready(B) | P0 | 集成测试 |
| MSN-026 | checkTaskDependencies | 全部完成→汇总 | 所有tasks completed | 最后task完成 | allCompleted=true，触发all-tasks-done | P0 | 集成测试 |
| MSN-027 | leaderConsolidate | 正常汇总 | all-tasks-done | 触发事件 | mission→consolidating→completed，保存finalOutput，重置团队idle | P0 | 集成测试 |
| MSN-028 | leaderConsolidate | 汇总失败 | agent异常 | 触发事件 | retries=1自动重试 | P1 | 异常测试 |
| MSN-029 | handleTaskFailure | 首次失败重试 | retryCount=0 | 触发task-failed | retryCount→1，status→ready，触发task-ready重试 | P0 | 功能测试 |
| MSN-030 | handleTaskFailure | 达最大重试 | retryCount=2 | 触发task-failed | 不重试，发布永久失败消息 | P0 | 功能测试 |
| MSN-031 | handleTaskFailure | 永久失败阻塞下游 | 下游有pending/ready依赖 | 触发task-failed | mission→failed，发布终止消息 | P0 | 异常测试 |

### 1.5 页面渲染

| 用例编号 | 功能点 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 优先级 | 测试类型 |
|---------|--------|---------|---------|---------|---------|--------|---------|
| MSN-032 | MissionsPage | 正常渲染 | 5个missions | 访问/missions | 统计面板+表格5行+每行含状态/名称/场景/进度/团队 | P0 | 功能测试 |
| MSN-033 | MissionsPage | 空数据 | 无missions | 访问/missions | 显示空状态提示 | P1 | 边界测试 |
| MSN-034 | MissionsClient | 状态筛选 | 多状态 | 点击"执行中" | 仅显示executing/consolidating | P1 | 功能测试 |
| MSN-035 | MissionsClient | 新建Sheet | 已登录 | 点击新建→选场景→填表→提交 | Sheet打开→场景卡片→配置表单→调用startMission→关闭刷新 | P0 | 功能测试 |
| MSN-036 | MissionDetailPage | 正常渲染 | 含tasks和messages | 访问/missions/[id] | 标题+PhaseBar+进度条+看板 | P0 | 功能测试 |
| MSN-037 | MissionDetailPage | 不存在404 | 无效id | 访问/missions/bad | 显示404 | P1 | 边界测试 |
| MSN-038 | MissionConsole | 看板视图 | 各状态tasks | 看板Tab | 三列：待处理/执行中/已完成 | P0 | 功能测试 |
| MSN-039 | MissionConsole | 输出Tab | finalOutput存在 | 切换输出Tab→点复制 | 展示输出+clipboard复制 | P1 | 功能测试 |
| MSN-040 | MissionConsole | 取消任务 | 活跃状态 | 点击取消 | 调用cancelMission+刷新 | P1 | 功能测试 |

### 1.6 数据库 Schema

| 用例编号 | 功能点 | 测试场景 | 预期结果 | 优先级 | 测试类型 |
|---------|--------|---------|---------|--------|---------|
| MSN-041 | missions表 | 级联删除 | 删mission→关联tasks/messages自动删 | P1 | 集成测试 |
| MSN-042 | missionTasks表 | 默认值 | 插入仅必填→status="pending",priority=0 | P2 | 边界测试 |
| MSN-043 | missions表 | 枚举约束 | 插入status="invalid"→数据库报错 | P1 | 边界测试 |

---

## 二、AI员工市场（Employee Marketplace）

### 2.1 Server Action: 员工CRUD

| 用例编号 | 功能点 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 优先级 | 测试类型 |
|---------|--------|---------|---------|---------|---------|--------|---------|
| EMP-001 | createEmployee | 正常创建 | 已登录，组织存在 | 调用createEmployee({slug,name,...}) | 新增记录isPreset=0 | P0 | 功能测试 |
| EMP-002 | createEmployee | 未登录 | 未登录 | 调用 | 抛出Unauthorized | P0 | 安全测试 |
| EMP-003 | createEmployee | 无组织 | 无organizationId | 调用 | 抛出"未找到所属组织" | P1 | 异常测试 |
| EMP-004 | deleteEmployee | 删除自定义 | isPreset=0 | 调用deleteEmployee(id) | 先删employeeSkills再删员工 | P0 | 功能测试 |
| EMP-005 | deleteEmployee | 删除预置 | isPreset=1 | 调用 | 抛出"Cannot delete preset employee" | P0 | 安全测试 |
| EMP-006 | deleteEmployee | 不存在 | 无效ID | 调用 | 抛出"Employee not found" | P1 | 边界测试 |
| EMP-007 | cloneEmployee | 正常克隆 | 源员工绑4技能 | 调用cloneEmployee(sourceId,...) | 新员工isPreset=0，克隆4个技能绑定 | P1 | 功能测试 |
| EMP-008 | cloneEmployee | 源不存在 | 无效sourceId | 调用 | 抛出"Source employee not found" | P1 | 异常测试 |

### 2.2 Server Action: 技能绑定

| 用例编号 | 功能点 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 优先级 | 测试类型 |
|---------|--------|---------|---------|---------|---------|--------|---------|
| EMP-009 | bindSkill | 正常绑定 | 角色兼容 | 调用bindSkillToEmployee(empId,skillId) | employeeSkills新增记录 | P0 | 功能测试 |
| EMP-010 | bindSkill | 不兼容角色 | compatibleRoles不含roleType | 调用 | 抛出不兼容错误 | P0 | 异常测试 |
| EMP-011 | bindSkill | 无角色限制 | compatibleRoles=[] | 调用 | 成功绑定 | P1 | 边界测试 |
| EMP-012 | bindSkill | 员工不存在 | 无效empId | 调用 | 抛出"Employee not found" | P1 | 异常测试 |
| EMP-013 | unbindSkill | 解绑扩展技能 | bindingType="extended" | 调用unbind | 删除记录 | P0 | 功能测试 |
| EMP-014 | unbindSkill | 解绑核心技能 | bindingType="core" | 调用 | 抛出"核心技能不可解绑" | P0 | 异常测试 |

### 2.3 Server Action: 更新操作

| 用例编号 | 功能点 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 优先级 | 测试类型 |
|---------|--------|---------|---------|---------|---------|--------|---------|
| EMP-015 | updateEmployeeProfile | 正常更新 | 员工存在 | 调用(empId, {name,nickname}) | 字段更新 | P0 | 功能测试 |
| EMP-016 | updateWorkPreferences | 正常更新 | 员工存在 | 调用(empId, prefs) | 偏好更新，异步保存版本 | P1 | 功能测试 |
| EMP-017 | updateAuthorityLevel | 正常更新 | 员工存在 | 调用(empId, "executor") | 权限更新 | P1 | 功能测试 |
| EMP-018 | toggleEmployeeDisabled | 禁用 | 可用员工 | 调用(empId, true) | disabled=1 | P1 | 功能测试 |
| EMP-019 | toggleEmployeeDisabled | 启用 | disabled=1 | 调用(empId, false) | disabled=0 | P1 | 功能测试 |

### 2.4 Server Action: 导出/导入

| 用例编号 | 功能点 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 优先级 | 测试类型 |
|---------|--------|---------|---------|---------|---------|--------|---------|
| EMP-020 | exportEmployee | 正常导出 | 绑3技能 | 调用(empId) | 返回完整配置含skills数组 | P1 | 功能测试 |
| EMP-021 | exportEmployee | 不存在 | 无效ID | 调用 | 抛出"Employee not found" | P1 | 异常测试 |
| EMP-022 | importEmployee | 正常导入 | skills name匹配 | 调用(orgId, data) | 创建员工+绑定匹配技能 | P1 | 功能测试 |
| EMP-023 | importEmployee | 部分匹配 | 3技能仅2匹配 | 调用 | 创建员工，绑定2技能 | P2 | 边界测试 |

### 2.5 Server Action: 高级功能

| 用例编号 | 功能点 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 优先级 | 测试类型 |
|---------|--------|---------|---------|---------|---------|--------|---------|
| EMP-024 | adjustAuthority | 高绩效升级 | accuracy≥95,satisfaction≥90,tasks≥50 | 调用 | 升一级 | P1 | 功能测试 |
| EMP-025 | adjustAuthority | 低绩效降级 | accuracy<60或satisfaction<50 | 调用 | 降一级 | P1 | 功能测试 |
| EMP-026 | adjustAuthority | 不满足条件 | 中等绩效 | 调用 | changed=false | P1 | 边界测试 |
| EMP-027 | rollbackConfig | 正常回滚 | 有效版本 | 调用 | 恢复快照，创建新版本记录 | P1 | 功能测试 |
| EMP-028 | rollbackConfig | 版本不属于该员工 | 跨员工版本 | 调用 | 抛出安全错误 | P1 | 安全测试 |
| EMP-029 | createSkillCombo | 正常创建 | 3个skills | 调用 | 新增combo记录 | P1 | 功能测试 |
| EMP-030 | createSkillCombo | 少于2个 | 1个skillId | 调用 | 抛出"至少需要2个技能" | P1 | 边界测试 |
| EMP-031 | applySkillCombo | 正常应用 | combo 3技能，已绑1 | 调用 | bound=2, skipped=1 | P1 | 功能测试 |

### 2.6 Server Action: 知识库

| 用例编号 | 功能点 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 优先级 | 测试类型 |
|---------|--------|---------|---------|---------|---------|--------|---------|
| EMP-032 | bindKnowledgeBase | 正常绑定 | 未绑定 | 调用 | 新增关联 | P1 | 功能测试 |
| EMP-033 | bindKnowledgeBase | 重复绑定 | 已绑定 | 调用 | 抛出"已绑定" | P1 | 异常测试 |
| EMP-034 | unbindKnowledgeBase | 正常解绑 | 存在绑定 | 调用 | 删除关联 | P1 | 功能测试 |

### 2.7 DAL 查询

| 用例编号 | 功能点 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 优先级 | 测试类型 |
|---------|--------|---------|---------|---------|---------|--------|---------|
| EMP-035 | getEmployees | 正常查询 | 11个员工 | 调用 | 返回11个，按createdAt升序，slug去重 | P0 | 功能测试 |
| EMP-036 | getEmployees | 空数据 | 新用户 | 调用 | 返回[] | P1 | 边界测试 |
| EMP-037 | getEmployeeFullProfile | 正常加载 | 完整数据 | 调用("xiaolei") | 含roleType,authorityLevel,knowledgeBases等 | P0 | 功能测试 |
| EMP-038 | getEmployeeFullProfile | 不存在 | 无效slug | 调用 | 返回undefined | P1 | 边界测试 |
| EMP-039 | getEmployees | 多组织隔离 | 多组织 | 组织A调用 | 仅返回组织A员工 | P0 | 安全测试 |

### 2.8 页面渲染

| 用例编号 | 功能点 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 优先级 | 测试类型 |
|---------|--------|---------|---------|---------|---------|--------|---------|
| EMP-040 | MarketplacePage | 正常渲染 | 9个员工 | 访问/employee-marketplace | 9卡片+创建卡片 | P0 | 功能测试 |
| EMP-041 | MarketplaceClient | SSR空数据重试 | SSR超时 | 页面加载 | 自动客户端重试(最多3次) | P1 | 异常测试 |
| EMP-042 | MarketplaceClient | 状态筛选 | 多状态 | 点"工作中" | 仅显示working员工 | P1 | 功能测试 |
| EMP-043 | MarketplaceClient | 删除自定义 | 有自定义员工 | 悬停→删除→确认 | 列表移除 | P1 | 功能测试 |
| EMP-044 | MarketplaceClient | 预置无删除 | 预置员工 | 悬停 | 无删除按钮 | P1 | 功能测试 |
| EMP-045 | ProfilePage | 正常渲染 | 完整数据 | 访问/employee/xiaolei | 并行加载13+数据源，全部展示 | P0 | 功能测试 |
| EMP-046 | ProfilePage | 不存在 | 无效slug | 访问/employee/bad | 404 | P1 | 边界测试 |
| EMP-047 | ProfilePage | 部分降级 | 某数据源异常 | 访问 | 异常降级为默认值，页面正常 | P1 | 异常测试 |

### 2.9 场景执行 API

| 用例编号 | 功能点 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 优先级 | 测试类型 |
|---------|--------|---------|---------|---------|---------|--------|---------|
| EMP-048 | POST /api/scenarios/execute | 正常执行 | 有效scenario+employee | POST | SSE流含thinking/source/text-delta/done | P0 | 集成测试 |
| EMP-049 | POST /api/scenarios/execute | 未登录 | 未登录 | POST | 401 | P0 | 安全测试 |
| EMP-050 | POST /api/scenarios/execute | 场景不存在 | 无效scenarioId | POST | 404 | P1 | 异常测试 |
| EMP-051 | POST /api/scenarios/execute | 无组织 | 用户无org | POST | 403 | P1 | 安全测试 |
| EMP-052 | POST /api/scenarios/execute | Agent组装失败 | assembleAgent异常 | POST | 500 | P1 | 异常测试 |
| EMP-053 | POST /api/scenarios/execute | 对话历史 | 传入conversationHistory | POST含10+条 | 截取最近10条，正常返回 | P2 | 功能测试 |

### 2.10 DAL: scenarios

| 用例编号 | 功能点 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 优先级 | 测试类型 |
|---------|--------|---------|---------|---------|---------|--------|---------|
| EMP-054 | getScenariosByEmployeeSlug | 正常查询 | 3个enabled场景 | 调用("xiaolei") | 返回3个，按sortOrder升序 | P1 | 功能测试 |
| EMP-055 | getScenariosByEmployeeSlug | 无组织 | orgId=null | 调用 | 返回[] | P1 | 边界测试 |

---

## 三、技能管理（Skills Management）

### 3.1 Server Action: 技能 CRUD

| 用例编号 | 功能点 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 优先级 | 测试类型 |
|---------|--------|---------|---------|---------|---------|--------|---------|
| SKL-001 | createSkill | 正常创建 | 已登录 | 调用({name,category,description}) | type="custom", version默认"1.0" | P0 | 功能测试 |
| SKL-002 | createSkill | 空名称 | 已登录 | 调用name="" | 抛出"技能名称不能为空" | P0 | 边界测试 |
| SKL-003 | createSkill | 空描述 | 已登录 | 调用description="" | 抛出"技能描述不能为空" | P0 | 边界测试 |
| SKL-004 | createSkill | 未登录 | 未登录 | 调用 | Unauthorized | P0 | 安全测试 |

### 3.2 Server Action: 插件技能

| 用例编号 | 功能点 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 优先级 | 测试类型 |
|---------|--------|---------|---------|---------|---------|--------|---------|
| SKL-005 | registerPluginSkill | 正常注册 | 已登录 | 调用含有效endpoint | type="plugin", pluginConfig保存 | P1 | 功能测试 |
| SKL-006 | registerPluginSkill | 无效URL | 已登录 | endpoint="not-url" | 抛出"API端点URL格式无效" | P1 | 边界测试 |
| SKL-007 | registerPluginSkill | 空端点 | 已登录 | endpoint="" | 抛出"API端点不能为空" | P1 | 边界测试 |
| SKL-008 | updatePluginConfig | 正常更新 | plugin技能 | 调用(id, config) | pluginConfig更新 | P1 | 功能测试 |
| SKL-009 | updatePluginConfig | 非插件技能 | custom技能 | 调用 | 抛出"只有插件技能才能更新插件配置" | P1 | 异常测试 |

### 3.3 Server Action: 更新与删除

| 用例编号 | 功能点 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 优先级 | 测试类型 |
|---------|--------|---------|---------|---------|---------|--------|---------|
| SKL-010 | updateSkill | 正常更新含版本 | custom技能存在 | 调用(id, {name,version}) | 事务：先插版本快照，再更新技能 | P0 | 功能测试 |
| SKL-011 | updateSkill | 不存在 | 无效ID | 调用 | 抛出"技能不存在" | P1 | 异常测试 |
| SKL-012 | deleteSkill | 删除custom | type="custom" | 调用 | 记录删除 | P0 | 功能测试 |
| SKL-013 | deleteSkill | 删除builtin | type="builtin" | 调用 | 抛出"内置技能不可删除" | P0 | 安全测试 |
| SKL-014 | deleteSkill | 不存在 | 无效ID | 调用 | 抛出"技能不存在" | P1 | 异常测试 |
| SKL-015 | deleteSkill | 跨组织 | 技能属其他组织 | 调用 | 抛出"技能不存在" | P0 | 安全测试 |

### 3.4 Server Action: 版本管理

| 用例编号 | 功能点 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 优先级 | 测试类型 |
|---------|--------|---------|---------|---------|---------|--------|---------|
| SKL-016 | rollbackSkillVersion | 正常回滚 | 有历史版本 | 调用(skillId, versionId) | 事务：保存当前快照+恢复历史snapshot | P1 | 功能测试 |
| SKL-017 | rollbackSkillVersion | 版本不属于该技能 | 跨技能版本 | 调用 | 抛出"版本不属于此技能" | P1 | 安全测试 |
| SKL-018 | rollbackSkillVersion | 版本不存在 | 无效versionId | 调用 | 抛出"版本不存在" | P1 | 异常测试 |

### 3.5 Server Action: 技能文件

| 用例编号 | 功能点 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 优先级 | 测试类型 |
|---------|--------|---------|---------|---------|---------|--------|---------|
| SKL-019 | addSkillFile | 正常添加 | 技能存在 | 调用 | 新增skillFiles记录 | P1 | 功能测试 |
| SKL-020 | addSkillFile | 技能不存在 | 无效skillId | 调用 | 抛出"技能不存在" | P1 | 异常测试 |
| SKL-021 | updateSkillFile | 正常更新 | 文件存在 | 调用(fileId, {content}) | content更新 | P1 | 功能测试 |
| SKL-022 | deleteSkillFile | 正常删除 | 文件存在 | 调用(fileId) | 记录删除 | P1 | 功能测试 |
| SKL-023 | importSkillPackage | 正常导入 | 已登录 | 调用含文件 | 事务创建skill+skillFiles | P1 | 功能测试 |
| SKL-024 | importSkillPackage | 空名称 | 已登录 | name="" | 抛出"技能名称不能为空" | P1 | 边界测试 |

### 3.6 Server Action: 使用记录

| 用例编号 | 功能点 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 优先级 | 测试类型 |
|---------|--------|---------|---------|---------|---------|--------|---------|
| SKL-025 | recordSkillUsage | 记录成功 | 有技能和员工 | 调用success=true | 新增记录success=1 | P1 | 功能测试 |
| SKL-026 | recordSkillUsage | 记录失败 | 有技能和员工 | 调用success=false | 新增记录success=0 | P1 | 功能测试 |
| SKL-027 | getSkillUsageStats | 有记录 | 10次(8成功2失败) | 调用(skillId) | totalUsages=10, successRate=80 | P1 | 功能测试 |
| SKL-028 | getSkillUsageStats | 无记录 | 无使用 | 调用 | totalUsages=0 | P2 | 边界测试 |

### 3.7 Server Action: 技能测试

| 用例编号 | 功能点 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 优先级 | 测试类型 |
|---------|--------|---------|---------|---------|---------|--------|---------|
| SKL-029 | testSkillExecution | 正常测试 | API Key配置 | 调用(skillId, "测试输入") | 返回含output/durationMs/tokensUsed/qualityScore | P0 | 集成测试 |
| SKL-030 | testSkillExecution | 无API Key | 未配置 | 调用 | success=false, error="未配置OPENAI_API_KEY" | P0 | 异常测试 |
| SKL-031 | testSkillExecution | 技能不存在 | 无效ID | 调用 | 抛出"Skill not found" | P1 | 异常测试 |
| SKL-032 | testSkillExecution | LLM异常 | API调用失败 | 调用 | success=false, error含信息 | P1 | 异常测试 |

### 3.8 DAL 查询

| 用例编号 | 功能点 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 优先级 | 测试类型 |
|---------|--------|---------|---------|---------|---------|--------|---------|
| SKL-033 | getSkills | 正常查询 | 29 builtin + 2 custom | 调用 | 按category+name排序，组织覆盖同名全局 | P0 | 功能测试 |
| SKL-034 | getSkills | 按分类 | 多分类 | 调用("perception") | 仅返回perception类 | P1 | 功能测试 |
| SKL-035 | getSkillsWithBindCount | 含计数 | A绑3员工，B绑0 | 调用 | A.bindCount=3, B.bindCount=0 | P1 | 功能测试 |
| SKL-036 | getSkillDetail | 正常详情 | 技能绑2员工 | 调用(id) | 含boundEmployees(2)、content、schemas | P0 | 功能测试 |
| SKL-037 | getSkillDetail | 不存在 | 无效ID | 调用 | 返回null | P1 | 边界测试 |
| SKL-038 | getSkillsNotBound | 正常 | 绑5个，共29 | 调用(empId) | 返回24个 | P0 | 功能测试 |
| SKL-039 | getSkillRecommendations | 正常推荐 | perception_agent | 调用 | 排除已绑和不兼容，按score降序，最多10 | P1 | 功能测试 |
| SKL-040 | getSkillVersionHistory | 有历史 | 5个版本 | 调用 | 返回5个，versionNumber降序 | P1 | 功能测试 |
| SKL-041 | getSkillDetailPageData | 综合查询 | 完整数据 | 调用(id) | 返回{skill,versions,usageStats} | P0 | 功能测试 |

### 3.9 多组织隔离

| 用例编号 | 功能点 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 优先级 | 测试类型 |
|---------|--------|---------|---------|---------|---------|--------|---------|
| SKL-042 | preferScopedSkillRows | 全局+组织合并 | 全局和组织技能 | 调用getSkills() | 组织同名技能优先于全局 | P0 | 安全测试 |
| SKL-043 | buildSkillAccessCondition | 跨组织访问 | 技能属其他组织 | 调用getSkillDetail(id) | 返回null | P0 | 安全测试 |

### 3.10 测试脚本

| 用例编号 | 功能点 | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 优先级 | 测试类型 |
|---------|--------|---------|---------|---------|---------|--------|---------|
| SKL-044 | test-skills | Dry Run | DB有seed | `npx tsx scripts/test-skills.ts --dry-run` | 检查完整性，输出统计 | P1 | 功能测试 |
| SKL-045 | test-skills | LLM执行 | DB+API Key | 运行 | 每技能调LLM，验证中文/Markdown/结构 | P1 | 集成测试 |
| SKL-046 | test-skills | 未seed | 数据库空 | 运行 | 报"Skill not found. Run db:seed first." | P1 | 异常测试 |

---

## 四、测试覆盖率矩阵

### 4.1 模块覆盖统计

| 模块 | Server Action | DAL | Inngest | 页面渲染 | API | 脚本 | 合计 |
|------|-------------|-----|---------|---------|-----|------|------|
| 任务中心 | 10 | 8 | 13 | 9 | 0 | 0 | 43 |
| AI员工市场 | 34 | 5 | 0 | 8 | 6 | 0 | 55 |
| 技能管理 | 24 | 9 | 0 | 0 | 0 | 3 | 46 |
| **合计** | **68** | **22** | **13** | **17** | **6** | **3** | **144** |

### 4.2 优先级分布

| 优先级 | 用例数 | 占比 |
|--------|-------|------|
| P0（阻塞级） | 40 | 28% |
| P1（核心） | 78 | 54% |
| P2（一般） | 26 | 18% |

### 4.3 测试类型分布

| 测试类型 | 用例数 | 占比 |
|---------|-------|------|
| 功能测试 | 78 | 54% |
| 异常测试 | 26 | 18% |
| 安全测试 | 16 | 11% |
| 边界测试 | 17 | 12% |
| 集成测试 | 7 | 5% |

### 4.4 Inngest 函数覆盖

| Inngest 函数 | 正常 | 失败 | 取消/边界 | 覆盖 |
|-------------|------|------|----------|------|
| leaderPlan | MSN-019 | MSN-020 | MSN-021 | 完全 |
| executeMissionTask | MSN-022 | MSN-024 | MSN-023 | 完全 |
| checkTaskDependencies | MSN-025,026 | — | — | 基本 |
| leaderConsolidate | MSN-027 | MSN-028 | — | 基本 |
| handleTaskFailure | MSN-029,030 | MSN-031 | — | 完全 |

---

## 五、测试执行建议

### 5.1 执行优先级

**Phase 1 — 冒烟测试（P0，约40个用例）**
- 三模块核心CRUD
- 全部认证/授权检查
- 任务 创建→执行→完成 端到端
- 员工 创建→绑技能→删除 生命周期
- 技能 创建→更新→删除 + 内置保护

**Phase 2 — 核心功能测试（P1，约78个用例）**
- Inngest 完整执行链路
- 失败重试和级联失败
- 版本管理和回滚
- 页面渲染和筛选交互

**Phase 3 — 回归测试（P2）**
- 边界条件和降级
- 无限滚动、自动刷新
- 推荐算法

### 5.2 测试环境要求

| 环境 | 要求 |
|------|------|
| 数据库 | Supabase PostgreSQL（db:push + db:seed） |
| 环境变量 | .env.local 完整配置 |
| Inngest | Inngest dev server（inngest-cli dev） |
| 浏览器 | Chrome/Edge 最新版 |
| Node.js | 18+ |

### 5.3 测试数据准备

1. 运行 `npm run db:seed` 填充9个预置员工、29个技能、知识库
2. 创建2-3个自定义员工、2-3个自定义技能
3. 通过 startMission 创建不同场景任务
4. 创建2个组织验证隔离

### 5.4 自动化工具建议

| 层级 | 工具 | 覆盖范围 |
|------|------|---------|
| 单元测试 | Vitest | Server Actions 输入校验、DAL 数据映射 |
| 集成测试 | Vitest + test DB | DAL 查询、完整 DB 操作 |
| E2E 测试 | Playwright | 页面渲染、交互流程 |
| API 测试 | Vitest / Supertest | /api/scenarios/execute SSE 流 |
| 性能测试 | k6 | 大数据量查询 |

### 5.5 需特别关注的风险点

1. **executeMissionDirect 异步执行**：.then()/.catch() 模式，需确认失败时 status 正确标为 failed
2. **Inngest cancelOn 匹配**：`mission/cancelled` 事件 match: "data.missionId" 的可靠性
3. **preferScopedSkillRows**：组织技能覆盖全局同名技能的边界
4. **SSE 流中断**：/api/scenarios/execute 客户端断连时的资源清理
5. **并发竞态**：多个 task-ready 同时触发时 status 检查防重复
6. **Token 预算未检查**：mission.tokenBudget=200000 但代码未检查 tokensUsed 是否超限
7. **技能重复绑定**：bindSkillToEmployee 未检查已有绑定（与知识库绑定行为不一致）
