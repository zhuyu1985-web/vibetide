# P0.2 chartjs-node-canvas 字体 spike 报告

**Date:** 2026-05-26
**Result:** PASS

## 验证内容

- [x] chartjs-node-canvas 能在 Node 中渲染图表
- [x] canvas 包的 `registerFont` 加载 Noto Sans SC
- [x] 中文标题/标签正常显示(肉眼验证 PNG,所有中文字符无方框/乱码)

## 依赖

- `chart.js@4.5.1`
- `chartjs-node-canvas@5.0.0`
- `canvas@3.2.3`(显式安装到顶层,确保 ESM `import { registerFont } from "canvas"` 能解析。如果只靠 chartjs-node-canvas 的间接依赖,pnpm 不会把 canvas 提升到顶层,会报 `ERR_MODULE_NOT_FOUND`。)

**安装命令(项目已确认使用 pnpm,不是 npm):**

```bash
pnpm add chartjs-node-canvas chart.js canvas
```

> **踩坑记录**:CLAUDE.md 写的是 `npm run`,但 `node_modules/.pnpm/` 和 `pnpm-lock.yaml` 表明项目实际用 pnpm 9.12.3。`npm install` 在 `.pnpm/` 嵌套布局上会触发 Arborist bug:`TypeError: Cannot read properties of null (reading 'matches') at Link.matches`。**后续所有依赖管理必须用 pnpm**。

## 字体文件

- 路径:`public/fonts/NotoSansSC-Regular.otf`
- 大小:**16,437,364 字节 ≈ 16 MB**(GitHub `noto-cjk/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf` 完整版,涵盖全部简中字形)
- 部署需打包到 lambda(Vercel `vercel.json` `includeFiles: ["public/fonts/**"]`,P3 实施时加)

## 跑通脚本输出

```
$ npx tsx scripts/spike-chart-font.ts
✓ 字体已注册: /Users/zhuyu/Developer/chinamcloud/vibetide/public/fonts/NotoSansSC-Regular.otf
✓ 已生成 /tmp/spike-chart-font-output.png (36701 bytes, 290 ms, 1920x1024)
```

## 产物

- `/tmp/spike-chart-font-output.png`
  - 36,701 字节
  - 1920×1024,8-bit RGBA,non-interlaced
  - 内容:Top 5 区县综合得分柱状图,绿色柱体,中文标题/legend/x 轴标签全部正常
- `file` 校验:`PNG image data, 1920 x 1024, 8-bit/color RGBA, non-interlaced`

## 性能

- **渲染 1920×1024 单图耗时:290 ms**(macOS arm64 prebuilt canvas)
- 报告 1 章预计 3 张图 → 单 org 单年报告约 5 张 chart(top5 / 维度雷达 / 维度对比 / 区县热力 / 主题图)
- 单报告 chart 生成总耗时:5 × 290 ms ≈ 1.5s,远低于 Inngest step 60s 上限

## 后续 implication(P3 实施时落地)

1. **chart-generator.ts** 用 `chartjs-node-canvas` + Noto Sans SC,font family 字符串统一 `"Noto Sans SC"`
2. **registerFont 必须在 ChartJSNodeCanvas 实例化前调用**(canvas 模块全局状态)
3. **Vercel 部署**:`vercel.json` 加 `functions["app/api/research/**"].includeFiles: "public/fonts/**"`,确保 16MB 字体打进 lambda zip
4. **lambda 包体**:加 16MB 字体后,需关注总包体是否触发 Vercel 50MB unzipped 上限。若超过,P3 验收阶段考虑用 subset 后的精简版 OTF(只含 GB2312 + 常用字)
5. **本地 macOS 装 canvas 用 prebuild-install 走 napi prebuilt,无需 brew cairo/pango**(macOS arm64 prebuild 已发布)。Linux 部署侧 Vercel 默认 Amazon Linux 2 + glibc 也支持 napi prebuild。
6. **顶层 canvas 依赖必须显式声明**:即便 chartjs-node-canvas 已依赖 canvas,ESM resolver 走顶层 node_modules,pnpm 不 hoist 时 import 失败。

## Commit 内容

- `scripts/spike-chart-font.ts`(spike 脚本,可保留作为后续 chart-generator 参考)
- `public/fonts/NotoSansSC-Regular.otf`(16MB,加入 git 仓)
- `package.json` + `pnpm-lock.yaml`(三个新依赖)
- 本文档
