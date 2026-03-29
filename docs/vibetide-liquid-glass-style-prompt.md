# VibeTide 液态玻璃视觉风格提示词（Liquid Glass Design Prompt）

> **用途：** 作为视觉风格描述块，嵌入到任何页面/组件的生成提示词中。
> **使用方式：** 将本文档的内容作为提示词的"视觉风格"章节，与页面布局/功能逻辑章节组合使用。

---

## 风格定义

本系统的视觉风格参考 Apple iOS 26 的 Liquid Glass（液态玻璃）设计语言，并将其适配到**深色系 B 端数据密集型仪表台**场景。不是简单的毛玻璃效果，而是一套完整的材质系统——UI 控件作为一层透明玻璃"漂浮"在内容之上，具备折射、高光、景深三层光学属性。

**核心设计哲学：**

- **三层分离模型：** 背景层（底色 / 壁纸 / 渐变）→ 内容层（文字、数据、图表）→ 玻璃控件层（导航、按钮、卡片容器）。玻璃层漂浮在内容之上，半透明地折射下方内容。
- **光学真实感：** 不是简单的背景模糊（blur），而是模拟真实玻璃的三种光学行为——折射（lensing，弯曲并聚焦光线）、高光（specular highlights，表面反射光）、投影（自适应阴影）。
- **内容优先：** 玻璃材质的作用是建立层级关系而非抢夺注意力。控件在视觉上退让，让数据和内容成为焦点。
- **流体形变：** 玻璃元素的形状和大小随上下文动态变化（如滚动时导航栏收缩、展开时卡片放大），过渡动画是流体式的（ease-out，带有弹性感）。

---

## CSS 实现规范

### 1. 背景层（Background Layer）

整个页面的底层，提供玻璃效果所折射的"内容源"。

```css
/* 页面底色：深色渐变，为玻璃折射提供色彩基底 */
body {
  background: #050A12;
  /* 可选：添加微妙的径向渐变光斑，增强折射效果的视觉丰富度 */
  background-image:
    radial-gradient(ellipse at 20% 50%, rgba(0, 212, 255, 0.04) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, rgba(168, 85, 247, 0.03) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 80%, rgba(16, 185, 129, 0.02) 0%, transparent 50%);
}
```

### 2. 玻璃材质（Glass Material）—— 核心

所有面板、卡片容器、导航栏、工具栏均使用此材质。这是 Liquid Glass 最核心的视觉表达。

```css
.glass-panel {
  /* ── 半透明底色 ── */
  background: rgba(255, 255, 255, 0.03);
  /* 深色场景下用极低的白色透明度，而非纯灰色 */

  /* ── 背景模糊（折射模拟） ── */
  backdrop-filter: blur(16px) saturate(1.2);
  -webkit-backdrop-filter: blur(16px) saturate(1.2);
  /* blur: 12-24px 范围，越大越"磨砂"，越小越"清透" */
  /* saturate: 1.1-1.4，轻微增强折射内容的饱和度，模拟玻璃色散 */

  /* ── 玻璃边框（高光边缘） ── */
  border: 1px solid rgba(255, 255, 255, 0.06);
  /* 顶部和左侧边框可以稍亮，模拟光源照射角度 */
  border-top: 1px solid rgba(255, 255, 255, 0.10);
  border-left: 1px solid rgba(255, 255, 255, 0.08);

  /* ── 圆角 ── */
  border-radius: 16px;
  /* Liquid Glass 偏好较大圆角（16-24px），与设备圆角"同心" */

  /* ── 投影（玻璃悬浮感） ── */
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.25),          /* 主阴影：制造悬浮感 */
    0 0 0 0.5px rgba(255, 255, 255, 0.05),    /* 内发光：玻璃边缘光泽 */
    inset 0 1px 0 rgba(255, 255, 255, 0.04);  /* 内部顶边高光 */
}
```

### 3. 玻璃变体（按层级强度分级）

不同层级的 UI 元素使用不同强度的玻璃效果：

```css
/* 一级玻璃：主面板、侧边栏（最厚，最明显的磨砂感） */
.glass-primary {
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(20px) saturate(1.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

/* 二级玻璃：卡片、弹窗（中等，轻微磨砂） */
.glass-secondary {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(12px) saturate(1.15);
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

/* 三级玻璃：按钮、标签、小控件（最薄，几乎透明） */
.glass-tertiary {
  background: rgba(255, 255, 255, 0.02);
  backdrop-filter: blur(8px) saturate(1.1);
  border: 1px solid rgba(255, 255, 255, 0.04);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

/* 强调玻璃：带有品牌色调的玻璃（如选中状态、激活状态） */
.glass-accent {
  background: rgba(0, 212, 255, 0.06);
  backdrop-filter: blur(16px) saturate(1.4);
  border: 1px solid rgba(0, 212, 255, 0.15);
  box-shadow:
    0 4px 24px rgba(0, 212, 255, 0.08),
    inset 0 1px 0 rgba(0, 212, 255, 0.1);
}
```

