import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isCmsPublishEnabled, isCatalogSyncEnabled, requireCmsConfig } from "../feature-flags";

describe("feature-flags", () => {
  const originalEnv = process.env;
  beforeEach(() => {
    process.env = { ...originalEnv };
  });
  afterEach(() => {
    process.env = originalEnv;
  });

  describe("isCmsPublishEnabled", () => {
    it("returns true when VIBETIDE_CMS_PUBLISH_ENABLED=true", () => {
      process.env.VIBETIDE_CMS_PUBLISH_ENABLED = "true";
      expect(isCmsPublishEnabled()).toBe(true);
    });

    it("returns false when not set", () => {
      delete process.env.VIBETIDE_CMS_PUBLISH_ENABLED;
      expect(isCmsPublishEnabled()).toBe(false);
    });

    it("returns false for any value other than 'true'", () => {
      process.env.VIBETIDE_CMS_PUBLISH_ENABLED = "false";
      expect(isCmsPublishEnabled()).toBe(false);
      process.env.VIBETIDE_CMS_PUBLISH_ENABLED = "1";
      expect(isCmsPublishEnabled()).toBe(false);
    });
  });

  describe("isCatalogSyncEnabled", () => {
    it("defaults to true when not set", () => {
      delete process.env.VIBETIDE_CATALOG_SYNC_ENABLED;
      expect(isCatalogSyncEnabled()).toBe(true);
    });

    it("returns false when explicitly set to 'false'", () => {
      process.env.VIBETIDE_CATALOG_SYNC_ENABLED = "false";
      expect(isCatalogSyncEnabled()).toBe(false);
    });
  });

  describe("requireCmsConfig", () => {
    it("throws when any required env is missing", () => {
      delete process.env.CMS_HOST;
      expect(() => requireCmsConfig()).toThrow(/CMS_HOST/);
    });

    it("returns config object when all env present", () => {
      process.env.CMS_HOST = "https://example.com";
      process.env.CMS_LOGIN_CMC_ID = "id123";
      process.env.CMS_LOGIN_CMC_TID = "tid123";
      process.env.CMS_TENANT_ID = "tenant123";
      process.env.CMS_USERNAME = "admin";
      const config = requireCmsConfig();
      expect(config).toEqual({
        host: "https://example.com",
        loginCmcId: "id123",
        loginCmcTid: "tid123",
        tenantId: "tenant123",
        username: "admin",
        timeoutMs: 15000,
        maxRetries: 3,
        defaultCoverUrl: expect.any(String),
      });
    });
  });
});
