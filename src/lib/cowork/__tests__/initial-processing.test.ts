import { describe, expect, it } from "vitest";

import {
  buildPendingInitialProcessing,
  canClaimInitialProcessing,
  readInitialProcessing,
} from "../initial-processing";

describe("initial conversation processing state", () => {
  it("creates and reads a pending state with the original prompt", () => {
    const state = buildPendingInitialProcessing(
      "查一下今天的 AI 新闻",
      new Date("2026-07-11T12:00:00.000Z"),
    );

    expect(readInitialProcessing({ initialProcessing: state })).toEqual(state);
    expect(state).toMatchObject({
      status: "pending",
      prompt: "查一下今天的 AI 新闻",
      attempt: 0,
    });
  });

  it("claims pending state and reclaims an expired running lease", () => {
    const now = new Date("2026-07-11T12:05:00.000Z");
    expect(
      canClaimInitialProcessing(
        {
          status: "pending",
          prompt: "test",
          attempt: 0,
          updatedAt: "2026-07-11T12:04:59.000Z",
        },
        now,
      ),
    ).toBe(true);
    expect(
      canClaimInitialProcessing(
        {
          status: "running",
          prompt: "test",
          attempt: 1,
          updatedAt: "2026-07-11T12:00:00.000Z",
        },
        now,
      ),
    ).toBe(true);
    expect(
      canClaimInitialProcessing(
        {
          status: "running",
          prompt: "test",
          attempt: 1,
          updatedAt: "2026-07-11T12:04:30.000Z",
        },
        now,
      ),
    ).toBe(false);
  });

  it("does not automatically reclaim completed or failed states", () => {
    const now = new Date("2026-07-11T12:05:00.000Z");
    for (const status of ["completed", "failed"] as const) {
      expect(
        canClaimInitialProcessing(
          {
            status,
            prompt: "test",
            attempt: 1,
            updatedAt: "2026-07-11T12:00:00.000Z",
          },
          now,
        ),
      ).toBe(false);
    }
  });
});