### 4. 高光效果（Specular Highlights）

Liquid Glass 的关键细节——模拟光线在玻璃表面的反射。

```css
/* 方案一：伪元素渐变高光（推荐，性能好） */
.glass-panel::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 50%;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.05) 0%,
    rgba(255, 255, 255, 0.01) 40%,
    transparent 100%
  );
  border-radius: 16px 16px 0 0;
  pointer-events: none;
}

/* 方案二：高级 — 随鼠标移动的动态高光（可选，交互性更强） */
.glass-panel:hover::after {
  content: '';
  position: absolute;
  width: 200px;
  height: 200px;
  background: radial-gradient(
    circle,
    rgba(255, 255, 255, 0.06) 0%,
    transparent 70%
  );
  top: var(--mouse-y, 50%);
  left: var(--mouse-x, 50%);
  transform: translate(-50%, -50%);
  pointer-events: none;
  transition: opacity 0.3s ease;
}
```

### 5. 动效规范（Fluid Motion）

Liquid Glass 的"液态"感主要靠动效体现——元素的出现、消失、形变都是流体式的。

```css
/* ── 全局过渡曲线 ── */
:root {
  /* Liquid Glass 标准缓动：快速开始、缓慢结束，带微弱弹性 */
  --ease-glass: cubic-bezier(0.22, 0.68, 0.35, 1.0);
  /* 快速响应缓动（用于小控件的状态切换） */
  --ease-glass-fast: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  /* 弹性缓动（用于展开/折叠动作） */
  --ease-glass-spring: cubic-bezier(0.34, 1.56, 0.64, 1.0);
}

/* ── 面板出现动画（物化效果：从模糊中凝聚成形） ── */
@keyframes glass-materialize {
  0% {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
    backdrop-filter: blur(0px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
    backdrop-filter: blur(16px);
  }
}

.glass-panel-enter {
  animation: glass-materialize 0.4s var(--ease-glass) forwards;
}

/* ── 元素悬浮反馈（鼠标悬停时玻璃"微微抬起"） ── */
.glass-card {
  transition: transform 0.25s var(--ease-glass), box-shadow 0.25s var(--ease-glass);
}
.glass-card:hover {
  transform: translateY(-2px);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    0 0 0 0.5px rgba(255, 255, 255, 0.08);
}

/* ── 导航栏收缩/展开（参考 iOS 26 Tab Bar 滚动时的形变） ── */
.glass-navbar {
  transition: all 0.35s var(--ease-glass);
}
.glass-navbar.compact {
  padding: 6px 12px;
  border-radius: 999px; /* 收缩为胶囊形状 */
  transform: scale(0.9);
}

/* ── 脉冲呼吸效果（用于"执行中"状态指示） ── */
@keyframes glass-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(0, 212, 255, 0.2); }
  50% { box-shadow: 0 0 0 8px rgba(0, 212, 255, 0); }
}
```

### 6. 文字与可读性

Liquid Glass 最大的可读性风险是文字在半透明背景上看不清。严格遵守以下规则：

```css
/* 规则一：正文文字永远放在实色/高对比度表面上，不直接放在薄玻璃上 */
/* 规则二：如果文字必须出现在玻璃表面，使用以下增强手段 */

.glass-text {
  color: rgba(255, 255, 255, 0.92);
  /* 添加极微弱的文字阴影，增强边缘可读性 */
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.glass-text-secondary {
  color: rgba(255, 255, 255, 0.55);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

/* 大标题/数字在玻璃上可以用更粗的字重补偿 */
.glass-stat-number {
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
}
```

### 7. 色彩与玻璃的交互

当玻璃元素需要承载颜色信息（如状态色、品牌色）时，颜色以"染色玻璃"的方式呈现，而非实色填充：

```css
/* 状态色通过玻璃的底色和边框来传达，保持半透明特性 */

/* 执行中 — 蓝色染色玻璃 */
.glass-status-running {
  background: rgba(0, 212, 255, 0.06);
  border-color: rgba(0, 212, 255, 0.15);
  box-shadow: 0 4px 20px rgba(0, 212, 255, 0.06);
}

/* 已完成 — 绿色染色玻璃 */
.glass-status-done {
  background: rgba(16, 185, 129, 0.06);
  border-color: rgba(16, 185, 129, 0.12);
}

/* 异常 — 红色染色玻璃 */
.glass-status-error {
  background: rgba(239, 68, 68, 0.06);
  border-color: rgba(239, 68, 68, 0.15);
  box-shadow: 0 4px 20px rgba(239, 68, 68, 0.06);
}

/* AI 员工头像：每个员工的专属色作为其玻璃底色 */
.glass-avatar {
  background: rgba(var(--agent-color-rgb), 0.08);
  border: 1.5px solid rgba(var(--agent-color-rgb), 0.25);
  backdrop-filter: blur(8px);
}
```

