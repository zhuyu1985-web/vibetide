// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/cowork/cowork-mission-panel", () => ({
  CoworkMissionPanel: ({ missionId }: { missionId: string | null }) => (
    <aside>执行面板 {missionId}</aside>
  ),
}));

import { MissionDrawer } from "@/components/cowork/mission-drawer";

describe("MissionDrawer", () => {
  it("collapses to a reopen control when a mission is available", () => {
    const onOpen = vi.fn();

    render(
      <MissionDrawer
        missionId="mission-1"
        open={false}
        onOpen={onOpen}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "展开执行过程" }));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("stays hidden when closed without a mission", () => {
    const { container } = render(
      <MissionDrawer
        missionId={null}
        open={false}
        onOpen={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(container.textContent).toBe("");
  });
});
