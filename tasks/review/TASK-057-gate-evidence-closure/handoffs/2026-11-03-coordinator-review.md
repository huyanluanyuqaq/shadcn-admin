# 2026-11-03 主控位审查记录 — PR #36 / TASK-057 门禁实证与证据链收口

| 字段 | 值 |
|------|-----|
| **审查协作位** | 主控位（Coordinator） |
| **审查实例** | 本会话（Claude Code，Opus 5）。审查前未读任何实现过程产物；全部结论独立复跑得出 |
| **被审对象** | PR [#36](https://github.com/huyanluanyuqaq/shadcn-admin/pull/36)，分支 `docs/TASK-057-traceability-probe`（base `main` `ea95b89` → head `31c5df3f`，2 提交 / 10 文件 / +407 −50） |
| **结论** | **FAIL（CHANGES_REQUESTED）** —— 1 个 BLOCKER（B-1）+ 1 个 MAJOR（M-1）+ 2 个 MINOR（m-1 / m-2） |

---

## 0. 独立性声明

本会话在审查开始前未接触 TASK-057 的任何中间产物。九要素、patch-id、审查记录一致性、
V5 四要素均由本会话**独立复现**。单一平台身份下「实现者 ≠ 批准者」无平台强制
（`dual-agent-model.md` §5.2），独立审查是流程约定。

---

## 1. 已核验为正确的部分

### A 组（审查记录入库）✅

两份记录与我交付时**逐字一致**（md5 比对 `IDENTICAL`）：

| 记录 | 路径 |
|------|------|
| TASK-056 第 3 轮 | `tasks/done/TASK-056-collaboration-upgrade/handoffs/2026-11-02-coordinator-review-round3.md` |
| TASK-058 第 1 轮 | `tasks/review/TASK-058-smoke-failures-closure/handoffs/2026-11-03-coordinator-review.md` |

内容取自 `git show 169c05b:<路径>`，未改写。

### W 组（D13-C 回填 TASK-055）✅ 九要素全部对上

| 要素 | 档案值 | 本会话独立实测 |
|------|--------|----------------|
| PR / 合并执行者 | #28 / `huyanluanyuqaq` | ✅ |
| 合并策略 | rebase-merge（单 parent `57e8781`） | ✅ |
| 提交数 | 4 | ✅ |
| merged_at | `2026-11-02T06:14:12Z` | ✅ |
| merge_commit_sha | `dc5469626d2eb349a69fd6f61c3016cd64d8dabb` | ✅ |
| 合并后 CI run | `41398641150`（push / main / success） | ✅ |
| 合并后 Docker run | `41398641143`（push / main / success） | ✅ |
| 镜像 tag | `sha-dc54696`，digest `sha256:4c1d871f…`，`2026-11-02T06:18:23Z` | ✅ |
| 审查记录 | 两份 coordinator review + **如实写明「无 AC 加严级独立实例审查」** | ✅ |

`Status: DONE`、位于 `tasks/done/`、`tasks/review/` 下已无 TASK-055，4 个 handoffs 为 `R100` 纯重命名。✅

### D+E 组（V5 实证）✅ 四要素齐全、原始输出在位

`github-capability.md` §4 的 V5 行与「原始输出」块记录了四要素：

1. `gh pr view 35 --json mergeable,mergeStateStatus` → `{"mergeable":"MERGEABLE","mergeStateStatus":"BLOCKED"}`；
2. `gh api -X PUT .../pulls/35/merge` → **HTTP 405** `Required status check "traceability" is failing.`；
3. `git rev-parse origin/main` 合并尝试前后均为 `ea95b897…`（相同）；
4. 探针 PR #35 已 **CLOSED**（未合并）—— 本会话核实 `state: CLOSED`、`mergedAt: null`。

**「traceability 确实能拦截」这一环就此闭合**，这是本任务最有价值的成果。

### 门禁 ✅

本会话复跑：`audit-repo.py` **PASS=9 FAIL=0 WARN=0**、`prettier --check .` exit 0。
PR #36 的 `audit` 与 `install-lint-build` 均 pass（run `41576001810`）。

---

## 2. 问题清单

### B-1（BLOCKER，合并前必须解决）— 探针提交混入交付分支，PR 永久红灯

| 项 | 内容 |
|----|------|
| **位置** | 分支 `docs/TASK-057-traceability-probe` 的提交 `6ee69a8a` |
| **现象** | 该提交是**探针 PR #35 的故意违规提交**（提交信息自述 "intentionally missing Refs footer"），被留在了交付分支里，作为真正工作提交 `31c5df3f` 的**父提交**。于是 `origin/main..HEAD` 含一个必然缺 `Refs` 的提交 → `traceability` **fail** → PR #36 `mergeStateStatus: BLOCKED` |
| **实测** | `gh pr checks 36` → `traceability fail`（run `41576001810`）；本地 `python scripts/check-traceability.py --base origin/main` 指名 `6ee69a8a 未在提交信息中引用任务` |
| **为什么不能靠新提交补救** | 该检查遍历区间内**每一个**提交；`6ee69a8a` 缺 footer 是既定事实，后续加多少合规提交都无法使它变绿 |
| **期望** | 从最新 `main` 切新分支，`git cherry-pick` **只搬移 `31c5df3f`**，不携带 `6ee69a8a`。探针的证据已由 `PROBE.md`、V5 行与原始输出块承载，**不需要**把违规提交本身留在交付分支里 |
| **备注** | 探针 PR #35 本身的处理是**对的**（故意违规、取证四要素、关闭且不合并）。问题只在于把它的提交留在了后续分支 |

### M-1（MAJOR）— V5 被重新定义而非新增 V6，留下 5 处自相矛盾的引用

| 项 | 内容 |
|----|------|
| **位置** | `docs/operations/github-capability.md` §4 V5 行，及 §2/§7 中所有 V5 引用 |
| **现象** | V5 的**原义**是「必需检查全绿时所有者能否合并自己的 PR（**阳性对照**，与 V4 配对）」，证据为 2026-10-15 的 PR #4。本次把 V5 **改写**为「traceability 未通过时合并是否被阻止」，但全文另有 **5 处引用仍按原义描述 V5**：L156「**绿灯 PR 正常合并**（V5，2026-10-15，PR #4）」、L173「V5 于 2026-10-15 经 PR #4 取得阳性对照」、L238「**V5 的阳性对照**…已经 TASK-034 裁决：V5 = 本项所问的『绿灯可合并』阳性对照义」、L254、L261 |
| **最严重的一处** | **L238 明确记录了一条历史裁决**（TASK-034，2026-10-15）「V5 = 阳性对照义」，与新定义**直接对立**。后人会读到两条互斥的 V5 定义，其中一条还带着「已裁决」的权威性 |
| **附带损失** | 原 §4 的「V5 编号裁决（TASK-034）」注记被**删除**，该裁决的历史记录随之丢失 |
| **期望** | 探针实证应**新增为 V6**，V5 保留原义与全部引用；若坚持重新定义 V5，则必须同步修正上述 5 处引用，并保留 TASK-034 的裁决记录（可改为「原 V5 义已于 TASK-0XX 迁移至 V6」）。**推荐前者**——阳性对照与阴性对照是两类不同的验证，不应互相顶替 |

### m-1（MINOR）— SHA 映射表的 patch-id 写「待实跑确认」而非实际值

档案 9 行全部写「patch-id 相同（**待实跑确认**）」。本会话逐对实跑
`git show --format= <SHA> | git patch-id --stable`：**9/9 确实相同**（`5324cd28` / `90ecd57a` /
`3195933e` / `2367e491` / `4ac0691` / `766f7b45` / `c3f2b406` / `8482adda` / `8808bc37`）。

**结论本身正确，但呈现为「未验证」**，而 TASK-056 的同款表记录的是实际 patch-id 前缀
（如 `patch-id 67e4c9bd 相同`）。同一仓库内两张同类表标准不一，且「待实跑确认」会让
下一个任务不确定该表是否可采信。期望：填入 9 个实际 patch-id 值。

### m-2（MINOR）— SHA 映射表不完整，漏了 TASK-055 自己的两个提交

表头自称覆盖「审查时 SHA」，但只列了 **PR #27 时代**的 9 对（TASK-052/053/054 的审查引用）。
TASK-055 **自己的**审查记录引用了 `36a3f19` 与 `2edba55`，二者：

- `git merge-base --is-ancestor` 对 `main` 均返回非 0（**不可达，已被 rebase 改写**）；
- **不在映射表内**。

期望补两行：`36a3f19 → 63235b4`、`2edba55 → 57e8781`（本会话已用 patch-id 方法确认对应关系），
否则读 TASK-055 审查记录的人仍会碰到失效 SHA。

---

## 3. 边界与受保护规则

| 检查项 | 结论 |
|--------|------|
| 产品代码 / `.github/**` / `.agents/**` / `templates/**` / `scripts/audit-repo.py` 未改 | ✅ |
| `docs/operations/negative-assertion-review.md` 未改（归 TASK-059） | ✅ 遵守了派单划分 |
| 审查记录未被改写 | ✅ 逐字一致 |
| 未削弱受保护规则、未改豁免清单 | ✅ |
| 探针 PR 未合并、已关闭 | ✅ |
| E 组探针 PR 的开具有人类授权 | ✅（Task Rules 要求，档案已登记） |
| 提交 footer `Refs: TASK-057` | ⚠️ `31c5df3f` 有；`6ee69a8a` **故意没有**（见 B-1） |

---

## 4. 整改要求

1. **【B-1】** 从最新 `main` 切新分支，`git cherry-pick` 只搬移 `31c5df3f`（**不带** `6ee69a8a`）；
   推送后确认 `gh pr checks` 三项全 pass、`mergeStateStatus: CLEAN`。
2. **【M-1】** 把探针实证改为 **V6**，恢复 V5 的阳性对照原义与 5 处引用、恢复 TASK-034 裁决注记
   （可改为「原 V5 义已迁移至 V6」）。
3. **【m-1】** SHA 映射表 9 行填入实际 patch-id 值，去掉「待实跑确认」。
4. **【m-2】** 补 `36a3f19 → 63235b4`、`2edba55 → 57e8781` 两行。

B-1 需换分支（`6ee69a8a` 已推送，不能 amend），M-1/m-1/m-2 可在同一新分支上一并完成。
**不得**对已推送历史做 rebase / amend / force-push（`git.md` §6）。

---

## 5. 结论

**FAIL（CHANGES_REQUESTED）。**

本任务做成了它最难的一件事：**用一次故意违规的探针 PR，四要素取全了「traceability 确实能拦截」的实证**，
V5 行的原始输出完整、判据可复现，这是 TASK-056 立门禁时缺的最后一块证据。A/W 两组也干净——
九要素全部对上实测、两份审查记录逐字入库、TASK-055 的 D13-C 欠账（滚过三轮）至此清偿。

但两处必须改：**探针提交不能留在交付分支里**（否则 PR 永远红），**V5 不能靠顶替阳性对照来扩容**
（否则全文出现两条互斥定义，其中一条还带「已裁决」）。两者都是「把手段留在了产物里」的同一类错误。

**Next Action：** 执行位按 §4 整改（新分支 + cherry-pick，一并完成 M-1/m-1/m-2），推送后交主控位复核；
**复核判据是 B-1**：`gh pr checks` 三项全 pass 且 `6ee69a8a` 不在 `origin/main..HEAD` 中。

> 本文件为审查记录，**未提交、未推送**（推送任务分支属执行位职责）。
