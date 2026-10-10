# ADR-002 — 移除 Clerk，改用自建 JWT 认证

## Status

```yaml
Status: Accepted
Date: 2026-10-09
Deciders: Architect
Supersedes: 无
Superseded by: 无
```

**状态说明：** Accepted —— 已于 2026-10-09 获人类确认，可进入实施。

---

## Context

基座仓库集成了 **Clerk**（`@clerk/react` 6.4.3）作为认证方案，存在两套认证路由：
`src/routes/(auth)/`（sign-in / sign-up / otp / forgot-password）与 `src/routes/clerk/`。

Clerk 是**第三方 SaaS 认证服务**，运行时需要外网访问与 `VITE_CLERK_PUBLISHABLE_KEY`。

而本项目的目标部署形态是 `docker compose` **单机自托管**，
使用场景包括内网 / 离线环境，且用户已确认不需要多用户自助注册。

---

## Problem

Clerk 的 SaaS 依赖与「自托管离线运行」的目标直接冲突，必须替换为自建认证。

**展开：**

- 离线环境下 Clerk 组件无法完成初始化，登录后页面不可用。
- 存在两套认证路由，状态与守卫逻辑分散，增加维护与替换成本。
- 单管理员场景下，Clerk 提供的注册、OTP、找回密码等能力全部冗余。

---

## Decision

移除 Clerk，改为**自建 JWT 认证**。

**具体做法：**

1. 移除依赖 `@clerk/react`，删除 `.env.example` 中的 `VITE_CLERK_PUBLISHABLE_KEY`。
2. 删除 `src/routes/clerk/` 整个目录。
3. 后端新增 `POST /api/auth/login`（bcryptjs 校验密码 → `jose` 签发 JWT）、
   `POST /api/auth/logout`、`GET /api/auth/me`；新增 JWT 校验中间件保护 `/api/*`。
4. `routes/_authenticated/route.tsx` 的守卫：由 Clerk 的 `<SignedIn>` 改为
   校验本地 token 并调用 `/api/auth/me` 确认有效性。
5. `features/auth/` 中 sign-in 页面的**表单与 UI 保持不动**，仅替换提交逻辑。
6. 移除 `sign-up`、`otp`、`forgot-password` 的入口（单管理员模式无自助注册）。
7. 管理员凭据由环境变量 `ADMIN_PASSWORD` 初始化，首次启动写入 `admins` 表。

---

## Alternatives

### 方案 A — 保留 Clerk，接受外网依赖

- **描述：** 继续使用 Clerk 托管认证。
- **优点：** 零实现成本，自带 MFA、找回密码、用户管理后台。
- **缺点：** 离线不可用；数据受第三方控制；与自托管目标根本冲突。
- **未采纳原因：** 与部署目标直接冲突，不可接受。

### 方案 B — Auth.js（NextAuth）凭证模式

- **描述：** 引入 Auth.js 的 Credentials Provider。
- **优点：** 社区方案，会话管理完善。
- **缺点：** 面向多租户会话场景设计，本系统为单管理员；配置项多，与 TanStack Router 集成需额外适配层。
- **未采纳原因：** 引入的抽象层级超出需求，属过度设计。

### 方案 C — 仅做 HTTP Basic Auth

- **描述：** 用反向代理或中间件的 Basic 认证保护整个站点。
- **优点：** 实现最简单。
- **缺点：** 无法在前端区分用户状态、无登出语义、凭据每次请求传输、无法扩展角色。
- **未采纳原因：** 无法满足前端需要「当前用户状态」与「登出」的交互需求。

---

## Consequences

### 正面

- 完全离线可用，无第三方依赖，符合自托管目标。
- 认证逻辑集中在一处，消除两套路由的割裂。
- 移除冗余页面（注册/OTP/找回密码），减少维护面。

### 负面

- 需自行保证 JWT 实现的安全性（密钥管理、过期策略、存储方式）。
- 失去 Clerk 免费提供的 MFA、风控、用户后台等能力。
- 移除 `sign-up` / `otp` / `forgot-password` 后，若未来需要多用户需重新引入。

### 中性 / 需要注意

- 前端 token 存储位置需在实现时确定（内存 + `sessionStorage` 优先于 `localStorage`，以降低 XSS 影响面）。
- `JWT_SECRET` 必须提供真实值；首期应强提示修改默认值，后续任务应改为缺失即拒绝启动。

---

## Risks

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|-------|------|---------|
| JWT 实现缺陷导致越权 | 中 | 高 | 使用成熟库；所有认证相关变更强制 Security 角色审查 |
| Token 存储位置不当导致泄露 | 中 | 中 | 优先内存 + sessionStorage；避免 localStorage |
| 密钥使用默认弱值 | 中 | 高 | 启动时校验 `JWT_SECRET` 与 `ADMIN_PASSWORD` 非默认值 |
| 移除页面后未来需回填 | 低 | 低 | Git 历史可追溯；届时作为独立任务重新设计 |

---

## References

- [ADR-001 后端技术栈选型](./ADR-001-backend-stack.md)
- [架构总览](../architecture/overview.md) §7 认证改造路径
