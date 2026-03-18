## ADDED Requirements

### Requirement: 技能包文件存储
系统 SHALL 在数据库中维护 `skill_files` 表，存储技能包中的参考文档和脚本文件。每个文件记录 SHALL 包含：文件类型（reference/script）、文件名、相对路径、文本内容。文件 SHALL 通过外键关联到 `skills` 表，删除技能时 SHALL 级联删除关联文件。SKILL.md 正文内容 SHALL 存储在 `skills.content` 字段中。

#### Scenario: 创建技能文件记录
- **WHEN** 系统为某技能创建一个参考文档文件记录
- **THEN** 文件记录 SHALL 包含 skill_id、organization_id、file_type='reference'、file_name、file_path、content
- **AND** file_path SHALL 为相对路径格式（如 'references/detection.md'）

#### Scenario: 级联删除
- **WHEN** 一个技能被删除
- **THEN** 该技能关联的所有 skill_files 记录 SHALL 被自动级联删除

#### Scenario: 路径唯一性
- **WHEN** 尝试为同一技能创建具有相同 file_path 的文件记录
- **THEN** 系统 SHALL 拒绝并返回唯一性约束错误

---

### Requirement: 技能包 Zip 导入
系统 SHALL 支持通过上传 .zip 文件导入技能包。导入流程 SHALL 包含前端预览和后端存储两个阶段。

#### Scenario: 上传并解析有效 Zip 包
- **WHEN** 用户在技能列表页点击「导入技能」并上传一个包含 SKILL.md 的 .zip 文件
- **THEN** 系统 SHALL 在浏览器端解压 zip 文件
- **AND** SHALL 显示文件树预览
- **AND** SHALL 从 SKILL.md 的 YAML frontmatter 中提取 name 和 description 并自动填充到表单
- **AND** 用户可修改提取的元数据后确认导入

#### Scenario: Zip 包缺少 SKILL.md
- **WHEN** 用户上传的 .zip 文件中不包含 SKILL.md（顶层或唯一子目录下）
- **THEN** 系统 SHALL 显示错误提示「技能包必须包含 SKILL.md 文件」
- **AND** SHALL 阻止导入操作

#### Scenario: Zip 包大小超限
- **WHEN** 用户上传的 .zip 文件大小超过 10MB
- **THEN** 系统 SHALL 拒绝上传并提示「文件大小不能超过 10MB」

#### Scenario: Zip 包文件数量超限
- **WHEN** 解压后的文件数量超过 20 个
- **THEN** 系统 SHALL 显示警告并阻止导入

#### Scenario: 路径安全校验
- **WHEN** zip 包中的文件路径包含 `..` 或绝对路径
- **THEN** 系统 SHALL 过滤掉这些文件并在预览中标记为「已跳过（不安全路径）」

#### Scenario: 嵌套目录的 Zip 包
- **WHEN** zip 包的根目录下只有一个文件夹（如 `my-skill/`），且 SKILL.md 在该文件夹内
- **THEN** 系统 SHALL 自动识别该子目录为技能包根目录，正确解析其中的文件结构

---

### Requirement: 技能包导出
系统 SHALL 支持将技能及其关联文件导出为 .zip 文件下载。

#### Scenario: 导出完整技能包
- **WHEN** 用户在技能详情页点击「导出」按钮
- **THEN** 系统 SHALL 构建一个 .zip 文件，包含：
  - 根目录的 SKILL.md（含 frontmatter 和 skills.content 内容）
  - references/ 目录下的所有参考文档文件
  - scripts/ 目录下的所有脚本文件
- **AND** 浏览器 SHALL 自动下载该 zip 文件，文件名为 `{skill-name}.zip`

#### Scenario: 导出无附加文件的技能
- **WHEN** 技能没有关联的 skill_files 记录
- **THEN** 导出的 .zip 中 SHALL 仅包含 SKILL.md 文件

---

### Requirement: 技能文件在线管理
技能详情页 SHALL 提供参考文档和脚本文件的完整管理功能。

#### Scenario: 查看技能文件列表
- **WHEN** 用户访问技能详情页
- **THEN** SHALL 在 SKILL.md 内容区域下方显示「参考文档」和「脚本」两个标签页
- **AND** 每个标签页 SHALL 列出对应类型的文件名列表及文件大小

#### Scenario: 查看文件内容
- **WHEN** 用户点击某个参考文档或脚本文件
- **THEN** SHALL 展开显示文件的完整文本内容
- **AND** markdown 文件 SHALL 支持渲染预览
- **AND** 脚本文件 SHALL 以代码格式高亮显示

#### Scenario: 新增文件
- **WHEN** 用户在「参考文档」或「脚本」标签页点击「添加文件」
- **THEN** SHALL 弹出对话框，要求输入文件名和文件内容
- **AND** 文件名 SHALL 自动添加对应的目录前缀（references/ 或 scripts/）
- **AND** 保存后文件 SHALL 出现在文件列表中

#### Scenario: 编辑文件
- **WHEN** 用户点击某个文件的「编辑」按钮
- **THEN** SHALL 切换为编辑模式，显示文本编辑区域
- **AND** 用户可修改文件内容并保存

#### Scenario: 删除文件
- **WHEN** 用户点击某个文件的「删除」按钮并确认
- **THEN** 该文件记录 SHALL 从 skill_files 表中删除
- **AND** 文件列表 SHALL 立即更新

---

### Requirement: 技能导入对话框
系统 SHALL 提供独立的技能包导入对话框组件。

#### Scenario: 打开导入对话框
- **WHEN** 用户点击技能列表页的「导入技能」按钮
- **THEN** SHALL 弹出导入对话框
- **AND** 对话框 SHALL 包含：文件拖放区域、或点击选择文件按钮
- **AND** SHALL 提示接受 .zip 格式

#### Scenario: 导入预览与确认
- **WHEN** zip 文件解析成功后
- **THEN** 对话框 SHALL 显示：
  - 提取的技能名称（可编辑）
  - 提取的技能描述（可编辑）
  - 技能分类选择（默认「知识」类）
  - 文件树预览（显示 SKILL.md、references/、scripts/ 中的文件）
  - 文件总数和总大小统计
- **AND** 用户点击「确认导入」后 SHALL 调用 Server Action 创建技能和文件记录

#### Scenario: 导入同名技能
- **WHEN** 用户导入的技能包名称与现有技能重复
- **THEN** 系统 SHALL 提示用户「该名称已存在」并允许修改名称后重试
