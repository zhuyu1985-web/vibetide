import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";

describe("next.config", () => {
  it("raises the Server Actions body limit for Excel imports", () => {
    expect(nextConfig.experimental?.serverActions?.bodySizeLimit).toBe("100mb");
  });
});
