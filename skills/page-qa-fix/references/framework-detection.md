# Framework Detection Guide

## Detecting the Framework

Check these files/directories in order:

| Indicator | Framework | Dev Command | Default Port |
|-----------|-----------|-------------|-------------|
| `next.config.*` | Next.js | `npm run dev` / `npx next dev` | 3000 |
| `nuxt.config.*` | Nuxt.js | `npm run dev` / `npx nuxi dev` | 3000 |
| `svelte.config.*` | SvelteKit | `npm run dev` / `npx vite dev` | 5173 |
| `remix.config.*` or `app/routes/` with `@remix-run` in package.json | Remix | `npm run dev` | 3000 |
| `vite.config.*` | Vite (React/Vue/etc.) | `npm run dev` / `npx vite` | 5173 |
| `angular.json` | Angular | `ng serve` | 4200 |
| `gatsby-config.*` | Gatsby | `npm run develop` | 8000 |

## TypeScript Check Commands by Framework

- **Next.js**: `npx tsc --noEmit` (uses project tsconfig)
- **Nuxt**: `npx nuxi typecheck`
- **SvelteKit**: `npx svelte-check`
- **Angular**: `npx ng build --configuration development` (type checking is part of build)
- **Others**: `npx tsc --noEmit`

## ESLint Check

Most frameworks: `npx eslint . --ext .ts,.tsx,.js,.jsx --quiet`

If `.eslintrc*` or `eslint.config.*` exists, ESLint is configured.

## Common Error Patterns

### Module Not Found
- Missing dependency: run `npm install` or `pnpm install`
- Wrong import path: check case sensitivity and file extensions
- Alias misconfigured: check `tsconfig.json` paths and bundler alias config

### Type Errors
- Missing type definitions: `npm install -D @types/xxx`
- API response shape mismatch: check API types vs component expectations
- Nullable access: add optional chaining `?.` or null checks

### Runtime Errors
- Hydration mismatch (SSR frameworks): ensure server/client render same content
- Missing environment variables: check `.env` files
- API endpoint not available in dev: check proxy config or mock setup
