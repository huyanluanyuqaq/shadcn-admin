# 2026-10-26 主控位审查记录 — TASK-049（第一轮）

> **性质声明：** 本记录是**主控位复审**（审查实例即派单实例），按 `.agents/protocols/handoff.md` §3.2
> 的两级命名分区，**不构成** I2 独立审查。I2 须由**不携带实现上下文的新实例**执行，
> 记录另名 `handoffs/YYYY-MM-DD-review.md`。本文件与派单实例同源，故只作主控位把关，
> 通过后仍须走 I2 + 人类授权。

---

## Meta

```yaml
Task: TASK-049 — 订阅管理搜索支持按客户名称搜索
审查对象: PR #24 / 提交 fe680d3 / 分支 feat/TASK-049-subscription-search-customer-name
档案: tasks/review/TASK-049-subscription-search-customer-name/TASK.md（Updated 2026-10-24T23:40）
审查人: 主控位 Coordinator（本会话）
日期: 2026-10-26
结论: CHANGES_REQUESTED（1 阻断 + 2 次要；零代码缺陷）
```

---

## 一、已独立核实的事项（方法 → 结果）

| # | 交付方声称 | 核实方法 | 结果 |
|---|-----------|---------|------|
| 1 | `or(...matches)` 作为**单一**条件进入 AND 链 | 读 diff（`crud.ts:157-166`） | ✅ 正确。若拆成多个 `push`，AND 优先级会退化为「必须同时命中」——实现无误 |
| 2 | `exists()` 子查询关联条件在位 | 读 diff（`resources.ts:111-127`） | ✅ `eq(customers.id, subscriptions.customerId)` 在；漏掉即恒真，未漏 |
| 3 | 关键字全走 drizzle 参数绑定、无注入面 | 读 diff | ✅ `like(col, '%kw%')` 与 `exists()` 均为构建器参数化，无裸 SQL 拼接 |
| 4 | 不传 `searchCondition` 的 5 个资源行为不变 | 读 diff + 逻辑推演 | ✅ 可选字段 + `matches.length > 0` 兜底；无钩子时与原代码等价 |
| 5 | 浏览器单测 10/10（原 8 + 新 2） | PR #24 CI `install-lint-build` **SUCCESS**（该作业含 `pnpm test` 全量） | ✅ 获独立机器验证 |
| 6 | eslint / prettier / tsc -b / server typecheck 全过 | 同上 CI 作业 + 本地 `audit-repo.py`（PASS=9） | ✅ |
| 7 | 冒烟 154/7 vs 基线 152/7，7 项失败逐字相同 | 读双方日志（`E:/AiData/task049-smoke-{baseline,branch}.log`）并 diff | ✅ 除 `Date.now()` 后缀（逐运行必然不同）外逐字相同；+2 恰为新增两项 |
| 8 | 7 项失败根因 = TASK-046 语义漂移（非本任务引入） | 读 `traffic-threshold.ts:90-94` + `smoke.ts:733-742` | ✅ 独立确认：A/B 载荷无 `trafficManualCap` 且无 `planId` ⇒ `effectiveCustomerTrafficTotal(null, null)` 返回 null ⇒ `continue` 跳过 ⇒ 永不评估。与交付方判定一致 |
| 9 | 未写入真实 `server/data/app.db` | 实测 max id：订阅 79 / 客户 85（与任务前一致）；无 10-24 及 `zzq-` 数据 | ✅ 声明属实。真实库零写入 |
| 10 | 分支轮冒烟跑在**全新快照**上 | 快照库新增 id：存活订阅 86–90 / 客户 95–99（`sqlite_sequence` 高水位 97 / 102，含冒烟 CRUD 增删已删除的行），均 > 真实库上限 79/85 | ✅ 证明快照确系从源库全新 `VACUUM INTO`（若跑在基线轮残留快照上，id 会从 ~90+ 续起；字面量更正注记见下） |
| 11 | PR 可合并、单提交、CI 双绿 | `gh pr view 24` | ✅ MERGEABLE / CLEAN / 两必需检查 SUCCESS |
| 12 | 工作区清洁、无越界文件 | `git status` + diff name-status | ✅ 仅 File Scope 内 6 文件 + 任务档案 3 文件 |

**取证过程中的一点说明（不影响任何结论）：** 留存产物 `E:/AiData/task049-server.log`
记录了一次「已注册 6 个订阅同步任务」的服务端启动，与真实库现值（4 个启用订阅）不符。
经 id 序列比对（第 10 项），该日志应属**早期一次作废的脏快照启动**，实际分支轮冒烟
跑在全新快照上（由第 10 项证明）。该日志已被执行位按 M-1 重命名加注，未被 PR 正文
或交接引用，属无引证的陈旧产物，见次要项 M-1。

**字面量更正注记（2026-10-27，源自 I2 审查 M-4）：** 上表第 10 项的原字面量
「快照库 id 序列：订阅 80–90 / 客户 86–99」**跨度失准**——2026-10-27 主控位对
`E:/AiData/task049-snapshot.db` 做只读复跑实测：新增**存活** id 为订阅 86–90 /
客户 95–99，`sqlite_sequence` 高水位为订阅 97 / 客户 102（高水位含冒烟 CRUD
增删流程中已删除的行），并非原字面量的 80–90 / 86–99。**结论不受影响**：
全部新增 id 均 > 真实库上限（订阅 79 / 客户 85）、与源库无重叠，「全新
`VACUUM INTO` 快照」的判定成立；且 I2 独立审查以更强证据佐证——分支轮与
I2 全新快照复跑两轮的阈值客户 C/D 分配 id 均逐位相同（93 / 94，仅
`Date.now()` 后缀不同），起点一致 ⇒ 两轮均为全新快照。原字面量以引用形式
保留于本注记，未静默改写。

