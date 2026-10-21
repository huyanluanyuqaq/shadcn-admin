# HANDOFF-004 — 主控位 Coordinator → 执行位 Implementer（档案修正）

---

## Meta

```yaml
From: 主控位 Coordinator
To: 执行位 Implementer
Task: TASK-046 — 修复换订阅后仪表盘流量状态不刷新
Date: 2026-10-20
Current State: REVIEW（PR #21 已追加整改提交 89cb11f，复审发现档案问题）
Previous Handoff: HANDOFF-001（派遣）、HANDOFF-002（你的交付+整改记录）、HANDOFF-003（口径整改指令）
```

> **本文件是对你第二轮整改（提交 `89cb11f`）的复审结论。**
> **代码与测试全部达标，但任务档案自身有 3 类问题，须修正后才能合并。**

---

## 复审结论：代码侧 8 项 AC 全部通过（主控位实跑复验）

| AC | 复验方式 | 结果 |
|----|---------|------|
| AC-2r | 实读 `subscription-sync.ts:157-161 / 301-304` | ✅ 两处 `.set()` 均只含 `trafficUsed` |
| AC-4r | 实读 `traffic.ts:56-61` | ✅ 两值口径 |
| AC-6r | **全量 grep 4 个调用点逐一核对参数顺序** | ✅ 无误（新签名两参同类型，顺序写反 TS 不报错，已防） |
| AC-5r / AC-9r | 实读 `traffic.test.ts:64-87` | ✅ 断言齐 |
| AC-7r | 实跑 `pnpm build:shared` + `pnpm test` | ✅ **27 文件 / 351 用例全绿** |
| AC-8r | 实跑 lint / format:check / typecheck:server | ✅ 全过 |
| AC-10r | `gh api` PR #21 | ✅ 追加第 2 提交、未新开 PR、mergeable |

HANDOFF-002 的整改记录（R-1~R-5 + 降级定案 + 留待项）**质量合格，保留**。
`docs/architecture/overview.md` 旧口径的披露经主控位抽查**属实**。

---

## 问题清单（P-1 ~ P-3）

### P-1 档案失真（必修）★

`TASK.md` 正文有 7 处与整改后的事实矛盾或陈旧。TASK.md 是本任务
**唯一事实来源**，正文与 Known Issues / 已执行整改互相矛盾即档案失效：

| # | 位置 | 现状（失真） | 修法 |
|---|------|-------------|------|
| 1 | `TASK.md:54-55` | 数据来源图写旧签名 `effectiveCustomerTrafficTotal(trafficTotal, planTrafficLimit, trafficManualCap)` + `= 手动上限 ?? 套餐月流量 ?? 存量上限` | 改为现签名与两值口径（可加「整改后」标注，保留定位过程的史实性） |
| 2 | `TASK.md:75-78` | 「`customers.traffic_total` **全仓无任何写入方** ⇒ 只读的历史存量列」 | 与 KI-1b（修正成立：表单 `trafficMonthlyGb` 经 `toCustomerInput` 每存必写）**直接矛盾**。正文须改为正确陈述或加「⚠️ 见 KI-1b 修正」标注 |
| 3 | `TASK.md:79-81` | 「前端从不发送 ⇒ 永远保持建表时的值」 | 同 #2，一并修正 |
| 4 | `TASK.md:85-88` | 触发条件「生效上限落到永不变化的存量 `traffic_total` ⇒ 分母是旧订阅额度」 | 这是**旧口径下**的触发条件。新口径下该场景是「不限流量」。须标注口径前提（属根因定位史实，可保留但必须标明「旧口径下」） |
| 5 | `TASK.md:111` | Scope：「根因 B 修复：让生效上限在换订阅后能反映**新订阅的额度**」 | 该方向已被人类裁决作废。须改为「根因 B 修复：生效上限改按人类裁决口径（手动 ?? 套餐），详见 R2/HANDOFF-003」 |
| 6 | `TASK.md:122` | Non-Scope：「❌ **不改** 提醒扫描 `reminder-scan.ts` 的用尽判定」 | ★**最严重**：HANDOFF-003 R-3 明确要求改、且已改完。须删除该行或改为「已按 HANDOFF-003 R-3 整改（2026-10-20）」 |
| 7 | `TASK.md:258` | Constraints：「不得改动优先级顺序（手动 > 套餐 > **订阅/存量**）」 | 「订阅/存量」已不在口径中。改为「手动 > 套餐」并注明人类裁决依据 |
| 附 | `TASK.md:270` | Dependencies：「存量数据语义澄清 blocks ⚠️ 执行位须先实测（R2）」 | R2 已作废、实测已完成。标注为「✅ 已实测（结论见 KI-1b/KI-1），R2 已作废」 |

