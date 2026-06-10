// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { CoworkSidebar } from "@/components/cowork/cowork-sidebar";
import type { Project } from "@/db/schema/projects";
import type { Conversation } from "@/db/schema/conversations";

const projects = [{ id: "p1", name: "时政组", color: null }] as unknown as Project[];
const conversations = [
  { id: "c1", title: "重庆AI产业快讯" },
  { id: "c2", title: "本周选题清单" },
] as unknown as Conversation[];

function renderSidebar(
  over: Partial<React.ComponentProps<typeof CoworkSidebar>> = {},
) {
  return render(
    <CoworkSidebar
      projects={projects}
      conversations={conversations}
      activeId={null}
      onNewConversation={() => {}}
      onNewProject={() => {}}
      {...over}
    />,
  );
}

describe("CoworkSidebar", () => {
  it("分组顺序:项目 在 最近对话 之前", () => {
    const { container } = renderSidebar();
    const text = container.textContent ?? "";
    const idxProject = text.indexOf("项目");
    const idxRecent = text.indexOf("最近对话");
    expect(idxProject).toBeGreaterThanOrEqual(0);
    expect(idxRecent).toBeGreaterThan(idxProject);
  });

  it("含新建对话/定时任务/定制及项目名、会话名", () => {
    const t = renderSidebar().container.textContent ?? "";
    expect(t).toContain("新建对话");
    expect(t).toContain("定时任务");
    expect(t).toContain("定制");
    expect(t).toContain("时政组");
    expect(t).toContain("重庆AI产业快讯");
  });

  it("定制默认收起,点击展开 SKILLS/连接器/个人插件", () => {
    const { container, getByRole } = renderSidebar();
    expect(container.textContent ?? "").not.toContain("连接器");
    fireEvent.click(getByRole("button", { name: /定制/ }));
    const t = container.textContent ?? "";
    expect(t).toContain("SKILLS");
    expect(t).toContain("连接器");
    expect(t).toContain("个人插件");
  });

  it("新建对话/新建项目触发回调", () => {
    const onNewConversation = vi.fn();
    const onNewProject = vi.fn();
    const { getByRole } = renderSidebar({ onNewConversation, onNewProject });
    fireEvent.click(getByRole("button", { name: /新建对话/ }));
    expect(onNewConversation).toHaveBeenCalledOnce();
    fireEvent.click(getByRole("button", { name: "新建项目" }));
    expect(onNewProject).toHaveBeenCalledOnce();
  });
});
