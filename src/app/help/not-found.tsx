import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HelpNotFound() {
  return (
    <div className="max-w-2xl mx-auto py-24 text-center">
      <h1 className="text-2xl font-semibold">没找到这篇文档</h1>
      <p className="mt-3 text-muted-foreground">这份资料可能被移动了,或者还在编写中。</p>
      <div className="mt-6 flex gap-3 justify-center">
        <Button asChild><Link href="/help">回到帮助首页</Link></Button>
        {/* CLAUDE.md "按钮不要带边框" — 用 secondary 而非 outline */}
        <Button asChild variant="secondary"><Link href="/help/search">搜索文档</Link></Button>
      </div>
    </div>
  );
}
