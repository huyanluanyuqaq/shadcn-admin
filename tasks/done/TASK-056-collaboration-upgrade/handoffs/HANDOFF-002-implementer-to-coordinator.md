# HANDOFF-002 — TASK-056 合并后收口（执行位 → 主控位）

## Meta

```yaml
From: Codex（执行位 · developer）
To: 主控位（Coordinator · Reviewer）
Task: TASK-056 — 协作体系整改（P1 失真 + P2 缺口）· 合并后收口
Date: 2026-11-02T20:20:00+08:00
Current State: DONE（档案已归档；本收口分支待主控位复核）
Branch: docs/TASK-056-required-check-and-archive
Base: main @ 4958eb17e2873eec3a072d6b9b730cb7ea2b2179
```

---

## Completed Work

### 1. 平台改动的前后原始输出

**必须先如实说明一件事：本任务没有、也不可能重新取得 `required_status_checks` 的「改动前」实测值。**
平台改动（由主控位把 `traceability` 加入必需检查）发生在**本分支切出之前** —— 本任务开始执行时，
`contexts` 已含 `traceability`。因此下表「改动前」一格**引自 TASK-056 合并前的既有留证**
（`handoffs/HANDOFF-001-developer-to-reviewer.md` 的「必需检查实测」原始输出段，2026-11-02 由执行位记录），
**不是本任务重新跑出来的**；「改动后」一格由本任务于 2026-11-02 实跑取得。
本任务**不得**把引自旧留证的前值伪装成本任务的新实测。

| 阶段 | 命令 | 原始输出 |
|------|------|----------|
| 改动前（**引自 `HANDOFF-001` 既有留证，非本任务复测**） | `gh api repos/huyanluanyuqaq/shadcn-admin/branches/main/protection --jq '{approvals: .required_pull_request_reviews.required_approving_review_count, contexts: .required_status_checks.contexts, enforce_admins: .enforce_admins.enabled}'` | `{"approvals":0,"contexts":["audit","install-lint-build"],"enforce_admins":true}` |
| 改动后（本任务 2026-11-02 实跑） | `gh api repos/huyanluanyuqaq/shadcn-admin/branches/main/protection/required_status_checks` | 见下方原始输出块 ① |

**原始输出 ① —— 改动后，`required_status_checks`（本任务实跑）：**

```text
{"url":"https://api.github.com/repos/huyanluanyuqaq/shadcn-admin/branches/main/protection/required_status_checks","strict":false,"contexts":["audit","install-lint-build","traceability"],"contexts_url":"https://api.github.com/repos/huyanluanyuqaq/shadcn-admin/branches/main/protection/required_status_checks/contexts","checks":[{"context":"audit","app_id":15368},{"context":"install-lint-build","app_id":15368},{"context":"traceability","app_id":15368}]}
```

**原始输出 ② —— 改动后，`/protection` 全量（本任务实跑，用于逐字段核对 §2 表）：**

```text
{"allow_deletions":{"enabled":false},"allow_force_pushes":{"enabled":false},"enforce_admins":{"enabled":true,"url":"https://api.github.com/repos/huyanluanyuqaq/shadcn-admin/branches/main/protection/enforce_admins"},"lock_branch":{"enabled":false},"required_conversation_resolution":{"enabled":false},"required_linear_history":{"enabled":false},"required_pull_request_reviews":{"dismiss_stale_reviews":false,"require_code_owner_reviews":false,"require_last_push_approval":false,"required_approving_review_count":0,"url":"https://api.github.com/repos/huyanluanyuqaq/shadcn-admin/branches/main/protection/required_pull_request_reviews"}}
```

**逐字段比对结论：** 与用户给定的实测值**逐项一致** —— `contexts` 已含 `traceability`、
`strict = false`、`enforce_admins.enabled = true`、`required_approving_review_count = 0`。
除 `contexts` 由 2 项增至 3 项外，其余字段与 2026-10-15 的首次实测**逐字段相同**。

### 2. 过期陈述更正清单（10 处，判据全部为 `gh api` 实测输出）

> 用户派单称「8 处」；执行位逐文件扫描后实际命中 **10 处**（含用户清单未点名的
> `AGENTS.md` §14.4 段首与 `docs/operations/github-capability.md` §2 表行、以及能力记录文件头）。
> 这 10 处是上表的**超集**；两处「落差表」均已同步修改。下表供主控位逐处复核。

