import type { EmployeeId } from "@/lib/constants";

type AvatarProps = { className?: string };

// Shared face: larger, centered low so there's room for hair/hats on top.
// Eyes blink via .avatar-eye (CSS); mouth smiles via SMIL <animate>.
function FaceBase({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <>
      <circle cx="32" cy="39" r="15" fill={fill} />
      <circle cx="32" cy="39" r="15" fill="none" stroke={stroke} strokeWidth="1.5" />
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
    </>
  );
}

// ---- 小雷 · 热点分析师 — 短发 + 雷达天线 ----
export function XiaoleiAvatar({ className }: AvatarProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="xl-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff7ed" />
          <stop offset="100%" stopColor="#fdba74" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#xl-bg)" />
      {/* scan beam */}
      <g className="avatar-anim-spin" style={{ transformOrigin: "32px 44px" }}>
        <path d="M32 44 L54 32 A24 24 0 0 0 32 20 Z" fill="#f59e0b" opacity="0.18" />
      </g>
      <path d="M10 44 A22 22 0 0 1 54 44" fill="none" stroke="#f59e0b" strokeWidth="1.2" opacity="0.3" />
      {/* antenna */}
      <line x1="32" y1="18" x2="32" y2="8" stroke="#b45309" strokeWidth="2" strokeLinecap="round" />
      <g className="avatar-anim-pulse" style={{ transformOrigin: "32px 6px" }}>
        <circle cx="32" cy="6" r="2.6" fill="#f59e0b" />
        <circle cx="32" cy="6" r="1" fill="#fffbeb" />
      </g>
      <FaceBase fill="#fff3e0" stroke="#f59e0b" />
      {/* short spiky hair with side fringe */}
      <path d="M18 32 Q18 22 32 20 Q46 22 46 32 Q43 28 38 28 Q35 24 32 26 Q29 24 26 28 Q21 28 18 32 Z" fill="#b45309" />
      <path d="M22 29 L20 25 M30 26 L29 22 M38 26 L40 22" stroke="#78350f" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

// ---- 小策 · 选题策划师 — 齐刘海 + 漂浮灯泡 ----
export function XiaoceAvatar({ className }: AvatarProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="xc-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f5f3ff" />
          <stop offset="100%" stopColor="#c4b5fd" />
        </linearGradient>
        <radialGradient id="xc-bulb" cx="0.5" cy="0.4" r="0.6">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="100%" stopColor="#fbbf24" />
        </radialGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#xc-bg)" />
      {/* sparkles */}
      <g className="avatar-anim-shimmer">
        <path d="M10 18 l1.5 1.5 M54 14 l-1.5 1.5" stroke="#a78bfa" strokeWidth="1.6" strokeLinecap="round" />
      </g>
      <g className="avatar-anim-shimmer avatar-delay-2">
        <circle cx="14" cy="22" r="1.2" fill="#fde047" />
        <circle cx="50" cy="22" r="1.2" fill="#a78bfa" />
      </g>
      {/* floating bulb */}
      <g className="avatar-anim-float" style={{ transformOrigin: "32px 10px" }}>
        <ellipse cx="32" cy="9" rx="4.2" ry="4.6" fill="url(#xc-bulb)" />
        <rect x="30" y="13" width="4" height="1.8" rx="0.5" fill="#78350f" />
        <rect x="30.5" y="15" width="3" height="1" rx="0.4" fill="#78350f" />
        <g className="avatar-anim-blink">
          <path d="M25 7 l-2 -1 M39 7 l2 -1 M32 3 l0 -2" stroke="#fbbf24" strokeWidth="1.3" strokeLinecap="round" />
        </g>
      </g>
      <FaceBase fill="#f5f3ff" stroke="#8b5cf6" />
      {/* bob hair with blunt bangs */}
      <path d="M17 34 Q17 22 32 20 Q47 22 47 34 L47 26 Q32 20 17 26 Z" fill="#6d28d9" />
      <path d="M17 30 Q32 24 47 30 L47 28 Q32 22 17 28 Z" fill="#5b21b6" />
    </svg>
  );
}

