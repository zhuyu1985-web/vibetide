---
name: quality_review
displayName: 质量审核（媒体行业专业版）
description: 对内容做媒体行业专业级质量审核 —— 8 维评分 + 3 档审核 + 9 场景分化 rubric + 合规红线扫描。输出质量分、违规命中、位置精确的修改建议、发布档位判定。supports strict / standard / relaxed 三档；strict 档可拒绝 95 分以下，标记强制人工复核。对接《广告法》《网络信息内容生态治理规定》《新华社发稿规范》等国家法规。
category: quality_review
version: "5.0"

metadata:
  skill_kind: management
  scenario_tags: [all]
  compatibleEmployees: [xiaoshen]
  modelDependency: deepseek:deepseek-chat
  requires:
    env: [OPENAI_API_KEY, OPENAI_API_BASE_URL, OPENAI_MODEL]
    knowledgeBases: []
    dependencies: [fact_check, compliance_check]
  implementation:
    scriptPath: src/lib/agent/execution.ts
    testPath: src/lib/agent/__tests__/

inputSchema:
  content: 待审核的完整稿件（markdown 或 html）
  contentType: 内容类型 (article / video_script / podcast / social_post / daily_brief)
  scenario: 内容场景 (news_standard / politics_shenzhen / sports_chuanchao / ...)
  reviewTier: 审核档位 (strict / standard / relaxed)
  targetChannel: 目标发布渠道 (app_news / app_politics / app_sports / ...)
outputSchema:
  overallScore: 综合分 0-100
  grade: 等级 S/A/B/C/D
  dimensionScores: 8 维评分详情
  complianceHits: 合规违规命中列表
  verdict: 审核结论 (approved / needs_revision / rejected)
  issues: 位置精确的问题清单
  revisionSuggestions: 具体修改建议
  requiresHumanReview: 是否需要人工复核
runtimeConfig:
  type: llm_analysis
  avgLatencyMs: 12000
  maxConcurrency: 3
  modelDependency: deepseek:deepseek-chat
compatibleRoles:
  - quality_reviewer
---

# 质量审核（quality_review）

## 1. 使用条件

**应调用场景**：
- 任何 `content_generate` 产出后的自动化审核
- 稿件发布到 CMS 前的最后一道关卡
- 编辑手动提交审核
- 每日 / 每周批量抽检已发稿件

**不应调用场景**：
- 素材 / 草稿 / 笔记类内容（未完成的中间态）
- 纯标题 / 摘要审核（走 headline_generate / summary_generate 自带校验）
- 视频成片视觉审核（另行使用人工 + AIGC 审核工具链）

**前置条件**：
- `content` 非空，字数 ≥ 200
- `scenario` 必须是 9 个合法 scenario 之一（见 content_generate §9）
- 涉政治 / 未成年人 / 医疗类内容默认 `reviewTier=strict`
- 涉种草 / 探店 / 广告合作内容默认广告法扫描必开

## 2. 8 维审核体系（扩展原 4 维）

| # | 维度 | 权重 | 说明 |
|---|------|------|------|
| 1 | 事实准确性 | 20% | 具体数字 / 人名 / 时间 / 地点 / 引言是否经得起核查 |
| 2 | 信源权威度 | 10% | 引用信源是否 S/A/B/C 级（详见 [media-industry-standards.md §8](../../docs/skills/media-industry-standards.md)） |
| 3 | 逻辑通顺度 | 10% | 段落衔接、因果链、论证严密性 |
| 4 | 语言流畅度 | 10% | 句式多变、无病句、标点规范 |
| 5 | 原创深度 | 10% | 非机械复述、有独立观点 / 视角 / 数据 |
| 6 | 结构完整性 | 10% | 符合 scenario 的结构要求（倒金字塔 / Top N / 钩子-痛点-CTA 等） |
| 7 | 受众价值 | 10% | 信息密度、时效性、对目标受众的实用性 |
| 8 | 合规性 | 20% | 广告法 / 政治红线 / 未成年人保护 / 网信办负面词 |

