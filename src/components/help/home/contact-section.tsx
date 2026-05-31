import Link from "next/link";
import { Button } from "@/components/ui/button";

export function ContactSection() {
  return (
    <section className="max-w-3xl mx-auto px-4 py-16 text-center">
      <h3 className="text-xl font-semibold text-foreground">没找到答案?</h3>
      <p className="mt-3 text-sm text-muted-foreground">
        直接与 AI 员工对话获取建议,或把文档反馈发给我们持续改进。
      </p>
      <div className="mt-6 flex gap-3 justify-center flex-wrap">
        <Button asChild>
          <Link href="/chat">打开 AI 员工对话中心</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="mailto:help@vibetide.local">提交文档反馈</Link>
        </Button>
      </div>
    </section>
  );
}
