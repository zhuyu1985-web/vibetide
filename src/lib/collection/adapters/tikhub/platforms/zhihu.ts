import type { RawItem } from "../../../types";
import { parseTimestampSec } from "../time-parser";

export const ZHIHU_ENDPOINT = "/api/v1/zhihu/web/fetch_article_search_v3";

// ─── 响应结构 ──────────────────────────────────────────────────────

interface ZhihuAuthor {
  id?: string;
  name?: string;
  url_token?: string;
}

interface ZhihuQuestion {
  id?: number | string;
  title?: string;
  name?: string;
  url?: string;
}

interface ZhihuObject {
  id?: number | string;
  original_id?: number | string;
  type?: string; // "answer" | "article" | "question" | "zvideo"
  title?: string;
  excerpt?: string;
  content?: string;
  url?: string;
  created_time?: number; // Unix seconds
  updated_time?: number; // Unix seconds
  author?: ZhihuAuthor;
  voteup_count?: number;
  comment_count?: number;
  favorites_count?: number;
  question?: ZhihuQuestion;
  thumbnail_info?: Record<string, unknown>;
}

interface ZhihuSearchItem {
  type?: string; // "search_result"
  object?: ZhihuObject;
  index?: number;
}

export interface ZhihuSearchResponse {
  code?: number;
  data?: {
    paging?: Record<string, unknown>;
    data?: ZhihuSearchItem[];
  };
}

// ─── Helper ────────────────────────────────────────────────────────

/** 清除 HTML 高亮标签 <em>...</em> */
function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, "").trim();
}

/**
 * 从 zhihu 对象中提取可访问的 web URL。
 * - answer: https://www.zhihu.com/question/<qid>/answer/<aid>
 * - article: https://zhuanlan.zhihu.com/p/<id>
 * - question: https://www.zhihu.com/question/<id>
 * - 其余: 保留 api URL 或空字符串
 */
function resolveZhihuUrl(obj: ZhihuObject): string {
  const type = obj.type;
  const id = obj.id ?? obj.original_id;

  if (type === "answer") {
    const qid = obj.question?.id;
    if (qid && id) {
      return `https://www.zhihu.com/question/${qid}/answer/${id}`;
    }
    if (id) return `https://www.zhihu.com/answer/${id}`;
  }

  if (type === "article" && id) {
    return `https://zhuanlan.zhihu.com/p/${id}`;
  }

  if (type === "question" && id) {
    return `https://www.zhihu.com/question/${id}`;
  }

  // fallback: use the api URL as-is (it's still a valid identifier)
  return obj.url ?? "";
}

// ─── Mapper ────────────────────────────────────────────────────────

/**
 * 把知乎搜索 API 响应映射为标准 RawItem[]。
 * 知乎搜索结果主要为回答 (answer)、文章 (article)、问题 (question)。
 * 封面图（如有）放入 rawMetadata，不入 attachments。
 */
export function mapZhihuResponse(response: ZhihuSearchResponse): RawItem[] {
  const list = response.data?.data ?? [];
  const items: RawItem[] = [];

  for (const entry of list) {
    const obj = entry.object;
    if (!obj) continue;

    // 跳过无法有效处理的类型（zvideo 等无稳定结构）
    const type = obj.type;
    if (!type || !["answer", "article", "question"].includes(type)) continue;

    const id = obj.id ?? obj.original_id;
    if (!id) continue;

    // 标题优先用 obj.title，知乎 answer 会把 question 标题填到 obj.title
    const rawTitle = obj.title ?? obj.question?.title ?? obj.question?.name ?? "";
    const cleanTitle = stripHtml(rawTitle) || "(无标题)";

    const rawExcerpt = obj.excerpt ?? obj.content ?? "";
    const cleanExcerpt = stripHtml(rawExcerpt).slice(0, 200);

    const url = resolveZhihuUrl(obj);
    const publishedAt = parseTimestampSec(obj.created_time ?? obj.updated_time);

    items.push({
      title: cleanTitle,
      url,
      summary: cleanExcerpt || undefined,
      publishedAt,
      channel: "tikhub_zhihu",
      contentType: "image_text",
      attachments: [],
      rawMetadata: {
        platform: "zhihu",
        item_id: String(id),
        item_type: type,
        question_id: obj.question?.id !== undefined ? String(obj.question.id) : undefined,
        author: obj.author?.name,
        author_id: obj.author?.id,
        upvotes: obj.voteup_count,
        comments: obj.comment_count,
        favorites: obj.favorites_count,
      },
    });
  }

  return items;
}
