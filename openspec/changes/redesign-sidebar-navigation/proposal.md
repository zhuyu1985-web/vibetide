# Change: 重新设计侧边栏导航，打造高品质视觉体验

## Why

当前侧边栏导航采用 shadcn/ui 默认样式，视觉表现力不足，缺乏品牌辨识度和专业感，给人"产品原型"的粗糙印象。作为用户每天使用的核心交互界面，侧边栏的设计品质直接影响产品的整体感知价值。需要通过精心设计的视觉层次、动效交互和品牌化处理，让导航体验从"能用"升级为"好用且好看"。

## What Changes

### 品牌区域 (Header)
- Logo 区域增加微光呼吸动效和渐变光晕
- 品牌名称添加渐变色彩处理
- 增加用户组织信息展示

### 一级导航 (Top-level Groups)
- 分组标题增加渐变色小圆点指示器 + 左侧渐变竖线装饰
- 每个分组赋予独立的主题色系（蓝、紫、绿、橙、靛蓝）
- 折叠/展开增加平滑动画过渡
- 分组之间增加精致的渐变分隔线

### 二级导航 (Menu Items)
- 激活态：左侧渐变色条指示器 + 轻柔的背景渐变 + 微光效果
- 悬浮态：背景渐变过渡 + 图标颜色变化动效
- 图标根据所属分组着色（非激活态为柔和色，激活态为鲜明色）
- 子菜单连接线从普通边框升级为渐变线

### 底部区域 (Footer)
- 增加用户头像、角色信息展示区域
- 添加快捷操作按钮（设置、主题切换）
- 底部增加版本号显示

### CSS 增强
- 侧边栏背景升级：多层渐变叠加 + 微妙噪点纹理
- 全局自定义滚动条样式（超薄、半透明）
- 增加暗色模式适配的完整配色方案
- 精细的 box-shadow 和 border 处理

## Impact

- Affected code:
  - `src/components/layout/app-sidebar.tsx` — 主要重构目标
  - `src/app/globals.css` — 新增侧边栏相关 CSS 变量和样式
  - `src/components/ui/sidebar.tsx` — 可能需要微调基础组件样式
- Affected specs: sidebar-navigation (new capability)
- No breaking changes to routing or data flow
- No new dependencies required (所有效果用 Tailwind CSS + CSS 原生实现)