// ---- 小资 · 素材研究员 — 丸子头 + 圆框眼镜 ----
export function XiaoziAvatar({ className }: AvatarProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="xz-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ecfdf5" />
          <stop offset="100%" stopColor="#6ee7b7" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#xz-bg)" />
      {/* floating pages */}
      <g className="avatar-anim-float" style={{ transformOrigin: "10px 20px" }}>
        <rect x="4" y="12" width="11" height="14" rx="1.5" fill="#fff" stroke="#10b981" strokeWidth="1.2" transform="rotate(-12 10 19)" />
        <line x1="6" y1="18" x2="14" y2="18" stroke="#10b981" strokeWidth="0.9" opacity="0.5" transform="rotate(-12 10 19)" />
      </g>
      <g className="avatar-anim-float avatar-delay-2" style={{ transformOrigin: "54px 18px" }}>
        <rect x="49" y="10" width="11" height="14" rx="1.5" fill="#fff" stroke="#10b981" strokeWidth="1.2" transform="rotate(14 54 17)" />
      </g>
      <FaceBase fill="#ecfdf5" stroke="#10b981" />
      {/* low bun hair */}
      <path d="M17 34 Q17 24 32 22 Q47 24 47 34 Q47 28 32 26 Q17 28 17 34 Z" fill="#047857" />
      <ellipse cx="32" cy="16" rx="5" ry="4" fill="#047857" />
      <ellipse cx="32" cy="15.5" rx="4" ry="3" fill="#065f46" />
      {/* round glasses */}
      <circle cx="26" cy="39" r="3.8" fill="none" stroke="#1f2937" strokeWidth="1.4" />
      <circle cx="38" cy="39" r="3.8" fill="none" stroke="#1f2937" strokeWidth="1.4" />
      <line x1="29.8" y1="39" x2="34.2" y2="39" stroke="#1f2937" strokeWidth="1.4" />
    </svg>
  );
}

// ---- 小文 · 内容创作师 — 贝雷帽 + 钢笔 ----
export function XiaowenAvatar({ className }: AvatarProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="xw-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#eff6ff" />
          <stop offset="100%" stopColor="#93c5fd" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#xw-bg)" />
      {/* ink wave */}
      <g className="avatar-anim-scan-x">
        <path d="M8 56 Q16 52 24 56 T40 56 T56 56" fill="none" stroke="#3b82f6" strokeWidth="1.4" opacity="0.55" strokeLinecap="round" />
        <path d="M8 60 Q16 56 24 60 T40 60 T56 60" fill="none" stroke="#3b82f6" strokeWidth="1.1" opacity="0.35" strokeLinecap="round" />
      </g>
      {/* swaying pen (right) */}
      <g className="avatar-anim-sway" style={{ transformOrigin: "52px 42px" }}>
        <path d="M50 26 L55 21 L58 24 L53 29 Z" fill="#3b82f6" />
        <path d="M50 26 L52 24 L55 27 L53 29 Z" fill="#1e40af" />
        <line x1="53" y1="29" x2="50" y2="46" stroke="#1e40af" strokeWidth="2.2" strokeLinecap="round" />
      </g>
      <FaceBase fill="#eff6ff" stroke="#3b82f6" />
      {/* hair peeking under beret */}
      <path d="M17 34 Q17 28 32 26 Q47 28 47 34 Q47 32 32 30 Q17 32 17 34 Z" fill="#1e3a8a" />
      {/* tilted beret */}
      <path d="M14 26 Q18 14 34 14 Q50 14 50 22 Q50 28 36 28 Q20 28 14 26 Z" fill="#1e40af" />
      <path d="M14 26 Q24 24 50 22 L50 25 Q30 28 14 27 Z" fill="#1e3a8a" />
      <circle cx="50" cy="14" r="2.4" fill="#1e40af" />
      <circle cx="50" cy="14" r="1.2" fill="#3b82f6" />
    </svg>
  );
}

