import { describe, expect, it } from "vitest";

import {
  RETURN_TO_PARAM,
  appendReturnTo,
  consumeCustomizeReturn,
  getSafeReturnTo,
  markCustomizeReturn,
} from "@/lib/navigation-return";

describe("navigation return helpers", () => {
  it("adds the current page as a return target without losing existing href params", () => {
    expect(appendReturnTo("/skills", "/home?tab=custom")).toBe(
      `/skills?${RETURN_TO_PARAM}=%2Fhome%3Ftab%3Dcustom`,
    );

    expect(appendReturnTo("/cowork/connectors?section=cms", "/cowork/abc")).toBe(
      `/cowork/connectors?section=cms&${RETURN_TO_PARAM}=%2Fcowork%2Fabc`,
    );
  });

  it("accepts only same-app relative return targets", () => {
    expect(
      getSafeReturnTo(new URLSearchParams("returnTo=/cowork/abc?tab=x"), "/home"),
    ).toBe("/cowork/abc?tab=x");
    expect(
      getSafeReturnTo(new URLSearchParams("returnTo=https://evil.test"), "/home"),
    ).toBe("/home");
    expect(getSafeReturnTo(new URLSearchParams("returnTo=//evil.test"), "/home")).toBe(
      "/home",
    );
  });

  it("marks customize entries so the source sidebar can reopen once after return", () => {
    const storage = new Map<string, string>();
    const sessionLike = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    };

    expect(consumeCustomizeReturn(sessionLike)).toBe(false);

    markCustomizeReturn(sessionLike);

    expect(consumeCustomizeReturn(sessionLike)).toBe(true);
    expect(consumeCustomizeReturn(sessionLike)).toBe(false);
  });
});
