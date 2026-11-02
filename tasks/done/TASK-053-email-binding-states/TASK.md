# TASK-053 — 邮箱/供应商/订阅 绑定状态重构（新增邮箱面板 · 归属派生 · 自动归档）

## Meta

```yaml
Task ID: TASK-053
Title: 邮箱/供应商/订阅 绑定状态重构
Workflow: feature
Status: DONE
Priority: P1
Owner: 鼠鼠戴的工具人 (WorkBuddy)
Owner Since: 2026-11-01T21:00:00+08:00
Assigned Role: developer
Created: 2026-11-01T21:00:00+08:00
Updated: 2026-11-01T22:40:00+08:00
Branch: （未建分支；提交时按 .agents/rules/git.md 命名 feat/TASK-053-email-binding-states）
Requires Human Approval: false
```

## Objective

把「邮箱 / 供应商 / 订阅」三要素的绑定关系重构为**四态模型**，使邮箱管理与订阅管理各自
只承载自己该显示的记录，并让客户到期后自动归档回落。

## Background

2026-11-01 人类裁决序列（同日四轮）：

1. 「仅更换邮箱而链接不变」**不成立**；「仅更换链接而邮箱不变」只发生在链接被重置时，旧链接无需保留；
2. 三要素均唯一且强绑定；
3. 需要区分「三要素强绑定」与「仅邮箱+供应商两要素」两种状态；
4. 邮箱管理新增面板（三字段）；订阅有值即导入订阅管理并从邮箱管理移出；客户到期自动归档；
   未分配订阅被同步为已到期则回落邮箱管理；**同一邮箱可注册不同供应商，不算重复**。

## 状态模型（判定唯一依据：绑定行 + 订阅行，禁止从 customers 文本列反推）

| 态 | 名称 | 判定 | 归属页面 |
|----|------|------|----------|
| E1 | 仅注册 | `binding.subscription_id IS NULL` | 邮箱管理 |
| E2 | 待分配 | 有订阅、订阅 `customer_id IS NULL`、未到期（或到期未满 24h） | 订阅管理（未分配） |
| E3 | 在用 | 有订阅、订阅 `customer_id NOT NULL` | 订阅管理（有客户） |
| E4 | 到期回落 | 有订阅、`customer_id IS NULL`、`expire_at + 24h <= now` | 邮箱管理（订阅管理仍可见） |

迁移：∅→E1（仅注册）/ ∅→E2（填链接导入）/ E2→E3（分配客户）/ E3→E2（客户到期归档）/
E2→E4（订阅同步为已到期）。**E2↔E4 是纯展示派生，不写库**，这正是「三要素仍保持绑定」的落实方式。

两个时钟：**客户到期**看 `customers.expire_at`（触发归档，无宽限）；**订阅到期**看
`subscriptions.expire_at`（触发回落，+24h 宽限）。

## Scope

1. 邮箱唯一性由「全局」改为「按 `(邮箱, 供应商)`」——跨供应商可重复注册。
2. `GET /api/email-bindings` 增加固定归属条件（E1 ∪ E4），`total` 同步收敛。
3. 「新增邮箱」面板改为三字段（邮箱 / 订阅 / 供应商），供应商可下拉可手输并自动建档。
4. 客户到期自动归档定时任务（每日 04:00，语义与手动归档一致）。
5. 上述行为的接口文档同步更新。
6. **（第二轮增量）删除 TASK-052 的 `previousEmail` 迁移机制与响应字段 `migrated`**，
   并以两道守卫替代：前端「只换邮箱不改链接」拦截（R1）+ 服务端「同一订阅两个邮箱」409（R2）。
7. **（第二轮增量）订阅管理「分配」入口**：未分配行提供按钮 → 跳客户管理新建页并预填
   邮箱 / 订阅链接 / 供应商 → 保存后既有保存流按 URL 命中该订阅回填 `customerId`。

## Non-Scope

- 数据库 schema 变更（本轮无需迁移：唯一索引本就是 `(email, pool_id)`）。
- 「失效订阅彻底不可见」所需的订阅状态字段（人类裁决：旧订阅只解绑、不删除，不做特殊展示）。
- `email_bindings.pool_id` 收为 NOT NULL、`subscription_id` 的 CASCADE→SET NULL（模型级改动，待立项）。

## Acceptance Criteria

