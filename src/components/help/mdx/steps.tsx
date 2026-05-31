import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StepsProps {
  children: ReactNode;
  className?: string;
}

/**
 * 给内部 <ol><li> 自动加左侧时间线 + 编号圆点。
 * 用 CSS counter 实现编号,不依赖 list-decimal,保证圆点视觉一致。
 *
 * 用法:
 *   <Steps>
 *     1. 第一步
 *     2. 第二步
 *   </Steps>
 *
 * MDX 编译时 1. / 2. 会被翻译成 <ol><li>...</li></ol>。
 */
export function Steps({ children, className }: StepsProps) {
  return (
    <div
      className={cn(
        "my-6 [counter-reset:step]",
        // 内部 <ol>: 去掉默认 list-style,改用左侧时间线
        "[&_ol]:relative [&_ol]:m-0 [&_ol]:list-none [&_ol]:space-y-4 [&_ol]:border-l-2 [&_ol]:border-border [&_ol]:pl-8 [&_ol]:py-1",
        // 内部 <li>: 用 ::before 渲染编号圆点
        "[&_ol>li]:relative [&_ol>li]:pl-2 [&_ol>li]:leading-7 [&_ol>li]:[counter-increment:step]",
        // 圆点(在 <li> 左外侧 -32px)
        "[&_ol>li]:before:absolute [&_ol>li]:before:left-[-1.05rem] [&_ol>li]:before:top-[0.2rem]",
        "[&_ol>li]:before:flex [&_ol>li]:before:size-6 [&_ol>li]:before:items-center [&_ol>li]:before:justify-center",
        "[&_ol>li]:before:rounded-full [&_ol>li]:before:bg-sky-500 [&_ol>li]:before:text-xs [&_ol>li]:before:font-semibold [&_ol>li]:before:text-white",
        "[&_ol>li]:before:[content:counter(step)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
