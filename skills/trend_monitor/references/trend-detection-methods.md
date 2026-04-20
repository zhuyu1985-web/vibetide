# 趋势监控 · 异常检测与拐点识别方法论

> `trend_monitor` skill 用于实时监控 30+ 平台热点趋势变化。本文档给出：
> 异常检测算法、趋势拐点识别规则、预警触发阈值。

---

## 1. 核心监控维度

每个话题的趋势监控有 3 个时间尺度：

| 时间尺度 | 采样频率 | 用途 |
|---------|---------|------|
| 短期（1 小时内） | 5 分钟 | 突发热点识别、紧急预警 |
| 中期（6-24 小时） | 30 分钟 | 日内走势判断、黄金发布时机 |
| 长期（3-7 天） | 1 天 | 事件生命周期、余热评估 |

---

## 2. 趋势状态 5 分类

| 状态 | 判断规则 | 业务意义 |
|------|---------|---------|
| **rising** | 近 1h 热度增长率 > 50% | 正在爆发，优先跟进 |
| **peaking** | 近 6h 内达到历史最高点 | 巅峰期，发稿最佳时机 |
| **stable** | 近 3h 波动 < 15% | 稳定话题，常规跟进 |
| **falling** | 近 3h 热度下降 > 30% | 衰退期，不适合新稿件 |
| **dormant** | 连续 12h 热度 < 平均值 50% | 沉寂，可降低监控频率 |

## 3. 异常检测算法

### 3.1 突发热点识别（Z-score 法）

```python
def detect_sudden_spike(heat_history: list[float], current_heat: float) -> bool:
    """基于历史分布检测异常飙升"""
    mean = statistics.mean(heat_history[-30:])     # 过去 30 个点
    stdev = statistics.stdev(heat_history[-30:])
    z_score = (current_heat - mean) / max(stdev, 1)
    return z_score > 3.0                            # 3σ 原则
```

- **触发阈值**：Z-score > 3 → 突发预警
- **Z-score > 5** → 紧急预警（可能是刷单 or 重大事件）

### 3.2 衰退拐点识别

```python
def detect_decay_turning_point(heat_series: list[float]) -> bool:
    """连续 3 个采样点下降 + 累计降幅 > 20%"""
    if len(heat_series) < 3: return False
    recent = heat_series[-3:]
    is_declining = all(recent[i] > recent[i+1] for i in range(2))
    decline_pct = (recent[0] - recent[-1]) / recent[0]
    return is_declining and decline_pct > 0.2
```

### 3.3 广告 / 刷单检测

刷单的典型特征：
- 短时间内热度直线上升（非自然曲线）
- 24 小时涨幅 > 1000%
- 参与账号主要是低质量号（粉丝少、发布集中）

```python
def detect_astroturfing(topic) -> bool:
    # 规则 1：涨幅异常
    if topic.hour_growth > 10_000: return True
    # 规则 2：时间分布不自然（如凌晨 2-5 点集中讨论）
    if topic.off_peak_concentration > 0.7: return True
    # 规则 3：评论重复度高
    if topic.comment_duplicate_rate > 0.3: return True
    return False
```

---

## 4. 预警触发矩阵

| 事件类型 | 触发条件 | 预警级别 | 处理动作 |
|---------|---------|---------|---------|
| 突发热点 | Z-score > 3 | 🔴 紧急 | 5 分钟内推送 xiaolei 桌面通知 + 预生成 outline |
| 政治敏感话题上榜 | 命中负面词清单 | 🔴 紧急 | 暂缓自动生成稿件；人工审核 |
| 企业负面热点 | 品牌词 + 负面词 | 🟡 注意 | 推送公关团队；标记为「慎写」 |
| 对标同行爆款 | 同行账号热度 Z > 4 | 🟢 提醒 | 同题漏题分析建议 |
| 预备热点兑现 | 之前标记的「可能爆」变成「已爆」 | 🟢 提醒 | 自动触发 content_generate |

---

## 5. 趋势预测（短期 2-6 小时）

基于过去 24h 数据预测未来 2h 走势：

### 5.1 线性回归预测

```python
def predict_next_2h(heat_series, timestamps):
    # 过去 6 小时数据线性回归
    x = np.array(timestamps[-12:])
    y = np.array(heat_series[-12:])
    slope, intercept = np.polyfit(x, y, 1)
    future_t = timestamps[-1] + 7200  # +2h
    predicted = slope * future_t + intercept
    return max(0, predicted)
```

**局限**：对拐点敏感度差；只适合稳定阶段。

### 5.2 S 型曲线拟合（热点生命周期）

热点的典型生命周期符合 Logistic 曲线：

```
h(t) = H_max / (1 + e^(-k(t - t_mid)))
```

- `H_max`：最终热度峰值
- `k`：增长速率
- `t_mid`：半峰时间

拟合出参数后可预测：
- **峰值时间**：`t_mid`
- **半衰期**：`t_mid + ln(3)/k`
- **消亡时间**：`t_mid + ln(20)/k`

---

## 6. 30+ 平台覆盖清单

监控范围比 `trending_topics` 更广，包括细分垂直平台：

### 主流平台（10）
与 trending_topics 相同，详见 [trending_topics/references/platform-ranking-specs.md](../../trending_topics/references/platform-ranking-specs.md)

### 垂直平台（20+）
- **财经**：雪球 / 东方财富 / 华尔街见闻
- **科技**：少数派 / 掘金 / InfoQ
- **体育**：虎扑 / 懂球帝
- **文娱**：豆瓣 / 猫眼
- **游戏**：TapTap / 游民星空
- **汽车**：汽车之家 / 懂车帝
- **女性**：她社区 / 妈妈帮
- **母婴**：宝宝树
- **商业**：LinkedIn 中国版
- **海外**：Reddit / Twitter / Product Hunt

---

## 7. 报警渠道

| 渠道 | 触发条件 | 延迟 |
|------|---------|------|
| 推送到 /home Dashboard | 所有预警 | 实时 |
| 员工桌面通知 | 🔴 紧急 | < 5 分钟 |
| 企业微信 / 钉钉 群 | 🔴 紧急 + 🟡 注意 | < 10 分钟 |
| 邮件日报 | 所有预警摘要 | 次日 07:30 |

---

## 8. 2026 年 4 月典型监控模式

### 模式 A：「6 小时延时」热点

某些热点在 A 平台先爆，6 小时后才在 B 平台发酵。提前识别可抢占。

例：海外话题先在 Twitter 爆 → 6h 后登上微博 → 再 12h 后头条跟进

### 模式 B：「深夜爆发」热点

凌晨 2-5 点突发话题（通常为海外事件或圈层话题），上班前才被看到。
trend_monitor 应当 24h 值班，不可有盲区。

### 模式 C：「预备事件」

发布会 / 比赛 / 选举等预定事件，提前 24h 预热，事件发生后 30min 内爆发。
trend_monitor 应维护「预备事件日历」，到点前主动拉高监控频率。

---

## 9. 与 trending_topics 的分工

| 维度 | trending_topics | trend_monitor |
|------|----------------|---------------|
| 时效 | 实时快照 | 时间序列追踪 |
| 输出 | 当前榜单 | 趋势状态 + 预警 |
| 触发 | 手动 / cron 定时 | 持续运行 |
| 计算 | 抓取 + 归一化 | 统计分析 + ML |

简言之：**trending_topics 告诉你现在有什么；trend_monitor 告诉你什么在发生变化**。
