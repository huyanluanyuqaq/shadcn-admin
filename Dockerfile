# ---------------------------------------------------------------------------
# 用户订阅管理系统 —— 单容器部署
#
# 基础镜像选择说明（重要）：
# 使用 **Debian slim 而非 Alpine**。better-sqlite3 的预编译二进制基于 glibc，
# Alpine（musl）无法使用，会退化为源码编译，需要 python3 / make / g++，
# 构建耗时长且镜像更大。改用 node:22-bookworm-slim 可直接命中预编译包。
# ---------------------------------------------------------------------------

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# pnpm 版本与 .github/workflows/ci.yml 对齐（12.10.1）：pnpm 12 起不再读取
# package.json 的 pnpm 字段，且 onlyBuiltDependencies 列表语法已改为
# pnpm-workspace.yaml 的 allowBuilds 映射语法，版本漂移会导致安装行为不一致。
RUN corepack enable && corepack prepare pnpm@12.10.1 --activate
WORKDIR /app

# ---- 依赖层：先装依赖，利用 Docker 缓存 ----
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
# 构建脚本必须执行：better-sqlite3 需要 prebuild-install 拉取预编译二进制
RUN pnpm install --frozen-lockfile

# ---- 构建层 ----
FROM deps AS build
COPY . .
# shared 必须先构建：后端消费其 dist 产物
RUN pnpm --filter @repo/shared build
RUN pnpm --filter server build
RUN pnpm build

# ---- 运行层：仅保留生产依赖与产物 ----
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/drizzle ./server/drizzle
COPY --from=build /app/dist ./client/dist

ENV PORT=3000
ENV DATABASE_URL=/app/data/app.db
EXPOSE 3000

VOLUME ["/app/data"]

# 启动时先应用数据库迁移，再启动服务
CMD ["sh", "-c", "node server/dist/db/migrate.js && node server/dist/index.js"]
