"use server";

// NOTE: 等 B1 worktree 合入后替换 stub 为真实 publishToAyrshare 调用
// 当前为 B3 实施阶段，B1 的 src/lib/ayrshare/ 尚未 merge 进本 worktree。
// 设计文档：/Users/zhuyu/.claude/plans/tophub-x-instagram-twitter-sunny-papert.md §3.1

import { requireAuth } from "@/lib/auth";
// import { revalidatePath } from "next/cache";
// import { publishToAyrshare } from "@/lib/ayrshare"; // B1 will provide

export interface PublishToAyrshareInput {
  articleId: string;
  platforms: string[];
}

/**
 * 把指定文章发布到 Ayrshare 聚合的外部社媒平台（X / Instagram / Facebook / LinkedIn）。
 *
 * Stub 实现 —— 等 B1 worktree 合入 `src/lib/ayrshare/publish.ts` 后，把 throw 去掉，
 * 启用下面被注释的真实调用 + revalidatePath。
 */
export async function publishToAyrshareAction(
  input: PublishToAyrshareInput,
): Promise<never> {
  // 即便是 stub 也做鉴权 —— 避免误暴露
  await requireAuth();

  // 暂时 stub 抛 NotImplementedError，等 B1 merge 后联调时去掉
  throw new Error(
    `[external-publish] B1 Ayrshare lib not yet merged. Stub. (article=${input.articleId}, platforms=${input.platforms.join(",")})`,
  );

  // const result = await publishToAyrshare({
  //   articleId: input.articleId,
  //   platforms: input.platforms,
  //   operatorId: user.id,
  // });
  // revalidatePath(`/articles/${input.articleId}`);
  // return result;
}
