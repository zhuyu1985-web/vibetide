// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const navigationMock = vi.hoisted(() => ({
  pathname: "/cowork/conversation-1",
  searchParams: new URLSearchParams("mode=focus"),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationMock.pathname,
  useSearchParams: () => navigationMock.searchParams,
}));

vi.mock("@/lib/cowork/use-mission-live", () => ({
  useMissionLive: () => ({
    loading: false,
    mission: {
      id: "mission-1",
      title: "生成选题报告",
      status: "executing",
      tasks: [],
    },
  }),
}));

import { CoworkMissionPanel } from "@/components/cowork/cowork-mission-panel";

describe("CoworkMissionPanel", () => {
  it("adds the current cowork page as the return target for mission details", () => {
    render(<CoworkMissionPanel missionId="mission-1" />);

    const link = screen.getByRole("link", { name: /查看完整执行详情/ });

    expect(link.getAttribute("href")).toBe(
      "/missions/mission-1?returnTo=%2Fcowork%2Fconversation-1%3Fmode%3Dfocus",
    );
  });
});