**综合分 = Σ(维度分 × 权重)**，映射等级：
- **S 级**（95-100）：顶尖稿件，直接置顶 / 头条
- **A 级**（85-94）：优秀稿件，正常发布
- **B 级**（75-84）：合格稿件，可发布但有优化空间
- **C 级**（60-74）：待修改，返回作者修订
- **D 级**（< 60）：打回重写

## 3. 三档审核 + 档位阈值

| 档位 | 发布最低分 | 合规要求 | 典型应用 |
|------|-----------|---------|---------|
| **strict** | ≥ 95（S 级） | 全部红线必须 0 命中；涉政治 / 未成年人必选此档 | 时政稿件、深度稿件、头条、播客、短剧 |
| **standard** | ≥ 85（A 级） | 硬违规 0 命中；软违规 ≤ 2 处 | 普通新闻、民生、综艺、体育战报 |
| **relaxed** | ≥ 75（B 级） | 无命中极限词 + 基本合规 | 种草、探店、每日简报 |

**强制 `strict` 场景**：
- `politics_*`（所有时政场景）
- 涉未成年人内容
- 涉军队 / 国家安全
- 涉重大突发事件（事故、灾害、危机）
- 涉股价敏感 / 企业重大人事变动

**档位跨越**：业务方可以要求 `relaxed` → `standard` 升级（更严格）；
不允许主动降级（除非明确授权 + 留痕）。

## 4. 场景化审核 rubric（按 scenario 分化）

### 4.1 news_standard（新闻标准）

- 必查：5W1H 覆盖 ≥ 90%、导语 ≤ 100 字、引述 ≥ 2 处
- 扣分项：情绪化动词（震惊 / 爆 / 颠覆）
- 红线：政治领导人姓名 / 职务 / 机构名称错误
- 加分：新华体动词使用率 ≥ 60%

### 4.2 politics_shenzhen（时政）

- 必查：**strict 档**；会议 / 政策全称；领导人姓名职务；政策原文引号包裹
- 扣分项：评价性词汇（力度不够 / 值得商榷）
- 红线：领导人姓名职务任何错误、擅自延伸政策解读、非 S/A 级信源
- 加分：引用原文 ≥ 3 处并附来源链接

### 4.3 sports_chuanchao（川超）

- 必查：比分 / 球员姓名 100% 准确（对照 KB）、数据来源一致
- 扣分项：暴虐词汇（血洗 / 碾压 / 暴虐）
- 红线：地域攻击、球员人身攻击、裁判黑哨定性
- 加分：数据维度 ≥ 5（射门 / 控球 / 传球 / 犯规 / 评分）

### 4.4 variety_highlight（综艺）

- 必查：艺人名 KB 核查通过
- 扣分项：化名 / 代称（某 L 姓男星）
- 红线：捏造艺人绯闻 / 黑料、涉塌房 / 翻车等诽谤性词汇
- 加分：盘点逻辑清晰（按出场 / 热度 / 话题度排序）

### 4.5 livelihood_zhongcao（种草）

- 必查：广告法极限词扫描（0 容忍）、合作披露（如有）
- 扣分项：未披露推广 / 夸大功效
- 红线：医疗器械 / 药品 / 处方药种草、烟酒赌博
- 加分：加「（个人使用感受）」等主观声明

### 4.6 livelihood_tandian（探店）

- 必查：地址精确到门牌号、人均精确到元、价格时效标注
- 扣分项：价格虚假（高 / 低于实际 ≥ 20%）、地址模糊
- 红线：虚构试吃体验、使用 stock 素材冒充现场
- 加分：营业时间 / 预约 / 停车等实用信息完整

### 4.7 livelihood_podcast（播客文字稿）

- 必查：**strict 档**；与音频逐字对齐；句长适合 TTS
- 扣分项：书面语 / 从句过多
- 红线：政治敏感 TTS 错读风险、版权争议
- 加分：双主持对话风格稳定（全季度一致）

