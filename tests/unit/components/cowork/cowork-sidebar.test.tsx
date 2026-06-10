// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";

// 侧栏现自包含(内部调 server actions + router),渲染测试需 mock 这些依赖,
// 否则会把 db/auth 模块拉进 jsdom。
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/app/actions/cowork-conversations", () => ({
  createConversationAction: vi.fn(),
  renameConversationAction: vi.fn(),
  pinConversationAction: vi.fn(),
  archiveConversationAction: vi.fn(),
  deleteConversationAction: vi.fn(),
}));
vi.mock("@/app/actions/projects", () => ({
  createProjectAction: vi.fn(),
}));

import { CoworkSidebar } from "@/components/cowork/cowork-sidebar";
import type { Project } from "@/db/schema/projects";
import type { Conversation } from "@/db/schema/conversations";

const projects = [{ id: "p1", name: "时政组", color: null }] as unknown as Project[];
const conversations = [
  { id: "c1", title: "置顶会话", pinnedAt: new Date() },
  { id: "c2", title: "普通会话A", pinnedAt: null },
  { id: "c3", title: "普通会话B", pinnedAt: null },
] as unknown as Conversation[];

function renderSidebar(activeId: string | null = null) {
  return render(
    <CoworkSidebar
      projects={projects}
      conversations={conversations}
      activeId={activeId}
    />,
  );
}

describe("CoworkSidebar", () => {
  it("分组顺序:项目 在 最近对话 之前", () => {
    const t = renderSidebar().container.textContent ?? "";
    expect(t.indexOf("项目")).toBeGreaterThanOrEqual(0);
    expect(t.indexOf("最近对话")).toBeGreaterThan(t.indexOf("项目"));
  });

  it("含新建对话/定时任务/定制 + 项目名 + 会话名", () => {
    const t = renderSidebar().container.textContent ?? "";
    ["新建对话", "定时任务", "定制", "时政组", "置顶会话", "普通会话A"].forEach(
      (s) => expect(t).toContain(s),
    );
  });

  it("有置顶会话时渲染「置顶」分组,且在最近对话之上", () => {
    const t = renderSidebar().container.textContent ?? "";
    expect(t).toContain("置顶");
    expect(t.indexOf("置顶")).toBeLessThan(t.indexOf("最近对话"));
  });

  it("定制默认收起,点击展开 SKILLS/连接器/个人插件", () => {
    const { container, getByRole } = renderSidebar();
    expect(container.textContent ?? "").not.toContain("连接器");
    fireEvent.click(getByRole("button", { name: /定制/ }));
    const t = container.textContent ?? "";
    ["SKILLS", "连接器", "个人插件"].forEach((s) => expect(t).toContain(s));
  });

  it("每条会话都有「会话操作」⋯ 菜单触发器", () => {
    const ops = renderSidebar().getAllByRole("button", { name: "会话操作" });
    expect(ops.length).toBe(conversations.length);
  });
});
