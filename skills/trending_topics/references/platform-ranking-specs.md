# 平台热榜 API 规范与字段映射

> `trending_topics` skill 调用的 10 个主流平台的热榜 API 详细规范，包括：
> 请求方式、响应字段、归一化映射规则、失败处理。配合 `TRENDING_RESPONSE_MAPPING`
> 环境变量使用。

---

## 归一化目标 Schema

所有平台响应必须映射为以下统一结构（VibeTide 内部表示）：

```typescript
interface NormalizedTopic {
  platform: string;       // 平台名（中文）
  rank: number;           // 排名（1-based）
  title: string;          // 话题标题
  summary?: string;       // 简短摘要（如有）
  heat: number;           // 热度数值（原始单位）
  heatUnit: string;       // 热度单位（阅读数 / 指数 / 互动数）
  url: string;            // 话题详情页 URL
  category?: string;      // 分类（由平台提供 or 自动识别）
  imageUrl?: string;      // 主图（如有）
  discoveredAt: string;   // ISO 8601 时间戳
  metadata?: Record<string, unknown>; // 平台特有字段
}
```

---

## 平台 × API 映射

### 1. 微博热搜

- **请求**：`GET /trending/weibo?limit=20`
- **频控**：建议 ≥ 1 分钟间隔（过频触发 IP 黑名单）
- **响应字段映射**：
  ```json
  {
    "rank": "rank",
    "title": "word",
    "heat": "num",
    "heatUnit": "阅读量",
    "url": "https://s.weibo.com/weibo?q={title}",
    "category": "category_v2",
    "discoveredAt": "onboard_time"
  }
  ```
- **特有字段**：
  - `is_hot`: 置顶（业务可重点关注）
  - `label_name`: 标签（「新」「热」「沸」）
  - `is_ad`: 广告标识（需过滤）

### 2. 百度实时热点

- **请求**：`GET /trending/baidu?limit=20`
- **频控**：≥ 10 分钟
- **响应字段映射**：
  ```json
  {
    "rank": "index",
    "title": "query",
    "heat": "hotScore",
    "heatUnit": "搜索指数",
    "url": "https://www.baidu.com/s?wd={title}",
    "category": "category",
    "imageUrl": "img"
  }
  ```
- **热度换算**：百度热度分为 10 档，乘 10000 标准化

### 3. 抖音热搜榜

- **请求**：`GET /trending/douyin?limit=20`
- **频控**：≥ 5 分钟
- **响应字段映射**：
  ```json
  {
    "rank": "position",
    "title": "word",
    "heat": "hotValue",
    "heatUnit": "热度值",
    "url": "https://www.douyin.com/hot/{id}",
    "category": "sentence_tag",
    "imageUrl": "cover"
  }
  ```
- **特有字段**：
  - `video_count`: 关联视频数
  - `view_count`: 累计观看量
  - `is_commerce`: 商业推广（需过滤）

### 4. 头条热搜

- **请求**：`GET /trending/toutiao?limit=20`
- **频控**：≥ 1 分钟
- **响应字段映射**：
  ```json
  {
    "rank": "position",
    "title": "Title",
    "heat": "HotValue",
    "heatUnit": "热度",
    "url": "{url}",
    "category": "ClusterType"
  }
  ```

### 5. 知乎热榜

- **请求**：`GET /trending/zhihu?limit=20`
- **频控**：≥ 10 分钟
- **响应字段映射**：
  ```json
  {
    "rank": "index",
    "title": "target.title",
    "heat": "detail_text",
    "heatUnit": "万热度",
    "url": "https://www.zhihu.com/question/{id}"
  }
  ```
- **热度字段解析**：`detail_text` 通常是「XX 万热度」字符串，需 parse

### 6. 36Kr 热榜

- **请求**：`GET /trending/36kr?limit=20`
- **频控**：≥ 30 分钟
- **响应字段映射**：
  ```json
  {
    "rank": "rank",
    "title": "widget_title",
    "heat": "read_num",
    "heatUnit": "阅读量",
    "url": "https://36kr.com/p/{articleId}",
    "category": "category"
  }
  ```

### 7. 哔哩哔哩全站日榜

