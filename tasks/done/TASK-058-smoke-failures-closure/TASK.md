# TASK-058 — smoke.ts 14 项失败三簇清偿

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-058
Title: smoke.ts 14 项失败三簇清偿
Workflow: bugfix
Status: DONE
Priority: P1
Owner: Codex（执行位 · developer）
Owner Since: 2026-11-02T22:05:00+08:00
Assigned Role: developer
Created: 2026-11-02T21:50:00+08:00
Updated: 2026-11-04T00:10:47+08:00
Branch: bugfix/TASK-058-smoke-failures-closure（自 docs/TASK-057-059-backlog-registration 切出，含 TASK-058 登记提交）
Requires Human Approval: false
```

## Objective

把 `server/scripts/smoke.ts` 的 **14 项既有失败**全部清零，使端到端冒烟退出码为 0；
且必须通过**定位真实缺陷或修正过期期望**来清零，不得通过删用例、放宽断言或跳过段落来「变绿」。

## Background

TASK-055（2026-11-02）首次实跑 `smoke.ts`，得 **168 通过 / 14 失败，退出码 1**，
并用 `main` 基线对照证明 14 项**先于该任务存在**（分簇计数经主控位 m-1 整改后为
「阈值 6 + 仪表盘 1 = 7 / sync 6 / 备份 1」，合计数 14 不变）。

三簇成因（TASK-055 `Known Issues` 1 的登记）：

| 簇 | 项数 | 失败断言 | 初步归因 |
|----|------|---------|---------|
| **A 流量阈值** | 6 + 1 = 7 | 客户 A/B 穿越 50%/60%/80%、回落、重置后重发；仪表盘 stats 返回 trafficThresholds | `/api/reminders/scan` 未生成提醒行（`{"notified":0,"rows":0}`） |
| **B 邮箱绑定 sync** | 6 | sync 创建/改绑/跨供应商/清理陈旧绑定/仅剩一条/按 poolId 筛选 | 被 TASK-053 的 R2 守卫（「一条订阅只能对应一个邮箱」）以 409 拒绝；**smoke 脚本期望写于该守卫之前，属脚本期望过期** |
| **C 备份恢复标记** | 1 | 19.17 恢复标记存在且 `filename` 等于请求目标 | 读到的值与请求目标不符 |

**重要限定**：以上归因是 TASK-055 的**初步判断**，未经逐簇根因验证。本任务的第一步必须是
**逐簇复现并定位根因**，不得直接按上表动手——尤其 A 簇「`/api/reminders/scan` 未生成提醒行」
可能是产品缺陷，也可能是 smoke 的前置数据构造问题，两者处置方式完全不同。

> **本任务已逐簇完成根因验证**（2026-11-02 实跑 + 探针），结论见下方「根因定位」小节。
> 与上表初步归因的两处差异，如实登记：
> ① **B 簇不是一个根因，而是两个**（R2 守卫 409 + 邮箱管理列表的归属派生过滤），
>    Background 表格只记了前者，漏了后者（它才是「终态只剩一条」「按 poolId 筛选」
>    两条失败的真正原因）；
> ② **A 簇不是产品缺陷**：现象描述（「`/api/reminders/scan` 未生成提醒行」）准确，
>    但成因是 smoke 的前置构造在 TASK-023 / TASK-046 两次口径变更后过期。

## Scope

- 逐簇复现 14 项失败，定位根因，区分「产品缺陷」与「smoke 期望过期 / 前置构造不当」。
- 按根因修产品代码**或**修 smoke 期望（后者必须在档案中说明为何期望是错的，并指向引入该期望的任务）。
- 修完后 `smoke.ts` 全绿（退出码 0），并把三簇的根因结论写入 `TASK-055` 的 `Known Issues` 1
  （**追加**，不改写历史记录）与相关业务档案。

## Non-Scope

- **不加新功能**。流量阈值通知的语义若被证明有缺陷，只修到「与既有 AC / 人类裁决一致」，
  不得借机改口径。
- **不改 `docker.yml` / `ci.yml` 的触发或作业**。
- **不动 `server/data/app.db` 真实库**（只读核查除外；smoke 必须用 `VACUUM INTO` 隔离快照）。
- **不给 `smoke.ts` 加「跳过失败段落」的开关**。

## 根因定位（三簇四元组 · 2026-11-02 实测）

> 每簇按「现象 / 定位命令 / 归因 / 依据」四元组记录。所有命令均在
> `bugfix/TASK-058-smoke-failures-closure` 分支、TASK-055 隔离配方下实跑。

### 0. 复现一致性（先复现，后定位）

隔离配方（与 TASK-055「V 组实测记录」一致，**修正了 SMOKE_DB_DIR**，见 C 簇）：

```powershell
# ① 真实库只读快照（VACUUM INTO）
node -e "const D=require('better-sqlite3');const s=new D('server/data/app.db',{readonly:true});
  s.exec(\"VACUUM INTO 'E:/AiData/task058-smoke/t058-smoke.db'\");s.close()"
# ② 起隔离服务（SMOKE_DB_DIR 必须等于快照库所在目录本身）
DATABASE_URL=E:/AiData/task058-smoke/t058-smoke.db PORT=3000 RESTORE_AUTO_EXIT=false `
  SMOKE_DB_DIR=E:/AiData/task058-smoke `
  TELEGRAM_API_BASE=http://127.0.0.1:3998 FEISHU_API_BASE=http://127.0.0.1:4000 `
  node --import tsx src/index.ts        # cwd = server/
# ③ 跑 smoke
cd server && SMOKE_BASE_URL=http://127.0.0.1:3000 SMOKE_DB_DIR=E:/AiData/task058-smoke `
  node node_modules/tsx/dist/cli.mjs scripts/smoke.ts
```

**改动前基线实跑**（`smoke.ts` 为 HEAD 版本，配方同 ②③）：

```text
结果：168 通过 / 14 失败
REAL_EXIT_CODE=1
```

14 项失败的断言名与失败详情，与 TASK-055 登记的清单**逐条一致**（无新增、无消失、
无改名）。逐条比对见 TASK-055 档案「14 项失败清单」表与本任务「V 组实测记录」。

---

### A 簇：流量阈值 6 项 + 仪表盘 1 项 = 7 项

**现象**：客户 A / B 的 6 条阈值断言全部报 `{"notified":0,"rows":0}` /
`{"rows":0}`；`GET /api/dashboard/stats` 的 `trafficThresholds` 只有 C、D 两条
（`"count":2`），A、B 双双缺席。客户 C（手动上限）与 D（套餐）两条**通过**。

**定位命令**：探针脚本（同一客户、同一用量，只改「生效上限的来源」）：

```javascript
// ① 只给存量月流量 trafficTotal（= smoke 11.5 客户 A/B 的原构造）
POST /api/customers  { name, expireAt, trafficTotal: 100G, trafficUsed: 60G }
POST /api/reminders/scan      → thresholds = {"checked":0,"notified":0,"reset":0}
GET  /api/dashboard/stats     → 该客户不在 trafficThresholds 中
// ② 同一客户补上手动上限 trafficManualCap
PATCH /api/customers/:id      { trafficManualCap: 100G, trafficUsed: 60G }
POST /api/reminders/scan      → thresholds = {"checked":1,"notified":1,"reset":0}
GET  /api/dashboard/stats     → {"threshold":50,"notified":true,...}
GET  /api/reminders           → 1 条「…流量用量达到 50% 阈值…」
```

原始输出（节选，完整版见「V 组实测记录」）：

```text
scan#1 thresholds = {"checked":0,"notified":0,"reset":0}
stats#1 该客户在 trafficThresholds 中？ 否（缺席）
patch(trafficManualCap=100G) status = 200
scan#2 thresholds = {"checked":1,"notified":1,"reset":0}
stats#2 该客户在 trafficThresholds 中？ {"threshold":50,"notified":true}
站内提醒条数 = 1 ["客户流量阈值提醒：客户「probe-a-…」流量用量达到 50% 阈值（已用 60.00 GB / 100.00 GB，60%）"]
```

**归因**：**smoke 前置构造过期**（脚本侧），**不是产品缺陷**。
`effectiveCustomerTrafficTotal(planTrafficLimit, trafficManualCap)` 只认
「手动上限 ?? 套餐月流量」，两者皆空 ⇒ 不限流量（`null`）⇒ 扫描直接 `continue`。
客户 A / B 只填了 `trafficTotal`，从 TASK-046 起它已完全不参与上限派生。

**依据**：
1. `shared/src/schema/traffic.ts` 的 `effectiveCustomerTrafficTotal` 函数体与
   TASK-046 人类裁决注释（「订阅拉取更新出来的流量不参与，只有两个值参与」）；
2. `docs/technical/api-contract.md` 「客户的订阅信息字段」表：
   `trafficTotal` 注明「**纯存量列**：表单管理字段，不参与生效上限派生」，
   「两者皆无 ⇒ 不限流量、不显示百分比」；
3. TASK-013 AC-3~AC-6 描述的是「穿越 / 最高阈值 / 回落重置 / 手动上限优先」语义，
   **没有**任何一条要求「只填 `trafficTotal` 也必须触发」；
4. git 史：11.5 段由 `bef5cac`（TASK-013）写入，彼时 `traffic_total` 是上限的
   兜底顺位；`2671a67`（TASK-023）把它降为最低顺位、`6828e2b`（TASK-046）
   「生效上限口径按人类裁决整改」删掉该顺位 —— **smoke 的前置数据没有跟着改**，
   失效点就在 `6828e2b`。

**修复**：客户 A / B 的载荷补 `trafficManualCap: 100 * 1024 ** 3`（与原有
`trafficTotal` 并存，比例不变 ⇒ 6 条断言的期望值一字未改）。`trafficTotal`
刻意保留，正好继续证明「存量列不参与」。

---

### B 簇：邮箱绑定 sync 6 项（**两个独立根因**）

**现象**：6 条失败分两类——

| 失败断言 | 详情 |
|---|---|
| `sync 创建绑定（action=created，cleaned=0）` | 409 `该订阅已绑定邮箱「mail…@example.com」。一条订阅只能对应一个邮箱…` |
| `同一邮箱可绑定不同供应商（action=created）` | 同上 409 |
| `sync 改绑已有绑定（action=updated）` | `action=created`（上一条没建成，无绑定可改） |
| `sync 清理陈旧绑定（…cleaned=1）` | `action=created`（同上级联） |
| `同步后该邮箱仅剩一条绑定（sub2 + syncPool）` | `[]`（列表空） |
| `按 poolId 筛选邮箱绑定` | `total = 0` |

**定位命令**：探针脚本复刻 12.9 全流程 + 只读连接直查库。

```text
主订阅已绑别的邮箱 status = 201
B1 sync(主订阅) → 409 {"error":"Conflict","message":"该订阅已绑定邮箱「bprobe-mail-…@example.com」。一条订阅只能对应一个邮箱…"}
B2 sync(新订阅 sub2) → 200 action = created cleaned = 0
B2 sync(改供应商 pool2) → 200 action = created cleaned = 1
B2 GET /email-bindings?q=… → total = 0 items = []
  [DB] 列表返回空之后，库里的真实行: [{"id":104,"email":"bprobe-sync-…","pool_id":89,"subscription_id":86}]
  [DB] sub2 行 = {"id":86,"name":"bprobe-sub2-…","customer_id":null,"expire_at":null}
对照组 sync(过期无客户订阅 sub3) → 200 action = updated cleaned = 0
对照组 GET /email-bindings?q=… → total = 1 items = [{...,"subscriptionId":87,"poolId":89,...}]
对照组 GET /email-bindings?poolId=pool2 → total = 1 items = [{...,"poolId":89,...}]
```

**归因 B-1（前 4 条失败）**：**smoke 复用了一个已被占用的订阅**（脚本侧），
不是产品缺陷。12.9 段把 sync 打到 `subscription.json?.id`（第 5 段的主订阅），
而第 5 段早已给它绑了 `mail<suffix>@example.com`。`/email-bindings/sync` 的
R2 守卫「一条订阅只能对应一个邮箱」因此以 409 拒绝 —— 这是 TASK-053 的**既定语义**。

**依据 B-1**：TASK-053 AC-8「同一订阅已挂另一邮箱 → 同步返回 **409**，且不改动
任何行（脚本场景 2 覆盖 5 项）」；`server/scripts/email-binding-sync-check.ts`
场景 2「只换邮箱不换链接（同一订阅出现第二个邮箱）→ **409 拒绝**」。
12.9 段由 `99d14fb`（TASK-008 前后）写入，早于 TASK-053 的守卫。

**归因 B-2（后 2 条失败）**：**smoke 期望过期**（脚本侧），不是产品缺陷，
也不是 B-1 的级联。探针证明库里那行绑定**确实存在**（`id=104`），
但 `GET /api/email-bindings` 不返回它：邮箱管理列表的 `listCondition`
只显示「仅注册」（`subscription_id IS NULL`）与「到期回落」（订阅无客户且
过期超过 24h）两类，sub2 的 `expire_at` 为 NULL ⇒ 两类都不算 ⇒ 被过滤掉。

**依据 B-2**：TASK-053 AC-3「`GET /api/email-bindings` 只返回 E1 与 E4；
E2/E3、到期未满 24h、`expire_at` 为 NULL 的记录不返回，`total` 与列表一致」、
AC-5「订阅填链接时先建订阅再挂绑定，保存后该记录不再出现在邮箱管理」；
`server/src/routes/resources.ts` 的 `listCondition` 实现。

**修复**：12.9 段新建专用订阅 `syncSub1`（**未绑任何邮箱** + **无客户且已过期
48h**），sync 全流程改打它；`syncSub2` 同样补 `expireAt` 过去时间。
6 条断言的期望值一字未改，只换了「打到哪个订阅」；另加 2 条创建/删除 sub1 的
自洽检查（用例总数 182 → 184）。

---

### C 簇：备份恢复标记 1 项（19.17）

**现象**：`19.16 合法恢复排程返回 202 且 restartExpected=false` **通过**，
`19.17 恢复标记存在且 filename 等于请求目标` 失败，详情为 `null`
（`existsSync(RESTORE_MARKER_PATH)` 为假）。

**定位命令**：跑完 smoke 后直接看磁盘——

```powershell
Get-ChildItem E:\AiData\task058-smoke -Force -Filter ".restore-pending.json"
Get-Content    E:\AiData\task058-smoke\.restore-pending.json
```

```json
{ "filename": "imp-20261102-232629-488.db",
  "requestedAt": "2026-11-02T15:26:30.170Z",
  "requestedBy": "admin" }
```

标记**存在且内容正确**（`filename` 正是 19.16 请求的目标），只是不在
`SMOKE_DB_DIR` 指向的目录里：它在**快照库同目录**，而配方把 `SMOKE_DB_DIR`
另设成了 `…/t058-smoke/data`。

**归因**：**测试配方错误（环境侧）**。产品按设计把标记写在数据库同目录，
smoke.ts 头部注释也写明「`SMOKE_DB_DIR=<服务端数据库所在目录>`」，
是 TASK-055 记录下来的配方自己违反了该约定。

**依据**：`server/src/db/restore.ts` 的 `restoreMarkerPath(dbPath) =
join(dirname(dbPath), '.restore-pending.json')`，头部注释「恢复标记文件名
（位于数据库同目录，与 app.db / backups/ 平级）」；`routes/backups.ts:250`
`writeRestoreMarker(databasePath, filename, username)`。

**修复**：不改产品代码，把配方的 `SMOKE_DB_DIR` 改成快照库所在目录本身。
同时在 `smoke.ts` 头部注释补一句「必须填 .db 文件所在的那个目录本身」，
并在 19.17 的失败详情里加诊断提示（不放松断言：`markerOk` 仍为 false）。

---

### 初步归因的修正（对照 Background 表格）

| 簇 | Background 初步归因 | 实测结论 | 差异 |
|----|--------------------|---------|------|
| A | 「`/api/reminders/scan` 未生成提醒行」（疑产品缺陷） | smoke 前置构造过期（TASK-046 起 `traffic_total` 不参与上限） | 现象对，归因错：不是产品缺陷 |
| B | 被 TASK-053 的 R2 守卫以 409 拒绝，属脚本期望过期 | **两个**根因：R2 守卫 409（前 4 条）+ 列表归属派生过滤（后 2 条） | Background 漏了第二个根因 |
| C | 「读到的值与请求目标不符」 | 配方把 `SMOKE_DB_DIR` 指向了与库文件不同级的目录 | 现象描述不准：值是对的，是**路径**找错了 |

### 产品缺陷结论：**0 个**

三簇 14 项**全部**由脚本侧（前置构造 / 期望过期 / 测试配方）造成，
`server/src/**` 一行未改。因此 Requirement 2 与 AC-5 的「未修复代码上必须失败」
反向验证在本任务**无适用对象**——该要求只对「修了产品缺陷」的情形生效。
为免「零反向验证」被读成「没验证」，改用**分解对照运行**证明每处修复都承重，
两次原始输出见「V 组实测记录」：

| 运行 | smoke.ts | 配方 | 结果 |
|------|----------|------|------|
| ① 对照 | HEAD 版本 | 修正后 | **169 通过 / 13 失败**，退出码 1 —— 配方修正单独清偿 C 簇 |
| ② 修复后 | 本分支 | 修正后 | **185 通过 / 0 失败**，退出码 0 |

---

## Requirements

1. 三簇各自的根因必须写成可复现的结论：现象 → 定位命令 → 归因（产品 / 脚本 / 环境）→ 依据。
2. 若归因为**产品缺陷**：修产品代码，并补对应的单元/脚本断言，使缺陷被回归守住
   （**该断言必须先在未修复代码上失败**——TASK-055 M-1 的教训：不具区分力的用例只是装饰）。
3. 若归因为**smoke 期望过期**：改期望，并在档案中写明「期望写于 TASK-XXX 之前，
   此后 R2 守卫 / 语义已变更」，附变更出处。**不得**删除用例来消除失败。
4. A 簇若证明 `/api/reminders/scan` 确有缺陷，须核对 `TASK-013` 的 AC 与
   `docs/technical/api-contract.md` 的语义表，判定是「实现回归」还是「文档与实现从未一致」。
5. 修完后全量门禁退出码全 0：sync-check、bundle-check、vitest、`tsc -b`、eslint、prettier、knip、
   `audit-repo.py`、`build:shared` / `typecheck:server`，以及 **`smoke.ts` 本身**。

## Constraints

| 类型 | 内容 |
|------|------|
| 技术 | 不引新依赖；smoke 必须用隔离快照库（`VACUUM INTO`），**绝不写真实库** |
| 兼容 | 不改公开 API 契约；若必须改，先更新 `api-contract.md` 并说明 |
| 安全 | 真实库任何写操作都超权 |
| 流程 | 每提交一个关注点；footer 含 `Refs: TASK-058` |

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| TASK-055（smoke 首次实跑 + 隔离配方 + 分簇登记） | blocks | 已完成 |
| `main` 上 `traceability` 已是必需检查 | 环境 | 已完成（本任务自己的提交须自带 `Refs`） |

## Acceptance Criteria

- [x] AC-1: A 簇 7 项的根因定位完成并写入档案，含复现命令与归因依据。
      **证据**：「根因定位」A 簇小节；探针两次对照（`checked:0/notified:0` →
      `checked:1/notified:1`）；`shared/src/schema/traffic.ts` 的
      `effectiveCustomerTrafficTotal`、`api-contract.md` 的 `trafficTotal`
      「纯存量列」注记、git 史 `bef5cac`(TASK-013) → `2671a67`(TASK-023) →
      `6828e2b`(TASK-046)。归因：**smoke 前置构造过期，非产品缺陷**。
- [x] AC-2: B 簇 6 项的根因定位完成；若为脚本期望过期，已改期望并注明变更出处（TASK-053 R2）。
      **证据**：「根因定位」B 簇小节。**两个**根因均已注明出处：
      B-1 = TASK-053 R2 守卫（AC-8 / `email-binding-sync-check.ts` 场景 2），
      B-2 = TASK-053 归属派生 `listCondition`（AC-3 / AC-5）。
      两者都是「期望写于 TASK-053 之前」的脚本侧过期，**期望值一字未改**，
      只把 sync 的目标订阅换成未绑邮箱、无客户且已过期的专用订阅。
- [x] AC-3: C 簇 1 项（19.17）的根因定位完成并修完。
      **证据**：「根因定位」C 簇小节 + `E:\AiData\task058-smoke\.restore-pending.json`
      原始内容（`filename` 与 19.16 请求目标一致，证明值没错、是路径找错）。
      修法：配方的 `SMOKE_DB_DIR` 改为快照库所在目录本身；
      `smoke.ts` 另加诊断提示与头部注释，**未放松断言**。
- [x] AC-4: `smoke.ts` 实跑 **168+ 通过 / 0 失败，退出码 0**；输出贴入档案。
      **证据**：「V 组实测记录」运行 ② —— `结果：185 通过 / 0 失败`、`REAL_EXIT_CODE=0`。
- [x] AC-5: 若修了产品缺陷，新增的回归断言已通过「未修复代码上必须失败」的反向验证，
      两次运行原始输出贴入档案。
      **结论：无产品缺陷，`server/src/**` 一行未改**，本条无适用对象（不虚构）。
      替代证据是分解对照运行：HEAD 版 smoke + 修正配方 → 13 失败（仅 C 被配方修掉），
      本分支 smoke + 修正配方 → 0 失败。两次原始输出均贴入「V 组实测记录」。
      既有回归防线的复跑结果：`email-binding-sync-check` 62/62、
      `email-binding-bundle-check` 68/68（均退出码 0）——R2 守卫与归属派生
      在**产品侧**早有专门用例守护，本任务未削弱它们。
- [x] AC-6: 未删任何既有 smoke 用例；用例总数不低于基线（**182** = 168 + 14），
      断言数不低于基线。
      **证据**：`git diff --stat server/scripts/smoke.ts` = `59 insertions(+), 5 deletions(-)`；
      删除的 5 行全部是「sync 目标订阅」的字段值与紧随的重复块，
      **没有删除任何 `check(` 调用**。静态 `check(` 计数 173 → 175，
      实跑用例数 182 → **185**（新增「创建/删除 sync 专用订阅 sub1」两条）。
- [x] AC-7: 真实库 `server/data/app.db` 四表行数与 mtime 在任务前后一致（只读核查留证）。
      **证据**：「D 组实测记录」。四表行数 `4 / 6 / 0 / 6` 与 TASK-055 记录一致，
      `app.db` 的 `Length=266240`、`mtime=2026-11-01 22:12:43` 全程未变；
      `app.db-wal` 为 0 字节、mtime 未变。**如实披露**：`app.db-shm` 的 mtime
      会随**每一次只读连接**前进（已用单独实验证明：开一个 `{readonly:true}`
      连接即改写该 mtime），这是 SQLite WAL 共享内存索引的固有行为，
      TASK-055 的 `VACUUM INTO` 配方同样如此，不构成对真实库的写入。
- [x] AC-8: 全量门禁退出码全 0（见 Requirements 5）。
      **证据**：「门禁实测记录」九条 + smoke 本身，逐条退出码均为 0。

## File Scope

```yaml
File Scope:
  - server/scripts/smoke.ts
  - server/src/**            # 仅当归因为产品缺陷时
  - server/drizzle/**        # 仅当需迁移时（需额外说明）
  - docs/technical/api-contract.md
  - tasks/backlog/TASK-058-*/**  → tasks/active/… → tasks/review/…
Non-Scope (files):
  - .github/**
  - .agents/**
  - templates/**
  - scripts/audit-repo.py
  - shared/scripts/**
  - src/**
```

## Implementation Plan

> 执行结果逐步登记在「根因定位」「V 组实测记录」「D 组实测记录」三节。

1. ~~切分支~~ → `bugfix/TASK-058-smoke-failures-closure`（自含 TASK-058 登记提交的
   `docs/TASK-057-059-backlog-registration` 切出）。
2. ~~先复现~~ → 168 通过 / 14 失败，与 TASK-055 清单**逐条一致**。
3. ~~逐簇定位~~ → A / B / C 四元组均已落盘；B 簇实为**两个**根因。
4. ~~按归因修~~ → **0 个产品缺陷**，`server/src/**` 一行未改；
   A 簇改前置构造、B 簇改 sync 目标订阅、C 簇改测试配方。
5. ~~反向验证~~ → 无产品缺陷可反向验证；改用**分解对照运行**（运行 ① 13 失败 /
   运行 ② 0 失败）证明每处修复承重，两次原始输出已贴入档案。
6. ~~全量门禁 + smoke 全绿~~ → 十条门禁退出码全 0，smoke 185 通过 / 0 失败；
   真实库四表行数与 `app.db` mtime 未变。
7. ~~提交、推分支、开 PR~~ → 见 `## Handoff` 与交付请求；**未自行合并**。

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|------------|
| 复现一致性 | 实跑 | TASK-055 的隔离配方；比对 14 项清单 |
| AC-1~3 | 根因定位 | 逐簇的定位命令与输出 |
| AC-4 | 实跑 | `cd server && SMOKE_BASE_URL=… SMOKE_DB_DIR=… ./node_modules/.bin/tsx scripts/smoke.ts > /tmp/x.log 2>&1; echo exit=$?` |
| AC-5 | 反向验证 | 暂存回改动前版本重跑，断言必须失败；再恢复重跑必须通过 |
| AC-6 | 文本 | `grep -c` 用例/断言数对比基线 |
| AC-7 | 只读核查 | `better-sqlite3` `{readonly:true}` 查四表行数 + mtime |
| AC-8 | 门禁 | 九条命令逐一记录退出码 |

## Current State

**DONE（2026-11-04 由 TASK-060 归档）。** PR #33 已合并；Merge Record 九要素与
SHA 映射表已由 TASK-060 通过平台 API、`git patch-id --stable` 与可达性检查重新实测，
目录按 D13-C 移入 `tasks/done/`。

## V 组实测记录（smoke.ts 实跑与对照运行）

隔离配方见「根因定位」§0。所有运行的服务端日志均确认
`[server] database: E:\AiData\task058-smoke\t058-smoke.db`（**不是**真实库）。

### 运行 ①：改动前 smoke.ts（HEAD 版本）+ 修正后配方（分解对照）

```text
结果：169 通过 / 13 失败
REAL_EXIT_CODE=1
```

失败清单（13 条，即 14 项减去 C 簇那 1 项）：

```text
  ✗ 客户 A 穿越 50% 阈值：发出 1 条通知 → {"notified":0,"rows":0}
  ✗ 客户 A 停留在 60%：重复扫描不重复通知 → {"rows":0}
  ✗ 客户 A 穿越 80% 阈值：再发 1 条（累计 2 条，最新为 80%） → {"rows":0}
  ✗ 客户 A 回落到 30%：不新增通知（累计仍 2 条） → {"rows":0}
  ✗ 客户 A 重置后再次穿越 50%：重新发 1 条（累计 3 条） → {"rows":0}
  ✗ 客户 B 一次跳到 95%：只发 1 条且为最高阈值 80%（非 50%） → {"rows":0}
  ✗ 仪表盘 stats 返回 trafficThresholds（A=50% 已通知 / B=80% / C=50% / D=80% 按套餐） → {"count":2,"c":{...},"d":{...}}
  ✗ sync 创建绑定（action=created，cleaned=0） → {"error":"Conflict","message":"该订阅已绑定邮箱「mail1793633988267@example.com」。一条订阅只能对应一个邮箱，如需更换邮箱请同时更换订阅链接"}
  ✗ sync 改绑已有绑定（action=updated） → {"action":"created","cleaned":0,"binding":{...,"subscriptionId":92,"poolId":88,...}}
  ✗ 同一邮箱可绑定不同供应商（action=created） → {"error":"Conflict","message":"该订阅已绑定邮箱「mail1793633988267@example.com」。一条订阅只能对应一个邮箱，如需更换邮箱请同时更换订阅链接"}
  ✗ sync 清理陈旧绑定（同一订阅只保留一个供应商身份，cleaned=1） → {"action":"created","cleaned":1,"binding":{...}}
  ✗ 同步后该邮箱仅剩一条绑定（sub2 + syncPool） → []
  ✗ 按 poolId 筛选邮箱绑定（供应商筛选的数据基础） → 0
```

⇒ 19.17 已通过：证明**配方修正单独清偿了 C 簇**，A/B 两簇必须改脚本。

### 运行 ②：本分支 smoke.ts + 修正后配方（修复后）

```text
结果：185 通过 / 0 失败
REAL_EXIT_CODE=0
```

14 项原失败断言逐条转绿（原始行）：

```text
  ✓ 客户 A 穿越 50% 阈值：发出 1 条通知
  ✓ 客户 A 停留在 60%：重复扫描不重复通知
  ✓ 客户 A 穿越 80% 阈值：再发 1 条（累计 2 条，最新为 80%）
  ✓ 客户 A 回落到 30%：不新增通知（累计仍 2 条）
  ✓ 客户 A 重置后再次穿越 50%：重新发 1 条（累计 3 条）
  ✓ 客户 B 一次跳到 95%：只发 1 条且为最高阈值 80%（非 50%）
  ✓ 仪表盘 stats 返回 trafficThresholds（A=50% 已通知 / B=80% / C=50% / D=80% 按套餐）
  ✓ 创建 sync 专用订阅 sub1（无客户、已过期、未绑邮箱）
  ✓ sync 创建绑定（action=created，cleaned=0）
  ✓ sync 改绑已有绑定（action=updated）
  ✓ 同一邮箱可绑定不同供应商（action=created）
  ✓ sync 清理陈旧绑定（同一订阅只保留一个供应商身份，cleaned=1）
  ✓ 同步后该邮箱仅剩一条绑定（sub2 + syncPool）
  ✓ 按 poolId 筛选邮箱绑定（供应商筛选的数据基础）
  ✓ 删除 sync 专用订阅 sub1
  ✓ 19.16 合法恢复排程返回 202 且 restartExpected=false
  ✓ 19.17 恢复标记存在且 filename 等于请求目标
  ✓ 19.18 排程后进程未退出（健康检查仍 200）
  ✓ 19.19 清理：本段备份已删除、标记已移除
```

恢复标记无残留（`Test-Path E:\AiData\task058-smoke\.restore-pending.json` → `False`）。

### A 簇探针原始输出（同一客户、只改上限来源）

```text
create(trafficTotal only) status = 201
  row = {"id":90,...,"trafficUsed":64424509440,"trafficTotal":107374182400,"trafficManualCap":null,"trafficThresholdNotified":0,...}
scan#1 thresholds = {"checked":0,"notified":0,"reset":0}
stats#1 该客户在 trafficThresholds 中？ 否（缺席）
patch(trafficManualCap=100G) status = 200
  patched row = {...,"trafficUsed":64424509440,"trafficTotal":107374182400,"trafficManualCap":107374182400,...}
scan#2 thresholds = {"checked":1,"notified":1,"reset":0}
stats#2 该客户在 trafficThresholds 中？ {"id":90,...,"used":64424509440,"total":107374182400,"percent":60,"threshold":50,"notified":true}
站内提醒条数 = 1 ["客户流量阈值提醒：客户「probe-a-1793633600586」流量用量达到 50% 阈值（已用 60.00 GB / 100.00 GB，60%）"]
```

> 探针第一次运行时漏带 `trafficUsed`，暴露出 `customerInputSchema.trafficUsed`
> 带 `.default(0)`：**PATCH 只带 `trafficManualCap` 会把 `trafficUsed` 复位成 0**
> （`patched row` 里 `trafficUsed:0`、`scan#2` 因此 `notified:0`）。
> 这与本任务 14 项失败无关（smoke 的 PATCH 都显式带 `trafficUsed`），
> 已登记为 Known Issues 第 3 条，**不在本任务修**。

### B 簇探针原始输出

```text
主订阅已绑别的邮箱 status = 201
B1 sync(主订阅) → 409 {"error":"Conflict","message":"该订阅已绑定邮箱「bprobe-mail-1793633758934@example.com」。一条订阅只能对应一个邮箱，如需更换邮箱请同时更换订阅链接"}
B2 sync(新订阅 sub2) → 200 action = created cleaned = 0
B2 sync(改供应商 pool2) → 200 action = created cleaned = 1
B2 GET /email-bindings?q=… → total = 0 items = []
  [DB] 列表返回空之后，库里的真实行: [{"id":102,"email":"bprobe-mail-1793633758934@example.com","pool_id":88,"subscription_id":85},{"id":104,"email":"bprobe-sync-1793633758934@example.com","pool_id":89,"subscription_id":86}]
  [DB] sub2 行 = {"id":86,"name":"bprobe-sub2-1793633758934","customer_id":null,"expire_at":null}
对照组 sync(过期无客户订阅 sub3) → 200 action = updated cleaned = 0
对照组 GET /email-bindings?q=… → total = 1 items = [{"id":104,"email":"bprobe-sync-1793633758934@example.com","subscriptionId":87,"poolId":89,"status":"active",...}]
对照组 GET /email-bindings?poolId=pool2 → total = 1 items = [{"id":104,...,"poolId":89,...}]
```

### 门禁实测记录（Requirements 5，逐条退出码）

| # | 门禁 | 命令 | 退出码 | 结果 |
|---|------|------|--------|------|
| 1 | sync-check | `cd server && AI_DATA_DIR=E:\AiData\task058-smoke node node_modules/tsx/dist/cli.mjs scripts/email-binding-sync-check.ts` | 0 | 通过 62 / 失败 0 |
| 2 | bundle-check | `cd server && AI_DATA_DIR=E:\AiData\task058-smoke node node_modules/tsx/dist/cli.mjs scripts/email-binding-bundle-check.ts` | 0 | 通过 68 / 失败 0 |
| 3 | vitest | `node node_modules/vitest/vitest.mjs run --browser.headless` | 0 | Test Files 27 passed / Tests **345** passed |
| 4 | `tsc -b` | `node node_modules/typescript/bin/tsc -b` | 0 | 无输出 |
| 5 | eslint | `node node_modules/eslint/bin/eslint.js .` | 0 | 无输出 |
| 6 | prettier | `node node_modules/prettier/bin/prettier.cjs --check .` | 0 | All matched files use Prettier code style! |
| 7 | knip | `node node_modules/knip/bin/knip.js` | 0 | 无输出 |
| 8 | audit-repo | `python scripts/audit-repo.py` | 0 | PASS=9 FAIL=0 WARN=0 |
| 9 | build:shared + typecheck:server | `cd shared && node ./node_modules/typescript/bin/tsc -p tsconfig.json`；`cd server && node ../node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` | 0 / 0 | 均无输出 |
| 10 | **smoke.ts 本身** | 运行 ② | **0** | 185 通过 / 0 失败 |
| 附 | 框架全量自检 | `python shared/scripts/audit_framework.py` | 0 | PASS=13 FAIL=0 WARN=0 SKIP=0 |

> **平台侧复核（PR #33，`gh run list` / `gh api .../jobs` 实测，截至 2026-11-03 01:25）**：
> 本分支已触发 **6 次** `event=pull_request` 的 CI 运行，head 分支均为
> `bugfix/TASK-058-smoke-failures-closure`，**每一次**的三个作业全部 success ——
> `install-lint-build` / `traceability` / `audit`：
>
> | run | head_sha | 三作业结论 |
> |-----|----------|-----------|
> | 41477718219 | `8b1781f…` | success / success / success |
> | 41478242197 | `9ae2af3…` | success / success / success |
> | 41478626967 | `20a7ccd…` | success / success / success |
> | 41479213523 | `6e9675d…` | success / success / success |
> | 41479711782 | `52b079f…` | success / success / success |
> | 41480296609 | `dea5dd0…` | success / success / success |
>
> `gh pr view 33 --json statusCheckRollup` 三项均 `SUCCESS`。
> 说明：每次向任务分支推送都会触发新的 `pull_request` 运行，上表是**截至 2026-11-03 01:25**
> 的实测快照（6 次全绿），不是「将来也会一直如此」的承诺。
> **注意**：`smoke.ts` **不在 CI 作业里**（`ci.yml` 无该步骤），它只是本任务
> Requirements 5 清单上的一项**本地门禁**；平台侧只能证明其余九项，冒烟证据以上方
> 运行 ② 的本地原始输出为准。

> 环境说明（如实记录）：本环境的 `pnpm` 与安装 `node_modules` 的运行时不一致，
> 任何 `pnpm <script>` 都会先在依赖状态检查处失败（`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`）。
> 因此上表一律用 `node <包入口>` 直接调用同一工具的同一版本，**不是**换了门禁项。
> 另注：`shared` 必须用它自己 devDependency 的 TypeScript 5.9.3 编译；
> 用根目录的 TypeScript 6.0.3 会在 `notifications.ts` 报 `Cannot find name 'URL'`
> （版本差异，与本任务改动无关）。

### D 组实测记录（真实库只读核查）

连接方式：`better-sqlite3` + `{ readonly: true }` 连 `server/data/app.db`，全程不写。

```text
{"subscription_pool":4,"subscriptions":6,"email_bindings":0,"customers":6,
 "plans":2,"reminders":74,"users":"ERR","logs":329,"settings":50,"webhooks":1,"backups":"ERR"}
```

四表行数 `4 / 6 / 0 / 6` 与 TASK-055 D 组记录**逐项一致**；
`app.db` `Length=266240`、`LastWriteTime=2026-11-01 22:12:43` 全程未变；
`app.db-wal` 为 0 字节且 mtime 未变。
**已知副作用（如实披露）**：`app.db-shm` 的 mtime 会随每一次只读连接前进 ——
单独实验证明仅开一个 `{readonly:true}` 连接即可改写它，属 SQLite WAL 共享内存索引
的固有行为，TASK-055 的 `VACUUM INTO` 配方同样如此。真实库的**内容与主文件**
未发生任何写入。

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `server/scripts/smoke.ts` | 修改 | ① 11.5 段客户 A/B 补 `trafficManualCap`（A 簇，7 项）；② 12.9 段新增 sync 专用订阅 `syncSub1`、`syncSub2` 补 `expireAt`、sync 目标订阅改指 `syncSub1`、清理段补删 `syncSub1`（B 簇，6 项）；③ 头部注释补 `SMOKE_DB_DIR` 口径、19.17 失败详情补诊断提示（C 簇，1 项） |
| `tasks/backlog/TASK-058-smoke-failures-closure/TASK.md` | `git mv` + 修改 | 领取：移入 `tasks/active/`；实现完成后 `Status → REVIEW` 并再 `git mv` 至 `tasks/review/`（`task-lifecycle.md` §4「变更状态」两步，缺一不可）；Owner 填执行位；追加根因定位四元组、实测记录、AC 证据、Known Issues |
| `tasks/review/TASK-055-archive-backfill-and-email-binding-residuals/TASK.md` | 修改（**仅追加**） | `Known Issues` 第 1 条追加三簇根因验证结论；「V 组实测记录」追加配方修正说明。历史记录一字未改 |
| `tasks/review/TASK-058-smoke-failures-closure/handoffs/HANDOFF-001-implementer-to-coordinator.md` | 新增 | 执行位 → 主控位交接（随任务目录一同移入 `review/`） |
| `tasks/done/TASK-058-smoke-failures-closure/TASK.md` | `git mv` + 修改 | TASK-060 按 D13-C 重测九要素与 SHA 映射，`Status → DONE` 并归档 |

> **交付请求 #33 的实际 diff 还含两个非本任务文件，如实披露（Known Issues 8）**：
> `tasks/backlog/TASK-057-gate-evidence-closure/TASK.md`、
> `tasks/backlog/TASK-059-template-drift-and-sha-mapping/TASK.md`。
> 成因：TASK-058 的任务定义只存在于主控位的登记提交 `b0714ad`（`Refs: TASK-057`）中，
> 而该提交所在的 `docs/TASK-057-059-backlog-registration`（= 交付请求 #32）尚未合并到
> `main`。执行位为能 `git mv` 领取任务，只能从该分支切出工作分支，于是 `main..HEAD`
> 必然带上 `b0714ad`。该提交**只新增这三份任务定义**（`git diff --stat main b0714ad`
> = 3 files / 644 insertions，无产品代码），且与交付请求 #32 是同一份内容。
> **未擅自改写已推送历史**（`.agents/rules/git.md` §6 的高风险操作），
> 由主控位决定合并次序，或要求执行位改从 `main` 切分支并只携带 TASK-058 的任务文件。

**未改动**：`server/src/**`（0 行）、`server/drizzle/**`、`docs/technical/api-contract.md`
（公开 API 契约无变化，无需更新）、`.github/**`、`.agents/**`、`templates/**`、
`scripts/audit-repo.py`、`shared/scripts/**`、`src/**`。

## Known Issues

1. **Background 的初步归因有两处偏差（已如实更正，未硬套原登记）**：
   ① B 簇不是一个根因而是两个 —— R2 守卫 409（前 4 条）+ 邮箱管理列表
   `listCondition` 归属派生过滤（后 2 条），原登记只记了前者；
   ② A 簇「`/api/reminders/scan` 未生成提醒行」的现象描述准确，但归因**不是**
   产品缺陷，而是 smoke 前置构造在 TASK-023 / TASK-046 两次口径变更后过期。
   C 簇原登记「读到的值与请求目标不符」也不准确：值是对的，是**路径**找错了
   （`SMOKE_DB_DIR` 与库文件不同级）。
2. **A 簇未牵涉「文档与实现从未一致」**：`api-contract.md` 对
   `effectiveCustomerTrafficTotal` 的口径描述（`trafficManualCap ?? 套餐月流量`、
   `trafficTotal` 为纯存量列）与实现**逐字一致**，TASK-013 的 AC-3~AC-6 也没有
   任何一条要求「只填 `trafficTotal` 必须触发」。因此不存在 TASK-013 AC 与
   契约文档的分歧，无需另立任务。
3. **新发现（本任务顺带暴露，未修，超出 File Scope 与 Non-Scope）**：
   `customerInputSchema.trafficUsed` 带 `.default(0)`，而 `crud.ts` 对 PATCH 调
   `.partial()` 后 zod 仍会补默认值 ⇒ **PATCH 客户时若不带 `trafficUsed`，
   该列被复位为 0**。探针第一次运行即撞上（`patched row` 里 `trafficUsed:0`）。
   影响：任何「只改其他字段」的客户编辑都会静默清空用量。本任务 14 项失败与它无关
   （smoke 的客户 PATCH 都显式带 `trafficUsed`），且修它要动 `shared/src/schema/**`
   与 `server/src/lib/crud.ts`，超出本任务 File Scope。**建议主控位另立任务**
   （任务登记属主控位独占动作，执行位不自行建任务）。
4. **`docs/technical/known-pitfalls.md` 未更新**：C 簇的「`SMOKE_DB_DIR` 必须是
   .db 所在目录本身」是典型的坑，但该文件不在本任务 File Scope 内。
   已在 `smoke.ts` 头部注释与 19.17 失败详情里留下同等信息；是否补进
   `known-pitfalls.md` 请主控位裁决。
5. **`E:\AiData` 在当前沙箱不可写**：任务规则要求临时文件落 `E:/AiData`，
   但沙箱只放开 `E:\NDLDSN-WORKSPACE`。已就「创建 `E:\AiData\task058-smoke`」
   取得人类授权，随后所有涉及该目录的命令均以提权方式执行；仓库内未产生任何
   临时产物（`.t058-tmp/`、`server/.t058-*` 已在 knip 报出后全部移出，
   移出后 knip 复跑退出码 0）。
6. **`pnpm` 在本环境不可用**（依赖状态检查先失败，见 V 组实测记录环境说明），
   门禁一律改用 `node <包入口>` 直调同一版本工具。这是**环境限制**，
   不是「换了门禁项」；若主控位要求严格按 `pnpm <script>` 复跑，需先修复本机
   pnpm/node 运行时一致性。
7. **本分支的基线选择带来一处 PR 范围外溢（已如实披露，未擅自处理）**：
   分支自 `docs/TASK-057-059-backlog-registration`（= 交付请求 #32，未合并）切出，
   因此 PR #33 的 diff 除本任务 4 个文件外，还含 `b0714ad` 新增的
   `tasks/backlog/TASK-057-…/TASK.md` 与 `tasks/backlog/TASK-059-…/TASK.md`
   （纯文档、无产品代码，与 PR #32 同一份内容）。这是「TASK-058 的任务定义尚不在
   `main` 上」的结构性后果。执行位**未**改写已推送历史、**未**重复登记任务，
   合并次序（先 #32 再 #33，或反之）交由主控位裁决。
8. **真实库 `app.db-shm` 的 mtime 会随只读连接前进**（D 组实测记录已单独实验证明）。
   `app.db` 主文件与 `-wal` 未变、四表行数未变。TASK-055 的 D 组只核查了
   `app.db` 的 mtime，未覆盖 `-shm`；此处如实补记，避免被读成「零副作用」。

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 001 | Codex（执行位 · developer） | 主控位 · Reviewer | 2026-11-02 | 三簇 14 项失败清偿：A/B 为脚本侧过期、C 为配方错误；0 产品缺陷；smoke 185/0 退出码 0；全量门禁全 0；待审查 |

**目录状态：** `tasks/done/TASK-058-smoke-failures-closure/`（`Status: DONE`，TASK-060 已归档）。

**交付请求：** [#33](https://github.com/huyanluanyuqaq/shadcn-admin/pull/33) 已于
`2026-11-02T17:40:55Z` 合并；最终平台实测为 **12 commits**，详见下表逐格复现命令。

**最新 Handoff：** `handoffs/HANDOFF-001-implementer-to-coordinator.md`
**Next Action：** 无；审查、合并与 D13-C 归档均已完成。

## Merge Record

> **本节不随「Pass/收尾」填写。** 按 D13-C 选项 C（`.agents/rules/github.md` §2 / §6、
> `AGENTS.md` §14.2），本表由**下一个任务**在回收本任务归档时回填；
> 在此之前任务保持 `Status = REVIEW`、留在 `tasks/review/`（机制，非遗漏）。
> **禁止在本任务内自我回写**（那会造成档案与提交历史不一致）。
> 回填时九要素必须填实测值（可被 `gh api` / Tags API 复现），不得沿用档案自述；
> 无合并前独立审查档时，「审查记录」行须如实写「无（A3 断档）」，**不得补写、不得伪造**。

> 以下九要素由 TASK-060 于 2026-11-04 重新通过 `gh api` / DockerHub Tags API 实测，
> 未沿用本档案或 TASK-060 Background 的自述值。

| 要素 | 实测值 | 复现命令 |
|------|--------|----------|
| PR | [#33](https://github.com/huyanluanyuqaq/shadcn-admin/pull/33)（`bugfix/TASK-058-smoke-failures-closure` → `main`）；合并执行者 `huyanluanyuqaq` | `gh api repos/huyanluanyuqaq/shadcn-admin/pulls/33 --jq '{number,merged_by:.merged_by.login,head:.head.ref,base:.base.ref}'` |
| 合并策略 | rebase-merge；合并头 `ea95b89` 为单父线性提交 | `gh api repos/huyanluanyuqaq/shadcn-admin/commits/ea95b8978c4957c7804b66aedec72eea6a058a82 --jq '{sha,parents:[.parents[].sha]}'` |
| 提交数 | **12** | `gh api repos/huyanluanyuqaq/shadcn-admin/pulls/33/commits --paginate --jq 'length'` |
| merged_at | `2026-11-02T17:40:55Z` | `gh api repos/huyanluanyuqaq/shadcn-admin/pulls/33 --jq '.merged_at'` |
| merge_commit_sha | `ea95b8978c4957c7804b66aedec72eea6a058a82` | `gh api repos/huyanluanyuqaq/shadcn-admin/pulls/33 --jq '.merge_commit_sha'` |
| 合并后 CI run | `41493459791`；Continuous Integration，`event=push`、`head_branch=main`、conclusion=`success` | `gh api repos/huyanluanyuqaq/shadcn-admin/actions/runs/41493459791 --jq '{id,name,event,head_branch,head_sha,conclusion}'` |
| 合并后 Docker run | `41493459973`；Build and Push Docker Image，`event=push`、`head_branch=main`、conclusion=`success` | `gh api repos/huyanluanyuqaq/shadcn-admin/actions/runs/41493459973 --jq '{id,name,event,head_branch,head_sha,conclusion}'` |
| 镜像 tag | `sha-ea95b89`；digest `sha256:5b66577422c69535f39f157b6132e17167105586ab5681641aae1f4b2f6f760c`；`last_updated=2026-11-02T17:47:44.489941Z` | `curl -fsSL https://hub.docker.com/v2/repositories/nomorelatenights/subscription-admin/tags/sha-ea95b89` |
| 审查记录 | `handoffs/2026-11-03-coordinator-review.md`：**一轮 PASS**。审查实例为 Claude Code（Opus 5），与执行位 Codex 不同；记录声明审查前未接触实现过程产物并独立复跑 | `gh api "repos/huyanluanyuqaq/shadcn-admin/contents/tasks/review/TASK-058-smoke-failures-closure/handoffs?ref=ea95b8978c4957c7804b66aedec72eea6a058a82" --jq '.[].name'` |

### SHA 映射表（rebase-merge 改写前后的对应关系）

判据统一采用 `git show --format= <SHA> | git patch-id --stable`。最终 PR 的 rebase 基点
`760e18c` 未变；审查记录头 `0388650b` 所在历史则因 PR #32 先合并而发生基点前移，
故不使用 tree 捷径。12 个最终 PR 旧 SHA 加 1 个审查头别名均重新实测：**13/13 patch-id SAME，
旧 SHA 全部不可达，新 SHA 全部在 `main` 可达**。`0388650b` 与最终 PR 头 `74c26ec`
是同一补丁的两个旧头，共同映射到 `ea95b89`。

| 审查时 SHA | main 上 SHA | 标题 | patch-id（旧 = 新） | 可达性判据 |
|-----------|------------|------|---------------------|------------|
| `ce7a7ba` | `56dff14` | 领取任务并转入 active | `74afe28cb101b78318cfa36fae000f5cb020105b`；SAME | 旧不可达 PASS；新在 main PASS |
| `312d686` | `a8c0606` | smoke 阈值客户补生效上限来源 | `7cc3277f18f0ae1fc82c203ac0846007466fbacc`；SAME | 旧不可达 PASS；新在 main PASS |
| `8f3404a` | `9ccb52d` | smoke 12.9 段改用未占用订阅 | `58dac6c057535a3722c7f51df4755bb92e79f60f`；SAME | 旧不可达 PASS；新在 main PASS |
| `3d4e787` | `3a2063f` | 注明 SMOKE_DB_DIR 口径并补诊断 | `b0d86b466636bf1e37570d0f18014de622b549b2`；SAME | 旧不可达 PASS；新在 main PASS |
| `067e30f` | `45a4a68` | 档案落盘三簇根因与实测记录 | `bf31926156fbc52ca5ba12cf4f77f6c4651e7572`；SAME | 旧不可达 PASS；新在 main PASS |
| `fd2a028` | `4e0160a` | TASK-055 追加根因与配方修正 | `ecc47cd4fb9c5d4c206baffa28ebd83b81488d83`；SAME | 旧不可达 PASS；新在 main PASS |
| `3ee607a` | `8829d3f` | 登记 PR #33 与范围外溢披露 | `5e85cd43c019f62604057452145872d8e7411518`；SAME | 旧不可达 PASS；新在 main PASS |
| `52aa116` | `fc4e35a` | 登记 PR #33 平台检查实证 | `9487d0d11cdf024b2e76a5e815ef2eacfe844bb9`；SAME | 旧不可达 PASS；新在 main PASS |
| `c6a489c` | `be45e52` | 回填最终提交数与三次 CI | `cb260962ad5245c7b8d77a328927a99a8713b72c`；SAME | 旧不可达 PASS；新在 main PASS |
| `5d4e152` | `aa13d89` | 补记第 4 次 CI 并限定快照 | `59e64e74f10f7e34c7fd3ea183d69dd143dc3943`；SAME | 旧不可达 PASS；新在 main PASS |
| `fba9d9e` | `f0279c1` | 任务目录移入 review | `4a963c71445d00003c399ccd7ee6dc73fa4644e4`；SAME | 旧不可达 PASS；新在 main PASS |
| `74c26ec` | `ea95b89` | 补记第 5/6 次 CI（最终 PR 头） | `fd896c5b8697105248cba0b3d40ba713ca70f862`；SAME | 旧不可达 PASS；新在 main PASS |
| `0388650` | `ea95b89` | 补记第 5/6 次 CI（审查记录头别名） | `fd896c5b8697105248cba0b3d40ba713ca70f862`；SAME | 旧不可达 PASS；新在 main PASS |

逐对复现：`git show --format= <旧SHA> | git patch-id --stable` 与新 SHA 同法比较；
反向验证：`git merge-base --is-ancestor <旧SHA> main` 必须非 0；正向验证：
`git merge-base --is-ancestor <新SHA> main` 必须为 0。全表原始自检输出贴入 TASK-060 的 W 组提交信息。

## Task Rules

- [增强] **禁止**用删用例、放宽断言、跳过段落、或给 smoke 加「忽略失败」开关的方式变绿
  （`.agents/rules/github.md` §5 受保护条款）。
- [补充] 每个产品缺陷修复都必须配一条**先在未修复代码上失败**的回归断言（TASK-055 M-1 教训）。
- [补充] smoke 一律用隔离快照库；真实库只读。

## Notes

- 基线：TASK-055 于 2026-11-02 实测 168 通过 / 14 失败 / 退出码 1；分簇 6+1 / 6 / 1。
- 隔离配方见 `tasks/done/TASK-055-archive-backfill-and-email-binding-residuals/TASK.md`
  「V 组实测记录」小节。
