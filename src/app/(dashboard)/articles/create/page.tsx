import { getCategories } from "@/lib/dal/categories";
import ArticleCreateClient from "./article-create-client";

export default async function ArticleCreatePage() {
  const categories = await getCategories().catch(() => []);
  return <ArticleCreateClient categories={categories} />;
}
