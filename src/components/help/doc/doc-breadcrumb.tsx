import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbSegment {
  label: string;
  href?: string;
}

export function Breadcrumb({ segments }: { segments: BreadcrumbSegment[] }) {
  return (
    <nav aria-label="面包屑" className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
      {segments.map((seg, i) => (
        <span key={`${seg.label}-${i}`} className="flex items-center gap-1.5">
          {seg.href ? (
            <Link href={seg.href} className="hover:text-foreground transition-colors">
              {seg.label}
            </Link>
          ) : (
            <span className="text-foreground">{seg.label}</span>
          )}
          {i < segments.length - 1 && <ChevronRight size={12} className="text-muted-foreground/50" />}
        </span>
      ))}
    </nav>
  );
}
