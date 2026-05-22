import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { revalidatePath } from "next/cache";

/**
 * 新建稿件页 —— Server-side INSERT 空稿后立即重定向到三栏编辑器。
 *
 * 没有客户端表单：访问 /articles/create 即代表「我要新建并立刻开始写」。
 * 列表 + 按钮也调用同一个 server action 路径，体验一致。
 *
 * 若用户误访问此 URL，最终结果是 articles 表多一行 status=draft 草稿，
 * 跳进编辑器后可手动取消编辑回到列表（草稿仍保留，可后续删除）。
 */
export default async function ArticleCreatePage() {
  const user = await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) {
    redirect("/articles");
  }

  const [article] = await db
    .insert(articles)
    .values({
      organizationId: orgId,
      title: "未命名稿件",
      body: "",
      mediaType: "article",
      status: "draft",
      createdBy: user.id,
      content: { headline: "未命名稿件", body: "", imageNotes: [] },
      wordCount: 0,
    })
    .returning();

  revalidatePath("/articles");
  redirect(`/articles/${article.id}?mode=edit`);
}
