# P0.1 docx 图片嵌入 spike 报告

**Date:** 2026-05-26
**Result:** PASS

## 验证内容

- docx npm lib 的 ImageRun 能编译嵌入 PNG buffer
- Table + TableRow + TableCell 嵌套渲染
- TextRun 中文显示

## 跑通脚本输出

```
$ npx tsx scripts/spike-docx-image.ts
✓ 已生成 1x1 PNG 占位: /Users/zhuyu/dev/chinamcloud/vibetide/docs/scope-content-sample.png
✓ 已生成 /tmp/spike-docx-image-output.docx, 大小 9584 bytes
  请用 Word/WPS 打开验证图片是否能正常显示
```

退出码 0,无 TS 编译错误,无 runtime 错误。

## 产物

- 文件: `/tmp/spike-docx-image-output.docx`
- 大小: **9584 bytes**(> 5KB 阈值,docx ZIP 内含完整图片关系链路与 XML 框架)
- PNG 占位:`docs/scope-content-sample.png` (1×1 PNG,67 bytes 后续 verify 时换真图)

## docx@9.6.1 API 注意点

**ImageRun 是 discriminated union,PNG/JPG/GIF/BMP 必须显式带 `type` 字段**,否则 TS 报错:

```ts
// docx@9 类型签名:
type RegularImageOptions = {
  readonly type: "jpg" | "png" | "gif" | "bmp"; // 必填
  readonly data: Buffer | string | Uint8Array | ArrayBuffer;
};
type IImageOptions = (RegularImageOptions | SvgMediaOptions) & CoreImageOptions;

// 正确写法:
new ImageRun({
  type: "png",                                  // ← 必须
  data: pngBuffer,
  transformation: { width: 600, height: 300 },
})
```

任务原 spike 模板中的 `new ImageRun({ data, transformation })` 在 docx@9 下会 TS 编译失败,P3 docx-builder 实现时直接按上面带 `type` 字段的写法即可。

## 后续 implication

- **P3 docx-builder.ts 可放心采用 docx npm lib + ImageRun**,锁版本 docx@9.6.1
- **39 行排行榜表用 `TableRow` 循环**生成(spike 已验证 2 行可渲染,扩展到 39 行同构)
- **TextRun 中文渲染** docx 内部已统一 utf-8 编码,无需额外字体声明(中文显示依赖打开 docx 的客户端字体,这与 P0.2 chartjs-node-canvas 中文字体问题是不同 layer 的问题)
- **PNG 图片**:ImageRun 直接吃 `Buffer`,可与 P0.2 产出的 ChartJSNodeCanvas Buffer 无缝衔接 — P3 直接 `new ImageRun({ type: "png", data: chartBuffer, transformation: ... })` 即可
- **人工最后用 Word/WPS 打开验证一次**(本 subagent 仅验证生成无错误,未做实际 Word/WPS 打开 visual check)

## 风险/未覆盖

- 1×1 PNG 渲染没问题,但当 PNG 是 1200×600 chart 大图 + 多张时,是否触发 docx 内部 jszip 内存峰值未测,P3 实装后用真实数据复测
- 未测大 docx(50+ 图 + 39 行表 + 长正文),P3 实装后 e2e 验证