### 4.8 drama_serial（短剧）

- 必查：**strict 档**；章节 / 集数完整；标签丰富
- 扣分项：剧透关键反转、过度娱乐化
- 红线：涉未成年人不当情节、涉违法犯罪正面刻画
- 加分：CMS 适配完整（type / 标签 / 简介分层）

### 4.9 daily_brief（每日简报）

- 必查：3-5 条热点覆盖 ≥ 4 个领域、每条 100-200 字
- 扣分项：单领域霸榜、过期新闻（≥ 24 小时）
- 红线：虚假热点、未验证事件
- 加分：每条有「一句话看点」+ 数据点

## 5. 工作流 Checklist

- [ ] **Step 1**：加载 scenario 对应的 rubric + 档位阈值
- [ ] **Step 2**：8 维评分（逐维给分 + 依据说明）
- [ ] **Step 3**：合规红线扫描（广告法 / 政治 / 未成年人 / 网信办）
- [ ] **Step 4**：问题精确定位（段落 + 句号 + 原文）
- [ ] **Step 5**：生成具体修改建议（必须可执行）
- [ ] **Step 6**：计算综合分 + 档位判定
- [ ] **Step 7**：输出结构化报告
- [ ] **Step 8**：判定是否需要人工复核（strict 档 + 高分仍建议人工抽查）

## 6. 输出结构

```json
{
  "overallScore": 87,
  "grade": "A",
  "verdict": "approved",
  "reviewTier": "standard",
  "dimensionScores": {
    "factAccuracy": { "score": 92, "weight": 20, "note": "3 个数字已核对，1 处引述来源模糊" },
    "sourceAuthority": { "score": 85, "weight": 10, "note": "新华社 + 深圳政府官网 S 级信源" },
    "logicFlow": { "score": 88, "weight": 10, "note": "整体流畅，第 5 段过渡生硬" },
    "languageFluency": { "score": 90, "weight": 10, "note": "句式多变，无病句" },
    "originality": { "score": 82, "weight": 10, "note": "视角新颖但论证偏单一" },
    "structure": { "score": 95, "weight": 10, "note": "完全符合 news_standard 倒金字塔" },
    "audienceValue": { "score": 85, "weight": 10, "note": "对科技读者有实用价值" },
    "compliance": { "score": 100, "weight": 20, "note": "无任何命中" }
  },
  "complianceHits": [],
  "issues": [
    {
      "location": { "section": "正文", "paragraph": 3, "sentenceNumber": 2 },
      "originalText": "该公司 2025 Q3 营收增长 200%",
      "problemType": "factAccuracy",
      "problem": "未标注来源，官方财报显示为 185%",
      "suggestion": "修正为「据 XX 财报，该公司 2025 Q3 营收同比增长 185%」",
      "severity": "high"
    }
  ],
  "revisionSuggestions": [
    "第 3 段修正数据并添加来源链接",
    "第 5 段增加过渡句改善段落衔接",
    "补充 1-2 个独家采访或调研数据提升原创深度"
  ],
  "requiresHumanReview": false
}
```

## 7. 合规扫描专项（4 大类）

### 7.1 广告法极限词（0 容忍）

扫描词库（详见 [media-industry-standards.md §4](../../docs/skills/media-industry-standards.md)）：
最 / 第一 / 独家 / 唯一 / 顶级 / 国家级 / 绝对 / 100% / 保证 / 首个

**命中处理**：标记严重度 **high**，建议修改词；strict / standard 档必须修改后才能通过。

### 7.2 政治红线（硬违规）

扫描项：
- 领导人姓名职务对照《党政机关工作人员称呼规范》
- 会议名称对照当年度官方通稿
- 政策原文对照国务院 / 各部委官网
- 敏感话题对照网信办最新负面词清单

**命中处理**：直接判 **rejected**；任何档位都不得通过。

