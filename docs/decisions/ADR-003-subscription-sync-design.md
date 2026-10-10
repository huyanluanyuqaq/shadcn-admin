# ADR-003 — 订阅同步设计：参照 sublinkPro，调度入库 + HEAD 优先 + 批量事务

## Status

```yaml
Status: Accepted
Date: 2026-10-09
Deciders: Architect
Supersedes: 无
Superseded by: 无
```

**状态说明：** Accepted —— 已于 2026-10-09 获人类确认（用户指示参照 sublinkPro 实现），
可进入实施。

---

## Context

用户指示：本项目「订阅链接拉取更新」参照
[sublinkPro](https://github.com/ZeroDeng01/sublinkPro)（Go + React，1.6k stars，MIT）实现。

已完成的调研结论（2026-10-09，源码级）：

- 调度：`robfig/cron/v3`，**每机场一条独立 job**，`CronExpr` 存数据库，支持热重载。
- 拉取：`http.Client{Timeout: 10s}`，**HEAD 优先**，失败或非 2xx 回退 GET；UA 默认 `clash.meta`。
- 解析：读响应头 `subscription-userinfo`。
- 入库：单条 `UpdateUsageInfo`；通过 `changedNodeIDs` 做**增量对比**。
- 后处理：异步打标签；可选「更新后测速」且 `ChangedOnly` 只测变化节点。
- 失败通知：`notifications.Publish("subscription.sync_failed")`。
- SQLite DSN：`_busy_timeout=5000` / `_journal_mode=WAL` / `_synchronous=NORMAL` /
  `_cache_size=-64000` / `_foreign_keys=ON`。

同时确认了 sublinkPro 的**三个设计缺口**：

1. `BatchUpdateAirportUsage` 无限 goroutine，**无并发上限**；
2. **无 `SkipIfStillRunning`**，任务可能重叠；
3. **无 jitter**，cron 表达式相同时惊群。

本项目的运行环境与 sublinkPro 不同：Node 单线程 + `better-sqlite3` **同步 API**，
无 goroutine 与连接池，因此不能照搬，需按其特性加严。

---

## Problem

在「Node + better-sqlite3 同步 API、单容器、数百至数千订阅定时同步」的约束下，
订阅拉取更新应如何设计调度、拉取与写入，才能保证既不大面积阻塞服务、也不打满上游？

**展开：**

- 需确定：cron 表达式存放位置、调度器选型、并发模型、写入事务边界、失败处理。
- 需明确：sublinkPro 的哪些做法可直接采纳，哪些必须修正。
- 结论需落到数据模型（字段）与代码约束（C1–C9），否则实施时会退化。

---

## Decision

**采纳 sublinkPro 的整体链路与设计细节，在其三个缺口处加严，并按 Node/SQLite 特性调整写入模型。**

### 采纳项

1. **Cron 表达式入库**：`subscriptions.cron_expr` 每条订阅自持，调度器逐条注册 job，
   提供热重载接口（改库即生效，无需重启）；执行后回写 `last_run_at` / `next_run_at`。
2. **HEAD 优先回退 GET**：先发 `HEAD` 读 `subscription-userinfo`；非 2xx 或头部缺失时回退 `GET`。
   理由：单次流量从数十 KB 降至数百字节，是数百订阅规模下最直接的带宽优化。
3. **增量对比**：仅当 `upload` / `download` / `total` / `expire` 发生变化时才写库并触发通知，
   避免每轮全量空转。
4. **SQLite 参数**：`busy_timeout=5000` + `WAL` + `synchronous=NORMAL` +
   `cache_size=-64000` + `foreign_keys=ON`（与 sublinkPro 一致，已生产验证）。
5. **失败通知**：同步失败写 `logs` 并触发通知渠道。

### 修正项（sublinkPro 的缺口）

6. **并发上限 `CONCURRENCY`**（默认 5，可配）：分批 `Promise.allSettled`，替代其无限 goroutine。
7. **单飞锁**：同一订阅未跑完不得重入；全局批次亦加互斥标记。
8. **jitter**：定时触发叠加 0–10 分钟随机延迟，避免惊群。

### 平台适配项

9. **写入模型与 sublinkPro 不同**：其多 goroutine 依赖连接池（MaxOpen=100）；
   本项目为 Node 单线程 + `better-sqlite3` 同步 API，**单连接即可，不引入连接池**。
   所有写入必须合并为**单个事务**（1 次 fsync），而非其逐条 `UpdateUsageInfo`。
10. **事务内禁止网络 IO**：`better-sqlite3` 的 `db.transaction()` 回调必须为同步函数，
    该 API 约束天然保证「拉取与写入在时间上分离」，实现时应依赖它而非绕过它。
11. **代理出口不用 mihomo**：sublinkPro 将 mihomo 作为 Go 库嵌入并注入 `DialContext`；
    本项目改用 undici `ProxyAgent` + `PROXY_URL` 环境变量即可，**镜像内不安装 mihomo 二进制**。

### 数据模型补充（`subscriptions` 表）

`cron_expr` · `last_run_at` · `next_run_at` · `sync_status` · `last_error` ·
`user_agent` · `headers(json)` · `skip_tls_verify` · `proxy_url`

对应 sublinkPro `airports` 表的 `CronExpr` / `RequestHeaders` / `InsecureSkipVerify` / `ProxyLink`。

---

## Alternatives

### 方案 A — 全局单一 cron，每轮全量遍历所有订阅

- **描述：** 一个 `0 */6 * * *` 任务，遍历全部订阅批量拉取。
- **优点：** 实现最简单，调度器只需一个 job。
- **缺点：** 无法按订阅定制频率；全量遍历下并发与惊群问题集中在同一时刻爆发；
  单条链接拖慢整轮。
- **未采纳原因：** sublinkPro 的「每对象独立 cron」已被生产验证更灵活，且天然错峰。

### 方案 B — 完整照搬 sublinkPro（含无限并发 + 连接池 + 逐条写）

- **描述：** 在 Node 侧 1:1 复刻其实现。
- **优点：** 与参照项目行为完全一致，便于对照排查。
- **缺点：** 无限并发在 Node 上会打满上游；逐条写在 `better-sqlite3` 同步 API 下
  造成 N 次 fsync 与 N 倍事件循环阻塞；连接池在 Node 单线程下无意义。
- **未采纳原因：** 运行模型不同（Go 多 goroutine vs Node 单线程同步 DB API），照搬会把
  sublinkPro 的缺口原样继承，并叠加 better-sqlite3 特有的阻塞问题。

### 方案 C — 引入外部任务队列（BullMQ + Redis）

- **描述：** 用 Redis 队列做调度、重试、限流与并发控制。
- **优点：** 能力最完整：持久化任务、重试退避、速率限制、可观测性开箱即用。
- **缺点：** **需额外 Redis 容器**，与「单容器 `docker compose up` 自托管」目标冲突；
  运维复杂度与内存占用显著上升。
- **未采纳原因：** 与 ADR-001 确定的单容器形态冲突，属过度设计。

### 方案 D — 不在服务端调度，由外部 cron / 系统 crontab 触发

- **描述：** 暴露 `POST /api/subscriptions/sync` 手动端点，由宿主 crontab 或外部调度器调用。
- **优点：** 服务端无调度逻辑，容器可无状态。
- **缺点：** 部署说明需额外配置宿主 crontab，**破坏「`docker compose up` 即可用」的目标**；
  无法在 UI 中查看下次执行时间，可观测性差。
- **未采纳原因：** 与自托管易用性目标冲突。

---

## Consequences

### 正面

- 调度粒度到每条订阅，可按需定制频率，改库即生效，无需重启容器。
- HEAD 优先使定时拉取的带宽消耗下降约两个数量级。
- 增量对比避免无意义的写入与通知风暴。
- 并发上限 + jitter + 单飞锁三者共同消除惊群与重叠，比参照项目更稳健。
- 单事务批量写入把 fsync 次数从 N 降为 1，避免事件循环长时间阻塞。
- 镜像内不含 mihomo 二进制，构建更快、体积更小。

### 负面

- 调度器需自行实现热重载与状态回写，比单一 cron 复杂。
- 单飞锁与并发上限需在代码层维护，增加实现与测试成本。
- HEAD 优先依赖上游正确实现；部分机场对 HEAD 响应不一致，需回退逻辑兜底（已纳入设计）。
- 定时任务在容器内运行，容器重启期间任务不执行，重启后需重新注册全部 job。

### 中性 / 需要注意

- 若未来订阅量增长到需要多实例水平扩展，SQLite 需迁移至 PostgreSQL（判据见架构 §10.6），
  届时单飞锁需从进程内标记改为数据库层或分布式锁。
- 「更新后测速」与「自动打标签」属 sublinkPro 的后处理特性，本项目首期不实现，保留扩展位。

---

## Risks

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|-------|------|---------|
| 实施时退回「事务内 await 网络 IO」写法 | 中 | 高 | 写入架构文档约束 C1，并以 `better-sqlite3` 同步事务 API 强制；Code Review 必查项 |
| 并发上限配置过大打满上游 | 中 | 中 | 默认 5，配置上限硬性约束在 1–20；叠加 jitter |
| 上游对 HEAD 无 `subscription-userinfo` | 中 | 低 | 回退 GET 路径已设计；失败记 `last_error` 并告警 |
| 容器重启后 job 未重新注册 | 低 | 中 | 启动时统一 `LoadFromDatabase()` 注册，并记录下次执行时间 |
| 单飞锁在异常退出下未释放 | 低 | 中 | 锁带时间戳与超时兜底，不依赖仅内存标记 |

---

## References

- [sublinkPro](https://github.com/ZeroDeng01/sublinkPro) — 参照实现（MIT）
  - `services/scheduler/manager.go` — cron 调度与热重载
  - `services/scheduler/subscription_task.go` — 同步任务与增量对比
  - `node/usage.go` — HEAD 优先拉取与 `subscription-userinfo` 解析
  - `database/sqlite.go` — SQLite PRAGMA 配置
- [架构总览 §10 订阅同步设计](../architecture/overview.md)
- [ADR-001 后端技术栈选型](./ADR-001-backend-stack.md)
- 工作区实证：`projects/business-manager`（concurrency=5 分批、事务不跨 IO，已生产运行）