> 修法原则：#2/#4 属**根因定位的历史过程**，可保留史实但**必须就近标注**
> 「旧口径下 / 已被 KI-1b 修正」；#1/#5/#6/#7 是**当前事实陈述**，直接改为正确内容。
> 改完后 `TASK.md` 内不得再有任何「当前口径含存量/订阅额度」的断言。

### P-2 File Scope 未登记（必修）

`src/features/customers/components/customers-columns.tsx` 与
`customers-table.tsx` 按 HANDOFF-003 R-3.1 被改动，但 File Scope yaml
**未含这两项**，违反 Constraints「超出 File Scope 的改动须先更新本字段并说明理由」。

修法：File Scope yaml 补两行，并在 TASK.md 适当位置（如 R-3.1 段或
File Scope 下方）说明：「R-3.1 所需，经 HANDOFF-003 指令追加，理由：
套餐额度经前端 `usePlanOptions()` 注入，不改后端 API 响应结构」。

### P-3 补一处披露（补登记即可）

docs 旧口径实为 **3 处**（主控位全量 grep 实测）：

- `docs/architecture/overview.md:176 / 567` —— 你已在 HANDOFF-002 披露 ✅
- `docs/technical/api-contract.md:150` —— **你漏披露** ❌
  （「生效流量上限（列表用量条）按 `trafficManualCap ?? trafficTotal` 派生」，
  整改后列表列已是「手动 ?? 套餐」）

修法：在本轮整改记录（HANDOFF-002 追加或新段）中补记该处。
**docs/** 不在 File Scope，本轮不改 docs 文件本身**（披露分支成立）；
是否修订 docs 由主控位报人类裁定（可并入后续任务）。

---

## 硬性禁令

1. ❌ 本轮**只改** `tasks/review/TASK-046-traffic-status-refresh/**` 内的档案文件
   （`TASK.md` 与 handoffs），**一行代码都不许动**
2. ❌ 不许改 `docs/**`（范围外，仅披露）
3. ❌ 不许删除 P-1 表格中标注「可保留史实」的内容——**标注修正，不是抹除过程**
4. ❌ 不许合并自己的 PR
5. ❌ 不为原方案辩护、不把失真说成「刻意留档」（除非加⚠️标注说明前提）

---

## 验收标准

- [ ] **AC-12r** `grep -n "存量上限\|trafficTotal, planTrafficLimit\|不改 提醒扫描\|全仓无任何写入方\|手动 > 套餐 >"` 在 `TASK.md` **零命中**（或仅剩带「旧口径下/已作废」标注的史实段）
- [ ] **AC-13r** File Scope yaml 含 `customers-columns.tsx` 与 `customers-table.tsx`，且有追加理由说明
- [ ] **AC-14r** 整改记录补记 `docs/technical/api-contract.md:150` 披露
- [ ] **AC-15r** `pnpm format:check` 通过（`.md` 在 prettier 覆盖范围，改档案必须过）
- [ ] **AC-16r** 改动仍限于 `tasks/review/TASK-046-traffic-status-refresh/**`；PR #21 **追加提交**（提交信息 `Refs: TASK-046`）

---

## Next Action

1. 读本文件，按 P-1（7+1 处）/ P-2 / P-3 修正 `TASK.md` 与 handoffs。
2. 跑 `pnpm format:check`（必须过）。
3. 在 PR #21 追加提交（**不新开 PR**），提交信息 `Refs: TASK-046`。
4. 在 HANDOFF-002 文末追加一段「第三轮：档案修正记录」（改了什么、为什么、
   P-3 补披露内容），或新写 `HANDOFF-004-implementer-to-coordinator.md`
   （若新写，须同步更新 TASK.md 的 Handoff 表）。
   **两种方式都须在 TASK.md 的 Handoff 表登记本文件（HANDOFF-004
   coordinator→implementer）**，并把 Next Action 指向「执行位按 HANDOFF-004
   修正档案」。
5. **停下**，等主控位复审与人类授权。

> 本轮是纯档案修正，**不需要**重跑 `pnpm test` / `typecheck:server`
> （代码零改动，`git diff` 可证仅 tasks/** 变动）。
