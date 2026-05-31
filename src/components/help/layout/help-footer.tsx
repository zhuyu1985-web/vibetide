import Link from "next/link";

export function HelpFooter() {
  return (
    <footer className="h-20 border-t border-border/60 flex items-center justify-center text-xs text-muted-foreground gap-4">
      <span>© 2026 Vibe Media</span>
      <span>·</span>
      <Link href="/help/changelog" className="hover:text-foreground">更新日志</Link>
      <span>·</span>
      <Link href="/help/faq" className="hover:text-foreground">常见问题</Link>
    </footer>
  );
}
