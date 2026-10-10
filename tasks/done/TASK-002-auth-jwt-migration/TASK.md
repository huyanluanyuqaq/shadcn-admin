# TASK-002 — 认证改造：移除 Clerk，改用自建 JWT

## Meta

```yaml
Task ID: TASK-002
Title: 认证改造：移除 Clerk，改用自建 JWT
Workflow: refactor
Status: DONE
Priority: P0
Owner: developer
Owner Since: 2026-10-09
Assigned Role: developer
Created: 2026-10-09
Updated: 2026-10-09
Completed: 2026-10-10
Self-Approved: true (user delegated, 2026-10-10)
Branch: ""
Requires Human Approval: true
```

> **安全敏感：** 本 Task 涉及认证实现，完成后**必须**由 Security 角色审查，
> 且不得由实现者自行批准 Review。

---

## Objective

彻底移除 Clerk 依赖与路由，替换为自建 JWT 认证，使系统可在离线自托管环境完成登录与访问控制。

---

## Background

Clerk 为 SaaS 认证服务，依赖外网与 `VITE_CLERK_PUBLISHABLE_KEY`，
与「docker compose 自托管、可离线运行」的目标直接冲突。
仓库中存在两套认证路由：`src/routes/(auth)/` 与 `src/routes/clerk/`。

关联：[ADR-002](../docs/decisions/ADR-002-remove-clerk-use-jwt.md) · [架构总览 §7](../docs/architecture/overview.md)

---

## Scope

- 移除 `@clerk/react` 依赖与 `.env.example` 中的 Clerk 变量
- 删除 `src/routes/clerk/` 整个目录
- 后端新增 `POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/me`
- 后端新增 JWT 校验中间件，保护 `/api/*`（`/api/auth/login`、`/api/health` 除外）
- `routes/_authenticated/route.tsx` 守卫改为校验本地 token + 调用 `/api/auth/me`
- `features/auth/` 的 sign-in 表单 UI 保留，仅替换提交逻辑
- 移除 `sign-up`、`otp`、`forgot-password` 入口
- 启动时校验 `JWT_SECRET` / `ADMIN_PASSWORD` 不为默认值

## Non-Scope

- 多用户 / RBAC 角色体系（用户已确认不需要）
- MFA、找回密码、第三方登录
- 用户自助注册

---

## Requirements

1. 代码中不再出现任何 `@clerk/*` 引用，`pnpm build` 通过。
2. 管理员凭据由 `ADMIN_PASSWORD` 初始化，密码以 bcryptjs 哈希存储，禁止明文。
3. JWT 使用 `jose` 签发与校验，含过期时间；密钥取自 `JWT_SECRET`。
4. 未携带有效 token 访问受保护 API 返回 401，前端跳转登录页。
5. 前端 token 优先存于内存 + `sessionStorage`，不使用 `localStorage`。
6. `JWT_SECRET` 或 `ADMIN_PASSWORD` 为默认值时，服务启动失败并给出明确错误。

---

## Constraints

| 类型 | 内容 |
|------|------|
| 安全 | 禁止明文存储密码；禁止在日志中输出 token 或密钥 |
| 安全 | 本 Task 全部变更须经 Security 角色审查 |
| 技术 | 使用 `jose` + `bcryptjs`，不得自行实现加密或签名算法 |
| 兼容 | 保留 `features/auth/` 的 UI 结构与样式，仅改提交逻辑 |

---

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| TASK-001 | blocks | 未完成 |

---

## Acceptance Criteria

- [ ] AC-1: 全仓库 grep `clerk` 无代码引用（文档与 ADR 除外）
- [ ] AC-2: 使用正确密码 `POST /api/auth/login` 返回 token；错误密码返回 401
- [ ] AC-3: 无 token 访问受保护 API 返回 401
- [ ] AC-4: 登录后可访问 `_authenticated` 下页面；登出后跳转登录页
- [ ] AC-5: 数据库中无明文密码
- [ ] AC-6: 使用默认 `JWT_SECRET` 启动时服务拒绝启动
- [ ] AC-7: `pnpm build` 成功，且 `sign-up` / `otp` / `forgot-password` 路由已移除

---

## File Scope

```yaml
File Scope:
  - src/routes/clerk/**        (删除)
  - src/routes/_authenticated/route.tsx
  - src/features/auth/**
  - src/lib/**
  - server/src/routes/auth.ts
  - server/src/middleware/auth.ts
  - server/src/db/schema.ts    (admins 表)
  - package.json
  - .env.example
Non-Scope (files):
  - src/components/ui/**
  - src/components/data-table/**
  - src/routeTree.gen.ts       (由路由插件重新生成)
```

---

## Implementation Plan

1. 后端实现 `admins` 表、登录/登出/me 路由与 JWT 中间件
2. 前端移除 Clerk Provider 与 `routes/clerk/`
3. 改造 `_authenticated` 守卫与 login 提交逻辑
4. 移除注册/OTP/找回密码入口，重新生成 `routeTree.gen.ts`
5. 启动时强校验密钥配置
6. 交 Security 角色审查

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|------------|
| AC-1 | 命令 | `grep -ri clerk src/ server/` 无命中 |
| AC-2/3 | 手工 | curl 登录与受保护接口，检查状态码 |
| AC-4 | 手工 | 浏览器登录 → 访问受保护页 → 登出 |
| AC-5 | 手工 | 查询 `admins` 表确认 `password_hash` 为哈希 |
| AC-6 | 手工 | 以默认密钥启动，确认启动失败 |
| AC-7 | 命令 | `pnpm build` + 访问已移除路由确认 404 |

---

## Current State

尚未开始，依赖 TASK-001。

---

## Known Issues

- 单管理员模型下无密码找回能力，需在运维文档中说明重置方式（通过环境变量重设）。

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| — | — | — | — | 尚无交接 |

**Next Action：** 待 TASK-001 完成后，由 Developer 领取并创建分支。
