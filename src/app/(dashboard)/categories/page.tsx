import { getCategoryTree } from "@/lib/dal/categories";
import CategoriesClient from "./categories-client";

export default async function CategoriesPage() {
  const categoryTree = await getCategoryTree().catch(() => []);
  return <CategoriesClient categoryTree={categoryTree} />;
}
