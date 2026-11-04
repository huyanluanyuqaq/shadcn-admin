# 2026-11-03 主控位审查记录 — PR #33 / TASK-058 smoke.ts 三簇清偿

| 字段 | 值 |
|------|-----|
| **审查协作位** | 主控位（Coordinator） |
| **审查实例** | 本会话（Claude Code，Opus 5）。审查前未读任何实现过程产物；全部结论独立复跑得出 |
| **被审对象** | PR [#33](https://github.com/huyanluanyuqaq/shadcn-admin/pull/33)，分支 `bugfix/TASK-058-smoke-failures-closure`（base `main` `e1e2b40` → head `0388650b`，14 提交 / 6 文件 / +1378 −6） |
| **结论** | **PASS** —— 8 条 AC 全部经独立复跑确认；另有 1 项**合并次序需主控位裁决**（见 §4） |

---

## 0. 独立性声明

本会话在审查开始前未接触 TASK-058 的任何中间产物，首次接触即 `TASK.md` + `HANDOFF-001` + 实际 diff。
三簇根因、smoke 实跑结果、断言完整性均由本会话**独立复现**。

须如实标注：单一平台身份下「实现者 ≠ 批准者」**无平台强制**（`dual-agent-model.md` §5.2），
独立审查是流程约定。

---

## 1. 逐条 AC 核验

### AC-1（A 簇 7 项）✅

**根因已对实现核实**：`shared/src/schema/traffic.ts:40` 的
`effectiveCustomerTrafficTotal(planTrafficLimit, trafficManualCap)` 签名里
**根本没有 `traffic_total` 参数**，实现为 `trafficManualCap ?? planTrafficLimit ?? null`。
故只填 `trafficTotal` 的客户上限为 `null`（不限流量），扫描不评估、仪表盘不出卡片 ——
**归因「smoke 前置构造过期，非产品缺陷」成立**。

档案中的决定性探针（同一客户、同一用量、只改上限来源：
`checked:0/notified:0` + 仪表盘缺席 → `checked:1/notified:1` + 1 条 50% 站内提醒）
与实现逻辑一致。

**修法未放宽**：只给客户 A/B 补 `trafficManualCap: 100G`，`trafficTotal: 100G` **刻意保留**。
因两者同为 100G，60%/85%/30%/60%/95% 全部比例不变。
本会话 `git diff` 复核：**7 条阈值/仪表盘断言一行未改**（diff 中新增的 `check(` 只有 sub1 那两条）。

### AC-2（B 簇 6 项）✅ 两个根因均已核实

| 根因 | 实现依据（本会话实测） |
|------|----------------------|
| **B-1** 前 4 条：sync 打到已被占用的主订阅 → TASK-053 R2 守卫 409 | 对照运行中实测到 `{"error":"Conflict","message":"该订阅已绑定邮箱「mail…@example.com」。一条订阅只能对应一个邮箱…"}` |
| **B-2** 后 2 条：绑定挂在**仍有效**的订阅上，不在邮箱管理列表 | `resources.ts:366` `listCondition` = `subscriptionId IS NULL` **或**（订阅过期 + 无客户 + 宽限内）→ 有效订阅的绑定被过滤，终态断言无数据可查 |

修法：新建专用订阅 `syncSub1`（未绑邮箱 + 无客户 + 已过期 48h），sync 全流程改打它；
`syncSub2` 同样补 `expireAt`。**期望值一字未改**，只换了「打到哪个订阅」
（`subscriptionId: subscription.json?.id` → `syncSub1.json?.id`）。另加 2 条 sub1 创建/删除自洽检查。

### AC-3（C 簇 1 项）✅

**根因已对实现核实**：`server/src/db/restore.ts:51` `restoreMarkerPath(dbPath) = join(dirname(dbPath), MARKER_FILENAME)`
—— 标记写在**数据库同目录**。TASK-055 记录下来的配方把 `SMOKE_DB_DIR` 另设成与库文件不同级的子目录，
故 19.17 在错误位置找不到标记。**「值没错，是路径找错」成立**。

修法未放松断言：`markerOk` 仍为 `false`（本会话核对 diff，该布尔未被改），
只丰富了 `markerDetail` 的诊断内容并在头部注释补一句口径说明。

### AC-4（smoke 全绿）✅ **本会话独立实跑复现**

隔离快照库（`VACUUM INTO`，只读源库）+ `SMOKE_DB_DIR` = 快照 `.db` 所在目录本身：

```text
结果：185 通过 / 0 失败
REAL_EXIT_CODE=0
```

与档案记载的「185 通过 / 0 失败、退出码 0」**逐字一致**。

### AC-5（反向验证 / 无产品缺陷）✅ **本会话独立做了分解对照实验**

档案称「无产品缺陷，`server/src/**` 一行未改」，并给出替代证据：
HEAD 版 smoke + 修正配方 → 13 失败（仅 C 被配方修掉）。

本会话独立复现该对照 —— 用 **`main` 的 `smoke.ts`** + **修正后的配方**：

```text
结果：169 通过 / 13 失败
REAL_EXIT_CODE=1
```

13 项失败**正是 A 簇 7 项 + B 簇 6 项**，而 **C 簇（19.17）不在失败清单里**。
这精确证明：

- 配方修正**单独**只修掉 1 项（C）；
- 其余 13 项由 `smoke.ts` 的改动修掉（A 7 + B 6）；
- 没有任何一项是靠「放宽」变没的。

同时本会话实测 `git diff --name-only origin/main...HEAD -- server/src/ shared/src/ src/`
= **0 个文件** —— 产品代码确实零改动，AC-5「无适用对象、不虚构」的处理是对的。

### AC-6（未删用例、断言数不减）✅ **本会话做了断言名全量比对**

这是本条最硬的判据。本会话提取两版 `smoke.ts` 中**所有 `check()` 的断言名**做多重集比对：

```
main 断言名条目 339 / PR 342
--- 仅 main 有（被删/被改）---   （空）
--- 仅 PR 有（新增）---          + 创建 sync 专用订阅 sub1（无客户、已过期、未绑邮箱）
                                + 删除 sync 专用订阅 sub1
```

**零删除、零改名、零修改**，只有 2 条新增。静态 `check(` call sites 173 → 175，同向。

> 附注（不影响结论）：实跑执行次数 182 → 185（+3），比静态 call sites 的 +2 多 1。
> 差额来自 `for…of` 循环内断言的迭代次数（`smoke.ts` 有多处 `for (const [label, …] of [...])`），
> 本会话未能精确定位是哪一条循环多迭代了一次；但**断言名全量比对已证明无删除无修改**，
> 故这纯属计数口径细节，不构成放 weakened 证据。

### AC-7（真实库未变）✅

本会话只读核查：`app.db` mtime 仍为 `2026-11-01 22:12:43`、`Length=266240`，
四表行数 `subscription_pool=4 / subscriptions=6 / email_bindings=0 / customers=6`，与 TASK-055 记录一致。

档案对 `app.db-shm` mtime 随只读连接前进的**如实披露 + 单独实验证明**，处理方式正确
（SQLite WAL 共享内存索引的固有行为，不构成对真实库的写入）。

### AC-8（全量门禁）✅ 本会话逐条复跑

| 门禁 | 结果 | 退出码 |
|-------|------|--------|
| `smoke.ts` | 185 / 0 | `0` |
| `email-binding-sync-check` | 62 / 0 | `0` |
| `email-binding-bundle-check` | 68 / 0 | `0` |
| `vitest run --browser.headless` | 27 文件 / 345 用例 | `0` |
| `tsc -b` | 通过 | `0` |
| `eslint .` | 通过 | `0` |
| `prettier --check .` | All matched files use Prettier code style | `0` |
| `knip` | 通过 | `0` |
| `typecheck:server` | 通过 | `0` |
| `audit-repo.py` | **PASS=9 FAIL=0 WARN=0** | `0` |

平台侧：PR #33 三个检查（`install-lint-build` / `audit` / `traceability`）在 head `0388650b` 上均 **pass**
（run `41480735362`）。档案如实注明「smoke.ts 不在 `ci.yml` 作业里，冒烟证据以本地运行为准，
不把 CI 绿当成冒烟已过」—— 这个区分是对的。

---

## 2. 三簇根因结论复核

| 簇 | 项数 | 档案结论 | 本会话核实 |
|----|------|---------|-----------|
| A 流量阈值 | 6 + 1 = 7 | smoke 前置构造过期（TASK-023 降顺位、TASK-046 删除顺位后 `traffic_total` 不参与上限派生） | ✅ 与 `effectiveCustomerTrafficTotal` 实现一致 |
| B 邮箱绑定 sync | 6 | **两个**独立根因：B-1 TASK-053 R2 守卫 409；B-2 归属派生 `listCondition` 过滤 | ✅ 两者均已对实现核实 |
| C 备份恢复标记 | 1 | 测试配方错误（`SMOKE_DB_DIR` 与 `.db` 不同级） | ✅ 与 `restoreMarkerPath` 实现一致 |
| **合计产品缺陷** | — | **0 个** | ✅ `server/src/**` 0 文件改动 |

**档案如实更正了 Background 初步归因的两处偏差**（B 簇实为两个根因；A 簇现象对但归因不是产品缺陷），
并在 TASK-055 的 `Known Issues` 1 中以**追加**方式补入（该文件本次 **38 insertions / 0 deletions**，
纯追加，未改写历史记录）。这正是本任务 `Non-Scope` 与框架 DoD 要求的行为。

---

## 3. 边界与受保护规则

| 检查项 | 结论 |
|--------|------|
| 产品代码零改动 | ✅ `server/src/` `shared/src/` `src/` 均 0 文件 |
| 未删/未放宽任何 smoke 断言 | ✅ 断言名全量比对：零删除零修改 |
| 未给 smoke 加「跳过失败」开关 | ✅ 无此类改动 |
| 未改 `.github/**` / `.agents/**` / `templates/**` / `scripts/audit-repo.py` | ✅ |
| 真实库只读 | ✅ mtime 与四表行数未变 |
| 每提交 footer `Refs: TASK-058` | ✅ 13/13 |
| 未自行合并、未自行批准 | ✅ PR 仍 OPEN |
| 未改写已推送历史 | ✅ 见 §4 |

---

## 4. 需主控位裁决：合并次序

**事实**：本分支自 `docs/TASK-057-059-backlog-registration`（= PR #32，**尚未合并**）切出，
因为 TASK-058 的任务定义只存在于该分支的登记提交 `b0714ad` 中。因此 `main..HEAD`
必然带上 `b0714ad`，PR #33 的 diff **另含 TASK-057 / TASK-059 两份任务定义**
（纯文档、无产品代码，与 PR #32 同一份内容）。

执行位的处理方式**正确**：在档案与提交信息中如实披露，未改写已推送历史、未重复登记任务，
把合并次序交主控位裁决。

**主控位裁决：先合并 PR #32，再合并 PR #33。**

理由：
1. PR #32 是三份纯文档登记（已由主控位按 C4 创建并自验门禁通过），先合它使任务定义落到 `main`；
2. PR #32 合并后，`b0714ad` 成为 `main` 的祖先，PR #33 的 `main..HEAD` **自动收缩**为
   仅 TASK-058 的提交，diff 随之变干净 —— 执行位**无需 rebase**，GitHub 的 rebase-merge 会正确处理；
3. 若反序（先 #33），TASK-057/059 的登记会随 #33 落地，随后 #32 的 diff 变空、
   GitHub 会将其视为已合并而关闭，**丢失 #32 的独立审查轨迹**。

---

## 5. 结论

**PASS。**

三簇 14 项失败全部清偿，且清偿方式经得起三种独立检验：
① 断言名全量比对证明**零删除零修改**；
② 分解对照实验（本会话独立复现）证明 13 项由 `smoke.ts` 改动修掉、1 项由配方修掉；
③ 根因逐条对上实现代码，不是「看起来合理」的归因。

「无产品缺陷所以不虚构反向验证」的处理，以及「smoke 不在 CI 里、不把 CI 绿当冒烟过」的区分，
都是这个任务里做得对的地方。

**Next Action：**
1. **先合并 PR #32**（任务登记），**再合并 PR #33**（本任务）—— 见 §4 裁决；
2. 两次合并均须人类授权；
3. PR #33 合并后 TASK-058 迁入 `tasks/done/`、`Status → DONE`，其 Merge Record 按 D13-C
   由下一个任务（TASK-057 或 TASK-059）回填；
4. 建议后续把「smoke.ts 进 CI」单独立项 —— 它目前只是本地门禁，平台侧无从证明。

> 本文件为审查记录，**未提交、未推送**（推送任务分支属执行位职责）。
