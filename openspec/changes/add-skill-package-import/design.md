## Context

技能管理需要从「单文本字段」升级为「多文件包」模式。核心参考是 Claude Skills 的文件结构：

```
skill-name/
├── SKILL.md              # 核心定义（frontmatter + markdown）
├── references/           # 参考文档
│   └── *.md
└── scripts/              # 自动化脚本
    └── *.sh / *.py
```

SKILL.md frontmatter 格式：
```yaml
---
name: page-qa-fix
description: "Automated page quality inspection..."
---
```

### 约束
- 所有文件为文本类型（markdown、shell、python），无二进制需求
- 单个技能包文件总量通常 < 100KB
- 需要支持多租户隔离（organization_id）
- 保持与现有 `skills.content` 字段的兼容

## Goals / Non-Goals

**Goals:**
- 用户可上传 .zip 技能包，系统自动解析并创建技能
- 用户可导出技能为 .zip，方便分享或迁移
- 技能详情页可查看和编辑所有关联文件
- 与现有技能 CRUD 系统无缝整合

**Non-Goals:**
- 不支持 GitHub URL 直接导入（后续迭代）
- 不支持技能包版本管理（现有 version 字段足够）
- 不支持二进制文件（图片、视频等）
- 不做技能市场/分享平台
- 不支持脚本在线执行（安全考虑）

## Decisions

### D1: 文件存储方案 → 数据库存储（text 列）

**选择：** 在 PostgreSQL 中用 `skill_files` 表存储文件内容

**理由：**
- 文件均为文本类型，体积小（通常 < 50KB/文件）
- 无需额外基础设施（Supabase Storage bucket）
- 事务一致性：技能删除时文件自动级联删除
- 查询简单：直接 JOIN 获取所有文件
- 备份简单：随数据库一起备份

**放弃的方案：**
- Supabase Storage：引入额外复杂度，对文本文件过度设计
- 文件系统：不适合多实例部署和容器化环境

### D2: Zip 处理方案 → 前端解析预览 + 后端存储

**选择：** 使用 `jszip` 库

**上传流程：**
1. 前端：用户选择 .zip → `jszip` 在浏览器端解压 → 显示文件树预览和元数据
2. 前端：用户确认后，将解析后的结构化数据（JSON）发送到 Server Action
3. 后端：Server Action 接收 JSON 数据，校验并写入 DB

**导出流程：**
1. 后端：API Route 查询技能和关联文件 → `jszip` 构建 zip → 返回 stream

**理由：**
- 前端预览无需 round-trip，体验更好
- Server Action 接收结构化数据比处理 multipart form 更简单
- `jszip` 同时支持浏览器和 Node.js

### D3: 数据模型设计

```sql
CREATE TABLE skill_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  file_type TEXT NOT NULL CHECK (file_type IN ('reference', 'script')),
  file_name TEXT NOT NULL,       -- e.g., 'framework-detection.md'
  file_path TEXT NOT NULL,       -- e.g., 'references/framework-detection.md'
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(skill_id, file_path)
);
```

**说明：**
- `file_type`：区分参考文档和脚本，用于 UI 分组展示
- `file_path`：保留完整相对路径，导出时可还原目录结构
- `file_name`：纯文件名，方便搜索和展示
- SKILL.md 的内容存储在 `skills.content` 字段（复用现有字段），不存入 `skill_files`
- CASCADE 删除：技能删除时自动清理关联文件

### D4: Frontmatter 解析

使用简单的正则解析 SKILL.md 的 YAML frontmatter（`---\n...\n---`），提取 `name` 和 `description`。不引入额外 YAML 解析库，用 `gray-matter` 或简单正则即可。

实际上项目可能已有 YAML 解析能力。用最小方案：正则匹配 frontmatter 区域，提取 key-value。

### D5: 安全考虑

- 上传的 .zip 文件大小限制：10MB
- 单个技能包文件数量限制：20 个
- 不执行上传的脚本，仅存储和展示
- 文件内容做基本清理（去除 BOM 头、规范换行符）
- 对 file_path 做路径遍历检查（禁止 `..` 和绝对路径）

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Zip 解压在浏览器端可能对大文件卡顿 | 用户体验 | 限制 10MB，显示加载状态 |
| 恶意文件上传 | 安全 | 不执行脚本，仅存储文本；路径遍历检查 |
| 数据库存储大量文本 | 性能 | 限制文件数量和大小；文本压缩在 PG 层面自动处理 |

## Open Questions

- 是否需要支持 .tar.gz 格式导入？（建议初期仅支持 .zip）
- 技能包中 SKILL.md 的 frontmatter 是否需要支持更多字段（如 category、version）？
