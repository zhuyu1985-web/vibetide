"use client";

import { useEffect, useRef, useState } from "react";
import { GlassCard } from "@/components/shared/glass-card";

function useInView(ref: React.RefObject<HTMLElement | null>, threshold = 0.15) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, threshold]);
  return inView;
}

interface FlowNode {
  id: string;
  label: string;
  highlight?: boolean;
}

// The flow structure grouped by rows
const rows: { nodes: FlowNode[]; id: string }[] = [
  { id: "r0", nodes: [{ id: "chat", label: "对话中心", highlight: true }] },
  { id: "r1", nodes: [{ id: "intent", label: "意图识别引擎", highlight: true }] },
  { id: "r2", nodes: [{ id: "employee", label: "AI 员工", highlight: true }, { id: "workflow", label: "工作流引擎", highlight: true }] },
  { id: "r3", nodes: [{ id: "assembly", label: "Agent Assembly", highlight: true }] },
  { id: "r4", nodes: [{ id: "skill", label: "技能系统" }, { id: "kb", label: "知识库" }, { id: "memory", label: "记忆系统" }] },
  { id: "r5", nodes: [{ id: "prompt", label: "7层提示词组装" }] },
  { id: "r6", nodes: [{ id: "llm", label: "LLM 执行" }] },
  { id: "r7", nodes: [{ id: "eval", label: "自我评估" }, { id: "memset", label: "记忆沉淀" }] },
  { id: "r8", nodes: [{ id: "feedback", label: "用户反馈" }, { id: "learn", label: "学习引擎" }] },
];

function VLine() {
  return <div className="w-0.5 h-6 mx-auto bg-border" />;
}

function NodeCard({ node, active }: { node: FlowNode; active: boolean }) {
  return (
    <GlassCard
      variant="secondary"
      padding="sm"
      className="transition-all duration-400 max-w-[200px] mx-auto text-center"
    >
      <div
        className="transition-all duration-400"
        style={{
          opacity: active ? 1 : 0.35,
          borderBottom: active && node.highlight ? "2px solid hsl(var(--primary))" : "2px solid transparent",
          paddingBottom: 2,
        }}
      >
        <p className="text-sm font-semibold whitespace-nowrap">{node.label}</p>
      </div>
    </GlassCard>
  );
}

export function ModuleRelationship() {
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef);
  const [activeRow, setActiveRow] = useState(-1);

  useEffect(() => {
    if (!inView) return;
    let step = 0;
    const interval = setInterval(() => {
      if (step > rows.length) { clearInterval(interval); return; }
      setActiveRow(step);
      step++;
    }, 400);
    return () => clearInterval(interval);
  }, [inView]);

  return (
    <div ref={containerRef} className="space-y-0">
      {rows.map((row, rowIdx) => (
        <div key={row.id}>
          {/* Connector from previous row */}
          {rowIdx > 0 && (
            <>
              {/* For multi→single or single→multi, show merge/fork lines */}
              {row.nodes.length === 1 && rows[rowIdx - 1].nodes.length > 1 ? (
                <div className="max-w-md mx-auto px-4">
                  <div className="grid" style={{ gridTemplateColumns: `repeat(${rows[rowIdx - 1].nodes.length}, 1fr)` }}>
                    {rows[rowIdx - 1].nodes.map((n) => (
                      <div key={n.id} className="w-0.5 h-4 mx-auto bg-border" />
                    ))}
                  </div>
                  <div className="h-0.5 bg-border" />
                  <div className="w-0.5 h-4 mx-auto bg-border" />
                </div>
              ) : rows[rowIdx - 1].nodes.length === 1 && row.nodes.length > 1 ? (
                <div className="max-w-md mx-auto px-4">
                  <div className="w-0.5 h-4 mx-auto bg-border" />
                  <div className="h-0.5 bg-border" />
                  <div className="grid" style={{ gridTemplateColumns: `repeat(${row.nodes.length}, 1fr)` }}>
                    {row.nodes.map((n) => (
                      <div key={n.id} className="w-0.5 h-4 mx-auto bg-border" />
                    ))}
                  </div>
                </div>
              ) : rows[rowIdx - 1].nodes.length === row.nodes.length && row.nodes.length > 1 ? (
                <div className="max-w-md mx-auto px-4">
                  <div className="grid" style={{ gridTemplateColumns: `repeat(${row.nodes.length}, 1fr)` }}>
                    {row.nodes.map((n) => (
                      <div key={n.id} className="w-0.5 h-5 mx-auto bg-border" />
                    ))}
                  </div>
                </div>
              ) : (
                <VLine />
              )}
            </>
          )}

          {/* Row of nodes */}
          <div
            className="max-w-md mx-auto px-4 grid gap-3"
            style={{ gridTemplateColumns: `repeat(${row.nodes.length}, 1fr)` }}
          >
            {row.nodes.map((node) => (
              <NodeCard key={node.id} node={node} active={rowIdx <= activeRow} />
            ))}
          </div>
        </div>
      ))}

      {/* Loop-back indicator */}
      <div className="max-w-md mx-auto mt-4 px-4">
        <div className="border-2 border-dashed border-border/50 rounded-lg p-2 text-center">
          <p className="text-xs text-muted-foreground">
            ↩ 回到 Agent Assembly（记忆层已更新）
          </p>
        </div>
      </div>
    </div>
  );
}
