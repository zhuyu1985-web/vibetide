# 会话管理产品规格(Cowork 工作区 R2)

- **状态**:Draft / 待 owner 确认
- **范围**:Cowork 工作区左栏「最近对话」列表的会话级操作(重命名 / 删除 / 置顶 / 归档)+ 列表分组组织。仅前端交互 + 1 处 schema 增量,不改 mission 执行链路。
- **背景**:当前 `CoworkSidebar`(`src/components/cowork/cowork-sidebar.tsx`)的最近对话是纯 `<Link>` 列表,零管理能力。后端 actions 已大半就绪(`src/app/actions/cowork-conversations.ts`:rename / archive / delete / moveToProject 均已实现),缺 **pin** 与全部 **UI**。
- **参考对标**:Claude.ai / Cowork / ChatGPT —— hover 出 `⋯` 菜单、inline 重命名、删除二次确认、置顶分组。

---

## 0. 现状盘点(决定哪些是"接线"哪些是"新建")

| 能力 | 后端 action | schema | UI |
|---|---|---|---|
| 重命名 | ✅ `renameConversationAction` | ✅ `title` | ❌ 缺 |
| 删除 | ✅ `deleteConversationAction`(硬删,消息 FK cascade) | ✅ | ❌ 缺 |
| 归档 | ✅ `archiveConversationAction(id, bool)` | ✅ `status: active\|archived` | ❌ 缺 |
| 移动到项目 | ✅ `moveConversationToProjectAction` | ✅ `projectId` | ❌ 缺(本规格不展开,见 §7) |
| **置顶** | ❌ **缺** | ❌ **缺字段** | ❌ 缺 |

> 结论:R2 主要是 **UI 接线**;唯一 schema 改动是给 `conversations` 加置顶标记。

---

## 1. 每条会话的操作集

### 1.1 触发方式 —— **采用 hover 出 `⋯` 按钮**(推荐,对齐 Claude/ChatGPT/Cowork)

- 鼠标 hover 会话行 → 行尾出现 `⋯`(MoreHorizontal)图标按钮;点击展开 `DropdownMenu`。
- **当前激活的会话行常驻显示 `⋯`**(不依赖 hover,避免选中态找不到入口)。
- 移动端 / 触屏无 hover:激活行常驻 + 长按兜底(R2 可不做长按,移动端非主战场)。
- **不做原生右键菜单**:与浏览器右键冲突、可发现性差、移动端无效。`⋯` 是这类产品的事实标准。
- 菜单项顺序(分隔线分两组):

  ```
  置顶 / 取消置顶
  重命名
  ──────────
  归档
  删除            ← destructive 红色
  ```

> 纪律:`⋯` 与菜单项用 `<Button variant="ghost">` / shadcn `DropdownMenu`,**不带边框**(项目全局约定);删除项用 destructive 文字色。

### 1.2 重命名 —— **inline 编辑**(不弹窗)

- 点「重命名」→ 该会话行标题原地变 `<Input>`(预填当前标题、文本全选、autofocus)。
- 提交:**Enter** 或 **失焦(blur)** → 调 `renameConversationAction`;**Esc** 取消还原。
- 空标题:阻止提交(action 已校验 `title 不能为空`),保持编辑态 + 轻提示。
- 乐观更新:本地先改,失败回滚 + toast。

### 1.3 删除 —— **二次确认**(必须)

- 点「删除」→ `AlertDialog` 确认:「删除对话『{title}』?该对话及全部消息将永久删除,无法恢复。」
- 确认按钮 destructive;取消关闭。
- 硬删(`deleteConversationAction` 已是物理删除 + 消息 cascade)。**不做软删/回收站**(YAGNI;要留痕的场景用「归档」)。
- mission 数据不受影响(`missions.conversationId` 是软引用,置脏不影响 mission 本身)。

### 1.4 置顶(pin)—— **即时切换,无确认**

- 点「置顶」→ 立即生效,会话移入列表顶部「置顶」分组;菜单项文案变「取消置顶」。
- 需新增后端能力(见 §5)。
- 置顶**不与归档互斥**的边界:归档一条已置顶会话时,**自动清除其置顶标记**(归档的东西不该占置顶区)。

### 1.5 归档(archive)—— **即时切换 + 轻 toast**