### 7.3 未成年人保护

扫描项（详见 [media-industry-standards.md §6](../../docs/skills/media-industry-standards.md)）：
- 未成年人真实姓名 / 学校 / 班级 / 住址
- 面部清晰图像（需检测图片元数据）
- 自杀 / 自残 / 犯罪细节

**命中处理**：
- 身份信息命中 → 强制脱敏；脱敏后重审
- 自杀 / 自残细节命中 → 直接 **rejected**

### 7.4 网信办负面词（含不良信息）

扫描词库：网信办 2020《规定》第 7/8 条禁止 + 不良内容清单。

**命中处理**：
- 违法信息（第 7 条）→ **rejected**
- 不良信息（第 8 条）→ **needs_revision** + 警告日志

## 8. 边界场景处理

| 场景 | 处理策略 |
|------|---------|
| 内容过短（< 200 字） | 仍评分，但 `originality` 维度标注「长度不足以评估」 |
| 多语言混合 | 按主语言标准审核，外语部分单独标注 |
| 纯观点类 | `factAccuracy` 改评逻辑自洽性 |
| 视频脚本格式 | `languageFluency` 侧重口语化 |
| reviewTier=relaxed | 阈值下调 10 分；但红线仍严格 |
| LLM 评分自相矛盾 | 触发二次评分（不同模型），取平均 |

## 9. EXTEND.md 示例

```yaml
review_config:
  strict_channels: [app_politics, app_drama, app_livelihood_podcast]
  default_tier: standard
  require_human_review_above_score: 95  # S 级仍建议人工抽查
  require_human_review_for_strict_tier: true

custom_weights:
  politics_shenzhen:
    compliance: 30      # 时政稿合规权重加倍
    factAccuracy: 25
    sourceAuthority: 15
  livelihood_zhongcao:
    compliance: 30      # 广告法合规同样加重
    languageFluency: 5  # 种草可读性轻一点
```

## 10. 参考资料

- **详细审核 rubric**：[references/review-rubric-extended.md](./references/review-rubric-extended.md)（8 维评分详细打分标准 + 场景扩展）
- **媒体行业规范**：[docs/skills/media-industry-standards.md](../../docs/skills/media-industry-standards.md)（法规 / 白黑名单 / 信源分级 / 违规案例库）
- **上游 skill**：`fact_check`（先跑事实核查）/ `compliance_check`（合规专项）
- **下游 skill**：`cms_publish`（A/B 级通过直接入库）
- 代码实现：[src/lib/agent/execution.ts](../../src/lib/agent/execution.ts)
- 历史版本：`git log --follow skills/quality_review/SKILL.md`

## 11. 上下游协作

**上游输入方**：
- `content_generate`：产出稿件 → 送审
- `xiaoshen`（质量审核官）：人工触发审核
- Inngest `leader-consolidate`：任务完成后自动触发

**下游消费方**：
- `cms_publish`：verdict=approved 直接入库
- `learning-engine`：审核意见作为反馈写回 `employee_memories`
- 编辑工作台：rejected / needs_revision 进入人工修订队列

## 12. 常见问题

**Q1：为什么同一篇稿件两次打分差异大？**
A：LLM 评分有随机性。本 skill 自带「二次评分一致性校验」：两次评分差 ≥ 15 时触发第三次评分，取中位数。

**Q2：strict 档位太严，稿件经常打回怎么办？**
A：这是设计目的。strict 档就是要"宁缺毋滥"。策略：
1. 上游 `content_generate` 多跑几版 variant
2. 人工介入调整关键段落
3. 必要时切到 standard 档（需主管授权）

**Q3：合规扫描为什么不能降档？**
A：合规不是"软指标"，是国家法规底线。降档 = 违法风险。任何时候都是 0 容忍。

**Q4：8 维为什么不是 10 维或更多？**
A：维度过多会让 LLM 评分稀释（每维权重太低）。8 维经过实际测试是最佳平衡。
