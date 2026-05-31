import { listCategories, listPopularDocs } from "@/lib/help/content";
import { HeroSearch } from "@/components/help/home/hero-search";
import { CategoryGrid } from "@/components/help/home/category-grid";
import { PopularDocs } from "@/components/help/home/popular-docs";
import { ContactSection } from "@/components/help/home/contact-section";

export const dynamic = "force-static";

const HOT_SEARCH_TERMS = ["第一个工作流", "AI 员工技能", "CMS 接入", "全渠道发布"];

export default async function HelpHomePage() {
  const categories = await listCategories();
  const popular = await listPopularDocs(6);
  return (
    <>
      <HeroSearch hotTerms={HOT_SEARCH_TERMS} />
      <CategoryGrid summaries={categories} />
      <PopularDocs docs={popular} />
      <ContactSection />
    </>
  );
}
