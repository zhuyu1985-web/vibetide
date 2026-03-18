# Change: 技能包导入/导出与文件管理

## Why

当前技能管理只支持单一 Markdown 文本字段（`content`），无法表达完整的技能包结构。实际的技能包（如 Claude Skills）由三类文件组成：

- **SKILL.md**：核心定义文件，含 frontmatter 元数据（name、description）和 markdown 正文
- **references/**：参考文档目录，存放辅助 markdown 文件（最佳实践、检测表、规则集等）
- **scripts/**：脚本目录，存放与技能相关的自动化脚本（shell、Python 等）

用户希望从 GitHub 下载或本地编写一个技能包后，能直接上传到平台使用。当前系统不支持这种多文件技能包的导入、存储、查看和导出。

## What Changes

### 1. 数据模型扩展
- 新增 `skill_files` 表，存储技能包中的参考文档和脚本文件
- 技能的 `content` 字段继续存储 SKILL.md 正文（现有字段复用）

### 2. 技能包导入（上传）
- 支持 .zip 文件上传，自动解析技能包结构
- 从 SKILL.md frontmatter 提取 name、description 自动填充
- 上传前预览：显示包内文件树、解析出的元数据
- 校验包结构合法性（必须包含 SKILL.md）

### 3. 技能包导出（下载）
- 将技能及其关联文件打包为 .zip 下载
- 导出的 .zip 可直接被其他系统导入

### 4. 技能文件管理
- 技能详情页新增「参考文档」和「脚本」标签页
- 支持在线查看、编辑、新增、删除 reference 和 script 文件
- 文件内容在线编辑（markdown 和代码编辑器）

### 5. 技能管理增强
- 技能列表页增加「导入技能」按钮
- 技能详情页增加「导出」按钮
- 支持从 SKILL.md frontmatter 批量设置技能元数据

## Impact

- **新增表:** `skill_files`（存储技能包文件）
- **新增 API:** `/api/skills/import`（处理 zip 上传解析）、`/api/skills/[id]/export`（打包下载）
- **修改页面:** `/skills`（增加导入按钮）、`/skills/[id]`（增加文件标签页和导出按钮）
- **新增依赖:** `jszip`（前端 zip 解析预览 + 后端打包导出）
- **影响范围:** 仅技能管理模块，不影响员工绑定、工作流执行等现有功能