---

## 二、阻断项（必须修复后才能进入 I2）

### B-1 AC 复选框与交付状态不一致；且 AC-3 原措辞在现有基线下不可达

- **现象：** `TASK.md` 的 AC-1~AC-7 **全部未勾选**，而 `Current State` 声称
  「AC-1 / AC-2 / AC-4 / AC-5 / AC-6 / AC-7 全部通过」。
- **依据：** 项目 DoD「**AC 复选框与交付状态一致**」；TASK-047 第二轮审查的 M-1
  正是同类问题（`AC-20` 未勾），当时以「执行位补勾」收口——本项目有明确先例，
  不是可豁免项。
- **AC-3 的特殊性：** 原措辞「既有全部项目通过」在当前 `main` 上**任何人**都无法达成
  （存量 7 项红，见 Known Issues 第 1 条）。该措辞由主控位派单时写下，**其意图是「无回归」**
  （括号内已自述），而「无回归」已被基线对照证实。故正确处置不是留着不勾，
  而是**修订为可判定措辞并保留原文引用**，不得静默改词。
- **修复要求：**
  1. 勾选 AC-1 / AC-2 / AC-4 / AC-5 / AC-6 / AC-7；
  2. AC-3 正文改为（原文以引用保留，禁止删除）：

     ```text
     - [x] AC-3: 冒烟既有项无回归——在未改动 main 的同源快照、同启动参数对照下，
           失败集与基线逐字相同（7 项存量失败，根因与范围边界见 Known Issues 第 1 条），
           无新增失败、无既有项由绿转红。
           （原措辞：「既有全部项目通过」——因基线存量红色而不可达，经主控位审查
           修订为上述可判定形式；修订理由见 Known Issues 第 1 条。）
     ```

  3. `Known Issues` 第 1 条末尾补一句，登记「AC-3 措辞已由主控位审查修订」这一事实本身
     （否定性/元事实不会随勾选自动显形，须落字）；
  4. `Current State` 的「同快照库」按 M-2 一并改。
- **修复后判据：** `grep -c '^- \[ \]' TASK.md` 为 0；AC-3 行含「基线」与「原措辞」字样。

---

## 三、次要项（随阻断项同批修复，不开新议题）

- **M-1 陈旧取证产物（仓库外动作）：** 将 `E:/AiData/task049-server.log` 重命名为
  `task049-server-aborted-dirty-start.log` 并在文件首行加注「作废启动：跑在基线轮残留
  快照上（6 jobs）；实际分支轮冒烟跑在全新快照，证据见 2026-10-26-coordinator-review.md
  第 10 项」。防止后续审查者被 6 jobs 误导。**不涉及仓库文件。**
- **M-2 措辞精度：** `TASK.md` `Current State` 中「同快照库、同启动参数」改为
  「同源快照（各自从 `server/data/app.db` 全新生成）、同启动参数」——与交接
  Assumption 1 的准确表述对齐（该假设经第 9/10 项核实为真）。
- **M-3 外观瑕疵（可选）：** `TASK.md` Handoff 表 002 行行尾 `）|` 前缺一个空格。

---

## 四、明确认可、无需后续重复审查的事项

1. 核心正确性点（OR 单一条件 / 关联条件在位 / 无注入面）——已逐行读过 diff，确认无误。
2. 「基线同红、非回归」的定性与「不修阈值段」的范围边界——**认可**。
   修复要么改 A/B 载荷、要么按 TASK-046 语义重写断言，两者都超出本任务 File Scope
   且触及 TASK-013 既有断言语义；交付方选择如实记录而非假装通过，处置正确。
   该存量失败**建议单开任务**收口（不并入本任务，理由同上）。
3. `input[placeholder]` 定位的局限性与「`%` / `_` 按通配符处理」的既有行为说明——
   已在交接「未覆盖」中如实披露，认可。
4. 任务档案与实现同批提交（KI-11）——已遵守（单一提交含全部 9 文件）。

---

## 五、流程要求（修复之后）

1. 修复为**纯档案改动 + 仓库外日志重命名**，零代码改动；在**同一分支上追加一个提交**
   （不 amend、不强推——PR #24 已开且有 CI 记录）。
2. 提交信息沿用 `docs(TASK-049): …` 前缀并带 `Refs: TASK-049` footer。
3. 修复提交中**同批入库**本审查记录与整改派单 `HANDOFF-003`（KI-11：不新开
   「入库专用」交接），并在 `TASK.md` 的 Handoff 表登记 003 行。
4. 随后由**不携带实现上下文的新实例**执行 I2 独立审查（记录名
   `handoffs/YYYY-MM-DD-review.md`），通过后交人类授权合并。
5. 合并后 `Merge Record` 由**下一个任务**按 D13-C 选项 C 回填；在此之前保持
   `Status = REVIEW`、留在 `tasks/review/`。

---

## References

- 交付交接：`tasks/review/TASK-049-subscription-search-customer-name/handoffs/HANDOFF-002-developer-to-reviewer.md`
- 对照基线取证：`E:/AiData/task049-smoke-baseline.log`（152/7）、
  `E:/AiData/task049-smoke-branch.log`（154/7）
- 快照脚本：`E:/AiData/task049-snapshot.cjs`（只读源库、只写 `E:/AiData/`）
- 代码位置：`server/src/lib/crud.ts:157-166`、`server/src/routes/resources.ts:111-127`
- 规范：`AGENTS.md` §13（DoD）、`.agents/protocols/handoff.md` §3.2（两级审查命名）