- [x] AC-1: 同一邮箱在**不同供应商**下可各注册一次客户，不返回 409。
- [x] AC-2: 同一邮箱在**同一供应商**下重复，返回 409 且提示含供应商名与占用客户名。
- [x] AC-3: `GET /api/email-bindings` 只返回 E1 与 E4；E2/E3、到期未满 24h、`expire_at` 为 NULL 的记录不返回，`total` 与列表一致。
- [x] AC-4: 新增邮箱面板仅三字段；供应商手输未命中时自动新建供应商（`url` 为空串）；订阅留空只写绑定行。
- [x] AC-5: 订阅填链接时先建订阅再挂绑定，保存后该记录不再出现在邮箱管理。
- [x] AC-6: 客户到期自动归档：删客户行、其订阅 `customer_id` 置空、该订阅的邮箱绑定保持不变。
- [x] AC-7: `/email-bindings/sync` 的入参 schema 已移除 `previousEmail`、响应不再含 `migrated`，迁移段已删除。
  残留的旧客户端若仍传 `previousEmail`，zod 按未知字段**静默忽略**（请求照常 200，**不**因此报 400），
  该字段不会被读取、也不会产生任何迁移效果——判定标准是「不生效」，不是「拒收」。
  旧邮箱记录在「换邮箱 + 换链接」后原样保留并指向旧订阅（脚本场景 1 覆盖）。
- [x] AC-8: 「同一订阅已挂另一邮箱」→ 同步返回 **409**，且不改动任何行（脚本场景 2 覆盖 5 项）。
- [x] AC-9: 客户表单「只换邮箱、链接未变」→ 阻止保存并提示；仅注册态（无链接）改邮箱放行（前端用例覆盖）。
- [x] AC-10: 订阅管理未分配行显示「分配」按钮；点击跳 `/customers` 并预填邮箱/链接/供应商；
  保存后该订阅按 URL 命中并回填 `customerId`（前端用例覆盖预填与回填两步）。

## File Scope

```yaml
Files:
  - server/src/routes/resources.ts          # 邮箱唯一性按供应商 + 邮箱列表归属条件 + 409 守卫 + 删除迁移段
  - server/src/lib/crud.ts                  # 新增 listCondition 选项
  - server/src/services/customer-archive.ts # 新增：到期归档扫描
  - server/src/services/scheduler.ts        # 注册每日归档任务
  - server/src/index.ts                     # 启动接线
  - server/scripts/email-binding-sync-check.ts
  - src/features/emails/components/emails-action-dialog.tsx
  - src/features/emails/queries.ts          # EmailBindingSyncInput 去掉 previousEmail
  - src/features/customers/components/customers-action-dialog.tsx   # R1 拦截 + prefill
  - src/features/customers/components/customers-action-dialog.test.tsx
  - src/features/customers/components/customers-dialogs.tsx         # 分配入口弹窗
  - src/features/customers/index.tsx                                # 读 search 参数
  - src/routes/_authenticated/customers/index.tsx                   # validateSearch
  - src/features/subscriptions/components/subscriptions-columns.tsx # 未分配行「分配」按钮
  - src/features/subscriptions/components/subscriptions-table.tsx   # 跳转与预填参数
  - docs/technical/api-contract.md
  - tasks/review/TASK-053-email-binding-states/TASK.md
Non-Scope (files):
  - server/src/db/**（无 schema 变更）
  - src/features/subscriptions/components/subscriptions-action-dialog.tsx（订阅表单同步逻辑不变，仅受 409 守卫影响）
```

## Verification Plan

| 验证项 | 方式 | 结果 |
|--------|------|------|
| AC-1~AC-3、AC-6~AC-8 | 服务端脚本 | `pnpm --filter server email-binding-check` → **37/37 通过** |
| AC-9、AC-10 | 前端用例 | `customers-action-dialog.test.tsx` → **30/30 通过**（全量 26 文件 / 342 用例） |
| 类型/静态 | 命令 | `tsc -b` / `typecheck:server` / `lint` / `knip` / `prettier --check .` 退出码全 `0` |
| AC-4、AC-5 | 浏览器手测（2026-11-01） | **通过**：内置浏览器真机点击，9 步全通，逐条证据见 Known Issues #3 |

## Current State

**Status = REVIEW（待独立审查）。** 四态模型已落库到代码与文档；自动化断言覆盖 AC-1~AC-3、AC-6~AC-8，
前端断言覆盖 AC-9、AC-10。`src/features/emails` 面板与「分配」跳转已于 2026-11-01 22:10 起
做浏览器手测并全部通过（证据见 Known Issues #3）。
TASK-052 的 `previousEmail` 迁移机制已在本轮删除（其 AC-6 语义被本任务取代，见 TASK-052 注记）。

