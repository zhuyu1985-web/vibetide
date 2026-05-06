// src/lib/research/topic-matcher.ts
// A3 Phase 3: keyword-based topic matching algorithm

export interface TopicWithKeywords {
  id: string;
  name: string;
  primaryKeywords: string[];   // isPrimary=true 的关键词，至少含 topic.name
  otherKeywords: string[];     // isPrimary=false 的关键词
}

export interface TopicMatchResult {
  topicId: string;
  matchedKeyword: string;
  matchType: "keyword";  // A3 V1 统一用 keyword（topicMatchTypeEnum 仅 keyword/semantic/both）
}

/**
 * 对一条文本进行关键词匹配，返回命中的 topic 列表。
 * 每个 topic 最多命中一次（主词优先，主词命中则跳过近似词）。
 */
export function matchTopicsForItem(
  text: string,
  topics: TopicWithKeywords[],
): TopicMatchResult[] {
  const matches: TopicMatchResult[] = [];
  if (!text) return matches;
  const lowerText = text.toLowerCase();

  for (const topic of topics) {
    let hit: string | null = null;
    // 1. 主词优先（精确包含）
    for (const kw of topic.primaryKeywords) {
      if (lowerText.includes(kw.toLowerCase())) { hit = kw; break; }
    }
    // 2. 主词未命中则尝试近似词
    if (!hit) {
      for (const kw of topic.otherKeywords) {
        if (lowerText.includes(kw.toLowerCase())) { hit = kw; break; }
      }
    }
    if (hit) {
      matches.push({ topicId: topic.id, matchedKeyword: hit, matchType: "keyword" });
    }
  }

  return matches;
}
