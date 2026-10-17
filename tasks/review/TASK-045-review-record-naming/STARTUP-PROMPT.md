# TASK-045 启动语（可直接整段粘贴给执行位）

> 主控位生成于 2026-10-17 20:0x。**把下方分隔线之间的全部内容整段复制**，
> 发给一个新的执行位会话即可。它已包含全部前提、命令、禁令与停手条件。

---

你现在是 **shadcn-admin 项目的执行位（implementer）**。

主控位已完成设计、实测与人类裁决，现在向你派遣一个**纯文档任务**。
你没有主控位的上下文，请严格按本指令执行；凡指令与你的判断冲突，**以本指令为准**。

## 任务一句话

在**框架模板仓库**的 `.agents/protocols/handoff.md` 中新增「§3.2 审查记录」子节，
填补一项规范空白；然后机械同步到项目快照。

## 必读（按顺序，各 10 分钟内看完）

1. `E:/NDLDSN-WORKSPACE/projects/shadcn-admin/tasks/active/TASK-045-review-record-naming/ASSIGNMENT.md`
   —— **完整指派单**。本指令是它的浓缩版，**两者不一致时以指派单为准**。
2. `projects/_workspace-template/.agents/protocols/handoff.md` 的 §2、§3 —— 找准插入点。
3. `projects/shadcn-admin/tasks/done/TASK-040-customer-renewal/handoffs/2026-10-16-coordinator-recheck.md`
   前 10 行 —— 这是规范要采纳的**既有好实践**，不要另发明命名。
4. `projects/shadcn-admin/tasks/done/TASK-033-stage3-platform-record/handoffs/`
   —— 同任务两份审查并存，是规范必须容纳的特例。

## 当前状态（主控位已核实，可直接采信）

- 项目仓库 `projects/shadcn-admin`：`main` = `origin/main` = `3eebdae`，工作区干净。
  ⚠️ **存在一个未合并的 PR #17**（setup-node v5）与一个未切换的分支 `chore/setup-node-v5`
  —— **与你无关，不要动它**。开工时正常 `git switch main` 即可。
- 模板仓库 `projects/_workspace-template`：分支 `master`、HEAD `e507f26`、工作区干净。
  ⚠️ **该仓库没有远端**，任何 `git push` 都会失败，不要尝试。

## 执行步骤

### 段一 · 模板仓库（改唯一事实来源）

```bash
cd E:/NDLDSN-WORKSPACE/projects/_workspace-template
git status --short                  # 须为空
git switch -c feat/TASK-045-review-record-naming
```

编辑 `.agents/protocols/handoff.md`：

- 把现有 §3「命名规则」的内容**完整移入新的 `### 3.1 交接记录`**（一个字都不能丢）；
- 新增 `### 3.2 审查记录`，内容照抄指派单 §6 的结构块，须含：
  - 独立审查记录：`YYYY-MM-DD-review.md`；同任务多份时 `YYYY-MM-DD-<scope>-review.md`
  - 主控位复审：`YYYY-MM-DD-coordinator-recheck.md`
  - 框架基线审查：`YYYY-MM-DD-baseline-review.md`
  - 四条约束：① 日期用**出具审查结论的日期** ② **不加轮次序号**
    （禁 `review2.md` / `review-round2.md`）③ 首行标题内含任务号
    ④ **交接记录命名不受本节约束**

```bash
git add .agents/protocols/handoff.md
git commit -m "docs(protocol): handoff.md 补「审查记录命名」子节（填补规范空白）"
```

### 段二 · 同步到项目快照 + 走 PR

```bash
cd E:/NDLDSN-WORKSPACE
cp projects/_workspace-template/.agents/protocols/handoff.md \
   projects/shadcn-admin/.agents/protocols/handoff.md
diff -q projects/_workspace-template/.agents/protocols/handoff.md \
        projects/shadcn-admin/.agents/protocols/handoff.md && echo "同步一致"

cd projects/shadcn-admin
git fetch origin && git switch main && git pull --ff-only
git switch -c chore/TASK-045-review-record-naming
git add .agents/protocols/handoff.md
git commit -m "docs(TASK-045): 同步框架 handoff.md 的审查记录命名规范

Refs: TASK-045"
python3 scripts/audit-repo.py        # 须仍为 PASS=7 FAIL=0 WARN=0
```