- 点「归档」→ 会话从「最近对话」消失,toast「已归档 · [撤销]」(撤销 5s 内可点,调 `archiveConversationAction(id, false)`)。
- 归档的会话进入「已归档」入口(见 §2.3),不在主列表出现。

### 1.6 边界:操作当前正在查看的会话后跳哪

| 操作对象 | 跳转规则 |
|---|---|
| 删除 / 归档**当前**会话(`activeId` 命中) | 跳到列表中**下一条 active 会话**;若列表已空 → 跳 `/home`(落地页) |
| 删除 / 归档**非当前**会话 | 停留原地,仅列表刷新 |
| 重命名 / 置顶**任意**会话 | 不跳转,原地刷新列表顺序 |

> 实现提示:跳转目标在客户端用当前 `conversations` 列表算出"下一条",避免空指针;`revalidatePath("/cowork")` 已在 actions 内,补 `router.push` 到目标。

---

## 2. 列表组织

### 2.1 分组结构(最近对话区,从上到下)

```
[新建对话]
项目 ▸ …(已有,不变)
定时任务 / 定制 …(已有,不变)
────────────────
📌 置顶                      ← 有置顶项时才出现该分组标题
   · 会话 A(置顶)
   · 会话 B(置顶)
最近对话
   · 会话 C
   · 会话 D
   · 会话 E
────────────────
🗄 已归档(入口,见 §2.3)
```

### 2.2 排序规则

- **置顶区**:组内按 `lastMessageAt` 倒序(最近活跃在上)。
- **最近对话区**:仅 `status='active'` 且未置顶,按 `lastMessageAt` 倒序(沿用现有 DAL `orderBy desc(lastMessageAt)`)。
- 置顶分组整体永远在最近对话之上。
- **不做日期分段**(今天/昨天/7天内):R2 列表预期条数少,YAGNI;条数大了再加(见 §3 later)。

### 2.3 归档会话的去处 —— **「已归档」独立入口**

- 归档的会话**从「最近对话」移除**,不混在主列表。
- 列表底部一个「已归档」入口(可点击行,带计数 `已归档 (N)`)。点击进入归档视图(MVP 用 Dialog/抽屉,复用 `listConversationsByUser(..., { includeArchived: true })` 过滤 `status='archived'`)。
- 归档视图内每条支持:**恢复**(取消归档→回最近对话)、**删除**(同样二次确认)。
- 不做独立路由页,Dialog 列表即可(YAGNI)。

---

## 3. MVP 优先级(must / should / later)

| 能力 | 等级 | 理由 |
|---|---|---|
| 会话行 hover `⋯` 菜单骨架 | **must** | 所有操作的入口,无它一切免谈 |
| **重命名(inline)** | **must** | 最高频;自动标题常不准,用户必须能改 |
| **删除(二次确认)** | **must** | 清理噪音的刚需;后端已就绪 |
| 删除/归档当前会话的跳转兜底 | **must** | 不做会留空白页 bug |
| **归档 + 「已归档」入口** | **should** | 媒体生产沉淀价值高(见 §4);后端已就绪,差 UI |
| 归档撤销 toast | should | 防误操作,成本低 |
| **置顶(pin)** | **should** | 体验提升明显,但需加 schema 字段 + 走 db:push/migrate,比纯接线重 |
| 置顶分组渲染 | should | 跟随 pin |
| 移动到项目(从 `⋯`) | **later** | 后端已有 action,但涉及项目选择器交互,放 R2 项目视图一起做(§7) |
| 日期分段、批量多选、拖拽排序、回收站 | **later** | YAGNI,等列表规模 / 用户反馈 |

**一句话切分**:R2 第一刀交 `⋯ + 重命名 + 删除 + 跳转兜底`(纯前端,0 schema 改动,可独立 ship);第二刀补 `归档入口 + 置顶`(置顶需 1 次 schema 增量)。

---

## 4. 媒体生产场景适配(2-3 条,克制)

1. **归档 = 任务完成沉淀,而非删除**。媒体生产里一次会话常对应一个已交付的选题/稿件/视频产出(会话内挂着 mission 产出物)。完成后用户想"收起但留底"——归档正好承接,**默认引导用户归档而非删除**(删除文案强调"不可恢复"以劝退)。这是媒体场景比通用聊天更看重归档的根本原因。

