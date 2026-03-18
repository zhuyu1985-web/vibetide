## 1. 数据模型

- [x] 1.1 在 `src/db/schema/` 新增 `skill-files.ts`，定义 `skill_files` 表（id, skill_id, organization_id, file_type, file_name, file_path, content, created_at, updated_at），含外键约束和唯一索引 (skill_id, file_path)
- [x] 1.2 在 `src/db/schema/index.ts` 中导出新表
- [x] 1.3 在 `src/db/types.ts` 中导出 `SkillFile` / `NewSkillFile` 类型
- [x] 1.4 运行 `npm run db:push` 推送 schema 到数据库
- [x] 1.5 验证：`npx tsc --noEmit` 类型检查通过

## 2. 数据访问层

- [x] 2.1 在 `src/lib/dal/skills.ts` 中新增 `getSkillFiles(skillId)` 函数，返回技能关联的所有文件记录
- [x] 2.2 新增 `getSkillDetailWithFiles(id)` 函数，返回技能详情 + 关联文件列表
- [x] 2.3 验证：类型检查通过

## 3. Server Actions

- [x] 3.1 新增 `importSkillPackage(data)` action：接收结构化的技能包数据（名称、描述、分类、SKILL.md 内容、文件列表），在事务中创建 skill + skill_files
- [x] 3.2 新增 `addSkillFile(skillId, data)` action：为技能添加单个文件
- [x] 3.3 新增 `updateSkillFile(fileId, data)` action：更新文件内容
- [x] 3.4 新增 `deleteSkillFile(fileId)` action：删除文件
- [x] 3.5 验证：类型检查通过

## 4. 导出 API

- [x] 4.1 安装 `jszip` 依赖：`npm install jszip`
- [x] 4.2 新增 API Route `src/app/api/skills/[id]/export/route.ts`：查询技能 + 文件 → 用 jszip 构建 zip → 返回 Response stream
- [x] 4.3 在 SKILL.md 导出时自动生成 frontmatter（name, description）
- [x] 4.4 验证：类型检查通过

## 5. Zip 解析工具

- [x] 5.1 新增 `src/lib/skill-package.ts` 工具模块：
  - `parseSkillZip(file: File)` — 在浏览器端用 jszip 解压，返回结构化数据
  - `parseFrontmatter(content: string)` — 解析 SKILL.md frontmatter
  - `validatePackageStructure(files)` — 校验包结构（必须有 SKILL.md、文件数 ≤20、路径安全检查）
- [x] 5.2 验证：类型检查通过

## 6. 导入对话框 UI

- [x] 6.1 新增 `src/components/shared/skill-import-dialog.tsx`：
  - Zip 文件拖放/选择区域
  - 解析中 loading 状态
  - 解析后显示：文件树预览、自动填充的元数据表单（名称、描述可编辑、分类选择）
  - 错误状态：缺少 SKILL.md、文件过多、文件过大
  - 确认导入按钮 → 调用 `importSkillPackage` action
- [x] 6.2 在技能列表页 `skills-client.tsx` 添加「导入技能」按钮，连接导入对话框
- [x] 6.3 验证：类型检查通过

## 7. 技能详情页增强

- [x] 7.1 修改 `src/app/(dashboard)/skills/[id]/page.tsx`：使用 `getSkillDetailWithFiles` 获取数据，将文件列表传递给客户端组件
- [x] 7.2 修改 `skill-detail-client.tsx`：
  - SKILL.md 区域下方新增标签页：「参考文档」和「脚本」
  - 文件列表：显示文件名、大小、更新时间
  - 展开查看文件内容（markdown 渲染 / 代码高亮）
  - 编辑文件内容（行内编辑模式）
  - 添加文件按钮 + 对话框
  - 删除文件按钮 + 确认
- [x] 7.3 在详情页头部添加「导出」按钮，点击触发 `/api/skills/[id]/export` 下载
- [x] 7.4 验证：类型检查通过

## 8. 集成验证

- [x] 8.1 `npx tsc --noEmit` 全项目类型检查通过
- [x] 8.2 `npm run build` 生产构建通过
- [ ] 8.3 手动测试：上传 zip → 预览 → 导入 → 查看详情 → 编辑文件 → 导出 → 再次导入验证一致性
