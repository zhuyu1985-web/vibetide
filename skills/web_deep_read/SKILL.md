---
name: web_deep_read
displayName: 网页深读
description: 抓取指定 URL 的网页正文，剥离导航、广告、评论、版权声明等噪声，输出干净的 Markdown 结构化内容，含标题、正文、发布时间、作者、来源域名、字数统计。优先调用 Jina Reader API 得到纯净 Markdown，额度不足或超时时自动降级为直接 fetch + cheerio 提取，单次超时 15s 不死等。支持按段落 / 句号边界截断到指定字数、可选保留图片引用、自动识别非 HTML 资源退出。适用于深度分析、引用原文、事实核查、爆款拆解、素材入库五大场景。当用户提及"深读""读原文""全文抓取""正文提取""把这篇文章完整读进来"或直接贴出单一 URL 需要理解详细内容时调用；不用于多 URL 批量爬取或站点级爬虫。
version: "3.0"
category: data_collection

metadata:
  skill_kind: data_collection
  scenario_tags: [hot-topic, deep-read, research, fact-check]
  compatibleEmployees: [xiaolei, xiaoce, xiaowen, xiaoshen]
  modelDependency: none
  requires:
    env: [JINA_API_KEY]
    knowledgeBases: []
    dependencies: []
  implementation:
    scriptPath: src/lib/web-fetch.ts
    testPath: src/lib/__tests__/
  openclaw:
    referenceSpec: docs/superpowers/specs/2026-04-19-skill-md-baoyu-standardization.md
---

# 网页深读（web_deep_read）

你是网页内容提取专家，能从指定 URL 抓取网页正文并输出干净、结构化、可被下游模型直接消费的 Markdown 内容。核心信条：**保留原文信息密度 > 速度**——宁愿多花一秒抓到完整正文，也不把半篇残文交给下游。

## 使用条件

✅ **应调用场景**：
- 热榜话题 / 搜索结果中命中某个关键 URL，需要读完整原文做深度分析
- 事实核查：需要引用具体数字、专家原话、政策原文
- 内容改写 / 续写：需要原文语气 / 结构 / 核心观点做参考
- 竞品分析 / 案例参考：需要把爆款文章完整读进来做拆解
- 素材入库：把优质外链正文转为 Markdown 存入知识库

❌ **不应调用场景**：
- 多 URL 批量爬取（应批量循环调用，并在上层串联去重与速率控制）
- 仅看标题即可判断的场景（搜索结果 snippet 已足够时）
- 站点级爬虫（本技能不做翻页 / sitemap 追踪）
- 登录后页面 / 付费墙内容（无鉴权能力）
- 视频 / 音频 / PDF 等非 HTML 资源（交 `media_search` / 专用工具）

**前置条件**：
- `url` 合法（以 `http://` 或 `https://` 开头）
- 优先使用 `JINA_API_KEY`（返回干净 Markdown）；未配置时降级为直接 fetch + cheerio 提取正文
- 非 HTML 资源（pdf/word/xlsx）直接报错返回 `warnings`，不勉强输出
- 单次调用单 URL；批量请由调用方循环并做 `maxConcurrency=3` 限流

## 输入 / 输出

**输入简要表：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| url | string | ✓ | 要深读的网页 URL |
| maxLength | int | ✗ | 正文字数上限，默认 `3000`，最大 `10000`，按段落边界截断 |
| includeImages | boolean | ✗ | 是否保留正文里的 `![alt](src)` 图片引用，默认 `false` |
| preferReader | enum | ✗ | `jina` / `fetch` / `auto`，默认 `auto` |

**输出简要表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| title | string | 页面标题（`<h1>` 或 `<title>`） |
| content | string | 清洗后的 Markdown 正文 |
| wordCount | int | 中文字符 + 英文单词合计 |
| source | string | 来源域名（如 `xinhuanet.com`） |
| publishedAt | string? | ISO-8601 发布时间（若能从 meta/jsonld 提取） |
| author | string? | 作者 / 署名 |
| channel | string? | `jina` / `fetch`（实际命中的通道） |
| truncated | boolean | 是否因 `maxLength` 被截断 |
| warnings | string[] | 异常 / 降级 / 截断提示 |

完整 Zod Schema 见 [src/lib/web-fetch.ts](../../src/lib/web-fetch.ts) 的 `fetchWebContent` 导出。

## 工作流 Checklist

- [ ] Step 0: `url` 合法性校验（格式 + 协议）
- [ ] Step 1: 选通道 —— 有 `JINA_API_KEY` 走 Jina Reader；否则 fetch + cheerio
- [ ] Step 2: 资源类型探测 —— `Content-Type` 非 `text/html` 时写入 warnings 退出
- [ ] Step 3: 正文抓取（Jina 通道直接得 Markdown；fetch 通道用 readability 规则提取 `<main>/<article>` 主体）
- [ ] Step 4: 清洗 —— 去导航 / 侧边栏 / 评论 / 广告 / 版权声明 / "相关推荐"
- [ ] Step 5: 发布时间 / 作者提取 —— 优先 JSON-LD `datePublished`；退回 `<meta property="article:published_time">`
- [ ] Step 6: 图片处理 —— `includeImages=false` 则剥离 `![...](...)`
- [ ] Step 7: 字数统计 + 按段落 / 句号边界截断（`maxLength`）
- [ ] Step 8: 失败处理 —— 4xx/5xx 或抓不到正文时，返回 `content=""` + warnings 明确原因
- [ ] Step 9: 质量自检（见 §6）

