"use client";

import { motion } from "framer-motion";
import { GlassCard } from "@/components/shared/glass-card";
import { PROMPT_LAYERS } from "@/app/showcase/data/showcase-content";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const cardVariant = {
  hidden: { opacity: 0, x: -30 },
  show: { opacity: 1, x: 0, transition: { duration: 0.45, ease: "easeOut" as const } },
};

// Interpolate hue from blue (220) to cyan (185) across 7 layers
function layerGradient(layer: number): string {
  const startHue = 220;
  const endHue = 185;
  const hue = startHue + ((endHue - startHue) * (layer - 1)) / 6;
  return `linear-gradient(135deg, hsl(${hue}, 70%, 50%), hsl(${hue + 15}, 80%, 60%))`;
}

function DynamicBadge({ level }: { level: string }) {
  const config: Record<string, { bg: string; text: string; pulse: boolean }> = {
    "静态": { bg: "bg-muted", text: "text-muted-foreground", pulse: false },
    "半动态": { bg: "bg-amber-500/15", text: "text-amber-600 dark:text-amber-400", pulse: false },
    "高度动态": { bg: "bg-green-500/15", text: "text-green-600 dark:text-green-400", pulse: true },
  };
  const c = config[level] ?? config["静态"];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}
    >
      {c.pulse && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
      )}
      {level}
    </span>
  );
}

export function SevenLayerPrompt() {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.1 }}
      className="space-y-6"
    >
      <div className="space-y-3">
        {PROMPT_LAYERS.map((layer) => (
          <motion.div
            key={layer.layer}
            variants={cardVariant}
          >
            <GlassCard
              variant="secondary"
              padding="sm"
              hover
              className="flex items-center gap-4"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                style={{ background: layerGradient(layer.layer) }}
              >
                L{layer.layer}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{layer.name}</p>
                <p className="text-xs text-muted-foreground">
                  {layer.content}
                </p>
              </div>
              <div className="shrink-0">
                <DynamicBadge level={layer.dynamicLevel} />
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      <motion.div variants={cardVariant}>
        <GlassCard variant="accent" padding="sm">
          <p className="text-sm leading-relaxed">
            🔑 <span className="font-semibold">分层设计的核心价值：</span>
            每一层可以独立更新，无需重写整个 Prompt。
          </p>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