// ---- 小见 · 视频制片人 — 导演鸭舌帽 ----
export function XiaojianAvatar({ className }: AvatarProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="xj-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fef2f2" />
          <stop offset="100%" stopColor="#fca5a5" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#xj-bg)" />
      {/* film strip side perforations */}
      <rect x="4" y="34" width="5" height="18" rx="1" fill="#111827" />
      <rect x="55" y="34" width="5" height="18" rx="1" fill="#111827" />
      <g className="avatar-anim-blink">
        <circle cx="6.5" cy="38" r="0.9" fill="#fef2f2" />
        <circle cx="6.5" cy="46" r="0.9" fill="#fef2f2" />
        <circle cx="57.5" cy="42" r="0.9" fill="#fef2f2" />
      </g>
      <g className="avatar-anim-blink avatar-delay-2">
        <circle cx="6.5" cy="42" r="0.9" fill="#fef2f2" />
        <circle cx="57.5" cy="38" r="0.9" fill="#fef2f2" />
        <circle cx="57.5" cy="46" r="0.9" fill="#fef2f2" />
      </g>
      <FaceBase fill="#fef2f2" stroke="#ef4444" />
      {/* hair shadow under cap */}
      <path d="M17 32 Q32 28 47 32 L47 30 Q32 26 17 30 Z" fill="#374151" />
      {/* snapback cap */}
      <path d="M16 24 Q18 12 32 12 Q46 12 48 24 Q32 22 16 24 Z" fill="#111827" />
      <path d="M16 24 L52 24 Q54 24 54 26 L54 27 L14 27 L14 26 Q14 24 16 24 Z" fill="#1f2937" />
      <rect x="30" y="16" width="10" height="3" rx="0.6" fill="#ef4444" />
      <text x="32" y="18.5" fontSize="3.5" fill="#fff" fontWeight="700" fontFamily="sans-serif">REC</text>
      {/* pulsing red dot */}
      <g className="avatar-anim-pulse" style={{ transformOrigin: "23px 17px" }}>
        <circle cx="23" cy="17" r="1.4" fill="#ef4444" />
      </g>
    </svg>
  );
}

// ---- 小审 · 质量审核官 — 双马尾 + 放大镜 ----
export function XiaoshenAvatar({ className }: AvatarProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="xs-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#eef2ff" />
          <stop offset="100%" stopColor="#a5b4fc" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#xs-bg)" />
      {/* side pigtails */}
      <g className="avatar-anim-sway" style={{ transformOrigin: "12px 36px" }}>
        <path d="M14 32 Q8 36 10 46 Q12 50 14 46 Q15 40 18 36 Z" fill="#4338ca" />
        <circle cx="13" cy="32" r="1.6" fill="#818cf8" />
      </g>
      <g className="avatar-anim-sway avatar-delay-2" style={{ transformOrigin: "52px 36px" }}>
        <path d="M50 32 Q56 36 54 46 Q52 50 50 46 Q49 40 46 36 Z" fill="#4338ca" />
        <circle cx="51" cy="32" r="1.6" fill="#818cf8" />
      </g>
      <FaceBase fill="#eef2ff" stroke="#6366f1" />
      {/* bangs */}
      <path d="M17 32 Q17 22 32 20 Q47 22 47 32 Q42 26 36 28 Q32 24 28 28 Q22 26 17 32 Z" fill="#4338ca" />
      {/* scanning magnifier */}
      <g className="avatar-anim-scan-x" style={{ transformOrigin: "46px 16px" }}>
        <circle cx="48" cy="14" r="6.5" fill="none" stroke="#4338ca" strokeWidth="2" />
        <circle cx="48" cy="14" r="4.5" fill="#fff" opacity="0.85" />
        <path d="M45.5 14 l1.8 1.8 l3.5 -3.5" fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="52.5" y1="18.5" x2="57" y2="23" stroke="#4338ca" strokeWidth="2.4" strokeLinecap="round" />
      </g>
    </svg>
  );
}

// ---- 小发 · 渠道运营师 — 蓬松短发 + 耳机 ----
export function XiaofaAvatar({ className }: AvatarProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="xf-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f0fdfa" />
          <stop offset="100%" stopColor="#5eead4" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#xf-bg)" />
      {/* radio waves */}
      <g className="avatar-anim-wave" style={{ transformOrigin: "8px 40px" }}>
        <path d="M4 38 Q8 34 12 38" fill="none" stroke="#14b8a6" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M2 42 Q8 36 14 42" fill="none" stroke="#14b8a6" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
      </g>
      <g className="avatar-anim-wave avatar-delay-2" style={{ transformOrigin: "56px 40px" }}>
        <path d="M52 38 Q56 34 60 38" fill="none" stroke="#14b8a6" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M50 42 Q56 36 62 42" fill="none" stroke="#14b8a6" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
      </g>
      <FaceBase fill="#f0fdfa" stroke="#14b8a6" />
      {/* messy fluffy hair */}
      <path d="M17 32 Q16 22 23 20 Q26 16 30 19 Q32 15 34 19 Q38 16 41 20 Q48 22 47 32 Q44 28 38 28 Q34 24 32 26 Q30 24 26 28 Q20 28 17 32 Z" fill="#0f766e" />
      {/* headphone band */}
      <path d="M17 30 Q17 18 32 18 Q47 18 47 30" fill="none" stroke="#111827" strokeWidth="2.4" strokeLinecap="round" />
      {/* ear cups */}
      <rect x="12" y="28" width="6.5" height="10" rx="2.5" fill="#14b8a6" stroke="#0f766e" strokeWidth="0.8" />
      <rect x="45.5" y="28" width="6.5" height="10" rx="2.5" fill="#14b8a6" stroke="#0f766e" strokeWidth="0.8" />
      <circle cx="15.25" cy="33" r="1.4" fill="#fff" opacity="0.6" />
      <circle cx="48.75" cy="33" r="1.4" fill="#fff" opacity="0.6" />
    </svg>
  );
}

