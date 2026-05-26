// scripts/spike-docx-image.ts
// 验证 docx npm lib 能正确嵌入 PNG 图片到段落,在 Word/WPS 中正确显示
//
// docx@9.6.1 的 ImageRun 是 discriminated union (RegularImageOptions | SvgMediaOptions),
// PNG 必须显式带 type: "png",否则 TS 编译报错 — 已踩过坑,文件头已锁版本。
import {
  Document,
  Packer,
  Paragraph,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  TextRun,
} from "docx";
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";

async function main() {
  // 准备一张测试 PNG
  const pngPath = path.resolve("docs/scope-content-sample.png");
  if (!existsSync(pngPath)) {
    // 兜底:用 1x1 PNG 占位(verify 时再换真图)
    const oneByOnePng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      "base64",
    );
    writeFileSync(pngPath, oneByOnePng);
    console.log(`✓ 已生成 1x1 PNG 占位: ${pngPath}`);
  }
  const pngBuffer = readFileSync(pngPath);

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: "Spike: docx 图片嵌入验证", bold: true, size: 32 }),
            ],
          }),
          new Paragraph({ children: [new TextRun("下面应该显示一张测试图片:")] }),
          new Paragraph({
            children: [
              new ImageRun({
                type: "png",
                data: pngBuffer,
                transformation: { width: 600, height: 300 },
              }),
            ],
          }),
          new Paragraph({
            children: [new TextRun("下面是表格(测试 39 行 docx 表骨架):")],
          }),
          new Table({
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("排名")] }),
                  new TableCell({ children: [new Paragraph("区县")] }),
                  new TableCell({ children: [new Paragraph("综合分")] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("1")] }),
                  new TableCell({ children: [new Paragraph("两江新区")] }),
                  new TableCell({ children: [new Paragraph("86.01")] }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outPath = "/tmp/spike-docx-image-output.docx";
  writeFileSync(outPath, buffer);
  const size = statSync(outPath).size;
  console.log(`✓ 已生成 ${outPath}, 大小 ${size} bytes`);
  console.log("  请用 Word/WPS 打开验证图片是否能正常显示");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
