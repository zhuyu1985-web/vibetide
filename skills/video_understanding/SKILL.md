---
name: video_understanding
displayName: 视频理解
description: 对一条视频（新闻视频链接或素材库已有视频）做端到端 AI 理解——抽取视频源 → 下载到素材库 → 通义听悟转写/摘要/章节，结果回填素材库与稿件。当用户提及"分析这个视频""把视频转写成文字""理解这条视频讲了什么""视频转文字""提取视频字幕/要点"时调用。
version: 1.0.0
category: content_analysis

metadata:
  skill_kind: action
  scenario_tags: [news, politics, sports, variety, livelihood]
  compatibleEmployees: [xiaojian, xiaoce, xiaoshen, leader]
  modelDependency: none
  requires:
    env: [VIDEO_ANALYSIS_PROVIDER, ALIBABA_CLOUD_ACCESS_KEY_ID, ALIBABA_CLOUD_ACCESS_KEY_SECRET, TINGWU_APP_KEY]
    knowledgeBases: []
    dependencies: []
  implementation:
    scriptPath: src/inngest/functions/tingwu-analyze.ts
    testPath: src/lib/tingwu/__tests__/analyze.test.ts
  openclaw:
    referenceSpec: docs/superpowers/specs/2026-06-26-news-url-import-pipeline-design.md
---

# 视频理解

把一条视频转成可检索、可复用的结构化情报：语音转写（带时间戳）、内容摘要、章节速览、关键词标签。复合能力，背后由三个原子工具/Inngest 链路串成，是"新闻 URL 导入闭环"的视频分支，也可在对话里对任意素材库视频单独触发复用。

## 1. 使用条件

- **触发**：用户给出一条含视频的链接，或指向素材库里一条已入库视频，要求"分析 / 转写 / 理解 / 提要点 / 出字幕"。
- **前置**：
  - 通义听悟已配置（`isTingwuEnabled()`：`VIDEO_ANALYSIS_PROVIDER=aliyun_tingwu` + 阿里云 AccessKey + `TINGWU_APP_KEY`）。未配置则优雅跳过，不报错。
  - 视频需有**公网可访问的直链**（域名形式，非 IP、无空格）。素材库 TOS/COS 的 `publicUrl` 可直接用。
- **不适用**：纯图文稿（无视频源）；流媒体 m3u8 / 需登录态 / DRM 视频（仅标记 + 存源链接，不强下）。

## 2. 输入 / 输出

**输入**（二选一入口）：
| 入口 | 字段 | 说明 |
|---|---|---|
| 链接 | `url` | 含视频的网页/视频页 URL，先经 `video_extract` 解析视频源 |
| 素材 | `assetId` + `publicUrl` | 素材库已入库视频，直接送听悟 |

**输出**（自动回填，不阻塞对话）：
- `asset_segments`：转写分段（`transcript` + 秒级 `startTimeSeconds/endTimeSeconds`）
- `asset_tags`：关键词标签（`category=topic`，`source=ai_auto`）
- `media_assets.understandingStatus=completed` + `understandingProgress=100` + `catalogData.tingwu`
- `articles.transcript`（转写全文）+ `articles.chapters`（章节速览）

## 3. 工作流 Checklist

1. 链接入口：`video_extract(url)` → 拿视频直链 `videoUrl`（`kind=direct` 才可下载）。
2. 下载入库：`storeImportedVideoToTos` → `media_assets`（`source=article_video`）+ `article_assets` 关联。
3. 提交听悟：`createTask({ fileUrl: publicUrl, sourceLanguage:'cn' })`（开 Transcription/Summarization/AutoChapters）→ `taskId`。
4. 轮询：`getTaskInfo(taskId)` 每 30s 起指数退避（封顶 5min），直到 `COMPLETED`。
5. 拉结果：`fetchResultJson(Result.{Transcription,Summarization,AutoChapters})`（30 天有效链，立即落库）。
6. 写回：`parseTranscription/parseKeywords/parseAutoChapters` → 写 `asset_segments`/`asset_tags`/`articles.transcript/chapters`，标 `completed`。

## 4. 质量把关

- **FileUrl 公网可达**是最高频失败点：提交前确认素材桶公读或带签名直链。
- 语言代码中文用 `cn`（不是 `zh`）。
- 长耗时（分钟级）：对话里**只触发不阻塞**，完成后回填里程碑卡；超 5min 未完成保持 `processing` 并提示"较慢稍后自动完成"。
- 听悟结果中**摘要/章节的精确字段**首次联调时打印固化为 fixture 再调解析（不臆造字段）。

## 5. 上下游协作

- **上游**：`新闻 URL 导入闭环`（cowork 粘贴 URL）→ 视频稿自动走本能力；或用户在对话里直接点名某素材视频。
- **下游**：转写/摘要可喂 `analyze_article`（结构化提炼）、内容创作（改写/二创）、稿件库检索。
- **同源工具**：`video_extract`（抽源）、`analyze_article`（图文结构化分析）、`tingwu_analyze`（触发听悟）——均为通用工具，对话里可单独调。

## 6. 常见问题

- **Q：视频没下载下来？** A：多半是流媒体(m3u8)/需登录/平台 JS 渲染拿不到直链 → 已降级"标记 + 存源链接"，可手动下载后传素材库再触发。
- **Q：听悟一直没结果？** A：分钟级正常；超 5min 仍 `ONGOING` 会保持 `processing`，结果链 30 天有效，可后续重查。
- **Q：未配置听悟会怎样？** A：`isTingwuEnabled()=false` 时整段跳过，视频仍正常入素材库，不报错。

## 7. 参考资料

- 设计 spec：`docs/superpowers/specs/2026-06-26-news-url-import-pipeline-design.md`（§8 通义听悟、§16 能力抽象）
- 实现：`src/lib/tingwu/*`、`src/inngest/functions/tingwu-analyze.ts`、`src/lib/articles/video-source.ts`