// ---- 小数 · 数据分析师 — 侧分短发 + 柱状图 ----
export function XiaoshuAvatar({ className }: AvatarProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="xsh-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff7ed" />
          <stop offset="100%" stopColor="#fdba74" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#xsh-bg)" />
      {/* bouncing bar chart top-left */}
      <g className="avatar-anim-bounce" style={{ transformOrigin: "6px 20px" }}>
        <rect x="4" y="14" width="3" height="6" rx="0.8" fill="#f97316" opacity="0.85" />
      </g>
      <g className="avatar-anim-bounce avatar-delay-2" style={{ transformOrigin: "10px 20px" }}>
        <rect x="9" y="10" width="3" height="10" rx="0.8" fill="#f97316" />
      </g>
      <g className="avatar-anim-bounce avatar-delay-1" style={{ transformOrigin: "15px 20px" }}>
        <rect x="14" y="6" width="3" height="14" rx="0.8" fill="#ea580c" />
      </g>
      {/* trend line to right */}
      <path d="M17 6 L52 4" fill="none" stroke="#ea580c" strokeWidth="1.3" strokeLinecap="round" opacity="0.6" />
      <g className="avatar-anim-pulse" style={{ transformOrigin: "52px 4px" }}>
        <circle cx="52" cy="4" r="1.8" fill="#ea580c" />
      </g>
      {/* bottom bouncing bars */}
      <g className="avatar-anim-bounce" style={{ transformOrigin: "51px 58px" }}>
        <rect x="50" y="52" width="3" height="6" rx="0.8" fill="#f97316" opacity="0.85" />
      </g>
      <g className="avatar-anim-bounce avatar-delay-2" style={{ transformOrigin: "55.5px 58px" }}>
        <rect x="54.5" y="48" width="3" height="10" rx="0.8" fill="#f97316" />
      </g>
      <g className="avatar-anim-bounce avatar-delay-3" style={{ transformOrigin: "59.5px 58px" }}>
        <rect x="58.5" y="44" width="3" height="14" rx="0.8" fill="#ea580c" />
      </g>
      <FaceBase fill="#fff7ed" stroke="#f97316" />
      {/* side-parted hair */}
      <path d="M17 32 Q17 22 30 20 Q46 22 47 32 L47 26 Q32 22 26 24 Q22 22 17 28 Z" fill="#c2410c" />
      <path d="M20 24 Q28 20 42 22 Q46 24 46 28 Q32 22 20 26 Z" fill="#9a3412" />
      {/* thin glasses */}
      <rect x="21" y="37" width="9" height="4.5" rx="1.4" fill="none" stroke="#1f2937" strokeWidth="1.1" />
      <rect x="34" y="37" width="9" height="4.5" rx="1.4" fill="none" stroke="#1f2937" strokeWidth="1.1" />
      <line x1="30" y1="39" x2="34" y2="39" stroke="#1f2937" strokeWidth="1.1" />
    </svg>
  );
}

