import { describe, it, expect } from "vitest";
import {
  CmsError,
  CmsAuthError,
  CmsBusinessError,
  CmsNetworkError,
  CmsSchemaError,
  CmsConfigError,
  isRetriableCmsError,
  classifyCmsError,
} from "../errors";

describe("CmsError hierarchy", () => {
  it("CmsAuthError extends CmsError with name", () => {
    const err = new CmsAuthError("login_cmc_id 失效");
    expect(err).toBeInstanceOf(CmsError);
    expect(err.name).toBe("CmsAuthError");
    expect(err.message).toBe("login_cmc_id 失效");
  });

  it("CmsBusinessError carries state + cmsMessage metadata", () => {
    const err = new CmsBusinessError("state=500", { state: 500, cmsMessage: "内部错误" });
    expect(err.state).toBe(500);
    expect(err.cmsMessage).toBe("内部错误");
  });

  it("CmsNetworkError for timeouts and DNS failures", () => {
    const err = new CmsNetworkError("timeout", { cause: "AbortError" });
    expect(err.cause).toBe("AbortError");
  });

  it("CmsSchemaError for invalid payloads", () => {
    const err = new CmsSchemaError("missing required: content", { field: "content" });
    expect(err.field).toBe("content");
  });

  it("CmsConfigError for missing env / unmapped catalog", () => {
    const err = new CmsConfigError("CMS_HOST missing");
    expect(err).toBeInstanceOf(CmsError);
  });
});

describe("isRetriableCmsError", () => {
  it("network errors are retriable", () => {
    expect(isRetriableCmsError(new CmsNetworkError("timeout"))).toBe(true);
  });

  it("5xx business errors are retriable", () => {
    expect(
      isRetriableCmsError(new CmsBusinessError("server error", { state: 503 })),
    ).toBe(true);
  });

  it("auth errors are NOT retriable (would accelerate account lockout)", () => {
    expect(isRetriableCmsError(new CmsAuthError("未登录"))).toBe(false);
  });

  it("schema errors are NOT retriable", () => {
    expect(isRetriableCmsError(new CmsSchemaError("bad payload"))).toBe(false);
  });

  it("config errors are NOT retriable", () => {
    expect(isRetriableCmsError(new CmsConfigError("env missing"))).toBe(false);
  });

  it("4xx business errors are NOT retriable (except 408/429)", () => {
    expect(
      isRetriableCmsError(new CmsBusinessError("bad request", { state: 400 })),
    ).toBe(false);
  });

  it("408 timeout and 429 rate limit ARE retriable", () => {
    expect(
      isRetriableCmsError(new CmsBusinessError("timeout", { state: 408 })),
    ).toBe(true);
    expect(
      isRetriableCmsError(new CmsBusinessError("rate limit", { state: 429 })),
    ).toBe(true);
  });
});

describe("classifyCmsError", () => {
  it("returns 'auth' for CmsAuthError", () => {
    expect(classifyCmsError(new CmsAuthError("x"))).toBe("auth");
  });
  it("returns 'network' for CmsNetworkError", () => {
    expect(classifyCmsError(new CmsNetworkError("x"))).toBe("network");
  });
  it("returns 'cms_business' for CmsBusinessError", () => {
    expect(classifyCmsError(new CmsBusinessError("x"))).toBe("cms_business");
  });
  it("returns 'mapping' for CmsSchemaError", () => {
    expect(classifyCmsError(new CmsSchemaError("x"))).toBe("mapping");
  });
  it("returns 'config' for CmsConfigError", () => {
    expect(classifyCmsError(new CmsConfigError("x"))).toBe("config");
  });
  it("returns 'unknown' for arbitrary error", () => {
    expect(classifyCmsError(new Error("x"))).toBe("unknown");
  });
});
