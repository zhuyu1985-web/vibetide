// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Callout } from "@/components/help/mdx/callout";
import { Steps } from "@/components/help/mdx/steps";
import { KeyboardKey } from "@/components/help/mdx/keyboard-key";
import { DocLink } from "@/components/help/mdx/doc-link";

describe("MDX components smoke", () => {
  it("Callout 4 个 type 都渲染不报错", () => {
    (["tip", "warn", "note", "info"] as const).forEach((t) => {
      const { container } = render(<Callout type={t}>x</Callout>);
      expect(container.textContent).toContain("x");
    });
  });

  it("Steps 渲染序号", () => {
    const { container } = render(
      <Steps>
        <ol>
          <li>a</li>
          <li>b</li>
        </ol>
      </Steps>,
    );
    expect(container.textContent).toContain("a");
    expect(container.textContent).toContain("b");
  });

  it("KeyboardKey 渲染文本", () => {
    const { container } = render(<KeyboardKey>Cmd+K</KeyboardKey>);
    expect(container.textContent).toBe("Cmd+K");
  });

  it("DocLink 输出 link", () => {
    const { container } = render(<DocLink href="/help/x">link</DocLink>);
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/help/x");
  });
});
