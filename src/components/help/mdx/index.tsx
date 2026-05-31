import type { ComponentPropsWithoutRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Callout } from "./callout";
import { Steps } from "./steps";
import { ScreenshotZoom } from "./screenshot-zoom";
import { VideoEmbed } from "./video-embed";
import { EmployeeBadge } from "./employee-badge";
import { KeyboardKey } from "./keyboard-key";
import { DocLink } from "./doc-link";
import { Tabs as MdxTabs } from "./tabs";

/**
 * 标准 HTML 元素重写(prose 风格)。
 * 思路:外层 DocLayout 已经套了 `prose prose-sm`,这里再针对个别元素加上
 * 锚点滚动偏移(scroll-mt-20,避开 sticky header)、行高、颜色微调,
 * 并把 <img>/<a> 接到 next/image 与 next/link。
 */
const StandardElements = {
  h1: (props: ComponentPropsWithoutRef<"h1">) => (
    <h1
      className="mt-12 mb-4 scroll-mt-20 text-3xl font-bold tracking-tight"
      {...props}
    />
  ),
  h2: (props: ComponentPropsWithoutRef<"h2">) => (
    <h2
      className="mt-10 mb-3 scroll-mt-20 text-2xl font-semibold tracking-tight"
      {...props}
    />
  ),
  h3: (props: ComponentPropsWithoutRef<"h3">) => (
    <h3
      className="mt-8 mb-2 scroll-mt-20 text-xl font-semibold"
      {...props}
    />
  ),
  p: (props: ComponentPropsWithoutRef<"p">) => (
    <p className="my-4 leading-7 text-foreground/90" {...props} />
  ),
  ul: (props: ComponentPropsWithoutRef<"ul">) => (
    <ul className="my-4 ml-6 list-disc space-y-1" {...props} />
  ),
  ol: (props: ComponentPropsWithoutRef<"ol">) => (
    <ol className="my-4 ml-6 list-decimal space-y-1" {...props} />
  ),
  li: (props: ComponentPropsWithoutRef<"li">) => (
    <li className="leading-7" {...props} />
  ),
  blockquote: (props: ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote
      className="my-4 border-l-4 border-border pl-4 italic text-muted-foreground"
      {...props}
    />
  ),
  code: (props: ComponentPropsWithoutRef<"code">) => (
    <code
      className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]"
      {...props}
    />
  ),
  pre: (props: ComponentPropsWithoutRef<"pre">) => (
    <pre
      className="my-4 overflow-x-auto rounded-lg text-sm"
      {...props}
    />
  ),
  table: (props: ComponentPropsWithoutRef<"table">) => (
    <div className="my-6 overflow-x-auto">
      <table className="w-full border-collapse" {...props} />
    </div>
  ),
  th: (props: ComponentPropsWithoutRef<"th">) => (
    <th
      className="border border-border bg-muted/40 px-3 py-1.5 text-left text-sm font-semibold"
      {...props}
    />
  ),
  td: (props: ComponentPropsWithoutRef<"td">) => (
    <td className="border border-border px-3 py-1.5 text-sm" {...props} />
  ),
  hr: (props: ComponentPropsWithoutRef<"hr">) => (
    <hr className="my-8 border-border" {...props} />
  ),
  img: (props: ComponentPropsWithoutRef<"img">) => {
    const { src, alt, width, height, ...rest } = props;
    if (!src || typeof src !== "string") return null;
    // 标 width/height 时走 next/image 自动响应式
    if (typeof width === "number" && typeof height === "number") {
      return (
        <Image
          src={src}
          alt={alt ?? ""}
          width={width}
          height={height}
          loading="lazy"
          className="my-6 h-auto max-w-full rounded-lg"
        />
      );
    }
    // 否则用原生 <img>,避免 next/image 强制要求尺寸
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return (
      <img
        src={src}
        alt={alt ?? ""}
        loading="lazy"
        className="my-6 h-auto max-w-full rounded-lg"
        {...rest}
      />
    );
  },
  a: ({
    href,
    children,
    ...rest
  }: ComponentPropsWithoutRef<"a">) => {
    if (!href || typeof href !== "string") {
      return <a {...rest}>{children}</a>;
    }
    const isInternal =
      (href.startsWith("/") && !href.startsWith("//")) || href.startsWith("#");
    if (isInternal) {
      return (
        <Link
          href={href}
          className="text-primary underline-offset-2 hover:underline"
        >
          {children}
        </Link>
      );
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline-offset-2 hover:underline"
        {...rest}
      >
        {children}
      </a>
    );
  },
};

/**
 * 传给 <MDXRemote components={mdxComponents} /> 的统一映射。
 * - 标准 HTML 元素(h1-h3 / p / ul / ol / blockquote / code / pre / table / img / a 等)走 StandardElements
 * - 8 个自定义组件用 PascalCase 名字暴露给 MDX 编译期
 * - `Tabs` 别名 `MdxTabs`,因为 MDX 里写 <Tabs> 编译期会找这个 key
 */
export const mdxComponents = {
  ...StandardElements,
  Callout,
  Steps,
  ScreenshotZoom,
  VideoEmbed,
  EmployeeBadge,
  KeyboardKey,
  DocLink,
  Tabs: MdxTabs,
};

export type MdxComponents = typeof mdxComponents;
