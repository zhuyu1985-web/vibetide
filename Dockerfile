# 未使用 # syntax=docker/dockerfile:1，以免 BuildKit 从 Docker Hub 拉取前端镜像
# （国内/内网常连不上 registry-1.docker.io，会在 resolve image config 一步超时失败）。
#
# Vibetide — Next.js 16 生产镜像（standalone）
#
# 四个与 Supabase 相关的变量：
#   DATABASE_URL                  → 运行时：直连 Postgres（自托管 Supabase 的 db 即可）
#   SUPABASE_SERVICE_ROLE_KEY     → 运行时：Storage 等服务端调用
#   NEXT_PUBLIC_SUPABASE_URL      → 构建时写入浏览器侧；改值须重建镜像
#   NEXT_PUBLIC_SUPABASE_ANON_KEY → 构建时写入浏览器侧；改值须重建镜像
#
# 构建示例（内网需换 NPM 源时可加）：
#   docker build \
#     --build-arg NPM_REGISTRY=https://你的内网npm镜像/ \
#     --build-arg NEXT_PUBLIC_SUPABASE_URL=https://api.example.com \
#     --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci... \
#     -t vibetide:latest .
#
# 运行示例：
#   docker run --rm -p 3000:3000 \
#     -e DATABASE_URL='postgresql://postgres:PASS@host:5432/postgres' \
#     -e SUPABASE_SERVICE_ROLE_KEY='eyJhbGci...' \
#     -e AUTH_SESSION_SECRET='至少32字符的随机串' \
#     vibetide:latest
#
# 说明：NEXT_PUBLIC_* 由 Next.js 在 pnpm build 时注入客户端 bundle；
#       运行时再通过 -e 设置同名变量无法更新已打包的前端 JS，只能重建。

FROM cmc-tcr.tencentcloudcr.com/ops/node22:1.0 AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

ENV NEXT_TELEMETRY_DISABLED=1

# ─── 依赖 ─────────────────────────────────────────────────
FROM base AS deps
# pnpm 与依赖安装默认走 npmmirror（国内直连 registry.npmjs.org 常超时）
ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV NPM_CONFIG_REGISTRY=${NPM_REGISTRY}
WORKDIR /app
RUN npm install -g pnpm@10.32.0
COPY package.json pnpm-lock.yaml ./
ENV HUSKY=0
RUN pnpm install --frozen-lockfile

# ─── 构建 ─────────────────────────────────────────────────
FROM base AS builder
ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV NPM_CONFIG_REGISTRY=${NPM_REGISTRY}
WORKDIR /app
RUN npm install -g pnpm@10.32.0
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}

ENV NODE_ENV=production
# 大项目（Next 16 + 1200+ deps）默认 V8 堆 ~1.5GB 容易 OOM 导致 BuildKit rpc EOF
ENV NODE_OPTIONS="--max-old-space-size=6144"
RUN pnpm run build

# ─── 运行 ─────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
