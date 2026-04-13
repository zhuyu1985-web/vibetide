"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { GlassCard } from "@/components/shared/glass-card";
import { ARCH_LAYERS } from "@/app/showcase/data/showcase-content";

const CONNECTOR_LABELS = ["调用", "驱动", "依赖"];

const BORDER_COLOR: Record<string, string> = {
  pink: "border-l-pink-500",
  indigo: "border-l-indigo-500",
  cyan: "border-l-cyan-500",
  emerald: "border-l-emerald-500",
};

const TEXT_COLOR: Record<string, string> = {
  pink: "text-pink-500",
  indigo: "text-indigo-500",
  cyan: "text-cyan-500",
  emerald: "text-emerald-500",
};

function LayerConnector({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-0 py-1">
      <div className="w-px h-4 bg-border" />
      <span className="text-xs text-muted-foreground py-0.5">
        ⬇ {label}
      </span>
      <div className="w-px h-4 bg-border" />
    </div>
  );
}

export function FourLayerArch() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });

  return (
    <div ref={ref} className="space-y-0">
      {ARCH_LAYERS.map((layer, i) => (
        <div key={layer.name}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{
              delay: i * 0.15,
              duration: 0.5,
              ease: "easeOut",
            }}
          >
            <GlassCard
              variant="secondary"
              padding="sm"
              className={`border-l-4 ${BORDER_COLOR[layer.color] ?? "border-l-gray-500"}`}
            >
              <p className={`font-bold text-sm mb-2 ${TEXT_COLOR[layer.color] ?? "text-foreground"}`}>
                ▎{layer.name}
              </p>
              <div className="flex flex-wrap gap-2">
                {layer.modules.map((mod) => (
                  <span
                    key={mod.name}
                    className={`
                      px-3 py-1.5 rounded-lg text-xs
                      ${mod.highlight
                        ? "bg-primary/10 text-primary border border-primary/20 font-medium"
                        : "bg-muted/50 text-foreground"
                      }
                    `}
                  >
                    {mod.name}
                  </span>
                ))}
              </div>
            </GlassCard>
          </motion.div>

          {i < ARCH_LAYERS.length - 1 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : { opacity: 0 }}
              transition={{ delay: i * 0.15 + 0.3, duration: 0.3 }}
            >
              <LayerConnector label={CONNECTOR_LABELS[i]} />
            </motion.div>
          )}
        </div>
      ))}
    </div>
  );
}