## Changed Files

| 文件 | 改动 |
|------|------|
| `server/src/routes/resources.ts` | `beforeWrite` 改为按 `(邮箱, 供应商)` 唯一；`/email-bindings` 增 `listCondition`（E1 ∪ E4）；新增 `EMAIL_FALLBACK_GRACE_MS`；**删除 `previousEmail` 迁移段与 `migrated`，新增「同一订阅两个邮箱 → 409」守卫** |
| `server/src/lib/crud.ts` | 新增 `listCondition?: () => SQL \| undefined`，仅作用于列表与 `total` |
| `server/src/services/customer-archive.ts` | 新增：`runCustomerArchiveScan()`（含 `CUSTOMER_AUTO_ARCHIVE=false` 安全阀） |
| `server/src/services/scheduler.ts` | 新增每日归档任务（`CUSTOMER_ARCHIVE_CRON`，默认 `0 4 * * *`） |
| `server/src/index.ts` | 启动时注册归档任务 |
| `src/features/emails/components/emails-action-dialog.tsx` | 新建模式三字段 + `PoolCombobox`（可下拉可手输）；编辑模式保留原五字段 |
| `src/features/emails/queries.ts` | `EmailBindingSyncInput` 删除 `previousEmail`；JSDoc 改为「换邮箱必须换链接」 |
| `src/features/customers/components/customers-action-dialog.tsx` | 新增 R1 拦截（只换邮箱不改链接 → toast 并阻止提交）；新增 `prefill` 预填（依赖只取三个字符串，避免 reset 循环） |
| `src/features/customers/components/customers-dialogs.tsx` | 新增「分配」预填弹窗（由 search 参数驱动开关，不走 provider 的 toggle 语义） |
| `src/features/customers/index.tsx` | 读 `assignEmail/assignUrl/assignPoolId`，关闭时清参数 |
| `src/routes/_authenticated/customers/index.tsx` | 新增 `validateSearch`（三个分配参数） |
| `src/features/subscriptions/components/subscriptions-columns.tsx` | 未分配行渲染「分配」按钮（`onAssign` 由列工厂注入） |
| `src/features/subscriptions/components/subscriptions-table.tsx` | `onAssign` 跳 `/customers` 并带预填参数 |
| `server/scripts/email-binding-sync-check.ts` | 场景 1~4 重写（迁移相关断言全部替换）；场景 5~7 保留；共 37 项 |
| `docs/technical/api-contract.md` | 邮箱唯一性改口径；新增归属条件表与「新增邮箱」行为表；归档小节补充自动归档；sync 小节删除 `previousEmail`/`migrated` 并补 409 规则；三页一致性表改写 |

## Known Issues

1. ~~「分配」按钮未实施~~ → **已实施（AC-10）**。跳转走 `/customers?assignUrl=…`，保存后由
   `syncSubscription` 按 URL 命中回填 `customerId`。**已于 2026-11-01 浏览器实测全通**（见 #3）。
2. ~~TASK-052 的 `previousEmail` 迁移机制仍在~~ → **已删除（AC-7）**，并以 R1（前端拦截）
   + R2（服务端 409）两道守卫替代。**两处已知边界，均属刻意取舍而非疏漏**：
   - R1 只拦「原本有链接且链接未动」；仅注册态（无链接）改邮箱放行（此时若该邮箱名下有旧绑定，
     会留下一条与客户邮箱不一致的绑定行，但归属判定仍只读绑定行与订阅行，不影响两页归属）。
   - R2 在**订阅表单直接改邮箱**时同样会 409（该订阅 id 不变，服务端无从判断「链接是否也变了」）：
     订阅本身已保存、绑定保持旧邮箱，而该绑定行因归属为 E2/E3 已不在邮箱管理显示
     ⇒ **这条只能靠 API/库直接处理，UI 无法自解**。若实际业务里普遍存在「订阅表单改邮箱」，
     应改为「同订阅单条绑定随邮箱转移」（可行且不越界，但等于恢复改名能力），需人类另行裁决；
     **本轮按「服务端不得改名」执行，故保留 409**。