// ---- 小探 · 深度调查员 — 侦探帽 + 放大镜 ----
export function XiaotanAvatar({ className }: AvatarProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="xt-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f0f9ff" />
          <stop offset="100%" stopColor="#7dd3fc" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#xt-bg)" />
      {/* clue footprints */}
      <g className="avatar-anim-shimmer">
        <circle cx="8" cy="56" r="1.2" fill="#0ea5e9" />
        <circle cx="14" cy="60" r="1.2" fill="#0ea5e9" />
      </g>
      <g className="avatar-anim-shimmer avatar-delay-2">
        <circle cx="20" cy="56" r="1.2" fill="#0ea5e9" />
      </g>
      {/* question mark above */}
      <g className="avatar-anim-pulse" style={{ transformOrigin: "32px 8px" }}>
        <path d="M30 8 Q32 4 34 8 Q34 10 32 11 L32 12" fill="none" stroke="#0ea5e9" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="32" cy="14" r="0.8" fill="#0ea5e9" />
      </g>
      <FaceBase fill="#f0f9ff" stroke="#0ea5e9" />
      {/* deerstalker hat */}
      <path d="M15 30 Q15 20 32 18 Q49 20 49 30 L50 33 Q32 29 14 33 Z" fill="#0c4a6e" />
      <ellipse cx="32" cy="33" rx="18" ry="2.4" fill="#075985" />
      <path d="M22 25 L22 19 L28 22 Z" fill="#0369a1" />
      <path d="M42 25 L42 19 L36 22 Z" fill="#0369a1" />
      {/* center ribbon */}
      <rect x="31" y="16" width="2" height="6" fill="#7dd3fc" />
      {/* scanning magnifier */}
      <g className="avatar-anim-scan-x" style={{ transformOrigin: "50px 42px" }}>
        <circle cx="50" cy="40" r="6.5" fill="none" stroke="#0c4a6e" strokeWidth="2" />
        <circle cx="50" cy="40" r="4.5" fill="#bae6fd" opacity="0.5" />
        <line x1="54.5" y1="44.5" x2="58.5" y2="48.5" stroke="#0c4a6e" strokeWidth="2.4" strokeLinecap="round" />
      </g>
    </svg>
  );
}

// ---- 小领 · 任务总监 — 金冠 + 光环 ----
export function LeaderAvatar({ className }: AvatarProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="xl-lead-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff1f2" />
          <stop offset="100%" stopColor="#fda4af" />
        </linearGradient>
        <linearGradient id="xl-crown" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#xl-lead-bg)" />
      {/* rotating halo */}
      <g className="avatar-anim-spin" style={{ transformOrigin: "32px 40px" }}>
        <circle cx="32" cy="40" r="22" fill="none" stroke="#e11d48" strokeWidth="0.8" strokeDasharray="3 4" opacity="0.35" />
      </g>
      {/* sparkles */}
      <g className="avatar-anim-shimmer">
        <path d="M8 22 l1.5 1.5 M56 20 l-1.5 1.5" stroke="#e11d48" strokeWidth="1.4" strokeLinecap="round" />
      </g>
      <g className="avatar-anim-shimmer avatar-delay-2">
        <circle cx="52" cy="28" r="1" fill="#fde047" />
        <circle cx="12" cy="28" r="1" fill="#fde047" />
      </g>
      <FaceBase fill="#fff1f2" stroke="#e11d48" />
      {/* royal hair under crown */}
      <path d="M17 32 Q17 24 32 22 Q47 24 47 32 L47 28 Q32 24 17 28 Z" fill="#9f1239" />
      {/* floating crown */}
      <g className="avatar-anim-float" style={{ transformOrigin: "32px 16px" }}>
        <path d="M16 26 L19 10 L25 18 L32 6 L39 18 L45 10 L48 26 Z" fill="url(#xl-crown)" stroke="#b45309" strokeWidth="1" strokeLinejoin="round" />
        <rect x="16" y="26" width="32" height="3" rx="0.8" fill="#b45309" />
        <circle cx="32" cy="6" r="1.6" fill="#fde047" />
        <circle cx="19" cy="10" r="1.2" fill="#fde047" />
        <circle cx="45" cy="10" r="1.2" fill="#fde047" />
        <circle cx="25" cy="18" r="1" fill="#fef3c7" />
        <circle cx="39" cy="18" r="1" fill="#fef3c7" />
      </g>
      {/* star badge bottom-right */}
      <g className="avatar-anim-pulse" style={{ transformOrigin: "49px 52px" }}>
        <path d="M49 48 L50.6 51.2 L54 51.5 L51.6 53.9 L52.3 57.3 L49 55.6 L45.7 57.3 L46.4 53.9 L44 51.5 L47.4 51.2 Z" fill="#e11d48" />
      </g>
    </svg>
  );
}

export const EMPLOYEE_AVATAR_MAP: Partial<Record<EmployeeId, (props: AvatarProps) => React.JSX.Element>> = {
  xiaolei: XiaoleiAvatar,
  xiaoce: XiaoceAvatar,
  xiaozi: XiaoziAvatar,
  xiaowen: XiaowenAvatar,
  xiaojian: XiaojianAvatar,
  xiaoshen: XiaoshenAvatar,
  xiaofa: XiaofaAvatar,
  xiaoshu: XiaoshuAvatar,
  xiaotan: XiaotanAvatar,
  leader: LeaderAvatar,
};
