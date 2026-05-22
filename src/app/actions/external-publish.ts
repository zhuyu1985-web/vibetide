"use server";

import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  publishToAyrshare,
  type PublishToAyrshareResult,
} from "@/lib/ayrshare";

export interface PublishToAyrshareInput {
  articleId: string;
  platforms: string[];
}

export async function publishToAyrshareAction(
  input: PublishToAyrshareInput,
): Promise<PublishToAyrshareResult> {
  const user = await requireAuth();

  const result = await publishToAyrshare({
    articleId: input.articleId,
    platforms: input.platforms,
    operatorId: user.id,
  });

  revalidatePath(`/articles/${input.articleId}`);
  return result;
}
