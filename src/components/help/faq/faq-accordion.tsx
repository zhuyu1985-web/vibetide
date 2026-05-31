"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import Fuse from "fuse.js";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { SearchInput } from "@/components/shared/search-input";
import type { FaqFile } from "@/lib/help/faq";

export function FaqAccordion({ data }: { data: FaqFile }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [openItems, setOpenItems] = useState<string[]>([]);

  const fuse = useMemo(
    () => new Fuse(data.items, { keys: ["question", "answer"], threshold: 0.4 }),
    [data],
  );

  // URL hash → 默认展开 + 滚动到该项
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash && data.items.some((i) => i.id === hash)) {
      setOpenItems([hash]);
      setTimeout(
        () =>
          document
            .getElementById(hash)
            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
        100,
      );
    }
  }, [data.items]);

  const filtered = q.trim() ? fuse.search(q).map((r) => r.item) : data.items;
  const visible = cat === "all" ? filtered : filtered.filter((i) => i.category === cat);

  return (
    <div>
      <SearchInput
        placeholder="搜索常见问题…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-6"
      />
      <Tabs value={cat} onValueChange={setCat}>
        <TabsList variant="line">
          <TabsTrigger value="all">全部</TabsTrigger>
          {data.categories.map((c) => (
            <TabsTrigger key={c.id} value={c.id}>
              {c.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Accordion
        type="multiple"
        className="mt-6"
        value={openItems}
        onValueChange={setOpenItems}
      >
        {visible.map((item) => (
          // 外包 div 真正承载 DOM id(Radix AccordionItem 的 id prop 不会透传到 DOM)
          <div key={item.id} id={item.id} className="scroll-mt-20">
            <AccordionItem value={item.id}>
              <AccordionTrigger>
                <span>
                  {item.question}
                  {item.popular && (
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                      热门
                    </span>
                  )}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{item.answer}</ReactMarkdown>
                </div>
                {item.relatedDocs && item.relatedDocs.length > 0 && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    相关文档:
                    {item.relatedDocs.map((d) => (
                      <Link key={d} href={d} className="text-primary mr-3">
                        {d}
                      </Link>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </div>
        ))}
      </Accordion>
    </div>
  );
}
