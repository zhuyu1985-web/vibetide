/**
 * topicCompareFindMatchesOnNew
 *
 * 监听 `topic-compare/my-post.created`，对新创建的 my_post 自动执行同题匹配：
 *   1. 关键词召回 benchmark_posts 候选
 *   2. LLM 判定同题
 *   3. upsert 到 topic_matches
 *
 * 并发限制 4（防 LLM 雪崩），重试 3 次
 */

import { inngest } from "@/inngest/client";
import { findSameTopicMatches } from "@/lib/topic-matching/find-matches";

export const topicCompareFindMatchesOnNew = inngest.createFunction(
  {
    id: "topic-compare/find-matches-on-new-mypost",
    name: "Topic Compare · 新 my_post 自动同题匹配",
    concurrency: 4,
    retries: 3,
  },
  { event: "topic-compare/my-post.created" },
  async ({ event, step }) => {
    const { organizationId, myPostId } = event.data;
    return step.run("find-matches", async () => {
      return findSameTopicMatches({ orgId: organizationId, myPostId });
    });
  },
);