| # | 文件 | 位置 | 原陈述（过期） | 现陈述 |
|---|------|------|----------------|--------|
| 1 | `AGENTS.md` | §14.1 检查表 `traceability` 行 | 「**否**（TASK-056 已落地作业，尚未设为必需）」 | 「是（2026-11-02 起）」 |
| 2 | `AGENTS.md` | §14.1 警示段 | 「`traceability` 当前**不是门禁**……**尚未**加入必需检查」 | 「**已于 2026-11-02 由主控位加入必需检查**」+「启用顺序不可颠倒」**保留为历史说明** |
| 3 | `AGENTS.md` | §14.4 段首 | 「必需检查 `install-lint-build` + `audit`」 | 「必需检查 `install-lint-build` + `audit` + `traceability`（三项，2026-11-02 实测）」 |
| 4 | `docs/agent-collaboration.md` | §4 可追溯性段 | 「**尚未**被加入必需检查，因此**当前不构成门禁**」 | 「已于 2026-11-02 由主控位加入必需检查，因此当前构成门禁」 |
| 5 | `docs/agent-collaboration.md` | §6 落差表「合并前必须通过必需检查」行 | 保证来源 = 「平台设置（`install-lint-build` + `audit`）」 | 保证来源 = 「平台设置（`gh api …/protection/required_status_checks` 实测 `contexts` = 三项）」 |
| 6 | `docs/operations/github-capability.md` | 文件头「最后更新」 | 「`traceability` 作业落地但**未**设为必需」 | 「`traceability` **已由主控位加入必需检查**，`contexts` 实测含 3 项」 |
| 7 | `docs/operations/github-capability.md` | §2 表「要求状态检查通过」行 | 「选定 `install-lint-build` + `audit`（共 **2** 项）」 | 「选定三项（共 **3** 项；第 3 项于 2026-11-02 由主控位加入）」 |
| 8 | `docs/operations/github-capability.md` | §3 检查表 `traceability` 行 | 「**否**（作业已存在，未加入 `contexts`）」 | 「**是**（2026-11-02 起，`gh api` 实测已在 `contexts` 中）」 |
| 9 | `docs/operations/github-capability.md` | §3「实测」段 | 「`contexts` 仍为 `["audit","install-lint-build"]`……**当前不是门禁**」 | 「`contexts` = 三项齐全……**当前是门禁**」 |
| 10 | `docs/operations/github-capability.md` | §5 落差表「合并前必须通过必需检查」行 | 保证来源 = 「平台设置（`install-lint-build` + `audit`）」 | 保证来源 = 「平台设置（`gh api …/protection/required_status_checks` 实测 `contexts` = 三项）」 |

**两份落差表的一致性：** `docs/agent-collaboration.md` §6 与 `docs/operations/github-capability.md` §5
仍为**同 8 行、同列、逐行一致**；两处均在表前新增同一句「**判据（2026-11-02 起）：『平台设置』一列的值一律以
`gh api …/protection/required_status_checks`（以及 `/protection` 全量）的实测输出为准，不得以本文档的既有陈述代替实测**」。
另在能力记录 §8 漂移表新增一行 `required_status_checks.contexts` 的「原记录 → 实测值」登记
（平台改动不在版本历史内，按该文件自身纪律必须登记）。

### 3. Merge Record 九要素回填 + 归档

- `tasks/review/TASK-056-collaboration-upgrade/TASK.md` 的 `## Merge Record` 九要素已全部填实测值
  （PR #29、rebase-merge、10 commits、`merged_at 2026-11-02T11:29:15Z`、
  `merge_commit_sha 4958eb17e2873eec3a072d6b9b730cb7ea2b2179`、CI run `41437221317`、
  Docker run `41437221458`、镜像 `sha-4958eb1` digest `sha256:286158132fe66359cd3e8699a695df0e4d77e04b755f7a61ffb71ae494bac406`、
  审查记录指向两份主控位审查记录）。
- `Status: REVIEW` → `Status: DONE`，并以 `git mv` 移入 `tasks/done/`（保留历史，未用 rm + 新建）。
- `Known Issues` 第 1、3 条已就地闭合（两条否定性断言已分别被平台实测与 SHA 映射表推翻）。