## 通道降级策略

| 场景 | 首选通道 | 降级到 | 备注 |
|------|---------|--------|------|
| 有 `JINA_API_KEY` 且网络正常 | Jina Reader | fetch + cheerio | 纯净度高，推荐 |
| 无 `JINA_API_KEY` | fetch + cheerio | — | 本地抓，需清洗 |
| Jina 返回 5xx / 超时 > 15s | fetch + cheerio | 直接返回 warnings | 不死等 |
| 目标站点反爬强烈（403/429） | — | warnings 说明「反爬拦截」 | 不暴力重试 |

## 质量把关

**自检阈值表：**

| # | 检查点 | 阈值 |
|---|-------|-----|
| 1 | title 非空 | 100% |
| 2 | wordCount ≥ 200（中文）或 ≥ 100（英文） | 除非 warnings 明确空页 |
| 3 | 正文不含 `<script>` / `<style>` / `>>>` 残留 | 100% |
| 4 | 正文首段不是导航 / 面包屑 | 人工抽检 |
| 5 | publishedAt 能解析出 | ≥ 80% 主流新闻站点 |
| 6 | 非 HTML 资源正确识别 | 100% 写入 warnings |
| 7 | 4xx / 5xx 明确返回错误码 | 100% |
| 8 | 截断在段落 / 句号边界 | 100% |

**Top-5 典型失败模式：**

| 失败模式 | 表现 | 修正 hint |
|---------|------|----------|
| 抓到导航 / 评论区 | 正文开头是"首页 > 新闻 > ..." | 过滤 `<nav>` / `<aside>` / `.comment-*`；用 readability 评分 |
| 正文被截半 | 末尾断在句中 | Step 7 只在句号 / 换行 / `</p>` 边界截断 |
| 发布时间缺失 | `publishedAt=null` | 兜底查 `<time>` / `.publish-date` / URL 路径日期 |
| 图片散乱 | 大量 `![](data:...)` | `includeImages=false` 默认剥离 |
| 超长静默等待 | 单次抓 30s+ | Jina 15s 超时 + fetch 10s 超时，过时立即降级 |

## 输出示例

```markdown
## 网页深读结果

- 标题：国务院发布《生成式人工智能管理条例》 明确AI内容标识制度
- 来源：xinhuanet.com
- 作者：新华社记者 王某某
- 发布时间：2026-03-17T10:00:00+08:00
- 字数：2480
- 通道：jina
- 是否截断：否

### 正文内容

国务院17日正式颁布《生成式人工智能管理条例》（以下简称《条例》），共八章五十二条。《条例》明确要求所有AI生成内容必须添加可识别标识，建立AI服务分级分类管理制度……

### 一、条例核心要点

1. **内容标识强制化**：所有AI生成的文字、图片、音视频必须带不可拆除的标识……

（正文继续）
```

## EXTEND.md 示例

```yaml
default_max_length: 3000
default_include_images: false
prefer_channel: jina          # jina / fetch / auto

# 特定站点的自定义清洗规则
site_overrides:
  "www.example.com":
    strip_selectors: [".sidebar", ".related-news"]
    title_selector: "h1.post-title"

# 反爬兜底
retry:
  max_attempts: 2             # 失败重试次数
  backoff_sec: [1, 3]
```

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 抓到空 content | 站点反爬 / JS 渲染 | 写入 warnings；提醒人工访问 |
| 中文字符被当成英文词切分 | 统计口径不对 | wordCount 做中英混合统计（见 `countWords`） |
| 发布时间是"1 小时前"等相对时间 | 站点未输出结构化 meta | 降级从 `<time datetime>` 提取；再降级到 fetchedAt |
| Jina Reader 频率被限 | 配额耗尽 | 自动降级为 fetch 通道；警示在 warnings |
| PDF / Word 链接 | 资源类型非 HTML | 直接 warnings 退出；下游走专用解析 |
| 正文含大量代码块 | 技术博客 | 保留 `` ``` `` 围栏，不做字数截断到代码块中间 |

## 上下游协作

- **上游**：`web_search` 搜到的候选 URL、`trend_monitor` 热榜条目、人工粘贴 URL、`news_aggregation` 输出条目
- **下游**：`content_generate` 用正文做改写 / 续写；`summary_generate` 生成摘要；`fact_check` 逐句核查；`topic_extraction` 抽主题；`case_reference` 入库做爆款拆解

## 参考资料

- 代码实现：[src/lib/web-fetch.ts](../../src/lib/web-fetch.ts)（`fetchWebContent` 入口函数，含 Jina / fetch 双通道）
- Jina Reader 文档：`r.jina.ai/<url>` —— 免费可用，有 Key 走配额通道
- 历史版本：`git log --follow skills/web_deep_read/SKILL.md`

- **媒体行业专业标准（共享）**：[../../docs/skills/media-industry-standards.md](../../docs/skills/media-industry-standards.md)
