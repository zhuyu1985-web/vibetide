"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { TOC_ITEMS } from "../data/showcase-content";

interface TocSidebarProps {
  activeSection: string;
}

function TocNavItems({
  activeSection,
  onItemClick,
}: {
  activeSection: string;
  onItemClick?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-0.5">
      {TOC_ITEMS.map((item) => {
        const isActive = activeSection === item.id;
        return (
          <button
            key={item.id}
            onClick={() => {
              document
                .getElementById(item.id)
                ?.scrollIntoView({ behavior: "smooth" });
              onItemClick?.();
            }}
            className={cn(
              "text-left px-3 py-1.5 rounded-md transition-colors text-sm",
              item.level === 1 && "font-bold text-[13px]",
              item.level === 2 && "pl-7 text-[12.5px]",
              isActive &&
                "text-primary font-semibold border-l-2 border-primary",
              !isActive && "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.title}
          </button>
        );
      })}
    </nav>
  );
}

export default function TocSidebar({ activeSection }: TocSidebarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block fixed left-0 top-0 w-[260px] h-screen z-40 overflow-y-auto p-6 bg-background/80 backdrop-blur-xl border-r border-border/50" style={{ position: 'fixed' }}>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">
          目录
        </p>
        <TocNavItems activeSection={activeSection} />
      </aside>

      {/* Mobile floating button + sheet */}
      <div className="lg:hidden fixed bottom-6 left-4 z-50">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button className="size-10 flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
              <Menu className="size-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-6">
            <SheetTitle className="text-xs uppercase tracking-widest text-muted-foreground mb-4">
              目录
            </SheetTitle>
            <TocNavItems
              activeSection={activeSection}
              onItemClick={() => setSheetOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
