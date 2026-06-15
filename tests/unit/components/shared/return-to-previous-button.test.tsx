// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigationMock = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: navigationMock.back,
    push: navigationMock.push,
  }),
  useSearchParams: () => navigationMock.searchParams,
}));

import { ReturnToPreviousButton } from "@/components/shared/return-to-previous-button";

describe("ReturnToPreviousButton", () => {
  beforeEach(() => {
    navigationMock.back.mockClear();
    navigationMock.push.mockClear();
    navigationMock.searchParams = new URLSearchParams(
      "returnTo=/cowork/conversation-1",
    );
    window.history.pushState({}, "", "/missions/mission-1");
  });

  it("uses an explicit safe return target before falling back to browser history", () => {
    render(<ReturnToPreviousButton fallbackHref="/missions" />);

    fireEvent.click(screen.getByRole("button", { name: "返回" }));

    expect(navigationMock.push).toHaveBeenCalledWith("/cowork/conversation-1");
    expect(navigationMock.back).not.toHaveBeenCalled();
  });

  it("uses the fallback when an explicit return target is unsafe", () => {
    navigationMock.searchParams = new URLSearchParams(
      "returnTo=https://evil.test",
    );

    render(<ReturnToPreviousButton fallbackHref="/missions" />);

    fireEvent.click(screen.getByRole("button", { name: "返回" }));

    expect(navigationMock.push).toHaveBeenCalledWith("/missions");
    expect(navigationMock.back).not.toHaveBeenCalled();
  });
});
