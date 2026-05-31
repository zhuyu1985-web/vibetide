/**
 * 小帮 · 帮助中心向导
 * - 风格综合自 XiaoceAvatar(齐刘海 + 漂浮灯泡)+ XiaoleiAvatar(发饰)
 * - 顶部学士帽 + 中央蓝色流苏(老师/答疑符号)
 * - 头顶悬浮问号灯泡(`avatar-anim-float`)+ 帽角小金星(`avatar-anim-shimmer`)
 * - 右手 path 绑定 `avatar-anim-hand-wave`,只在 `waving` 为 true 时启用
 */

type AvatarProps = { className?: string; waving?: boolean };

export function XiaobangAvatar({ className, waving }: AvatarProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="xb-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ecfeff" />
          <stop offset="100%" stopColor="#67e8f9" />
        </linearGradient>
        <radialGradient id="xb-bulb" cx="0.5" cy="0.4" r="0.6">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="100%" stopColor="#fbbf24" />
        </radialGradient>
        <linearGradient id="xb-cap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1f2937" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>

      {/* 背景:青色 → 深天蓝,代表"信息/引导" */}
      <rect width="64" height="64" rx="16" fill="url(#xb-bg)" />

      {/* 装饰:帽角小金星(shimmer) */}
      <g className="avatar-anim-shimmer">
        <path d="M9 18 l1.3 1.3 M55 14 l-1.3 1.3" stroke="#fde047" strokeWidth="1.6" strokeLinecap="round" />
      </g>
      <g className="avatar-anim-shimmer avatar-delay-2">
        <circle cx="11" cy="22" r="1" fill="#fde047" />
        <circle cx="53" cy="22" r="1" fill="#7dd3fc" />
      </g>

      {/* 头顶悬浮问号灯泡 — 浮动 + 4 道发散光线 */}
      <g className="avatar-anim-float" style={{ transformOrigin: "32px 9px" }}>
        {/* 灯泡外圈光晕(radial yellow) */}
        <ellipse cx="32" cy="9" rx="5" ry="5.4" fill="url(#xb-bulb)" />
        {/* 灯泡底座 */}
        <rect x="30" y="13.5" width="4" height="1.6" rx="0.5" fill="#78350f" />
        <rect x="30.5" y="15.4" width="3" height="0.9" rx="0.4" fill="#78350f" />
        {/* 中央问号字符 */}
        <text
          x="32"
          y="11.4"
          fontSize="6.5"
          textAnchor="middle"
          fontWeight="800"
          fontFamily="-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
          fill="#0f172a"
        >
          ?
        </text>
        {/* 4 道发散光线(blink) */}
        <g className="avatar-anim-blink">
          <path
            d="M24 6 l-2 -1 M40 6 l2 -1 M32 1 l0 -2 M26 14 l-2.5 1 M38 14 l2.5 1"
            stroke="#fbbf24"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </g>
      </g>

      {/* —— FaceBase(圆脸 + 眨眼 + 笑嘴),内联以避免连带改 employee-svg-avatars.tsx —— */}
      <circle cx="32" cy="39" r="15" fill="#f0fdff" />
      <circle cx="32" cy="39" r="15" fill="none" stroke="#0891b2" strokeWidth="1.5" />
      <g className="avatar-eye">
        <ellipse cx="26" cy="39" rx="2" ry="2.2" fill="#1f2937" />
        <circle cx="26.6" cy="38.1" r="0.6" fill="#fff" />
      </g>
      <g className="avatar-eye avatar-eye-2">
        <ellipse cx="38" cy="39" rx="2" ry="2.2" fill="#1f2937" />
        <circle cx="38.6" cy="38.1" r="0.6" fill="#fff" />
      </g>
      <circle cx="22.5" cy="44" r="1.8" fill="#fca5a5" opacity="0.6" />
      <circle cx="41.5" cy="44" r="1.8" fill="#fca5a5" opacity="0.6" />
      <path fill="none" stroke="#1f2937" strokeWidth="1.4" strokeLinecap="round" d="M28 45 Q32 47.5 36 45">
        <animate
          attributeName="d"
          values="M28 45 Q32 47.5 36 45;M28 44.6 Q32 48.4 36 44.6;M28 45 Q32 47.5 36 45;M28 45.4 Q32 46.6 36 45.4;M28 45 Q32 47.5 36 45"
          dur="3.2s"
          repeatCount="indefinite"
        />
      </path>

      {/* 学士帽 — 黑色梯形帽板 + 顶部小立方 + 中央蓝色流苏 */}
      {/* 帽边平板(顶视带角度) */}
      <path
        d="M14 24 L50 24 L46 28 L18 28 Z"
        fill="url(#xb-cap)"
        stroke="#0f172a"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      {/* 帽身(下方束带,贴住前额) */}
      <path
        d="M19 28 Q32 22 45 28 L45 30 Q32 26 19 30 Z"
        fill="#111827"
      />
      {/* 中央纽扣 + 流苏起点 */}
      <circle cx="32" cy="24.5" r="1.6" fill="#0ea5e9" />
      <circle cx="32" cy="24.5" r="0.8" fill="#7dd3fc" />
      {/* 流苏(垂下 — 蓝色,微微摆动) */}
      <g className="avatar-anim-sway" style={{ transformOrigin: "32px 25px" }}>
        <line x1="32" y1="25.5" x2="36" y2="32" stroke="#0284c7" strokeWidth="1.2" strokeLinecap="round" />
        <g>
          <circle cx="36" cy="32.3" r="1.6" fill="#0284c7" />
          <path d="M35 33 l0 3 M36 33 l0 3 M37 33 l0 3" stroke="#0369a1" strokeWidth="0.6" strokeLinecap="round" />
        </g>
      </g>

      {/* 右手挥手 — 单独 group,只在 waving 时启用动画
          手腕在 (50, 50),围绕 (50, 52) 旋转 */}
      <g
        className={waving ? "avatar-anim-hand-wave" : ""}
        style={{ transformOrigin: "50px 52px" }}
      >
        {/* 手臂(短) */}
        <path d="M44 50 Q48 50 50 50" fill="none" stroke="#0e7490" strokeWidth="2.4" strokeLinecap="round" />
        {/* 手掌(圆角五指简化) */}
        <path
          d="M50 47 Q53 46 54 48 Q55 48 55.5 49 Q56 49 56 50 Q56 51 55 51.5 Q54 53 51.5 53 Q49 53 48 51.5 Q47 49.8 48 48.5 Q49 47.5 50 47 Z"
          fill="#fef3c7"
          stroke="#0f172a"
          strokeWidth="0.9"
          strokeLinejoin="round"
        />
        {/* 手指分节 */}
        <path
          d="M51 47.5 L51.5 48.8 M52.5 47 L53 48.5 M54 47.8 L54.2 49 M55 49.4 L54.4 50.3"
          stroke="#0f172a"
          strokeWidth="0.5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
