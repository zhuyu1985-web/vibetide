"use client";

import { GlassCard } from "@/components/shared/glass-card";
import { GLOSSARY } from "@/app/showcase/data/showcase-content";

export function GlossaryTable() {
  return (
    <GlassCard variant="secondary">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground">
                术语
              </th>
              <th className="text-left py-2 text-xs font-medium text-muted-foreground">
                解释
              </th>
            </tr>
          </thead>
          <tbody>
            {GLOSSARY.map((item, i) => (
              <tr
                key={item.term}
                className={i % 2 === 0 ? "bg-muted/20" : ""}
              >
                <td className="py-2.5 pr-4 align-top">
                  <code className="font-mono text-primary text-sm">
                    {item.term}
                  </code>
                </td>
                <td className="py-2.5 text-muted-foreground text-sm leading-relaxed">
                  {item.definition}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
