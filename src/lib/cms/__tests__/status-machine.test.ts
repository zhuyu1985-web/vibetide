import { describe, it, expect } from "vitest";
import {
  mapCmsStatusToPublicationState,
  canTransition,
  isTerminalState,
  type CmsPublicationState,
} from "../status-machine";

describe("mapCmsStatusToPublicationState", () => {
  it("maps '30' (发布) → synced", () => {
    expect(mapCmsStatusToPublicationState("30")).toBe("synced");
  });

  it("maps '60' (重新编辑) → rejected_by_cms", () => {
    expect(mapCmsStatusToPublicationState("60")).toBe("rejected_by_cms");
  });

  it("maps '0' (初稿) / '20' (待发布) → submitted (未终态)", () => {
    expect(mapCmsStatusToPublicationState("0")).toBe("submitted");
    expect(mapCmsStatusToPublicationState("20")).toBe("submitted");
  });

  it("returns null for unknown status (caller decides)", () => {
    expect(mapCmsStatusToPublicationState("99")).toBeNull();
    expect(mapCmsStatusToPublicationState("")).toBeNull();
    expect(mapCmsStatusToPublicationState(undefined)).toBeNull();
  });
});

describe("canTransition", () => {
  it("submitting → submitted (success)", () => {
    expect(canTransition("submitting", "submitted")).toBe(true);
  });
  it("submitting → retrying (network/5xx)", () => {
    expect(canTransition("submitting", "retrying")).toBe(true);
  });
  it("submitting → failed (non-retriable)", () => {
    expect(canTransition("submitting", "failed")).toBe(true);
  });
  it("retrying → submitted or failed", () => {
    expect(canTransition("retrying", "submitted")).toBe(true);
    expect(canTransition("retrying", "failed")).toBe(true);
  });
  it("submitted → synced / rejected_by_cms (from polling)", () => {
    expect(canTransition("submitted", "synced")).toBe(true);
    expect(canTransition("submitted", "rejected_by_cms")).toBe(true);
  });
  it("synced → anything is FORBIDDEN (terminal)", () => {
    expect(canTransition("synced", "submitted")).toBe(false);
    expect(canTransition("synced", "failed")).toBe(false);
  });
  it("failed → anything is FORBIDDEN (terminal)", () => {
    expect(canTransition("failed", "submitted")).toBe(false);
  });
  it("rejected_by_cms → anything is FORBIDDEN", () => {
    expect(canTransition("rejected_by_cms", "submitted")).toBe(false);
  });
});

describe("isTerminalState", () => {
  it("synced / failed / rejected_by_cms are terminal", () => {
    expect(isTerminalState("synced")).toBe(true);
    expect(isTerminalState("failed")).toBe(true);
    expect(isTerminalState("rejected_by_cms")).toBe(true);
  });
  it("submitting / submitted / retrying are not terminal", () => {
    expect(isTerminalState("submitting")).toBe(false);
    expect(isTerminalState("submitted")).toBe(false);
    expect(isTerminalState("retrying")).toBe(false);
  });
});
