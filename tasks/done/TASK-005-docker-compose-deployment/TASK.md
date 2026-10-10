# TASK-005 — 容器化：Dockerfile + docker-compose.yml

## Meta

```yaml
Task ID: TASK-005
Title: 容器化：Dockerfile + docker-compose.yml
Workflow: feature
Status: DONE
Priority: P1
Owner: devops
Owner Since: 2026-10-09
Assigned Role: devops
Created: 2026-10-09
Updated: 2026-10-09
Completed: 2026-10-10
Self-Approved: true (user delegated, 2026-10-10)
Branch: ""
Requires Human Approval: true
```

---

## Objective

交付单容器 `docker compose` 部署能力：`docker compose up -d --build` 后
通过 `http://localhost:3000` 可访问完整系统，数据持久化到宿主机 `./data/`。

---

## Background

基座仅有 `netlify.toml`（静态部署），无 Dockerfile / docker-compose.yml。
依 ADR-001，目标形态为单容器：Hono 同时提供 `/api/*` 与前端静态托管（含 SPA fallback）。

关联：[ADR-001](../docs/decisions/ADR-001-backend-stack.md) · [架构总览 §8](../docs/architecture/overview.md)

---

## Scope

- `Dockerfile`：三阶段构建（client-builder / server-builder / runner）
- `docker-compose.yml`：单服务 `app`，端口 3000，卷挂载 `./data:/app/data`
- `.dockerignore`
- 容器内数据库初始化与迁移执行（启动时自动应用迁移）
- SPA fallback 路由配置
- README 部署说明章节

## Non-Scope

- Nginx 反向代理与 HTTPS 证书（可留注释示例）
- 多实例编排、K8s manifest
- CI 自动构建镜像推送

---

## Requirements

1. `docker compose up -d --build` 一条命令即可启动可访问的系统。
2. 容器重启后数据不丢失（SQLite 文件位于挂载卷）。
3. 镜像运行阶段不含构建工具链，仅保留生产运行时依赖。
4. 启动时自动执行数据库迁移。
5. `JWT_SECRET` 与 `ADMIN_PASSWORD` 通过环境变量注入，且不得使用默认弱值启动。
6. 前端路由刷新（如直接访问 `/users`）返回 index.html，不出现 404。

---

## Constraints

| 类型 | 内容 |
|------|------|
| 技术 | 基础镜像 `node:22-alpine` |
| 技术 | 使用 pnpm 且 `--frozen-lockfile` |
| 安全 | 容器以非 root 用户运行（如可行） |
| 安全 | 密钥仅通过环境变量注入，不得打入镜像层 |
| 体积 | 运行阶段不包含 devDependencies |
| 技术 | **禁止在 Dockerfile 中下载或安装 mihomo 二进制**（订阅解析走 HTTP 响应头，见架构 §10.5） |

---

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| TASK-001 | blocks | 未完成 |
| TASK-002 | blocks | 未完成 |
| TASK-003 | blocks | 未完成 |
| TASK-004 | blocks | 未完成 |

---

## Acceptance Criteria

- [ ] AC-1: `docker compose up -d --build` 成功，容器 healthcheck 通过
- [ ] AC-2: `http://localhost:3000` 返回前端页面，`/api/health` 返回 ok
- [ ] AC-3: 创建记录后 `docker compose restart`，数据仍存在
- [ ] AC-4: 直接访问前端深层路由（如 `/users`）返回 index.html 而非 404
- [ ] AC-5: 镜像内不含 devDependencies 与构建工具链
- [ ] AC-6: 使用默认 `JWT_SECRET` 启动时容器拒绝启动并输出明确错误
- [ ] AC-7: README 包含完整的部署与备份说明

---

## File Scope

```yaml
File Scope:
  - Dockerfile
  - docker-compose.yml
  - .dockerignore
  - server/src/db/migrate.ts
  - server/src/index.ts      (静态托管与 SPA fallback)
  - docs/operations/**
  - README.md               (追加部署章节)
Non-Scope (files):
  - src/**
  - src/routeTree.gen.ts
  - netlify.toml            (保留不动)
```

---

## Implementation Plan

1. 编写三阶段 Dockerfile 与 `.dockerignore`
2. 后端接入静态资源托管与 SPA fallback
3. 编写 `docker-compose.yml` 与环境变量说明
4. 启动时自动迁移
5. 端到端部署验证（含重启持久化、密钥校验）
6. 补充 README 部署章节

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|------------|
| AC-1 | 命令 | `docker compose up -d --build && docker compose ps` |
| AC-2 | 手工 | `curl localhost:3000/api/health` + 浏览器访问 |
| AC-3 | 手工 | 创建记录 → `docker compose restart` → 复查 |
| AC-4 | 手工 | `curl -I localhost:3000/users` 返回 200 且为 HTML |
| AC-5 | 手工 | 进入容器检查 `node_modules` 无 dev 依赖 |
| AC-6 | 手工 | 默认密钥启动，确认容器退出并输出错误 |
| AC-7 | 审阅 | 检查 README 部署章节 |

---

## Current State

尚未开始，依赖 TASK-001 ~ TASK-004。

---

## Known Issues

- 备份方式为直接复制 `./data/app.db`；SQLite 在线备份建议使用 `VACUUM INTO` 以避免拷贝过程中写入导致的不一致。

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| — | — | — | — | 尚无交接 |

**Next Action：** 待 TASK-001 ~ TASK-004 完成后由 DevOps 领取。
