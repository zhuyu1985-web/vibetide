import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Architecture rules from ADRs. See docs/adr/.
//
// ADR-2026-05-01 (platform-supabase-strategy):
//   - DB 走 Drizzle，不引入 supabase-js 做数据操作
//   - Auth 走 iron-session，不再用 Supabase Auth Helpers / SSR Client
//   - 激活 Realtime（P1）时可针对性放行 @supabase/supabase-js 用于客户端订阅
const architectureRules = {
  "no-restricted-imports": [
    "error",
    {
      paths: [
        {
          name: "@supabase/supabase-js",
          message:
            "ADR-2026-05-01: 当前架构不使用 Supabase 客户端 SDK。DB 走 Drizzle，Auth 走 iron-session。激活 Realtime（P1 路线图）时再解禁该 import 用于客户端订阅，并同步更新 ADR。",
        },
      ],
      patterns: [
        {
          group: ["@supabase/auth-helpers-*", "@supabase/ssr"],
          message:
            "ADR-2026-05-01: Supabase Auth 已被 iron-session 完全替代，不再使用 Auth Helpers / SSR Client。",
        },
      ],
    },
  ],
};

// Design-system consistency rules. Prevents re-drifting away from the
// shared primitives in src/components/ui/* and src/components/shared/*.
//
// Why: every past round of style cleanup found the same two root causes —
// raw HTML form elements bypassing the shared Button/Input/Select, and
// hard-coded table markup bypassing the shared DataTable. These rules
// block both at lint time so future work stays on the rails.
const designSystemRules = {
  // Ban raw HTML form elements in app/ and component files. Developers must
  // import Button, Input, Textarea, Select from src/components/ui/*.
  //
  // Level: `warn` because the existing codebase has ~350 pre-existing
  // violations. Warnings still surface in editors (red squigglies via the
  // ESLint extension) and in CI output, which keeps new violations highly
  // visible during code review. Once the backlog is cleaned up, bump to
  // "error" to hard-block drift.
  "no-restricted-syntax": [
    "warn",
    {
      selector: "JSXOpeningElement[name.name='button']",
      message:
        "Use <Button> from @/components/ui/button instead of raw <button>. Raw buttons break the liquid-glass design system.",
    },
    {
      selector: "JSXOpeningElement[name.name='input']:not([attributes.0.name.name='type'][attributes.0.value.value='checkbox']):not([attributes.0.name.name='type'][attributes.0.value.value='radio'])",
      message:
        "Use <Input> from @/components/ui/input instead of raw <input>. (Exception: native <input type='checkbox'/'radio'> is fine.)",
    },
    {
      selector: "JSXOpeningElement[name.name='select']",
      message:
        "Use <Select> from @/components/ui/select instead of raw <select>. The native <select> uses OS-level styling that breaks visual consistency.",
    },
    {
      selector: "JSXOpeningElement[name.name='textarea']",
      message:
        "Use <Textarea> from @/components/ui/textarea instead of raw <textarea>.",
    },
  ],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Architecture rules apply project-wide (not just UI). Any TS/TSX file
    // could try to pull in supabase-js/auth-helpers/ssr — block them all.
    files: ["src/**/*.{ts,tsx}"],
    rules: architectureRules,
  },
  {
    // Apply design-system rules only to UI source code, not to the shared
    // primitives themselves (which necessarily wrap raw HTML elements).
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    ignores: [
      "src/components/ui/**",
      // Landing page can use raw elements for CTAs with gradient brand styling
      "src/app/landing/**",
      // Media asset uploader uses a hidden file input
      "src/components/media-assets/**",
    ],
    rules: designSystemRules,
  },
]);

export default eslintConfig;