3. ~~面板未做浏览器验证~~ → **已手测通过（2026-11-01 22:10~22:35，内置浏览器 + 隔离快照库）**。
   环境：真实库 `VACUUM INTO` 快照 `E:/tmp/t053-manual.db`，`PORT=3000` + `pnpm dev`，`CUSTOMER_AUTO_ARCHIVE=false`；
   **真实库未被写入**。实测 9 步全通：
   - 点「供应商」→ 下拉展开，4 条既有供应商可见（`PopoverTrigger asChild → FormControl → Button` 未吞事件）；
   - 选既有供应商 → 按钮文案即时变为所选名称，下拉自动收起；
   - 输入不存在的名称 → 出现「新建供应商「X」」项，选中后回填；
   - 空表单直接保存 → 「邮箱不能为空」「供应商不能为空」红字分别落在对应字段下方，标签同步转红；
   - 点「供应商」标签后按空格 → 下拉打开（`FormLabel htmlFor` ↔ 控件 id 关联有效）；
   - 三字段填齐保存 → toast「已保存，并导入订阅管理」，弹窗关闭；**邮箱管理仍为空**（E2 已移出）、
     订阅管理出现「未分配」行（自动化断言之外的交互侧佐证）；
   - 该行「分配」→ 跳 `/customers?assignUrl=…&assignEmail=…&assignPoolId=…`，客户弹窗自动打开且
     邮箱 / 订阅链接 / 供应商三处均已预填；关闭弹窗后 URL 参数被清空（刷新不再弹）；
   - 补「名称 + 到期时间」再保存 → toast「客户已创建，订阅已同步到订阅管理…」，该订阅 `customer_id` 回填、
     行内「未分配」变客户名、「分配」按钮消失、邮箱管理仍为空（E3）；
   - 库层核对：新建供应商 `id=88`、订阅 `id=85`、绑定 `id=102` 三者指向一致，无孤儿行。
   **仍未覆盖**：其他浏览器与窄屏/移动端；下拉「按键打开」只验到「标签聚焦 + 空格」，
   Enter 单键开合因坐标落点无法定位而未取到可复现结论（不作判定）；触屏与读屏无验证。
4. **两次写入非原子**：新增邮箱时「建订阅」与「建绑定」是两次请求，中间失败会留下未挂邮箱的订阅，
   前端以 toast 提示、需人工补绑。彻底解决需服务端提供单事务保存接口（属契约变更）。

## Handoff

| # | From | To | Date | Summary |
|---|------|----|------|---------|
| 001 | developer | reviewer | 2026-11-01 | 按四态模型实施 AC-1~AC-6：邮箱唯一性改按供应商（8 项断言）、邮箱列表归属派生（2 项）、自动归档（5 项）；检查脚本 36/36，四项门禁退出码全 0。未实施「分配」跳转与 TASK-052 迁移机制清理，已在 Known Issues 载明。 |
| 002 | developer | reviewer | 2026-11-01 | 人类指示「先清 `previousEmail` 后门，再做分配跳转」，两项均完成：删除迁移段与 `migrated`（AC-7）、新增同订阅双邮箱 409（AC-8）、前端 R1 拦截（AC-9）、分配入口与预填（AC-10）。脚本 37/37，前端 30/30（全量 342），lint/knip/tsc/format 全 0。 |
| 003 | reviewer（独立实例） | developer | 2026-11-02 | 独立审查 **FAIL**：R1「一条订阅一个邮箱」大小写维度半实现（守卫用 `lower()`、upsert 定位用 `eq()`）⇒ 同订阅改邮箱大小写会落两行，可由正常 UI 触发；另 R2 文档把带订阅的旧记录称作「仅注册态」。见 `handoffs/2026-11-02-review.md` 第一节。 |
| 004 | reviewer（独立实例） | 人类 | 2026-11-02 | 第二轮复核 **PASS**（0 阻断）：`074e557`/`51b7c04`/`bee2610` 三轮修复后三处入口口径统一，行数 `1→1`、落库大小写未被改写，反向变异测试证明用例咬得住；N1~N4 已同批收口。见同文件第二节。 |

**最新 Handoff：** 004（独立复核 PASS，2026-11-02，`handoffs/2026-11-02-review.md` 第二节）
**Next Action：** 随 PR #27 合并后把 `Status` 置 `DONE` 并移入 `done/`；Merge Record 按 D13-C 由下一个任务回填
（与 TASK-052 / TASK-054 共享同一 `merge_commit_sha`）。

