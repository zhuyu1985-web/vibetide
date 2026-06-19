# P2 领域前端 · 新 session 起点 handoff

> 给新 session 的干净入口。P1（领域一等维度·后端）**已完成**，本文件只讲 P2（前端 + 接断层）该做什么。先读本文件，再读 spec，然后用 `writing-plans` 拆 P2 plan 或直接做。

## 背景：P1 已完成（别重做）

P1 后端已全部实现并提交在 `main`（6 个 commit，`a0e8a3d` → `60e953c`，测试通过）：
- `domains` 受控字典表（含口径包 `prompt_guidance` / `authority_sources`）
- `ai_employees.domain_id` 外键、`mission_tasks.domain_fallback`
- `pickEmployeeForStep` 工种+领域双因子、返回 `{ employee, domainFallback }`
- `assembleAgent` join domains 注入 Layer 4.5（`domainGuidance` 优先回退通用模板）
- `web_search` 加 `includeDomains` 入参 + 领域 `authoritySources` 经 `ToolContext.authorityDomains` 注入
- `src/lib/dal/domains.ts`（**只有 `getDomainById`**）

设计依据：[`2026-06-18-domain-form-first-class-and-capability-center-design.md`](../specs/2026-06-18-domain-form-first-class-and-capability-center-design.md)（§6.1 选员工两级 / §6.2 编排徽章 / §6.4 领域字典管理 / §9 P2 范围）。

## 核心断层（P2 第一优先级）

**P1 后端读 `ai_employees.domain_id`（外键），但 employee 配置页还在写 `instanceConfig.domainTags`（自由标签）——两者脱节。** 后果：用户在配置页填的领域**变不成 `domain_id`**，P1 的领域派单 / 口径包能力**目前悬空、没有 UI 数据来源**（除非手跑 `scripts/migration-domain-001.ts`，但新建/编辑员工仍走 domainTags）。

**P2 最高优先：把配置页的领域从「domainTags 自由标签」切到「domains 字典下拉，写 domain_id」，接上这条断层。**

## P2 现状（已核实 file:line，2026-06-19）

| 项 | 现状 |
|---|---|
| `src/lib/dal/domains.ts` | 只有 `getDomainById`；**缺 `listDomainsByOrg` + CRUD**（P2 下拉 / 管理要用） |
| `src/app/(dashboard)/employee/[id]/employee-profile-client.tsx:1086-1219` | 还是 **domainTags 自由标签**（`:1129` "自定义领域标签…回车添加"），未接 domains 字典 |
| `workflow_templates` schema | **无** `defaultDomainId`；编排节点无领域字段 |
| 组件层 | **无**两级选择器、**无**领域徽章 |
| domains 口径包 | 表已有 `prompt_guidance`/`authority_sources` 字段，但**无管理 UI**——口径包也没数据来源 |

## P2 要做（按优先级）

1. **接断层（必做先做）**：`domains` DAL 加 `listDomainsByOrg(orgId)`；employee 配置页领域改为 **domains 字典下拉（单选，写 `ai_employees.domain_id`）**，对应 server action 从写 `instanceConfig.domainTags` 改为写 `domain_id`。保留 domainTags 一个兼容期或一次性迁移。
2. **领域字典管理 UI**（spec §6.4）：`domains` CRUD + **口径包编辑**（`promptGuidance` 多行 / `authoritySources` 域名标签）。否则 P1 的口径包能力同样无数据。建议落在 `/settings/domains` 或「能力与集成中心」。
3. **两级选择器（工种→领域）**（spec §6.1）：本期范围限**花名册 + 配置页**；对话中心选员工 picker、模板节点指派 picker 顺延 P2.1（spec §9 已明确）。
4. **工作流编排领域徽章**（spec §6.2 / Q2 拍板「场景默认 + 节点继承可覆盖」）：`workflow_templates` 加 `defaultDomainId` 列 + 节点 `domainId`（存 `steps[]` jsonb）；编排器节点卡显示领域徽章（继承/覆盖）。

> 注：媒体形态（mediaForm）的任务级 UI 属 **P3**，不在 P2；P2 只做「领域」前端。

## 新 session 起法

```
cd /Users/zhuyu/Developer/chinamcloud/vibetide
# 读本文件 + spec → writing-plans 拆 P2 TDD plan（或直接做 §1 接断层）
```

注意：① 本地库用 `npm run db:push`（不 migrate）；② 工作区有未提交改动（cowork-client / skills-client / `src/lib/types.ts` 等），P2 改的是 domains DAL / employee 配置页 / workflow 编辑器，**commit 时精确 `git add` 自己的文件**；③ 开头先 `git log --oneline --grep="feat(domain)"` 确认 P1 边界，别重做已完成的部分。
