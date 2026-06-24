import { describe, it, expect } from "vitest";
import {
  isHotTopicIntent,
  isRegenerate,
  isExitLoop,
  parseSelection,
  isFinalizeIntent,
  isTranslateIntent,
  extractTargetLanguage,
  isSubmitReviewIntent,
  parseMultiSelection,
  isAnalyzeIntent,
} from "../intents";
import { detectReviewDecision } from "../review-followup";

describe("isHotTopicIntent", () => {
  it.each([
    "获取今天的热点",
    "今天的热点",
    "获取热点",
    "来点热点",
    "看看热点榜",
    "热点",
    "今日热点有哪些",
  ])("命中：%s", (t) => {
    expect(isHotTopicIntent(t)).toBe(true);
  });

  it.each(["写一篇稿子", "发布到新闻", "你好", "加配图"])(
    "不命中：%s",
    (t) => {
      expect(isHotTopicIntent(t)).toBe(false);
    },
  );
});

describe("isRegenerate / isExitLoop", () => {
  it("换一批类命中重出", () => {
    for (const t of ["换一批", "换个", "重新生成", "再来一批", "换换"]) {
      expect(isRegenerate(t)).toBe(true);
    }
  });
  it("'重新获取/重新抓取' 命中 isRegenerate", () => {
    for (const t of ["重新获取", "重新抓取", "重新获取一下", "重新拉取"]) {
      expect(isRegenerate(t)).toBe(true);
    }
  });
  it("退出类命中退出", () => {
    for (const t of ["退出", "取消闭环", "不做了", "结束", "算了"]) {
      expect(isExitLoop(t)).toBe(true);
    }
  });
});

describe("parseSelection", () => {
  it("阿拉伯数字：选3 / 第3个 / 3", () => {
    expect(parseSelection("选3")).toBe(3);
    expect(parseSelection("第3个")).toBe(3);
    expect(parseSelection("3")).toBe(3);
    expect(parseSelection("选第 2 个")).toBe(2);
  });

  it("中文数字：第三个 / 选二 / 三", () => {
    expect(parseSelection("第三个")).toBe(3);
    expect(parseSelection("选二")).toBe(2);
    expect(parseSelection("选第五个")).toBe(5);
  });

  it("字母选项：选A/B/C", () => {
    expect(parseSelection("选A")).toBe(1);
    expect(parseSelection("选B")).toBe(2);
    expect(parseSelection("C")).toBe(3);
    expect(parseSelection("选 a")).toBe(1);
  });

  it("语义位置：最后/中间/第一（依赖 total）", () => {
    expect(parseSelection("最后一个", 3)).toBe(3);
    expect(parseSelection("中间那个", 3)).toBe(2);
    expect(parseSelection("第一个")).toBe(1);
  });

  it("无法解析 → null", () => {
    expect(parseSelection("我想想")).toBeNull();
    expect(parseSelection("不错")).toBeNull();
  });
});

describe("isFinalizeIntent", () => {
  it.each(["定稿", "就这版", "可以了", "就这样", "外文也定了", "敲定"])(
    "命中：%s",
    (t) => expect(isFinalizeIntent(t)).toBe(true),
  );
  it.each(["把第二段改短", "加个案例"])("不命中：%s", (t) =>
    expect(isFinalizeIntent(t)).toBe(false),
  );
});

describe("isTranslateIntent / extractTargetLanguage", () => {
  it.each([
    "转成英文",
    "翻译成英文",
    "转英文",
    "翻译一下",
    "做个日文版",
    "转成外文",
  ])("命中翻译：%s", (t) => expect(isTranslateIntent(t)).toBe(true));

  it.each(["把第二段改短", "标题再短点", "加个外卖数据"])(
    "改稿指令不误判为翻译：%s",
    (t) => expect(isTranslateIntent(t)).toBe(false),
  );

  it("抽语种：英文/日文，默认英文", () => {
    expect(extractTargetLanguage("转成英文")).toEqual({ code: "en", label: "英文" });
    expect(extractTargetLanguage("翻译成日语")).toEqual({ code: "ja", label: "日文" });
    expect(extractTargetLanguage("翻译一下")).toEqual({ code: "en", label: "英文" });
  });
});

describe("isSubmitReviewIntent", () => {
  it.each([
    "保存到个人稿库，并提交审核",
    "提交审核",
    "送审",
    "发给审核",
    "保存并提交审核",
  ])("命中：%s", (t) => expect(isSubmitReviewIntent(t)).toBe(true));

  it.each(["把第二段改短", "转成英文", "定稿"])("不命中：%s", (t) =>
    expect(isSubmitReviewIntent(t)).toBe(false),
  );
});

describe("detectReviewDecision", () => {
  it("通过类 → approved", () => {
    for (const t of ["通过", "同意发", "可以发", "批准", "没问题，过了"]) {
      expect(detectReviewDecision(t)?.decision).toBe("approved");
    }
  });
  it("驳回类 → rejected + 抽理由", () => {
    expect(detectReviewDecision("驳回，第二段数据来源没标")).toEqual({
      decision: "rejected",
      reason: "第二段数据来源没标",
    });
    expect(detectReviewDecision("打回")?.decision).toBe("rejected");
    expect(detectReviewDecision("不通过")?.decision).toBe("rejected");
  });
  it("非决策 → null", () => {
    expect(detectReviewDecision("这篇写得怎么样")).toBeNull();
    expect(detectReviewDecision("你好")).toBeNull();
  });
});

describe("parseMultiSelection", () => {
  it("都发 → all", () => {
    expect(parseMultiSelection("都发")).toEqual({ kind: "all" });
    expect(parseMultiSelection("全部都发")).toEqual({ kind: "all" });
  });
  it("国内/海外", () => {
    expect(parseMultiSelection("只发国内")).toEqual({ kind: "domestic" });
    expect(parseMultiSelection("只发海外")).toEqual({ kind: "overseas" });
  });
  it("编号多选（去重排序）", () => {
    expect(parseMultiSelection("发 1 和 3")).toEqual({ kind: "idx", idx: [1, 3] });
    expect(parseMultiSelection("选第一个和第三个")).toEqual({
      kind: "idx",
      idx: [1, 3],
    });
    expect(parseMultiSelection("3 1 3")).toEqual({ kind: "idx", idx: [1, 3] });
  });
  it("无法解析 → null", () => {
    expect(parseMultiSelection("再想想")).toBeNull();
  });
});

describe("isAnalyzeIntent", () => {
  it.each([
    "查这篇传播数据",
    "查数据",
    "传播数据怎么样",
    "复盘",
    "看看效果",
    "这篇发得怎么样",
    "再查一次",
  ])("命中：%s", (t) => expect(isAnalyzeIntent(t)).toBe(true));

  it.each(["把第二段改短", "退出"])("不命中：%s", (t) =>
    expect(isAnalyzeIntent(t)).toBe(false),
  );
});
