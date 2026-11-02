# 协作效率度量口径（collaboration-metrics）

> **本文件只定义口径与采集方法，不引入任何平台、仪表盘或依赖。**
> 数据源一律是仓库自身（`tasks/**`、git 历史）与 GitHub 既有记录（PR / Actions）。
>
> **目的：发现瓶颈，不是考核 Agent。** 任何指标一旦被当作绩效目标，就会被优化成数字本身
> （例如把 PR 拆得更碎以降低 Lead Time，却抬高审查成本）。本文件的指标**只用于定位「哪一段在变慢」**。

---

## 1. 采集节奏与责任位

| 项 | 约定 |
|----|------|
| 频率 | 每 10 个完成的任务统计一次；或出现「连续两个任务延期」时临时统计 |
| 执行者 | 主控位（数据只读，不改任何任务档案） |
| 留痕 | 结果追加到 `.agents/state/metrics-log.md`（**只追加，不覆盖**），保留原始命令输出 |
| 判据 | 指标恶化**不自动触发**流程变更；必须先定位到具体阶段，再决定是否改制度 |

---

## 2. 七项指标

### M1 Lead Time（交付周期）

**定义：** 任务从「需求登记」到「合并进 `main`」的墙钟时长。
**起点：** `TASK.md` 的 `Created`。**终点：** PR 的 `mergedAt`。
**回答的问题：** 一个需求从提出到可用的总时长是否在变长。

```bash
gh pr list --state merged --limit 20 --json number,title,createdAt,mergedAt \
  --jq '.[] | "\(.number)\t\(.createdAt)\t\(.mergedAt)\t\(.title)"'
```

> 起点也可用 `Owner Since`（认领时刻）—— 二者之差即**排队时间**（M1a），单独看它更能暴露「等人」还是「等改」。

### M2 Cycle Time（实施周期）

**定义：** 从「认领」到「提交交付请求」的时长，即真正在写代码的时间。
**起点：** `TASK.md` 的 `Owner Since`。**终点：** PR 的 `createdAt`。

```bash
grep -h "^Owner Since:" tasks/*/TASK-0*/TASK.md | sort | tail -10
gh pr list --state all --limit 10 --json number,createdAt,headRefName \
  --jq '.[] | "\(.number)\t\(.createdAt)\t\(.headRefName)"'
```

> **口径要点：** Cycle Time 只统计**首次**认领到**首次**交付。整改轮次不计入 —— 整改属 M3/M5 的范围。

### M3 PR Review Time（审查等待）

**定义：** 交付请求从「可审查」到「首条审查结论」的时长。
**起点：** PR 的 `createdAt`（本仓库不区分 Draft，Draft 期视同未交付，故用 `createdAt` 偏保守）。
**终点：** 首条 `review` 的 `submitted_at`。

```bash
gh api repos/huyanluanyuqaq/shadcn-admin/pulls/28/reviews \
  --jq '.[] | "\(.submitted_at)\t\(.state)\t\(.user.login)"'
```

> 无 review 时该指标**不可计算**，应如实记「无审查记录」，而不是记 0（记 0 会把断档伪装成高效）。

### M4 Merge Conflict Rate（冲突率）

**定义：** 合并过程中出现 Git 冲突的 PR 占比。
**判据（可自动）：** PR 的 `mergeable` 曾为 `CONFLICTING`，或分支提交中出现 `Resolve conflict` / `Merge branch 'main'` 类提交。
**判据（人工）：** 审查记录中出现「冲突」处置段落。

```bash
gh pr list --state all --limit 20 --json number,mergeable,headRefName \
  --jq '.[] | "\(.number)\t\(.mergeable)\t\(.headRefName)"'
```

> **注意：** `mergeable` 是**当前**状态，只反映查询时刻。历史冲突需从提交历史推断——
> 因此本指标只能给出**下限**，不得声称「冲突率为 0」。

### M5 Rework Rate（返工率）

**定义：** 需要至少一轮 `CHANGES_REQUESTED` 才合并的 PR 占比。
**判据：** PR reviews 的 `state` 中出现 `CHANGES_REQUESTED`。

```bash
gh api repos/huyanluanyuqaq/shadcn-admin/pulls/28/reviews --jq '[.[].state] | join(",")'
```

