import { describe, it, expect } from "vitest";
import {
  inferTimeRange,
  extractSearchQuery,
  parseExplicitTimeRange,
  resolveWebSearchTimeRange,
} from "../search-params";

describe("inferTimeRange", () => {
  describe("突发新闻家族 → 24h（回归：用户输入盈江地震旧稿事故）", () => {
    it("场景：突发新闻 + 10 分钟内发布 → 24h", () => {
      const message = [
        "场景：突发新闻",
        "事件关键词: 地震",
        "紧急程度: 特急（10 分钟内发布）",
        "事件发生时间: 2026",
      ].join("\n");
      expect(inferTimeRange(message)).toBe("24h");
    });

    it("单独命中：突发", () => {
      expect(inferTimeRange("突发事件追踪")).toBe("24h");
    });
    it("单独命中：特急", () => {
      expect(inferTimeRange("这是特急稿件")).toBe("24h");
    });
    it("单独命中：紧急", () => {
      expect(inferTimeRange("紧急通知")).toBe("24h");
    });
    it("单独命中：刚刚", () => {
      expect(inferTimeRange("刚刚发生的一件事")).toBe("24h");
    });
    it("单独命中：速报", () => {
      expect(inferTimeRange("速报：xxx")).toBe("24h");
    });
    it("N 分钟内", () => {
      expect(inferTimeRange("10 分钟内发布")).toBe("24h");
      expect(inferTimeRange("5分钟前")).toBe("24h");
    });
    it("N 小时内", () => {
      expect(inferTimeRange("2 小时内完成")).toBe("24h");
      expect(inferTimeRange("1小时前")).toBe("24h");
    });
  });

  describe("原有规则不回归", () => {
    it("今日 → 24h", () => {
      expect(inferTimeRange("今日热点")).toBe("24h");
    });
    it("每日 → 24h", () => {
      expect(inferTimeRange("每日时政")).toBe("24h");
    });
    it("daily / today → 24h", () => {
      expect(inferTimeRange("daily news")).toBe("24h");
      expect(inferTimeRange("today's top stories")).toBe("24h");
    });
    it("breaking → 24h", () => {
      expect(inferTimeRange("breaking news")).toBe("24h");
    });
    it("本周 → 7d", () => {
      expect(inferTimeRange("本周科技")).toBe("7d");
    });
    it("本月 → 30d", () => {
      expect(inferTimeRange("本月回顾")).toBe("30d");
    });
  });

  describe("不误伤：年度/专有名词不能被误识别为突发", () => {
    it("CCBN（年度展会，中长周期）不命中任何窗口", () => {
      expect(inferTimeRange("CCBN 2026 展会最新动态")).toBeUndefined();
    });
    it("普通新闻话题不命中", () => {
      expect(inferTimeRange("人工智能")).toBeUndefined();
    });
  });
});

describe("extractSearchQuery", () => {
  it("突发新闻场景：只抽取有效关键词，跳过纯数字年份", () => {
    const message = [
      "场景：突发新闻",
      "事件关键词: 地震",
      "紧急程度: 特急（10 分钟内发布）",
      "事件发生时间: 2026",
    ].join("\n");
    const q = extractSearchQuery(message);
    expect(q).toContain("突发新闻");
    expect(q).toContain("地震");
    expect(q).toContain("特急");
    // "2026" 是纯数字字段值 —— 不应污染 query；timeRange 由 inferTimeRange 兜
    expect(q).not.toMatch(/\b2026\b/);
  });

  it("非场景表单（自由文本）原样返回", () => {
    expect(extractSearchQuery("帮我查一下今天的地震新闻")).toBe(
      "帮我查一下今天的地震新闻",
    );
  });

  it("多行但无场景前缀：原样返回", () => {
    const message = "第一行\n第二行";
    expect(extractSearchQuery(message)).toBe(message);
  });

  it("剔除「检索时间窗」字段，不污染 query", () => {
    const message = [
      "场景：突发新闻追踪",
      "事件关键词: 地震",
      "检索时间窗: 24h",
    ].join("\n");
    const q = extractSearchQuery(message);
    expect(q).toContain("地震");
    expect(q).not.toContain("24h");
    expect(q).not.toContain("检索时间窗");
  });
});

describe("parseExplicitTimeRange", () => {
  it("场景表单显式 24h → 24h", () => {
    const message = [
      "场景：突发新闻追踪",
      "事件关键词: 地震",
      "检索时间窗: 24h",
    ].join("\n");
    expect(parseExplicitTimeRange(message)).toBe("24h");
  });

  it("支持全部规范值 1h / 24h / 7d / 30d", () => {
    expect(parseExplicitTimeRange("检索时间窗: 1h")).toBe("1h");
    expect(parseExplicitTimeRange("检索时间窗: 7d")).toBe("7d");
    expect(parseExplicitTimeRange("检索时间窗: 30d")).toBe("30d");
  });

  it("英文字段名 time_range 也识别", () => {
    expect(parseExplicitTimeRange("time_range: 24h")).toBe("24h");
    expect(parseExplicitTimeRange("timeRange: 7d")).toBe("7d");
  });

  it("同义中文 label 都能识别", () => {
    expect(parseExplicitTimeRange("时间窗: 24h")).toBe("24h");
    expect(parseExplicitTimeRange("检索窗口: 7d")).toBe("7d");
  });

  it("非规范值忽略", () => {
    expect(parseExplicitTimeRange("检索时间窗: 2小时")).toBeUndefined();
    expect(parseExplicitTimeRange("检索时间窗: 48h")).toBeUndefined();
    expect(parseExplicitTimeRange("检索时间窗: 过去 24 小时")).toBeUndefined();
  });

  it("无 timeRange 行 → undefined", () => {
    expect(parseExplicitTimeRange("场景：每日热点\n事件关键词: 地震")).toBeUndefined();
  });
});

describe("resolveWebSearchTimeRange（显式 > 推断）", () => {
  it("显式优先于推断：写了 7d 就用 7d，即使消息里有「突发」", () => {
    const message = [
      "场景：突发新闻追踪",
      "事件关键词: 地震",
      "紧急程度: 特急（10 分钟内发布）",
      "检索时间窗: 7d",
    ].join("\n");
    expect(resolveWebSearchTimeRange(message)).toBe("7d");
  });

  it("没显式 → 回落到 inferTimeRange", () => {
    expect(resolveWebSearchTimeRange("今日热点")).toBe("24h");
    expect(resolveWebSearchTimeRange("本周科技")).toBe("7d");
  });

  it("都没命中 → undefined", () => {
    expect(resolveWebSearchTimeRange("人工智能")).toBeUndefined();
  });
});
