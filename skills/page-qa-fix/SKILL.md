---
name: page-qa-fix
description: "Automated page quality inspection and error repair for web projects. Scan all page routes, detect compilation/runtime/HTTP errors, diagnose root causes, and auto-fix issues in a continuous loop until all pages work. Use when: (1) user says 'check all pages', 'fix page errors', 'page QA', '页面质检', '页面检查', '路由检查', '修复页面', (2) after build completes and pages have routing errors or blank screens, (3) user reports multiple pages are broken or showing errors, (4) user wants to verify all routes are accessible and error-free. Supports Next.js, Nuxt, SvelteKit, Remix, Vite, and other frameworks."
builtin: false
---

# Page QA & Auto-Fix

Automated workflow to scan, diagnose, and fix all broken pages in a web project. Loop continuously until every page is error-free.

## Workflow Overview

1. **Detect framework** → determine project type, dev command, port
2. **Build route list** → scan all page routes
3. **Run static checks** → TypeScript + ESLint
4. **Start dev server** → ensure it's running
5. **Check each page** → HTTP status, console errors, runtime errors
6. **Diagnose errors** → locate file, line, root cause
7. **Fix errors** → by priority, preserve business logic
8. **Verify fix** → re-check page, rollback if new issues
9. **Loop** → repeat until all pages pass
10. **Report** → output fix summary

## Step 1: Detect Framework

Read `package.json` and check for framework config files. See [references/framework-detection.md](references/framework-detection.md) for the full detection table.

Key outputs needed:
- Framework name
- Dev server command (from `package.json` scripts or framework default)
- Default port
- TypeScript check command
- Package manager (`npm`, `pnpm`, `yarn`, `bun` — check for lock files)

## Step 2: Build Route List

Run `scripts/scan_routes.sh` to discover all routes:

```bash
bash <skill_dir>/scripts/scan_routes.sh <project_dir> > /tmp/routes.txt
```

If the script outputs `ROUTER_CONFIG:<file>`, read that file to manually extract routes from code-based router configurations (React Router, Vue Router, etc.).

Review the route list and add any known routes that the scanner may have missed (e.g., from navigation components or API docs).

## Step 3: Run Static Checks

Run checks in parallel and capture output:

1. **TypeScript**: Run the appropriate type-check command (see framework-detection.md). Capture all errors with file paths and line numbers.
2. **ESLint**: Run `npx eslint . --ext .ts,.tsx,.js,.jsx,.vue,.svelte --quiet` if ESLint config exists. Capture errors only (not warnings).

Parse output to build an error list: `{file, line, message, type: "ts"|"eslint"}`.

## Step 4: Start Dev Server

1. Check if dev server is already running: `curl -s -o /dev/null -w "%{http_code}" http://localhost:<port>`
2. If not running, start it in background: `npm run dev &` (or appropriate command)
3. Wait for server to be ready (poll with curl, max 30 seconds)
4. If server fails to start, check terminal output for errors — these are blocking issues to fix first

## Step 5: Check Each Page

Run `scripts/check_pages.sh` to check HTTP status:

```bash
bash <skill_dir>/scripts/check_pages.sh http://localhost:<port> /tmp/routes.txt
```

For pages returning non-200 status:
- **500**: Server-side error — check dev server terminal output
- **404**: Route may not be registered, or file may have wrong export
- **CONNECTION_ERROR**: Server crashed or route causes infinite loop

Additionally, use Playwright (if available) to visit each broken page and capture:
- Console errors (`console.error` messages)
- Unhandled exceptions
- Network failures (failed API calls, missing assets)

## Step 6: Diagnose Each Error

For each error, determine:

| Error Type | Diagnosis Method |
|------------|-----------------|
| Module not found | Check import path, verify file exists, check aliases in tsconfig/vite config |
| Type error | Read the file at the error line, understand expected vs actual types |
| Undefined access | Trace the variable, check if data might be null/undefined |
| Missing props | Compare component usage vs its type definition |
| Hydration mismatch | Look for browser-only APIs in SSR code, conditional rendering |
| API error | Check if API routes exist, env vars are set, proxy is configured |
| Missing dependency | Check if package is in package.json, run install if needed |

Record each diagnosis: `{file, line, rootCause, category, severity}`.

## Step 7: Fix Errors by Priority

Fix order:
1. **Blocking** (severity: critical): Missing modules, server crashes, 500 errors
2. **Type errors** (severity: high): TypeScript compilation failures
3. **Runtime warnings** (severity: medium): Potential crash points, deprecation warnings

Fix rules:
- **Preserve business logic** — only fix the error itself, do not refactor
- **Minimal changes** — smallest possible diff to resolve the issue
- **One fix at a time** — fix, verify, then move to next
- If a dependency is missing, run `<pkg_manager> install <package>` (or `<pkg_manager> install -D <package>` for dev deps)
- If a type is wrong, fix the type annotation or add proper type guards
- If an import path is wrong, correct the path
- If a component is missing required props, add sensible defaults or required prop passing

## Step 8: Verify Each Fix

After each fix:
1. Re-run type check on the modified file: `npx tsc --noEmit <file>` or full project check
2. Re-check the page HTTP status with curl
3. If using Playwright, revisit the page and confirm no console errors

**If fix introduces new errors**:
- Revert the change immediately (use git or manual undo)
- Try an alternative approach
- If stuck after 2 attempts, log the issue and move on — report it as unresolved

## Step 9: Loop Until Clean

Repeat Steps 3-8 until:
- All static checks pass (zero TS/ESLint errors)
- All pages return 200
- No console errors on any page

## Step 10: Output Fix Summary

Generate a summary report in this format:

```
## Page QA Fix Report

### Summary
- Pages checked: X
- Pages fixed: Y
- Unresolved issues: Z

### Fixes Applied

| Page | File | Root Cause | Fix |
|------|------|-----------|-----|
| /dashboard | src/pages/dashboard.tsx:42 | Missing import for `UserCard` | Added import statement |
| /settings | src/components/Settings.tsx:15 | Nullable access on `user.email` | Added optional chaining `?.` |

### Unresolved Issues (if any)

| Page | Error | Reason |
|------|-------|--------|
| /reports | Hydration mismatch | Requires architecture change beyond scope |
```

## Resources

### scripts/
- `scan_routes.sh` — Discover all page routes for Next.js, Nuxt, SvelteKit, Remix, and other frameworks
- `check_pages.sh` — Check HTTP response status for each route against a running dev server

### references/
- [framework-detection.md](references/framework-detection.md) — Framework detection table, TypeScript check commands, and common error patterns

## 参考资料

- **媒体行业专业标准（共享）**：[../../docs/skills/media-industry-standards.md](../../docs/skills/media-industry-standards.md)
- 历史版本：`git log --follow skills/page-qa-fix/SKILL.md`
