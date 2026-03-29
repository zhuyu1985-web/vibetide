# Vibetide Liquid Glass UI 重构规范

## 设计目标

参考 iOS 26 Liquid Glass 设计语言，将 Vibetide 的 UI 从"基础玻璃效果"升级为完整的液态玻璃材质系统，同时支持明暗双模式。

## 核心决策

| 决策项 | 选择 |
|--------|------|
| 范围 | 重点优化：设计系统 + 核心组件，自动传播到所有页面 |
| 玻璃风格 | 深度层次：不同层级使用不同模糊度/透明度/阴影 |
| 色彩主调 | 冷蓝色调（hue 从 262 偏移到 240-248） |
| 背景效果 | 渐变 + 2-3 个柔和光晕 |
| 侧边栏分组色 | 保留色相区分但降低 30% 饱和度 |

---

## Phase 1: globals.css 设计系统重构

### 1.1 色彩变量调整

**Primary hue 偏移**: 262.881 → 245 (冷蓝)

```
Light:
  --primary: oklch(0.546 0.245 245)
  --background: oklch(0.97 0.008 240)
  --page-bg: linear-gradient(135deg, #EDF2FA 0%, #E2ECFA 50%, #EEF2F9 100%)
  --glow-1: rgba(59, 130, 246, 0.12)
  --glow-2: rgba(34, 211, 238, 0.06)
  --glow-3: rgba(16, 185, 129, 0.04) (新增第三光晕)

Dark:
  --primary: oklch(0.623 0.214 245)
  --background: oklch(0.07 0.02 240)
  --page-bg: linear-gradient(135deg, #050A14 0%, #0A1225 50%, #071018 100%)
  --glow-1: rgba(59, 130, 246, 0.08)
  --glow-2: rgba(34, 211, 238, 0.04)
  --glow-3: rgba(16, 185, 129, 0.03)
```

### 1.2 Liquid Glass 三层材质系统

替换现有的 glass utility classes，建立三层 + 强调变体：

```
glass-primary   → L1 基底层（侧边栏、Topbar、主面板）
glass-secondary → L2 内容层（卡片、表格、表单区域）
glass-tertiary  → L3 控件层（按钮、标签、小控件）
glass-accent    → 强调层（选中态、激活态，带品牌色染色）
glass-float     → 浮动层（弹窗、下拉菜单、Toast）
```

**每层参数（暗色模式 / 亮色模式）**：

| 层级 | bg (暗) | bg (亮) | blur | saturate | border-top (暗) | shadow |
|------|---------|---------|------|----------|-----------------|--------|
| L1 primary | rgba(255,255,255,0.04) | rgba(255,255,255,0.75) | 20px | 130% | rgba(255,255,255,0.10) | 0 8px 32px rgba(0,0,0,0.3) |
| L2 secondary | rgba(255,255,255,0.03) | rgba(255,255,255,0.65) | 12px | 115% | rgba(255,255,255,0.06) | 0 4px 16px rgba(0,0,0,0.2) |
| L3 tertiary | rgba(255,255,255,0.02) | rgba(255,255,255,0.50) | 8px | 110% | rgba(255,255,255,0.04) | 0 2px 8px rgba(0,0,0,0.15) |
| accent | rgba(59,130,246,0.06) | rgba(59,130,246,0.08) | 16px | 140% | rgba(59,130,246,0.15) | 0 4px 24px rgba(59,130,246,0.08) |
| float | rgba(255,255,255,0.05) | rgba(255,255,255,0.88) | 24px | 150% | rgba(255,255,255,0.12) | 0 16px 48px rgba(0,0,0,0.35) |

**光影折射 — 顶部高光 (::before)**：
每个 glass 元素使用 ::before 伪元素在顶部 50% 区域添加从 rgba(255,255,255,0.05) 到 transparent 的渐变高光。

**边框差异化**：
- border: 1px solid rgba(255,255,255,0.06)（全边框）
- border-top: 1px solid rgba(255,255,255,0.10)（顶部更亮，模拟光源）
- border-left: 1px solid rgba(255,255,255,0.08)（左侧次亮）

### 1.3 Liquid Glass 动效系统

```css
:root {
  --ease-glass: cubic-bezier(0.22, 0.68, 0.35, 1.0);
  --ease-glass-fast: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --ease-glass-spring: cubic-bezier(0.34, 1.56, 0.64, 1.0);
}
```

