import Link from "next/link";
import { loadFaq } from "@/lib/help/faq";
import { FaqAccordion } from "@/components/help/faq/faq-accordion";

export const dynamic = "force-static";
export const metadata = { title: "常见问题", description: "Vibe Media 平台常见问题与解答" };

export default async function FaqPage() {
  const data = await loadFaq();
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">常见问题</h1>
      <p className="text-muted-foreground mb-8">
        找不到你要的?试试{" "}
        <Link href="/help/search" className="text-primary underline underline-offset-2">
          全文搜索
        </Link>
        。
      </p>
      <FaqAccordion data={data} />
    </div>
  );
}
