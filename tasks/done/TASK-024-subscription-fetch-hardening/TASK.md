# TASK-024 — 订阅拉取健壮性：dispatcher 池化复用 + 缺头错误带诊断现场

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-024
Title: 订阅拉取健壮性：dispatcher 池化复用 + 缺头错误带诊断现场
Workflow: feature
Status: DONE
Priority: P1
Owner: workbuddy
Owner Since: 2026-10-12
Assigned Role: developer
Created: 2026-10-12
Updated: 2026-10-12
Branch: feat/TASK-024-subscription-fetch-hardening
Requires Human Approval: false
```

---

## Objective

修复生产排查（2026-10-12）中暴露的两个订阅拉取缺陷：

1. `buildDispatcher` **每次请求都新建** `Agent`/`ProxyAgent`——无连接池、无 TLS
   会话复用；实测部分 Cloudflare 上游对全新连接的请求不返回
   `subscription-userinfo` 头，而池化的全局 dispatcher 正常返回。改为
   **模块级缓存、按 `(proxyUrl, skipTlsVerify)` 键复用**。
2. 「响应缺少 subscription-userinfo 头」错误**不带任何现场信息**，无法区分
   「上游真不支持」与「拿到了 HTML 错误页/门户页」。补上**最终 HTTP 状态码、
   content-type、重定向后的 URL**。

---

## Background

生产机 fnubuntu 上一条订阅出现「预览/拉取成功、保存与立即同步失败」，
最终根因是该订阅记录 `skip_tls_verify=true`（用户已关闭，保存恢复）。
代码级机制：`skipTlsVerify=true` 时 `buildDispatcher` 返回**每次请求新建**的
`new Agent({ connect: { rejectUnauthorized: false } })`；false/缺省时不传
dispatcher，走 undici 全局 dispatcher（`new Agent()`，池化）。两条路径请求头、
URL、方法完全一致，唯一差别是 dispatcher——而该差异足以让 CF 上游改变响应。

附带问题：排查三轮才定位，因为缺头错误只有一句话，既无状态码也无 content-type
（token 失效返回 HTML 门户页与真缺头表现完全相同）。

---

## Scope

- `server/src/services/subscription-parser.ts`：
  - `buildDispatcher` 改模块级 `Map` 缓存（键 = `proxyUrl` + `skipTlsVerify`），
    Agent/ProxyAgent 复用；ProxyAgent 构造失败仍返回 undefined（行为不变）
  - 缺头错误信息追加 `（HTTP <status>, content-type: <ct>, url: <final-url>）`
- `server/scripts/smoke.ts`：mock 上游新增 `/nouserinfo`（200 但不返回用量头），
  断言同步失败且 error 含状态码 / content-type / URL 三段诊断信息
- `docs/architecture/overview.md`：§10.5 后补一小节说明 dispatcher 复用与
  缺头错误诊断口径（TASK-024）

**不在范围**：UA 自动重试（证据不足，未采纳）、`/preview` 实时路径透传订阅
配置（独立问题，另案）、前端与数据库（无 schema 变更、无迁移）。

---

## Acceptance Criteria

- [x] `skipTlsVerify=true`（含配代理）的订阅拉取复用同一 dispatcher 实例，
      不再每次请求新建（代码审查 + 冒烟行为不变）
- [x] 缺头失败时 `SyncResult.error` 含 `HTTP <status>`、`content-type`、
      重定向后 URL 三要素；上游非 2xx 的错误信息保持原样
- [x] `pnpm --filter server typecheck` / `pnpm lint` / `pnpm format:check` 全绿
- [x] 隔离冒烟通过，含新增 `/nouserinfo` 缺头用例（141 + 1 项）
- [x] 前端 `pnpm test` 无回归（本次不触前端，仍复跑确认）

---

## Constraints

- P5 最小改动：只动上述三个文件，不做顺带重构
- 错误文案是用户可见字符串（toast / lastError / 通知），改动需在冒烟中断言
- dispatcher 缓存无淘汰策略——现实中 `(proxyUrl, skipTlsVerify)` 组合只有
  寥寥数个，有界；如未来出现组合爆炸再议

---

## Changed Files

| 文件 | 改动 |
|------|------|
| `server/src/services/subscription-parser.ts` | dispatcher 模块级缓存；缺头错误带诊断信息 |
| `server/scripts/smoke.ts` | mock 上游 `/nouserinfo` 端点 + 缺头诊断信息断言 |
| `docs/architecture/overview.md` | §10.5 后新增 §10.8 dispatcher 复用与错误诊断说明 |

---

## Known Issues

- CF 上游对全新连接剥头的**具体判别逻辑无法从外部实定**（连接状态/TLS 会话
  评分仅为假设）；本任务以「池化对齐两条路径」应对，不试图解释 CF 侧。
- `/preview` 实时路径仍不透传订阅的 UA/代理配置（客户表单填了也不生效）——
  记录在案，另案处理。

---

## Handoff 记录

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 1 | workbuddy | human | 2026-10-12 | 实现+验证+归档完成，待人类批准合并推送 main |

---

## 验证记录

执行时间：2026-10-12（分支 `feat/TASK-024-subscription-fetch-hardening`，基线 main `c9af017`）

| 项 | 命令 | 结果 |
|----|------|------|
| Server 类型检查 | `pnpm --filter server typecheck` | ✅ |
| Lint | `pnpm lint` | ✅ |
| 格式 | `pnpm format:check` | ✅（All matched files use Prettier code style!） |
| 死导出 | `pnpm knip` | ✅ 22 项既有基线不变，`git diff main...HEAD` 零新增导出 |
| 单元/集成测试 | `pnpm test` | ✅ 214/214（18 文件） |
| 隔离冒烟 | 3002 实例 + `smoke-024.db` 快照 + mock 三通道 | ✅ 142 通过 / 0 失败（141 基线 + 1 新增） |

新增冒烟用例：mock 上游 `/nouserinfo`（200 + text/html 但不返回用量头）→ 同步
失败且 error 含 `subscription-userinfo` / `HTTP 200` / `text/html` / `/nouserinfo`
四要素。

冒烟后处理：3002 实例已停止，快照 `server/data/smoke-024.db`（含 -shm/-wal）
已删除，未污染 3000 真实数据。

---

## 合并前检查单

- [x] `pnpm test` 全绿（214/214）
- [x] `pnpm lint` / `pnpm format:check` 通过
- [x] `pnpm --filter server typecheck` 通过
- [x] 隔离冒烟通过（3002 实例 + mock 三通道，未污染 3000 真实数据）
- [x] 任务文档归档至 `tasks/done/`
- [ ] **人类批准后**：ff 合并 main + 推送 origin + 删分支

---

## Task Rules

- 遵循 P5 最小改动：不动前端、无 DB 迁移、不改 ADR-003 决策本身
- 冒烟用例必须断言错误文案的新格式（防止回归成光秃秃一句话）