**关键动画**：
- `glass-materialize`: 面板出现 — scale(0.96)+opacity(0) → scale(1)+opacity(1)，400ms
- hover 反馈: translateY(-2px) + shadow 增强 + border 增亮，250ms
- press 反馈: scale(0.98) + shadow 收缩，150ms

### 1.4 状态染色玻璃

用半透明染色替代实色 badge：
- running/info: rgba(59,130,246,0.06) bg + rgba(59,130,246,0.15) border
- success: rgba(16,185,129,0.06) bg + rgba(16,185,129,0.12) border
- warning: rgba(245,158,11,0.06) bg + rgba(245,158,11,0.12) border
- error: rgba(239,68,68,0.06) bg + rgba(239,68,68,0.15) border

### 1.5 背景层增强

暗色模式添加微妙径向渐变光斑：
```css
background-image:
  radial-gradient(ellipse at 20% 50%, rgba(59,130,246,0.04) 0%, transparent 50%),
  radial-gradient(ellipse at 80% 20%, rgba(34,211,238,0.03) 0%, transparent 50%),
  radial-gradient(ellipse at 50% 80%, rgba(16,185,129,0.02) 0%, transparent 50%);
```

### 1.6 文字可读性

在玻璃表面的文字添加微弱 text-shadow：
- 暗色: text-shadow: 0 1px 2px rgba(0,0,0,0.3)
- 亮色: 不需要（背景足够亮）

---

## Phase 2: 核心组件改造

### 2.1 GlassCard 组件

新增 `level` prop 对应三层材质：
```
variant="default" → glass-secondary (L2)
variant="panel" → glass-primary (L1)
variant="elevated" / variant="float" → glass-float
variant="interactive" → glass-secondary + hover 动效
variant="accent" → glass-accent
```

保持向后兼容 —— 现有 variant 映射到新层级。

### 2.2 AppSidebar

- 整体使用 glass-primary (L1)
- 侧边栏分组色饱和度降低 30%（通过调整 Tailwind 色值的 opacity）
- Logo glow 改为冷蓝色调
- 渐变分隔线降低透明度

### 2.3 Topbar

- 使用 glass-primary (L1) + backdrop-filter
- 移除 `bg-background/95`，改为 glass 背景
- 搜索框使用 glass-tertiary
- 用户头像渐变改为冷蓝色调

### 2.4 Dashboard Layout

- 背景层使用新的 `--page-bg` 渐变 + 三光晕系统
- 主内容区保持透明（不加玻璃），让内容高对比度

### 2.5 弹窗/下拉菜单

- shadcn Dialog/Sheet/DropdownMenu 的 content 添加 glass-float 效果
- 出现动画使用 glass-materialize

---

## Phase 3: 页面级修复

### 3.1 着陆页
- 将 `#0A84FF` 等硬编码色替换为 CSS 变量 / Tailwind primary
- navbar 使用统一的 glass-primary
- 各 section 背景使用 CSS 变量

### 3.2 登录/注册页
- 表单区域使用 glass-secondary
- 页面背景使用 `--page-bg`

### 3.3 仪表盘页面
- 确保所有卡片使用 GlassCard 组件
- 清理直接使用 `bg-white/XX` 或 `bg-slate-XX` 的硬编码

---

## Phase 4: 验证

- `npx tsc --noEmit` 通过
- `npm run build` 通过
- 明暗模式切换无异常
- 文字对比度 >= 4.5:1

---

## 兼容性保护

### 保留的 class 名（向后兼容映射）

| 旧 class | 映射到 |
|----------|--------|
| .glass | glass-secondary |
| .glass-card | glass-secondary + shadow |
| .glass-card-interactive | glass-secondary + hover |
| .glass-panel | glass-primary |
| .glass-elevated | glass-float |
| .glass-blue | glass-accent |
| .glass-badge | glass-tertiary + pill radius |
| .glass-sidebar | glass-primary (sidebar variant) |
| .glass-input | glass-tertiary (input variant) |

### 性能约束
- 同屏 backdrop-filter 元素 <= 15
- 玻璃嵌套最多一层
- 可动画元素添加 will-change: transform
- 不支持 backdrop-filter 的浏览器回退到半透明实色