- **请求**：`GET /trending/bilibili?limit=20`
- **频控**：≥ 1 小时
- **响应字段映射**：
  ```json
  {
    "rank": "rank",
    "title": "title",
    "heat": "stat.view",
    "heatUnit": "播放量",
    "url": "https://www.bilibili.com/video/{bvid}",
    "imageUrl": "pic"
  }
  ```

### 8. 小红书热搜

- **请求**：`GET /trending/xiaohongshu?limit=20`
- **频控**：≥ 1 小时
- **响应字段映射**：
  ```json
  {
    "rank": "rank",
    "title": "word",
    "heat": "score",
    "heatUnit": "热度",
    "url": "https://www.xiaohongshu.com/search?q={title}"
  }
  ```

### 9. 澎湃热榜

- **请求**：`GET /trending/thepaper?limit=20`
- **频控**：≥ 30 分钟
- **响应字段映射**：
  ```json
  {
    "rank": "rank",
    "title": "title",
    "heat": "interactionNum",
    "heatUnit": "互动数",
    "url": "https://www.thepaper.cn/newsDetail_forward_{id}"
  }
  ```

### 10. 微信 24h 热文

- **请求**：`GET /trending/wechat-24h?limit=20`
- **频控**：≥ 1 小时
- **响应字段映射**：
  ```json
  {
    "rank": "rank",
    "title": "title",
    "heat": "readCount",
    "heatUnit": "阅读数",
    "url": "{sourceUrl}"
  }
  ```

---

## TRENDING_RESPONSE_MAPPING 环境变量格式

允许通过 env 动态覆盖默认映射（便于第三方 API 变更时快速适配）：

```bash
# .env.local
TRENDING_API_URL=https://api.trending-service.com
TRENDING_API_KEY=xxxxx
TRENDING_RESPONSE_MAPPING='{"weibo":{"title":"word","heat":"num"},"baidu":{"title":"query","heat":"hotScore"}}'
```

---

## 热度值归一化

不同平台的「热度」单位完全不同，无法直接比较。内部统一归一化到 **0-100 相对分**：

### 方法 1：log 变换 + 平台内百分位

```ts
function normalizeHeat(heat: number, platform: string): number {
  const logHeat = Math.log10(heat + 1);
  const percentile = getPlatformPercentile(platform, logHeat);  // 平台内历史分布百分位
  return Math.round(percentile * 100);
}
```

### 方法 2：平台内 Top 1 基准

```ts
function normalizeHeatToTop1(heat: number, topOneHeat: number): number {
  return Math.round((heat / topOneHeat) * 100);
}
```

VibeTide 当前采用**方法 2**（更直观，对应「榜一的 X%」）。

---

## 失败处理策略

### 单平台失败

- 连续 3 次失败 → 自动降级跳过
- failedPlatforms 数组记录
- 不影响其他平台返回

### 全部平台失败

- 判定为聚合服务不可用
- 返回 `{ topics: [], coverage: { successfulPlatforms: 0 } }`
- 上游 workflow 停止（不可能凭空生成热点话题）

### 部分字段缺失

- 必填字段（title / platform / rank）缺失 → skip 该条目
- 可选字段（imageUrl / category）缺失 → 输出 null
- 热度字段缺失 → 使用 rank 的倒数作为 fallback

---

## 2026 年 4 月 API 变更记录

| 日期 | 平台 | 变更 | 应对 |
|------|------|------|------|
| 2026-02-15 | 微博 | 热搜 API 返回字段 `category` → `category_v2` | 更新映射 |
| 2026-03-20 | 百度 | 热点榜合并旧 `realtime` 和 `rebang` | 用新端点 `/trending` |
| 2026-04-01 | 抖音 | 增加 `is_commerce` 字段 | 自动过滤广告 |

---

## 新平台接入 checklist

接入一个新平台（如视频号 / 快手）需要：

- [ ] 确认平台有公开或半公开热榜数据
- [ ] 选择稳定的第三方聚合服务（或自建爬虫）
- [ ] 在 `src/lib/agent/tools/trending-topics.ts` 添加平台 handler
- [ ] 更新 `TRENDING_RESPONSE_MAPPING` 映射
- [ ] 本文档追加平台规范
- [ ] 更新 `trending_topics/SKILL.md` §2 平台列表
