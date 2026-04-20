# 选题提取 · 方法论与筛选规则

> `topic_extraction` skill 从原始热点流中提取「可创作」选题。本文档给出：
> 选题评估维度、价值计算公式、差异化角度识别、可落地判定规则。

---

## 1. 5 维选题评估模型

从热点到可创作选题，需综合 5 维判断：

| 维度 | 权重 | 说明 |
|------|------|------|
| 热度分（heat） | 25% | 关注量 + 互动量（见 heat_scoring） |
| 时效性（timeliness） | 20% | 事件新鲜度 / 窗口期 |
| 受众匹配（audience_fit） | 20% | 与本号受众画像契合度 |
| 创作难度（feasibility） | 15% | 素材可得性 / 核查难度 |
| 差异化潜力（differentiation） | 20% | 是否能有独家视角 |

```python
topic_score = (
    0.25 * heat_score +
    0.20 * timeliness +
    0.20 * audience_fit +
    0.15 * (100 - creation_difficulty) +  # 难度反向
    0.20 * differentiation_potential
)
```

**阈值**：
- `topic_score >= 80`：P0 优先选题
- `60-79`：P1 备选
- `< 60`：跳过

---

## 2. 差异化角度生成

对同一个热点，提取 3-5 个差异化角度：

### 2.1 时空维度角度

- **当前**：事件本身
- **历史**：类似事件回顾
- **未来**：后续发展预测
- **本地**：本地影响
- **全球**：国际对比

### 2.2 主体维度角度

- **决策者**：政府 / 企业视角
- **执行者**：员工 / 从业者视角
- **受益者**：消费者 / 用户视角
- **相关方**：竞争对手 / 产业链

### 2.3 层次维度角度

- **事件层**：发生了什么
- **原因层**：为什么会这样
- **影响层**：对谁有什么影响
- **趋势层**：指向什么方向

### 2.4 情感维度角度

- **理性分析**：数据驱动
- **情感共鸣**：人文故事
- **观点碰撞**：正反对比
- **解决方案**：如何应对

---

## 3. 选题价值打分示例

**原始热点**：「深圳发布 AI 产业新政，设立 200 亿专项基金」

### 角度 A：政策视角（时空维度 × 现在）

- heat: 85（全网热议）
- timeliness: 100（当日）
- audience_fit: 80（科技读者）
- feasibility: 90（政策文件易得）
- differentiation: 60（千篇一律）
- **总分：82**（P0）

### 角度 B：创业者视角（主体维度 × 受益者）

- heat: 85
- timeliness: 95
- audience_fit: 85（更精准）
- feasibility: 70（需要采访）
- differentiation: 85（独家视角）
- **总分：83**（P0，更推荐）

### 角度 C：深圳 vs 其他城市对比（时空维度 × 地域）

- heat: 85
- timeliness: 90
- audience_fit: 75
- feasibility: 75
- differentiation: 90（稀缺对比）
- **总分：83**（P0）

---

## 4. 可落地判定（feasibility）

判断选题能否在 T 小时内完成：

### 4.1 素材充足度

- **S（极好）**：官方文件 + 专家观点 + 数据表齐全
- **A（充足）**：官方文件 + 数据
- **B（一般）**：官方文件为主
- **C（稀缺）**：仅有原始报道，需延伸搜索
- **D（不可行）**：涉及非公开信息

### 4.2 核查难度

- 数字全部有官方源：低
- 需要对照多个信源：中
- 涉及争议 / 未证实：高
- 涉及政治敏感：极高（strict 档）

### 4.3 审核通过概率

基于历史同类稿件通过率预测：
- `news_standard`：95%
- `politics_shenzhen`：85%
- `sports_chuanchao`：98%
- `livelihood_zhongcao`：92%

低于 85% 的话题需谨慎（可能触发合规重写 / 二次核查）。

---

## 5. 选题分级

### P0 选题（优先 · 必做）
- topic_score ≥ 80
- 时效窗口紧（≤ 6 小时）
- 本号读者高度相关

### P1 选题（重要 · 应做）
- topic_score 65-79
- 时效窗口较紧（6-24 小时）
- 中度相关

### P2 选题（常规 · 可做）
- topic_score 50-64
- 时效窗口宽（24-72 小时）
- 一般相关

### P3 选题（降级 · 不做）
- topic_score < 50
- 时效过期
- 不相关

---

## 6. 选题排除规则

以下话题自动排除：

- **已被辟谣**：权威机构辟谣的话题
- **敏感话题**：政治 / 外交 / 民族 / 宗教高风险
- **违法话题**：涉嫌犯罪 / 违法活动
- **版权争议**：涉及未授权作品
- **广告 / 公关**：明显的商业营销
- **已过时**：事件已超过 48 小时且无新进展
- **负面情绪**：涉未成年人不幸事件的细节性报道
- **重复选题**：本号近 7 天内已发类似稿件

---

## 7. 受众画像匹配

基于本号历史数据判断选题与受众匹配度：

```python
def audience_fit(topic, channel_metrics):
    topic_tags = extract_tags(topic)
    channel_interest = channel_metrics.top_interest_tags
    overlap = set(topic_tags) & set(channel_interest)
    fit_score = len(overlap) / len(channel_interest)
    return min(100, int(fit_score * 100))
```

---

## 8. 输出结构

```json
{
  "source_event": {
    "event_id": "evt_xxx",
    "title": "深圳发布 AI 产业新政",
    "heat_score": 92
  },
  "extracted_topics": [
    {
      "topic_id": "topic_xxx",
      "angle": "政策视角",
      "angle_category": "时空 × 现在",
      "proposed_title": "200 亿撬动 AI 产业：深圳政策亮点深度解读",
      "target_audience": "政策研究者 + 科技白领",
      "recommended_scenario": "news_standard",
      "recommended_word_count": 1500,
      "estimated_duration_hours": 4,
      "scores": {
        "heat": 85,
        "timeliness": 100,
        "audience_fit": 80,
        "feasibility": 90,
        "differentiation": 60,
        "overall": 82
      },
      "priority": "P0",
      "outline": [
        "悬念开头 - 200 亿背后的考量",
        "政策亮点 - 三大核心条款",
        "配套措施 - 如何落地",
        "意义影响 - 对深圳 AI 产业的推动"
      ],
      "required_sources": ["深圳市政府官网", "新华社", "第一财经解读"],
      "risk_flags": []
    }
  ],
  "top_recommendation": "topic_xxx"
}
```

---

## 9. 选题生成时机

- **实时**：trending_topics / hot_topics 更新触发
- **定时**：每日 08:00 批量生成当日选题清单
- **按需**：xiaoce（选题策划师）手动触发

---

## 10. 质量自检

- [ ] 选题数量 ≥ 3（必须有多角度）
- [ ] 至少 1 个 P0 选题
- [ ] 差异化明显（角度分类不重复）
- [ ] 每个选题有 outline 雏形
- [ ] 所需素材已列出
- [ ] 无排除规则命中
- [ ] 预估工时合理（单篇 ≤ 8 小时）