### 4. SHA 映射表（10 行，判定方式未照抄 TASK-055）

`## Merge Record` 内新增「SHA 映射表」小节，10 行。**判据与 TASK-055 先例不同**：
TASK-055 的 rebase 基点未变（`2ca5d50` → `2ca5d50`），旧/新 tree 相同；
本任务基点由 `2ca5d50` **前移到 `d7cb861`**，逐对 tree **不相同**。
故本表改用 **patch-id 相同** + `git range-diff` 为判据，两条命令均由执行位独立实跑：

```text
$ git range-diff 2ca5d50..c701418 d7cb861..4958eb1
 1:  e9a994f =  1:  4b0567e docs(TASK-056): 登记协作体系整改任务
 2:  f04831a =  2:  98c8c15 docs(TASK-056): 协作体系审计报告入库
 3:  c28da6a =  3:  e985e7c feat(TASK-056): 新增任务可追溯性检查并用独立作业承载
 4:  aaa02d1 =  4:  326a939 docs(TASK-056): 更正 Docker 触发口径与 Issue 通道的失真
 5:  9551e20 =  5:  fcb63ee docs(TASK-056): 补充效率度量口径与场景验证清单
 6:  b3b21b5 =  6:  fe4da69 docs(TASK-056): 统一两份历史档案的 Meta 结构
 7:  82f057f =  7:  247fdc7 docs(TASK-056): 回填首次度量基线
 8:  075e087 =  8:  b6f51bb docs(TASK-056): 档案收口并转入待审查
 9:  f9ee16e =  9:  bd4999c docs(TASK-056): 档案登记交付请求号与 CI 实测
10:  c701418 = 10:  4958eb1 docs(TASK-056): 主控位审查 F-1~F-4 已改正

$ for s in e9a994f f04831a c28da6a aaa02d1 9551e20 b3b21b5 82f057f 075e087 f9ee16e c701418; do
>   git merge-base --is-ancestor $s main; echo "$s -> $?"; done
e9a994f -> 1
f04831a -> 1
c28da6a -> 1
aaa02d1 -> 1
9551e20 -> 1
b3b21b5 -> 1
82f057f -> 1
075e087 -> 1
f9ee16e -> 1
c701418 -> 1
```

（`1` = 非祖先，即旧 SHA 在 `main` 上不可达；10/10 全部不可达。）
另有两个负向自测临时提交 `f93bcc71` / `9801af63`（`HANDOFF-001` 测试表）已 `reset --soft` 撤销，
`git branch -a --contains` 为空、亦非 `main` 祖先 —— **没有、也不可能有**对应的 main SHA，已如实登记、不补造映射。

### 5. 三份主控位审查记录纳入版本控制

此前三份审查记录一直未入库（工作树未跟踪）。本次一并以 `git add` 纳入：

- `tasks/review/TASK-055-archive-backfill-and-email-binding-residuals/handoffs/2026-11-02-coordinator-review-round3.md`
- `tasks/done/TASK-056-collaboration-upgrade/handoffs/2026-11-02-coordinator-review.md`
- `tasks/done/TASK-056-collaboration-upgrade/handoffs/2026-11-02-coordinator-review-round2.md`

（TASK-056 的两份随 Task 目录一起 `git mv` 至 `tasks/done/`；路径变化但内容一字未改。）

---

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `AGENTS.md` | 修改 | §14.1 检查表与警示段、§14.4 必需检查清单（3 处） |
| `docs/agent-collaboration.md` | 修改 | §4 可追溯性段、§6 落差表该行 + 「保证来源」判据段（3 处） |
| `docs/operations/github-capability.md` | 修改 | 文件头、§2 表行与复核结论、§3 表行与实测段与启用顺序段、§5 落差表该行与判据段、§8 漂移表新增一行 |
| `tasks/review/TASK-056-collaboration-upgrade/TASK.md` → `tasks/done/…` | 修改 + `git mv` | Merge Record 九要素、SHA 映射表、Status → DONE、Known Issues 1/3 闭合、Handoff 表加 002 行 |
| `tasks/done/TASK-056-collaboration-upgrade/handoffs/HANDOFF-002-implementer-to-coordinator.md` | 新增 | 本文件 |
| `tasks/review/TASK-055-…/handoffs/2026-11-02-coordinator-review-round3.md` | 新增（纳入版本控制） | 原未跟踪 |
| `tasks/done/TASK-056-…/handoffs/2026-11-02-coordinator-review.md` | 新增（纳入版本控制） | 原未跟踪 |
| `tasks/done/TASK-056-…/handoffs/2026-11-02-coordinator-review-round2.md` | 新增（纳入版本控制） | 原未跟踪 |

