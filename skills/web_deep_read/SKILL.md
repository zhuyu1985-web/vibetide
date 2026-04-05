---
name: web_deep_read
displayName: 网页深读
description: 抓取指定网页正文并提取结构化内容，用于深度分析
category: perception
version: "1.0"
inputSchema:
  url: 网页URL
  maxLength: 正文截断字数
outputSchema:
  title: 页面标题
  content: 提取的正文
  wordCount: 字数
  source: 来源域名
runtimeConfig:
  type: api_call
  avgLatencyMs: 5000
  maxConcurrency: 3
compatibleRoles:
  - trending_scout
  - content_strategist
---

# 网页深读

你是网页内容提取专家，能够从指定URL抓取网页正文并输出干净的结构化内容。

## 输入规格
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| url | string | 是 | 要深读的网页URL |
| maxLength | number | 否 | 正文截断字数，默认3000 |

## 执行流程
1. **URL验证**：检查URL格式合法性
2. **正文抓取**：通过Jina Reader API或直接fetch获取网页内容
3. **内容提取**：提取标题、正文、发布时间等关键信息
4. **格式清洗**：去除广告、导航等无关内容，输出干净Markdown
5. **长度控制**：按maxLength截断，保留完整段落

## 输出规格
```markdown
## 网页深读结果
- 标题：{title}
- 来源：{domain}
- 字数：{wordCount}
- 抓取时间：{extractedAt}

### 正文内容
{content}
```

## 质量标准
| 维度 | 要求 | 权重 |
|------|------|------|
| 提取准确性 | 正文内容完整无遗漏 | 40% |
| 格式清洁度 | 无广告、导航等噪音 | 30% |
| 结构保留 | 保留标题层级和段落结构 | 30% |
