## Context

当前侧边栏使用 shadcn/ui 的默认 Sidebar 组件，仅添加了 `glass-sidebar` 背景效果。导航项采用最基础的文本+图标排列，没有视觉层次区分、品牌化处理或交互动效。需要在不引入新依赖的前提下，通过 CSS 和 Tailwind 实现高品质的视觉设计。

### 当前问题分析

1. **缺乏视觉层次**: 一级分组标题和二级菜单项在视觉权重上几乎无差异
2. **激活态不醒目**: 仅有 `bg-primary/10 text-primary` 的淡色背景，辨识度低
3. **无品牌化**: 除 Logo 外，侧边栏没有任何品牌色彩和个性化设计
4. **交互反馈弱**: 缺少悬浮和点击的视觉反馈动效
5. **分组间无分隔**: 各模块之间没有明确的视觉分界

## Goals / Non-Goals

### Goals
- 打造具有科技感和专业感的侧边栏视觉设计
- 建立清晰的一级/二级导航视觉层次
- 为每个业务模块赋予独立的色彩标识
- 提供流畅的交互动效反馈
- 完美适配 Light/Dark 双主题
- 纯 CSS/Tailwind 实现，零新依赖

### Non-Goals
- 不改变现有路由结构和导航层级
- 不引入可折叠/展开整个侧边栏的 icon-only 模式
- 不添加搜索功能或快捷键导航
- 不修改移动端 Sheet 模式的行为

## Decisions

### 色彩系统

每个一级分组使用独立的主题色，营造"彩色宇宙"的视觉效果：

| 分组 | 主题色 | Light 渐变 | Dark 渐变 |
|------|--------|-----------|----------|
| 工作空间 | Blue | `#3B82F6 → #6366F1` | `#60A5FA → #818CF8` |
| 内容管理 | Purple | `#8B5CF6 → #A855F7` | `#A78BFA → #C084FC` |
| 智能媒资 | Emerald | `#10B981 → #14B8A6` | `#34D399 → #2DD4BF` |
| 创作者中心 | Amber | `#F59E0B → #EF4444` | `#FBBF24 → #F87171` |
| 全渠道传播 | Indigo | `#6366F1 → #8B5CF6` | `#818CF8 → #A78BFA` |

### 激活态设计

```
┌─────────────────────────┐
│ ▌▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │  ← 左侧 3px 渐变色条
│ ▌  🔵 团队工作台        │  ← 图标显示主题色 + 文字加粗
│ ▌▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │  ← 背景：主题色 8% 透明度渐变
└─────────────────────────┘
```

- 左侧 3px 圆角渐变色条（使用 `::before` 伪元素）
- 背景：主题色的 8% 透明度 → 透明，从左到右渐变
- 图标：主题色鲜明色
- 文字：`font-semibold` + 前景色加深
- 微光效果：`box-shadow: 0 0 20px rgba(主题色, 0.08)`

### 悬浮态设计

- 背景：主题色 5% 透明度过渡显示
- 图标：颜色过渡到主题色
- 过渡时长：`150ms ease-out`
- 整体 `translateX(2px)` 微移

### 分组标题设计

```
  ●───── 工作空间 ─────
```

- 左侧小圆点：主题色渐变填充，6px
- 标题文字：`uppercase tracking-wider text-[10px]` 大写间距处理
- 右侧渐变线：主题色 → 透明

### 连接线设计

子菜单的左侧连接线从 `border-l` 升级为渐变线：
- 使用 `background: linear-gradient(to bottom, 主题色 30%, transparent)`
- 宽度 2px，圆角端点

### Logo 区域设计

- Logo 图标：增加脉冲呼吸光晕动画（`animation: pulse-glow 3s ease-in-out infinite`）
- 品牌名："Vibe" 使用渐变色，"Media" 保持前景色
- 下方增加一条从左到右的渐变分割线

### 滚动条定制

```css
::-webkit-scrollbar { width: 3px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: linear-gradient(主题色系);
  border-radius: 3px;
}
```

## Risks / Trade-offs

- **Risk**: 过度装饰导致视觉噪音 → 所有装饰元素使用低透明度，确保内容优先
- **Risk**: 动画影响性能 → 仅使用 CSS transforms 和 opacity，利用 GPU 加速
- **Risk**: 暗色模式配色不协调 → 每个色彩变量都有独立的暗色模式定义
- **Trade-off**: 渐变色增加了 CSS 复杂度，但通过 CSS 变量系统化管理

## Open Questions

- 是否需要在折叠状态下（icon-only mode）也保留色彩区分？（暂不考虑，Non-Goal）
