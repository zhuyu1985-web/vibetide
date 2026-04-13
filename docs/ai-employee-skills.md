# AI 员工技能清单

> 数据来源：`src/lib/constants.ts` — `EMPLOYEE_CORE_SKILLS` + `BUILTIN_SKILL_NAMES`
>
> 核心技能为系统自动绑定，不可解绑。

---

## 1. 小雷 — 热点猎手（xiaolei）

| 技能标识 | 技能名称 | 说明 |
|---------|---------|------|
| `web_search` | 全网搜索 | 搜索互联网获取实时信息 |
| `web_deep_read` | 网页深读 | 抓取网页正文进行深度分析 |
| `trending_topics` | 热榜聚合 | 聚合多平台实时热榜 |
| `trend_monitor` | 趋势监控 | 监控热点趋势和话题变化 |
| `social_listening` | 社交聆听 | 社交媒体舆情监控 |
| `heat_scoring` | 热度评分 | 热度评分计算 |

---

## 2. 小策 — 选题策划师（xiaoce）

| 技能标识 | 技能名称 | 说明 |
|---------|---------|------|
| `web_search` | 全网搜索 | 搜索互联网获取实时信息 |
| `web_deep_read` | 网页深读 | 抓取网页正文进行深度分析 |
| `trending_topics` | 热榜聚合 | 聚合多平台实时热榜 |
| `topic_extraction` | 主题提取 | 话题提取和分析 |
| `angle_design` | 角度设计 | 选题角度设计 |
| `audience_analysis` | 受众分析 | 受众分析 |
| `task_planning` | 任务规划 | 任务规划 |

---

## 3. 小资 — 素材管家（xiaozi）

| 技能标识 | 技能名称 | 说明 |
|---------|---------|------|
| `media_search` | 媒资检索 | 搜索媒资库素材 |
| `knowledge_retrieval` | 知识检索 | 检索知识库内容 |
| `news_aggregation` | 新闻聚合 | 聚合多源新闻资讯 |
| `case_reference` | 案例参考 | 查询案例库参考 |

---

## 4. 小文 — 内容创作师（xiaowen）

| 技能标识 | 技能名称 | 说明 |
|---------|---------|------|
| `content_generate` | 内容生成 | 生成内容文案 |
| `headline_generate` | 标题生成 | 生成标题 |
| `summary_generate` | 摘要生成 | 生成摘要 |
| `style_rewrite` | 风格改写 | 风格改写 |
| `script_generate` | 脚本生成 | 生成脚本 |

---

## 5. 小剪 — 视频制片人（xiaojian）

| 技能标识 | 技能名称 | 说明 |
|---------|---------|------|
| `video_edit_plan` | 视频剪辑方案 | 视频剪辑方案 |
| `thumbnail_generate` | 封面生成 | 缩略图方案 |
| `layout_design` | 排版设计 | 排版设计方案 |
| `audio_plan` | 音频方案 | 音频配置方案 |

---

## 6. 小审 — 质量审核官（xiaoshen）

| 技能标识 | 技能名称 | 说明 |
|---------|---------|------|
| `quality_review` | 质量审核 | 质量审核 |
| `compliance_check` | 合规检查 | 合规性检查 |
| `fact_check` | 事实核查 | 事实核查 |
| `sentiment_analysis` | 情感分析 | 情感分析 |

---

## 7. 小发 — 渠道运营师（xiaofa）

| 技能标识 | 技能名称 | 说明 |
|---------|---------|------|
| `publish_strategy` | 发布策略 | 发布策略制定 |
| `style_rewrite` | 风格改写 | 风格改写 |
| `translation` | 多语翻译 | 内容翻译 |
| `audience_analysis` | 受众分析 | 受众分析 |

---

## 8. 小数 — 数据分析师（xiaoshu）

| 技能标识 | 技能名称 | 说明 |
|---------|---------|------|
| `data_report` | 数据报告 | 生成数据分析报告 |
| `competitor_analysis` | 竞品分析 | 竞品分析 |
| `audience_analysis` | 受众分析 | 受众分析 |
| `heat_scoring` | 热度评分 | 热度评分计算 |

---

## 技能复用汇总

以下技能被多个员工共享：

| 技能 | 使用员工 |
|------|---------|
| `web_search` 全网搜索 | 小雷、小策 |
| `web_deep_read` 网页深读 | 小雷、小策 |
| `trending_topics` 热榜聚合 | 小雷、小策 |
| `audience_analysis` 受众分析 | 小策、小发、小数 |
| `heat_scoring` 热度评分 | 小雷、小数 |
| `style_rewrite` 风格改写 | 小文、小发 |
| `sentiment_analysis` 情感分析 | 小审（未被小数使用但同属分析类） |

---

## 统计

| 员工 | 核心技能数 |
|------|-----------|
| 小策（xiaoce） | 7 |
| 小雷（xiaolei） | 6 |
| 小文（xiaowen） | 5 |
| 小审（xiaoshen） | 4 |
| 小资（xiaozi） | 4 |
| 小剪（xiaojian） | 4 |
| 小发（xiaofa） | 4 |
| 小数（xiaoshu） | 4 |

**全系统共 30 种技能定义，8 位员工合计绑定 38 个技能槽位（含重复）。**