> 本仓库更常见的形态是「审查记录写 FAIL 但未在平台上点 REQUEST_CHANGES」——
> 平台数据会**低估**返工率。此时以 `handoffs/` 中的审查结论为准（`grep -l "FAIL" tasks/**/handoffs/*review.md`），
> 并在留痕中注明「口径来源：审查记录」。

### M6 CI Failure Rate（检查失败率）

**定义：** Actions 运行中 `conclusion=failure` 的占比（按工作流分别统计）。

```bash
gh run list --workflow=ci.yml --limit 30 --json conclusion \
  --jq 'group_by(.conclusion) | map({(.[0].conclusion): length}) | add'
```

> **必须按工作流分开看**：`docker.yml` 的失败多为外部（DockerHub 网络/凭据），
> 与 `ci.yml` 的代码质量失败不是同一类问题，混在一起会掩盖真因。

### M7 Blocked Time（阻塞时长）

**定义：** 任务处于 `BLOCKED` 状态的总时长。
**起点：** 状态切换为 `BLOCKED` 的 Handoff 时间。**终点：** 切回 `ACTIVE` 的 Handoff 时间。

```bash
grep -rl "Status: BLOCKED\|BLOCKED" tasks/*/*/TASK.md | head
grep -rh "Current State" tasks/*/*/handoffs/*.md | sort | uniq -c | sort -rn | head
```

> 本仓库尚无 BLOCKED 的专用事件流，因此该指标依赖 Handoff 文本，**精度有限**。
> 若未来 BLOCKED 超过 2 次/10 任务，应改为在 `TASK.md` 增加 `Blocked Since` 字段（属结构变更，需另立任务）。

---

## 3. 明确不采集的指标

| 指标 | 不采集的理由 |
|------|-------------|
| 代码行数 / 提交数 | 与价值无关，且会激励拆分提交、注水改动 |
| 「Agent 每小时产出」 | 无法区分「快而错」与「慢而对」；且鼓励跳过验证 |
| 故事点 / 估算偏差 | 本仓库任务粒度已由 AC 约束，估算体系收益低于维护成本 |
| 单任务耗时排名 | 会被读成考核，进而诱发数据粉饰 —— 与「诚实披露」的框架原则直接冲突 |

---

## 4. 如何读这些指标（判定规则）

| 现象 | 优先怀疑 | 不建议的第一反应 |
|------|---------|-----------------|
| M1 上升而 M2 平稳 | 排队/等待（M1a、M3） | 催执行位 |
| M2 上升而 M3 平稳 | 任务拆分过大或依赖未清 | 增加并行度 |
| M3 上升 | 主控位审查成为瓶颈 | 降低审查强度 |
| M5 上升 | 需求/验收标准不清（返工源于理解偏差） | 加强「自查」 |
| M6 上升且集中在 `ci.yml` | 本地与 CI 环境漂移（见 `known-pitfalls.md`） | 放宽检查 |
| M4 上升 | File Scope 重叠或分支生命周期过长 | 加大 rebase 频率而不查根因 |

**一条硬规则：** 任何指标异常都必须在留痕中写出**定位到的具体阶段**，
否则该次统计视为未完成 —— 数字本身不是结论。

---

## 5. 首次基线（TASK-056 实测，2026-11-02）

以本文件落盘时可见的数据建立基线，供后续对比。**只登记能实测的项**，不可计算的项如实写「数据不足」。

| 指标 | 基线值 | 数据来源 |
|------|--------|---------|
| M6 `ci.yml` 近 30 次结论分布 | `{"success": 26, "failure": 4}`（失败率 **13.3%**） | `gh run list --workflow=ci.yml --limit 30 --json conclusion` 实跑（2026-11-02） |
| M4 远端分支数 | **2**（`main` + 在途任务分支） | `git ls-remote --heads origin` 实跑（2026-11-02） |
| M3 可计算性 | **不可计算**：PR #27 的 `pulls/27/reviews` 返回 `0`，审查结论全部落在 `handoffs/**` | `gh api repos/:owner/:repo/pulls/27/reviews` 实跑 |

> 基线不追求完整。**先建立口径，再谈趋势** —— 缺数据时写「数据不足」是可接受的结果，
> 用估计值填表则会使后续所有对比失去意义。