**未改动：** `src/**`、`server/**`、`shared/**`、`package.json`、`pnpm-lock.yaml`、`.github/**`、
`.agents/**`、`templates/**`、`scripts/audit-repo.py`（含其豁免清单）、`scripts/check-traceability.py`、
`docker.yml`、任何历史 `handoffs/*.md` 的正文。

---

## Tests

| 项 | 命令 | 退出码 | 输出摘要 |
|----|------|--------|---------|
| 仓库级框架审计 | `python scripts/audit-repo.py` | **0** | `PASS=9 FAIL=0 WARN=0` |
| 格式检查 | `node node_modules/prettier/bin/prettier.cjs --check .` | **0** | `All matched files use Prettier code style!` |
| 状态一致性 | 全档案 `^Status:` 与所在目录比对 | — | `done/` 下无 `REVIEW`、`review/` 下无 `DONE` |

**未运行 `pnpm test` / `tsc` / `eslint`：** 本收口为纯文档与档案改动，零产品代码变更。
（本机 `pnpm exec` 会触发 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` 的依赖重装中断，
故 prettier 以 `node node_modules/prettier/bin/prettier.cjs` 直接调用，同一二进制、同一配置。）

---

## Known Issues

1. **`required_status_checks` 的「改动前」值本任务未复测**（见 §1）。前值引自 TASK-056 合并前的既有留证；
   这是时间上不可逆的事实，不是疏漏，但复核时**不得**把它当作本任务的新实测。
2. **SHA 映射表的判据与 TASK-055 不同**（patch-id vs tree）。原因是 rebase 基点前移；
   已在档案中写明差别与理由，避免后人照抄先例得出「tree 不同 ⇒ 内容被改」的误判。
3. **TASK-055 仍留在 `tasks/review/`（`Status: REVIEW`）**：按 D13-C（选项 C）其归档回写须并入
   **下一个任务**的交付请求，本任务不代为回填（避免越界与重复记账）。
4. **本机 `pnpm exec` 不可用**（依赖目录状态异常，见 Tests 节），已改用直接调用 node 二进制；
   CI 上的完整流水线不受影响。
5. **`.github/PULL_REQUEST_TEMPLATE.md` 仍写着「本仓库 Issues **已启用**」** —— 这是 TASK-056 的
   **遗留失真**（该任务的 AC-2 要求「关闭 Issues 后，所有『Issues 已启用』的表述必须改为事实陈述」，
   但漏掉了 PR 模板这一处）。**本次刻意未改**：它不属于派单列举的必需检查类陈述，改它属于扩大范围。
   已如实登记，请主控位裁决是否另立任务或在本分支补改。

---

## Assumptions

- 「8 处过期陈述」按**实际扫描结果 10 处**执行（超集），逐处列于 §2 供复核；
  未因数字不符而少改任何一处。
- 平台改动（加入必需检查）由主控位完成，本任务只做**复核与文档收口**，未调用任何写接口。
- 镜像 digest 以 DockerHub Tags API 匿名读取得准，未推拉任何镜像。

---

## Risks

- **本 PR 自身会被 `traceability` 门禁检查**：本分支每个提交均带 `Refs: TASK-056`，
  且 TASK-056 档案在 `tasks/**` 下真实存在，判据区间 `origin/main..HEAD` 内无历史欠账 commit。
- **回滚成本**：全部改动为文档与档案，可 `git revert`；平台侧若需回退 `traceability`
  必需检查，由主控位在网页端操作（本任务不代为执行）。

---

## Remaining Work / Next Action

1. 主控位复核本分支（重点见 `TASK.md` 的 `Next Action` 三条）。
2. 合并后复核 `required_status_checks.contexts` 仍含 `traceability`（平台配置不在版本历史内）。
3. TASK-055 的归档回写按 D13-C 并入**下一个任务**的交付请求。