2. **置顶 = 进行中的重点选题**。运营常有 1-2 个"本周主推"会话需反复回看,置顶区天然承担"工作台 pin board",优先级高于通用聊天产品里的置顶。

3. **项目归集优先于零散标签**。媒体生产已有 `projects` 容器(专题/栏目维度)。会话管理**不引入第二套标签体系**,归类统一走「移动到项目」(§7);`⋯` 菜单里"移动到项目"是连接两者的桥,避免标签与项目语义重叠造成认知负担(YAGNI)。

---

## 5. 唯一 schema 增量(置顶)

置顶**不复用** `status` 枚举(置顶与归档正交,且置顶要参与排序)。给 `conversations` 加:

```ts
// src/db/schema/conversations.ts
pinnedAt: timestamp("pinned_at", { withTimezone: true }), // null = 未置顶;有值 = 置顶时间
```

- 用 `pinnedAt` 而非 boolean:免费获得"置顶区按置顶时间排序"的能力(若未来需要),且语义自解释。
- DAL `listConversationsByUser` 排序改为 `orderBy(desc(pinnedAt NULLS LAST), desc(lastMessageAt))`,或在应用层 split 成两组(列表小,应用层更简单)。
- 新增 action `pinConversationAction(id, pinned: boolean)`;归档时在 `archiveConversationAction` 内顺手 `pinnedAt = null`(见 §1.4 边界)。
- **迁移纪律(项目强制)**:改 schema → `npm run db:generate` → 本地库 `npm run db:push`(本地 journal 空,见 MEMORY)/ 生产 `npm run db:migrate` → 跑 `bash scripts/verify-schema-sync.sh`。**禁手写日期格式 SQL**。

---

## 6. 受影响文件清单(实现锚点)

| 文件 | 改动 |
|---|---|
| `src/components/cowork/cowork-sidebar.tsx` | 最近对话区重写:置顶/普通分组、行级 `⋯` `DropdownMenu`、inline 重命名 `<Input>`、删除 `AlertDialog`、已归档入口 |
| `src/app/actions/cowork-conversations.ts` | 新增 `pinConversationAction`;`archiveConversationAction` 内清 `pinnedAt` |
| `src/lib/dal/cowork-conversations.ts` | `listConversationsByUser` 排序加 `pinnedAt`;`updateConversation` 支持 `pinnedAt`/`status` 同改 |
| `src/db/schema/conversations.ts` | 加 `pinnedAt` 字段 |
| `src/db/schema/enums.ts` | 不动(置顶不进枚举) |
| 调用 `CoworkSidebar` 的 `home-workspace-client.tsx` / `cowork-client.tsx` | 传入分组后的会话数据 + 注入操作回调(rename/delete/pin/archive 调 action),处理当前会话被删/归档后的 `router.push` |

> `CoworkSidebar` 现为纯展示组件(副作用靠回调注入),保持该模式:把会话操作做成 props 回调,逻辑留在父 client 组件,便于单测。

---

## 7. 明确不在本规格内(避免范围蔓延)

- **项目视图 / 项目下会话聚合 / 「移动到项目」交互** —— 归 R2 项目子规格,本规格只确认 `⋯` 菜单**预留**该入口(later)。
- **会话搜索 / 全文检索** —— 独立能力。
- **批量多选、拖拽排序、日期分段、回收站、共享/协作** —— later,等规模与反馈。
- **mission 执行链路、消息渲染** —— 不碰。

---

## 8. 验收清单(R2 会话管理)

- [ ] hover 任意会话行出现 `⋯`;激活行常驻 `⋯`,无边框。
- [ ] 重命名:inline `<Input>`,Enter/blur 保存,Esc 取消,空标题被拦。
- [ ] 删除:`AlertDialog` 二次确认;确认后会话+消息消失。
- [ ] 删除/归档**当前**会话 → 跳下一条 active;列表空 → 跳 `/home`。
- [ ] 置顶:即时进置顶分组,菜单文案切「取消置顶」;归档已置顶会话自动清置顶。
- [ ] 归档:从最近对话消失,toast 可撤销;「已归档 (N)」入口可进、可恢复、可删。
- [ ] 排序:置顶组在上,组内与最近对话均按 `lastMessageAt` 倒序。
- [ ] `npx tsc --noEmit` + `npm run build` 通过;`verify-schema-sync.sh` 全绿(若动 schema)。