---

## 各 UI 组件的玻璃化适配规则

### 页面级

| 元素 | 玻璃等级 | 特殊处理 |
|------|----------|----------|
| 页面背景 | 无（实色 + 渐变光斑） | 作为玻璃折射的"内容源" |
| Header / 顶栏 | 一级玻璃 | 底部无圆角（贴顶），`border-bottom` 替代 `border` |
| 侧边面板 | 一级玻璃 | 右侧/左侧无圆角（贴边），与页面边缘齐平 |
| 主内容区 | 无或极薄玻璃 | 内容区保持高对比度，避免阅读障碍 |

### 组件级

| 元素 | 玻璃等级 | 特殊处理 |
|------|----------|----------|
| 任务卡片 | 二级玻璃 | 悬停时微微抬起 + 边框增亮 |
| 状态胶囊 Badge | 三级玻璃 + 状态染色 | 文字加 text-shadow 保证可读 |
| 按钮（主要） | 三级强调玻璃 | 蓝色底色稍高（0.1），点击时波纹 |
| 按钮（次要） | 三级玻璃 | 默认态几乎透明，悬停态显现边框 |
| 进度条轨道 | — | 用 `rgba(255,255,255,0.06)` 代替实色灰 |
| 进度条填充 | — | 实色保留（进度信息不应被玻璃削弱） |
| Tab 栏 | 二级玻璃 | 选中 Tab 下方有实色（非玻璃）指示线 |
| 下拉菜单 | 二级玻璃 | 出现时使用 glass-materialize 动画 |
| 消息气泡 | 二级玻璃 | 左侧色条保留实色（发送者标识不能模糊） |
| 统计数字 | 无 | 数字本身用实色，不加玻璃效果（可读性优先） |
| 头像 | 三级玻璃 + 角色染色 | emoji 不受玻璃影响，边框带角色色 |

### 交互态

| 状态 | 玻璃变化 |
|------|----------|
| 默认 | 基准玻璃效果 |
| 悬停 | 背景透明度 +0.02，边框亮度 +0.04，微抬 translateY(-2px) |
| 按下 | 背景透明度 +0.04，缩小 scale(0.98)，阴影收紧 |
| 选中/激活 | 切换为强调玻璃（品牌色染色），边框明显 |
| 禁用 | 透明度降到 0.01，边框消失，整体 opacity: 0.4 |

---

## 性能注意事项

1. `backdrop-filter` 是 GPU 密集操作。**同屏玻璃元素不超过 15 个**，嵌套玻璃效果（玻璃上面再叠玻璃）最多一层。
2. 对可能做动画的玻璃元素添加 `will-change: transform, backdrop-filter`。
3. 滚动容器内的玻璃元素如果很多，考虑只在可视区域内启用 backdrop-filter（虚拟滚动）。
4. 提供降级方案：不支持 backdrop-filter 的浏览器回退到半透明实色背景。

```css
@supports not (backdrop-filter: blur(1px)) {
  .glass-panel {
    background: rgba(11, 17, 32, 0.92); /* 接近实色的回退 */
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
}
```

---

## 快速嵌入用法（直接放进提示词中的精简版）

如果上面的完整版太长，可以用以下精简版直接嵌入到页面生成提示词中：

```
视觉风格：参考 iOS 26 Liquid Glass（液态玻璃）设计语言，深色系变体。

核心规则：
1. 三层分离：背景层（#050A12 + 微光渐变）→ 内容层 → 玻璃控件层
2. 所有面板/卡片/导航使用半透明玻璃材质：
   background: rgba(255,255,255, 0.03~0.05)
   backdrop-filter: blur(12~20px) saturate(1.2)
   border: 1px solid rgba(255,255,255, 0.05~0.10)（顶/左边框稍亮，模拟光源）
   box-shadow: 0 4px 24px rgba(0,0,0,0.25)（悬浮感）
   border-radius: 16px（大圆角）
3. 高光效果：每个玻璃面板顶部有一层极微弱的白色渐变高光（::before 伪元素）
4. 状态色以"染色玻璃"呈现（背景 rgba(状态色, 0.06) + 边框 rgba(状态色, 0.15)），不用实色填充
5. 文字永远保证高对比度：在玻璃上的文字加 text-shadow: 0 1px 2px rgba(0,0,0,0.3)
6. 动效是流体式的：ease = cubic-bezier(0.22, 0.68, 0.35, 1.0)，出现动画带 scale(0.96→1) + opacity 渐现
7. 悬停反馈：微抬 translateY(-2px) + 边框增亮 + 阴影扩大
8. 进度条、状态指示圆点等信息型元素保持实色，不加玻璃效果
9. 同屏玻璃元素不超过 15 个，避免嵌套玻璃
```
