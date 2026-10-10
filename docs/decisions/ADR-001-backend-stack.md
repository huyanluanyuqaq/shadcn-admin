# ADR-001 — 后端技术栈选型：Hono + Drizzle + SQLite + JWT

## Status

```yaml
Status: Accepted
Date: 2026-10-09
Deciders: Architect
Supersedes: 无
Superseded by: 无
```

**状态说明：** Accepted —— 已于 2026-10-09 获人类确认（后端选型、移除 Clerk 改 JWT、
`server/` + `shared/` 并列目录三项一并确认），可进入实施。

---

## Context

基座仓库 `shadcn-admin` 为**纯前端 SPA**（Vite 8 + React 19 + TanStack Router + Tailwind 4），
数据来自 `@faker-js/faker` mock，认证依赖 Clerk（SaaS），部署形态为 Netlify 静态托管。

二次开发目标是一套**可 `docker compose` 自托管**的用户订阅管理系统，
覆盖订阅管理、客户管理、邮箱管理、仪表盘、通知、日志、套餐。

因此必须为该系统从零引入服务端与持久层。约束条件：

1. 部署形态要求**单机自托管、离线可运行** —— 排除任何 SaaS 托管依赖。
2. 前端已确立 TypeScript + zod 技术体系 —— 后端应与之共享类型与校验规则。
3. 目标用户为运营者本人，系统写入量低（人工 CRUD + 定时同步），无高并发写场景。
4. 基座已是上游 fork，改造应尽量保持目录结构稳定，以便未来同步上游。

---

## Problem

在「单机自托管、低并发写、与既有 TS 前端共享类型」的约束下，应选择哪套后端技术栈？

**展开：**

- 需要 HTTP 框架、ORM、数据库、认证四项的选型结论。
- 选型直接决定 Docker 镜像体积、构建时长、运维复杂度与未来可扩展性。
- 若不先决策即开工，将在模块开发到一半时出现技术栈返工。

---

## Decision

采用 **Hono（Node runtime）+ Drizzle ORM + SQLite（better-sqlite3）+ 自建 JWT（jose + bcryptjs）**，
以**单容器**形态部署，Hono 同时提供 REST API 与前端静态托管。

**具体做法：**

1. 新增 `server/` 目录承载 Hono 应用，新增 `shared/` 目录承载前后端共享的 zod schema 与类型。
2. 使用 Drizzle 定义 schema 并生成迁移 SQL，纳入版本管理。
3. SQLite 数据文件置于 `/app/data/app.db`，通过 docker bind mount 持久化，启用 WAL 模式。
4. 认证采用自建 JWT：登录签发、中间件校验、密码用 bcryptjs 哈希存储。
5. 单容器内 Hono 挂载 `/api/*` 路由与 `/*` 静态资源（含 SPA fallback），不引入反向代理。

---

## Alternatives

### 方案 A — NestJS + TypeORM + PostgreSQL

- **描述：** 企业级全栈框架 + 重量级 ORM + 独立数据库容器。
- **优点：** 架构约束强、模块边界清晰、生态成熟、团队协作友好。
- **缺点：** 需额外 `db` 容器与运维；NestJS 装饰器体系与前端 zod 体系割裂；镜像体积与启动时间显著增加；对单人维护的自托管系统是过度设计。
- **未采纳原因：** 与「单机自托管、低并发写」的目标不匹配，运维成本远大于收益。

### 方案 B — Express + Prisma + SQLite

- **描述：** 最主流的 Node 组合，保留 SQLite。
- **优点：** 生态最大、文档最多、招人容易。
- **缺点：** Express 为 JS 优先，类型体验依赖大量 `@types` 与断言；Prisma 需代码生成步骤与独立引擎二进制，Docker 构建时间与镜像体积明显增加。
- **未采纳原因：** 与既有 TypeScript + zod 体系的类型共享能力弱于 Hono + Drizzle，且 Prisma 在容器化构建上代价更高。

### 方案 C — Serverless 边缘方案（Hono on Cloudflare Workers + D1）

- **描述：** 前端 Vercel + 后端 Cloudflare Workers + D1 数据库。
- **优点：** 零运维、全球加速、按需计费。
- **缺点：** **无法满足 `docker compose` 自托管部署这一硬性需求**；数据托管在第三方平台。
- **未采纳原因：** 与目标部署形态直接冲突。

### 方案 D — 不做变更（Do Nothing）

- **描述：** 保留纯前端 + mock 数据形态。
- **优点：** 无开发成本。
- **缺点：** 无持久层、无真实业务能力，刷新即丢失数据，无法交付「订阅管理系统」。
- **未采纳原因：** 不满足需求。

---

## Consequences

### 正面

- 单容器 `docker compose up -d` 即可运行，无外部服务依赖，可完全离线。
- 前后端共享 TypeScript 类型与 zod schema，接口变更在编译期即可发现。
- Hono 与 Drizzle 均为轻量库，镜像体积小、构建快、冷启动快。
- SQLite 单文件便于备份（直接复制文件）与迁移。

### 负面

- SQLite 并发写能力弱于 PostgreSQL；多实例横向扩展需先迁库。
- 需自建认证与会话管理（Clerk 原本免费提供），引入安全实现责任。
- 定时任务在单容器内运行，容器重启期间任务不执行。
- `server/` 的测试体系需从零建立。

### 中性 / 需要注意

- SQLite → PostgreSQL 的迁移路径已预留（Drizzle 多 dialect），但需调整列类型与 compose 配置，代价可控而非零。
- 单管理员模型已足够（用户确认「用户管理 = 订阅客户管理」），`admins` 表保留未来扩展角色的空间，首期不实现 RBAC。

---

## Risks

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|-------|------|---------|
| SQLite 并发写锁导致写失败 | 低 | 中 | 启用 WAL 模式；写入集中在人工操作场景；监控告警 |
| 自建 JWT 实现出现安全缺陷 | 中 | 高 | 使用成熟库（`jose` / `bcryptjs`）；涉及认证的变更强制 Security 角色审查 |
| 未来需迁 PostgreSQL | 中 | 中 | Drizzle 抽象已预留；迁移列为独立任务，不在首期引入 |
| 共享目录 `shared/` 引入构建复杂度 | 中 | 低 | 通过 tsconfig path alias + Vite alias 解决，不引入 workspace |

---

## References

- [架构总览](../architecture/overview.md)
- [ADR-002 移除 Clerk，改用自建 JWT](./ADR-002-remove-clerk-use-jwt.md)
- 项目 `AGENTS.md` §3 技术栈、§13 Agent Notes
