import { describe, it, expect } from "vitest";
import { stripJinaBoilerplate } from "../strip-boilerplate";

describe("stripJinaBoilerplate", () => {
  it("short content untouched", () => {
    expect(stripJinaBoilerplate("hi")).toBe("hi");
    expect(stripJinaBoilerplate("")).toBe("");
  });

  it("strips navbar link-only lines but keeps body", () => {
    const input = `
# 重点工程提速攻坚 赋能区域高质量发展

[![Image 1](https://g.cbg.cn/web/ShiJieWang/pc/img/logo2.png)](https://www.cbg.cn/)

*   [首页](https://www.cbg.cn/)
| *   [头条新闻](https://www.cbg.cn/list/5147/1.html)
| *   [重庆新闻](https://www.cbg.cn/list/705/1.html)
| *   [央媒关注](https://www.cbg.cn/list/5598/1.html)

发布时间:2026-05-14 11:34 来源:视界网/重庆网络广播电视台

这是一段真正的正文,讲了某地某项目某事项,讨论了对市民和企业带来的影响,数据指标,以及今后的工作计划。
正文应该足够长,被算法判定为正文段落,而不是导航。

【版权声明】本网注明...
    `;
    const out = stripJinaBoilerplate(input);
    expect(out).toContain("重点工程提速攻坚");
    expect(out).toContain("发布时间");
    expect(out).toContain("这是一段真正的正文");
    expect(out).not.toContain("[首页]");
    expect(out).not.toContain("[头条新闻]");
    expect(out).not.toContain("[![Image 1]");
  });

  it("truncates at '相关推荐' / '友情链接' / 'Copyright' footer markers", () => {
    const input = `
# 标题

这是正文段落 1,关于今天的天气和路况报告。
这是正文段落 2,关于经济形势分析,字数足够长才不被启发式误判为短内容。
这是正文段落 3,补充更多细节,让总长度超过 200 字符以触发清洁逻辑。
继续延长正文,保证内容长度足够算法处理判断。

相关推荐
*   [文章 A](https://x.com/a)
*   [文章 B](https://x.com/b)

友情链接
*   [友情 1](https://y.com/1)
    `;
    const out = stripJinaBoilerplate(input);
    expect(out).toContain("正文段落 1");
    expect(out).toContain("正文段落 3");
    expect(out).not.toContain("相关推荐");
    expect(out).not.toContain("[文章 A]");
    expect(out).not.toContain("友情链接");
  });

  it("removes footer keyword lines (违法和不良信息举报 etc.)", () => {
    const input = `
# 文章标题

这是一段足够长的正文,需要超过 200 字符以触发清洁逻辑的下限要求,所以在这里我添加更多正文文字内容确保长度达标。
继续添加文字让内容长度突破 200 字符的下限。再加一些字数让总长度足够触发处理逻辑。

违法和不良信息举报,电话:023-67175860
互联网新闻信息服务许可证号:50120170002
增值电信业务经营许可证:渝B2-20080001
    `;
    const out = stripJinaBoilerplate(input);
    expect(out).toContain("正文");
    expect(out).not.toContain("违法和不良信息");
    expect(out).not.toContain("互联网新闻信息服务许可证号");
    expect(out).not.toContain("增值电信业务经营许可证");
  });

  it("removes '当前位置' breadcrumb", () => {
    const input = `
# 标题

当前位置:[首页](https://x.com/) > [新闻](https://x.com/news) > 正文

正文内容这里很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长。
正文继续延伸超过 200 字符的下限以触发清洁逻辑。再加更多文字让总长足够。
    `;
    const out = stripJinaBoilerplate(input);
    expect(out).toContain("正文内容");
    expect(out).not.toContain("当前位置");
  });

  it("preserves links inside long body paragraphs (有 ≥8 个中文字符的行不删)", () => {
    // 即使有 markdown link,只要中文够多就视为正文段
    const input = `
# 标题

这是一段重要文字超过 200 字符以触发清洁逻辑,正文段落里可能含 [链接示例](https://example.com) 但因为这一行包含足够多的中文字符所以应该被保留下来作为正文的一部分而不是被当作 navbar 删除。
后续段落继续延伸内容,让总长度突破 200 字符的下限确保算法触发处理逻辑。
    `;
    const out = stripJinaBoilerplate(input);
    expect(out).toContain("[链接示例]");
    expect(out).toContain("正文的一部分");
  });
});
