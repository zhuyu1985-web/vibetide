"use client";

import type { ReactNode } from "react";
import {
  Tabs as UiTabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface TabItem {
  label: string;
  content: ReactNode;
  value?: string;
}

interface TabsProps {
  items: TabItem[];
  defaultValue?: string;
  className?: string;
}

/**
 * MDX 内嵌 Tabs 薄 wrapper,内部复用 @/components/ui/tabs。
 * 由于和上游 ui 的 `Tabs` 同名,这里导出为 `Tabs`,在 mdxComponents
 * 中以别名 `MdxTabs` 暴露给 MDX 编译器,避免与 React 默认元素冲突。
 *
 * 用法:
 *   <Tabs items={[
 *     { label: "macOS", content: <>...</> },
 *     { label: "Windows", content: <>...</> },
 *   ]} />
 */
export function Tabs({ items, defaultValue, className }: TabsProps) {
  if (!items?.length) return null;
  const normalized = items.map((item, idx) => ({
    ...item,
    value: item.value ?? `tab-${idx}`,
  }));
  const initial = defaultValue ?? normalized[0].value;

  return (
    <UiTabs defaultValue={initial} className={cn("my-6", className)}>
      <TabsList variant="line" className="w-full justify-start">
        {normalized.map((item) => (
          <TabsTrigger key={item.value} value={item.value}>
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {normalized.map((item) => (
        <TabsContent
          key={item.value}
          value={item.value}
          className="pt-2 [&>p:first-child]:mt-0"
        >
          {item.content}
        </TabsContent>
      ))}
    </UiTabs>
  );
}
