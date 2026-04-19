import { describe, it, expect } from "vitest";
import {
  CmsResponseEnvelopeSchema,
  CmsChannelsDataSchema,
  CmsAppSchema,
  CmsCatalogNodeSchema,
  CmsArticleSaveResponseDataSchema,
  CmsArticleDetailSchema,
} from "../types";

describe("CmsResponseEnvelopeSchema", () => {
  it("accepts well-formed success envelope", () => {
    expect(() =>
      CmsResponseEnvelopeSchema.parse({
        state: 200,
        success: true,
        message: "操作成功",
        data: { foo: 1 },
      }),
    ).not.toThrow();
  });

  it("rejects envelope missing state", () => {
    expect(() =>
      CmsResponseEnvelopeSchema.parse({ success: true, message: "ok", data: {} }),
    ).toThrow();
  });

  it("allows data=null for error responses", () => {
    expect(() =>
      CmsResponseEnvelopeSchema.parse({
        state: 500,
        success: false,
        message: "错误",
        data: null,
      }),
    ).not.toThrow();
  });
});

describe("CmsChannelsDataSchema", () => {
  it("accepts object keyed by CHANNEL_*", () => {
    const data = {
      CHANNEL_APP: { code: 1, pickValue: "1", thirdFlag: "2", name: "APP" },
      CHANNEL_WEB: { code: 2, pickValue: "0", thirdFlag: "2", name: "网站" },
    };
    expect(() => CmsChannelsDataSchema.parse(data)).not.toThrow();
  });

  it("tolerates extra string keys", () => {
    const data = {
      CHANNEL_APP: { code: 1, pickValue: "1", thirdFlag: "2", name: "APP" },
      CUSTOM_CHANNEL: { code: 99, pickValue: "0", thirdFlag: "1", name: "自定义" },
    };
    expect(() => CmsChannelsDataSchema.parse(data)).not.toThrow();
  });
});

describe("CmsAppSchema", () => {
  it("accepts app entry with appkey/appsecret", () => {
    expect(() =>
      CmsAppSchema.parse({
        id: 1,
        siteid: 73,
        name: "测试",
        type: 1,
        appkey: "ak",
        appsecret: "as",
        addtime: null,
      }),
    ).not.toThrow();
  });

  it("allows null appkey/appsecret/addtime", () => {
    expect(() =>
      CmsAppSchema.parse({
        id: 2,
        siteid: 73,
        name: "x",
        type: 1,
        appkey: null,
        appsecret: null,
        addtime: null,
      }),
    ).not.toThrow();
  });
});

describe("CmsCatalogNodeSchema", () => {
  it("accepts a leaf node without children", () => {
    const node = {
      id: 9369,
      appid: 250,
      siteId: 73,
      name: "栏目",
      parentId: 0,
      innerCode: "009887",
      alias: "news",
      treeLevel: 1,
      isLeaf: 1,
      type: 1,
      childCatalog: [],
    };
    expect(() => CmsCatalogNodeSchema.parse(node)).not.toThrow();
  });

  it("accepts nested children (recursive)", () => {
    const node = {
      id: 9373,
      appid: 250,
      siteId: 73,
      name: "父",
      parentId: 0,
      innerCode: "009891",
      alias: "parent",
      treeLevel: 1,
      isLeaf: 0,
      type: 1,
      childCatalog: [
        {
          id: 9374,
          appid: 250,
          siteId: 73,
          name: "子",
          parentId: 9373,
          innerCode: "009891000001",
          alias: "child",
          treeLevel: 2,
          isLeaf: 0,
          type: 1,
          childCatalog: [],
        },
      ],
    };
    expect(() => CmsCatalogNodeSchema.parse(node)).not.toThrow();
  });
});

describe("CmsArticleSaveResponseDataSchema", () => {
  it("accepts article.id and url/preViewPath", () => {
    expect(() =>
      CmsArticleSaveResponseDataSchema.parse({
        article: { id: 925194, status: 0, title: "x" },
        url: "1376/1376mrgrgklm/925194.shtml",
        preViewPath: "https://api/preview?x=1",
        method: "ADD",
      }),
    ).not.toThrow();
  });
});

describe("CmsArticleDetailSchema", () => {
  it("accepts minimal detail payload", () => {
    expect(() =>
      CmsArticleDetailSchema.parse({
        Id: 925194,
        title: "稿件",
        status: "30",
        type: 1,
      }),
    ).not.toThrow();
  });
});