### 段三 · 归档本任务档案

把主控位留在 `tasks/active/TASK-045-review-record-naming/ASSIGNMENT.md` 的档案
（若它不在工作区，从指派单重建）补齐 `TASK.md`，回填实测值，
`Status → REVIEW` 并 `git mv` 到 `tasks/review/`。

## ⚠️ 硬性禁令

1. **不得重命名任何存量档案。**
   人类曾裁决「存量 11 份审查记录要重命名」，但主控位实测发现
   **11/11 全部已符合规范、无可执行对象**（规范本身就是从这 11 份的实际形态归纳的）。
   若强行改名：收益 0，代价是 **36 处引用同步修改**。
   自证方式：你的 `git diff --name-status` 中**不应出现任何 `R` 状态**。
2. **不得跳过段一直接在项目仓库里手改 `.agents/**`** —— 只能由模板仓库同步覆盖。
3. **不得改** `templates/**`、业务代码（`src/` `server/` `shared/`）、`.github/**`、`docs/**`。
4. **不得 `git push` 模板仓库**（无远端，会失败）。
5. **不得自行合并 PR。** 开 PR 后停下，等主控位审查与人类显式授权。

## 验收标准（自检后再开 PR）

- [ ] §3.1 交接命名内容**完整无丢失**，§3.2 审查记录已新增
- [ ] 两副本 `diff` 无输出
- [ ] `git diff --name-status` **无任何 `R`**（存量零重命名）
- [ ] 36 处引用零改动：`2026-10-15-review.md` 13 处、`2026-10-15-archive-review.md` 6 处、
      `2026-10-16-review.md` 5 处、`2026-10-14-review.md` 4 处、
      `2026-10-17-review.md` 4 处、`2026-10-16-coordinator-recheck.md` 4 处
- [ ] `python3 scripts/audit-repo.py` = `PASS=7 FAIL=0 WARN=0`

## 停手条件（命中任一条，立即停止并上报，不要自行变通）

① 存量校验结果不是 11/11；
② 模板仓库工作区不干净，或需要 `git push`；
③ 同步前两副本 `diff` 已不一致；
④ 发现本次改动会触及 `tasks/**/handoffs/**`；
⑤ 任何一步需要绕过段一（直接改项目内 `.agents/**`）。

## 交付物

- 模板仓库 1 个提交（无远端，仅本地提交并记录 SHA）
- 项目仓库 1 个提交 + PR（描述须**明确标注这是跨仓改动**）
- `handoffs/HANDOFF-002-implementer-to-coordinator.md`，报告：
  模板仓库提交 SHA / 项目侧同步结果 / `diff` 一致性 / 存量零改动自证 / audit 结果
- 本任务档案 `Status → REVIEW`，移入 `tasks/review/`

---

## 主控位补充说明（不需要执行位看到）

**为何要统一命名**：归档回写自动化（调研于 2026-10-17 18:3x）的前置依赖。
`Merge Record` 九要素中「独立审查记录路径」是**唯一 GitHub 查不到**的要素——
PR、提交、CI run 全部永久保存在 GitHub，只有"两轮审查、无阻断"这类判断只存在本地。
目前找它靠人肉翻目录，且 `HANDOFF-001-developer-to-reviewer.md` 这类**看似审查、实为交接**
的文件极易导致误判。地基不牢，后续任何自动化都会漏读。

**人类已做的裁决**（执行位须知但不得自行更改）：
- 裁决一「存量重命名」→ 主控位实测消解为**无对象**；
- 裁决二「同时改框架协议 `handoff.md`」→ 采纳，即本指令的两段式。