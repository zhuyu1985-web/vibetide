import { describe, expect, it } from "vitest";
import { transformOpinionRow } from "../opinion-transform";

describe("transformOpinionRow platform normalization", () => {
  it("把具体网站名归一为网站,并保留原始平台名", () => {
    const result = transformOpinionRow({
      标题: "网站稿件",
      平台: "重庆日报网",
      链接: "https://cqrb.cn/a/1.html",
    });

    expect(result?.rawItem.platform).toBe("网站");
    expect(result?.rawItem.author).toBe("重庆日报网");
    expect(result?.rawItem.rawMetadata).toMatchObject({
      originalPlatform: "重庆日报网",
    });
  });

  it("把微博头条归一为微博,账号名称仍保留在作者字段", () => {
    const result = transformOpinionRow({
      标题: "微博稿件",
      平台: "微博头条",
      作者昵称: "美丽重庆",
      链接: "https://www.weibo.com/ttarticle/p/show?id=1",
    });

    expect(result?.rawItem.platform).toBe("微博");
    expect(result?.rawItem.author).toBe("美丽重庆");
    expect(result?.rawItem.rawMetadata).toMatchObject({
      originalPlatform: "微博头条",
    });
  });
});