> 历史留档：002 交付时的 Next Action 要求独立审查重点核以下六项，已于 2026-11-02 由独立实例执行完毕
> （结论见 `handoffs/2026-11-02-review.md`）：① 四态判定与 `api-contract.md` 归属表逐字一致；
> ② `listCondition` 只作用于列表、不影响 `GET /:id` 与写入；③ 自动归档的删除语义与手动归档完全一致；
> ④ `previousEmail` 是否**彻底**消失（入参/响应/类型/文档/脚本五处）；⑤ R2 守卫在「换链接 + 换邮箱」时
> **不得**误报（同一订阅换链接即换订阅 id，不应撞 409）；⑥ 分配预填弹窗的开关不受 StrictMode 双跑影响。

## Merge Record

> 本节由 **TASK-055**（执行位）按 D13-C 选项 C 于 2026-11-02 实测回填。
> 原「未合并」说明已作废（本任务已随 PR #27 落地），替换为实测值。

| 要素 | 值 |
|------|-----|
| PR | [#27](https://github.com/huyanluanyuqaq/shadcn-admin/pull/27) `feat(TASK-054): 新增邮箱单事务落库（/email-bindings/bundle）+ 前端单次写请求` |
| 合并策略 | `rebase-merge`（实测：merge commit 只有 **1 个 parent** `b9f9879`，非双亲合并提交） |
| 提交数 | **9**（PR #27 全量；变更规模 `changed_files=29`。本任务与 TASK-052、TASK-054 **共用同一个 PR #27**，故三者的提交数/变更规模相同，无法按任务拆分） |
| merged_at | `2026-11-02T02:09:31Z` |
| merge_commit_sha | `2ca5d506d0c4f3da8b8d12bc72844c79aef7a2ab` |
| 合并后 CI run | `41376188754`（Continuous Integration，`event=push` `head_branch=main`，conclusion=**success**，`created_at=2026-11-02T02:09:34Z`） |
| 合并后 Docker run | `41376188853`（Build and Push Docker Image，`event=push` `head_branch=main`，conclusion=**success**，`created_at=2026-11-02T02:09:34Z`） |
| 镜像 tag | `sha-2ca5d50`（digest `sha256:0658ac254eeb76a547d26181f1cf7d000d8f96c3bd8fac6d15000732d63a9c16`，`tag_last_pushed=2026/11/2 2:13:44`） |
| 审查记录 | `handoffs/2026-11-02-review.md` —— **同一文件内含两节**：首轮 **FAIL**（阻塞项）+ 第二轮复核 **PASS**。两节均保留，未合并、未删除 |

**与 TASK-052 / TASK-054 同批落地**：本任务**没有独立的 PR 与 merge commit**，与另两份
**共用 PR #27 与同一个 `merge_commit_sha` `2ca5d50`**。原因：TASK-052/053 的改动此前只存在于
主工作区、从未提交，TASK-054 必须叠在其上实现，故三者一并交付。
**不得**把本行误读为三次独立合并。

**合并未推进 `latest`**：`latest` 至今仍为 `sha256:b6da326e15e41c9e…`，等于 `v1.0.7` =
`sha-e563800`（TASK-051 的合并产物），**不是**本任务的 `sha-2ca5d50`
（`sha256:0658ac254eeb76a5…`）。`docker.yml` 仅由 `v*` tag 触发（`AGENTS.md` §14.3）。

**复现命令**（每条均在 2026-11-02 于本仓实跑，输出即上表数值）：

```bash
gh api repos/huyanluanyuqaq/shadcn-admin/pulls/27 \
  --jq '{merged:.merged, merged_at:.merged_at, merge_commit_sha:.merge_commit_sha, commits:.commits, changed_files:.changed_files}'
gh api repos/huyanluanyuqaq/shadcn-admin/pulls/27/commits --jq 'length'      # → 9
gh api "repos/huyanluanyuqaq/shadcn-admin/actions/runs?head_sha=2ca5d506d0c4f3da8b8d12bc72844c79aef7a2ab&per_page=20" \
  --jq '.workflow_runs[] | {id:.id, name:.name, event:.event, head_branch:.head_branch, conclusion:.conclusion}'
git log --format="%H %P %s" -1 2ca5d506d0c4f3da8b8d12bc72844c79aef7a2ab
Invoke-RestMethod https://hub.docker.com/v2/repositories/nomorelatenights/subscription-admin/tags/sha-2ca5d50
Invoke-RestMethod https://hub.docker.com/v2/repositories/nomorelatenights/subscription-admin/tags/latest
```

### SHA 映射表（rebase-merge 改写前后的对应关系）

rebase-merge **改写了全部 SHA**：审查记录里引用的旧 SHA 在当前 `main` 上**均不可达**
（`git merge-base --is-ancestor <旧SHA> main` 全部返回非 0）。本表供复核者把历史审查记录
里的旧 SHA 对应到 `main` 上的真实提交。**九组逐条可核**（判定方式见 AC-6）。

| 审查时 SHA | main 上 SHA | 标题 | 内容对应核对 |
|-----------|------------|------|--------------|
| `767c149` | `d270802` | feat(TASK-052/TASK-053): 客户编辑跨页同步 + 邮箱绑定状态重构 | tree 相同 `3bde50ea` |
| `068bb5d` | `5672338` | feat(server): 新增邮箱单事务落库接口 POST /email-bindings/bundle | tree 相同 `db67a916` |
| `8caab4f` | `1551bb9` | docs(TASK-054): 档案收口 —— AC 勾选附证据、变更清单、交接记录 | tree 相同 `76a31d72` |
| `be7c2f2` | `a501c79` | docs(TASK-054): 主控位审查记录 —— PASS（有条件），R1-R3 整改 + B-1 合并前置 | tree 相同 `3b9e8168` |
| `074e557` | `53e756c` | fix(server): 邮箱大小写变体绕过唯一性判定（TASK-053 R1 / TASK-054 R4） | tree 相同 `972952f2` |
| `a65970a` | `8ba2c09` | docs: 邮箱归属口径与实测计数校正（TASK-053 R1 合并前置 D/E/F） | tree 相同 `a6d3c835` |
| `51b7c04` | `20d5d4c` | fix(server): 邮箱绑定 CRUD 补大小写不敏感唯一校验（同根缺陷第三个入口） | tree 相同 `907eb658` |
| `bee2610` | `b9f9879` | fix(server): 邮箱绑定判重按「身份是否变化」判定（PATCH 只改字段不再误 409） | tree 相同 `3282fcb8` |
| `07e5217` | `2ca5d50` | docs(TASK-052/053/054): 独立审查入库 + 053 阻塞项修复收口 + 任务目录/状态补正 | tree 相同 `d3ab9af1`，即 merge commit |

核对方式（TASK-055 执行位实跑，非照抄）：

```bash
# ① 旧 SHA 在 main 上不可达（全部返回非 0）
for s in 767c149 068bb5d 8caab4f be7c2f2 074e557 a65970a 51b7c04 bee2610 07e5217; do
  git merge-base --is-ancestor $s main; echo "$s => $?"
done
# ② 新旧标题逐条一致 + ③ tree 相同（证明是同一份内容的 rebase 副本，而非另写一份）
for p in 767c149:d270802 068bb5d:5672338 8caab4f:1551bb9 be7c2f2:a501c79 \
         074e557:53e756c a65970a:8ba2c09 51b7c04:20d5d4c bee2610:b9f9879 07e5217:2ca5d50; do
  o=${p%%:*}; n=${p##*:}
  echo "$o -> $n : $(git log --format=%s -1 $o) | tree $(git log --format=%T -1 $o) / $(git log --format=%T -1 $n)"
done
```

> **本表为追加，未改写任何 `handoffs/*.md` 内文的旧 SHA / 旧数字**（历史记录不得篡改）。

## Notes

- `expire_at` 是 `timestamp_ms` 列，drizzle 参数编码器要求 `Date`：传毫秒数会在**运行期**抛
  `value.getTime is not a function`（类型检查不报）。本任务在 `listCondition` 与脚本造数两处踩到，
  已改为 `new Date(...)`。
- E2↔E4 不写库，是刻意选择：避免定时任务与订阅同步同时写同一行造成抖动与竞态。
- 「分配」弹窗**不走** `CustomersProvider` 的 `open` 状态：`useDialogState` 的 `setOpen(x)`
  在 `open === x` 时置 `null`（toggle 语义），StrictMode 下 effect 双跑会把刚打开的弹窗又关掉。
  改为「search 参数为真即渲染、关闭时清参数」，声明式且无 toggle 副作用。
- 客户表单的重置 effect 依赖只能取 `prefill` 的**三个字符串**：对象字面量每次渲染都是新身份，
  放进依赖会 reset → 重渲染 → reset 无限循环。
