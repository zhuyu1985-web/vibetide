"use client";

import { useEffect, useRef, useState } from "react";
import { GlassCard } from "@/components/shared/glass-card";
import { DAG_TASKS } from "@/app/showcase/data/showcase-content";
import type { DagTask } from "@/app/showcase/data/showcase-content";

function useInView(ref: React.RefObject<HTMLElement | null>, threshold = 0.2) {
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

const serialTasks = DAG_TASKS.filter((t) => t.id <= 3);
const parallelTasks = DAG_TASKS.filter((t) => t.id > 3);

function TaskNode({ task, active, compact }: { task: DagTask; active: boolean; compact?: boolean }) {
  return (
    <GlassCard
      variant="secondary"
      padding="sm"
      className="transition-all duration-500"
    >
      <div
        style={{
          borderLeft: `3px solid ${task.employeeColor}`,
          paddingLeft: 12,
          boxShadow: active ? `0 0 18px ${task.employeeColor}44` : "none",
          borderRadius: 8,
        }}
      >
        {compact ? (
          /* Compact vertical layout for parallel tasks */
          <div className="flex flex-col gap-1.5 py-1">
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ backgroundColor: task.employeeColor }}
              >
                {task.id}
              </div>
              <p className="font-semibold text-sm">{task.title}</p>
            </div>
            <div className="flex items-center gap-2 pl-8">
              <span className="text-xs text-muted-foreground">{task.employee}</span>
              <span className="text-xs bg-muted/50 px-2 py-0.5 rounded">{task.skill}</span>
            </div>
          </div>
        ) : (
          /* Full horizontal layout for serial tasks */
          <div className="flex items-center gap-3">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ backgroundColor: task.employeeColor }}
            >
              {task.id}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{task.title}</p>
              <p className="text-xs text-muted-foreground">{task.employee}</p>
            </div>
            <span className="text-xs bg-muted/50 px-2 py-0.5 rounded shrink-0">
              {task.skill}
            </span>
          </div>
        )}
      </div>
    </GlassCard>
  );
}

function Connector() {
  return <div className="w-0.5 h-6 mx-auto bg-border" />;
}

export function DagExample() {
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef);
  const [activeIds, setActiveIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!inView) return;
    // Sequence: 1 → 2 → 3 → (4,5,6 simultaneously)
    const order = [1, 2, 3, [4, 5, 6]];
    let step = 0;
    const interval = setInterval(() => {
      if (step >= order.length) { clearInterval(interval); return; }
      const current = order[step];
      setActiveIds((prev) => {
        const next = new Set(prev);
        if (Array.isArray(current)) {
          current.forEach((id) => next.add(id));
        } else {
          next.add(current);
        }
        return next;
      });
      step++;
    }, 600);
    return () => clearInterval(interval);
  }, [inView]);

  return (
    <div ref={containerRef} className="space-y-0">
      {/* Serial tasks */}
      <div className="max-w-xl mx-auto space-y-0">
        {serialTasks.map((task, i) => (
          <div key={task.id}>
            <div
              className="transition-opacity duration-500"
              style={{ opacity: activeIds.has(task.id) ? 1 : 0.4 }}
            >
              <TaskNode task={task} active={activeIds.has(task.id)} />
            </div>
            {i < serialTasks.length - 1 && <Connector />}
          </div>
        ))}
      </div>

      {/* Fork zone */}
      <div className="mx-auto mt-0">
        {/* Vertical line from task 3 down to horizontal bar */}
        <div className="w-0.5 h-6 mx-auto bg-border" />

        {/* Horizontal connector bar */}
        <div className="relative">
          <div className="h-0.5 bg-border" />
          {/* Three vertical drops */}
          <div className="grid grid-cols-3 gap-4">
            <div className="w-0.5 h-5 mx-auto bg-border" />
            <div className="w-0.5 h-5 mx-auto bg-border" />
            <div className="w-0.5 h-5 mx-auto bg-border" />
          </div>
        </div>

        {/* Parallel tasks */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {parallelTasks.map((task) => (
            <div
              key={task.id}
              className="transition-opacity duration-500"
              style={{ opacity: activeIds.has(task.id) ? 1 : 0.4 }}
            >
              <TaskNode task={task} active={activeIds.has(task.id)} compact />
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="text-center mt-6 text-xs text-muted-foreground">
        <span>串行 ──→ 按依赖顺序执行</span>
        <span className="mx-3">|</span>
        <span>并行 ═══→ 无依赖同时执行</span>
      </div>
    </div>
  );
}
