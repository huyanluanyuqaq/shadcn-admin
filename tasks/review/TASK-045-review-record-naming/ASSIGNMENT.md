# 独立审查记录文件命名规范 — 指派命令

> **本文件是可直接执行的指派单。** 复制「指派正文」整段发给执行位即可。  
> 生成时间：2026-10-17 19:5x · 角色：主控位（coordinator）  
> 依据：本轮对 `tasks/**/handoffs/` 的全量实测（54 个文件逐个定性）

---

## 一、背景：这是规范空白，不是执行偏差

**实测结论（重要，先纠正可能的误解）**：

`.agents/protocols/handoff.md` **只规定了 `HANDOFF-NNN-<from>-to-<to>.md` 的交接命名，  
从未规定「独立审查记录」的文件名。**

⇒ 所以现存命名不一致 **不是谁没遵守规矩，而是根本没有规矩**。  
本任务不是"整顿违规"，而是**填补规范空白**。

---

## 二、实测数据（54 个 handoff 文件全量定性）

### 2.1 两类文件必须分开

| 类别       | 命名形态                                                 | 数量 | 性质                    |
| -------- | ---------------------------------------------------- | -- | --------------------- |
| **交接记录** | `HANDOFF-NNN-<from>-to-<to>.md`                      | 27 | 协议已规定，**本次不动**        |
| **审查记录** | 日期开头，含 `-review`                                     | 11 | **协议未规定 ⇒ 需统一**       |
| 审查类交接    | `HANDOFF-NNN-developer-to-reviewer.md`               | 5  | 是**交接**，不是审查记录，**不动** |
| 其他实施记录   | `DATE-implementation.md` / `DATE-ci-verification.md` | 7  | 实施留痕，不在本次范围           |
| 主控位复审    | `2026-10-16-coordinator-recheck.md`                  | 1  | 已自成一类，**保留**          |

### 2.2 真审查记录的 11 份及其命名

```
2026-10-14-review.md                (TASK-031)
2026-10-15-review.md                (TASK-032 / 034 / 035 / 036 / 037 / 039)  ← 6 份同名不同任务
2026-10-15-archive-review.md        (TASK-033，归档回写审查)
2026-10-15-review.md                (TASK-033，同任务第二份）
2026-10-16-review.md                (TASK-040)
2026-10-17-review.md                (TASK-041)
```

### 2.3 发现的两个特例（规范必须容纳）

**特例 A —— 同一任务多份审查并存**（TASK-033）  
`2026-10-15-review.md` 与 `2026-10-15-archive-review.md` 同日同任务。  
⇒ 规范必须支持「一个任务多份审查」，否则会逼出覆盖丢文件。

**特例 B —— 主控位复审须与独立审查名称分区**（TASK-040）  
该文件正文已自我声明：

> ⚠️ **本文件不是 AC-10 所要求的「独立审查记录」**，**不得被计为** AC-10「两份审查记录」之一。

即**项目内已自发形成好实践**：`-review` = 独立审查、`-coordinator-recheck` = 主控位复审。  
⇒ **规范应采纳这一既有区分，而非另发明命名。**

---

## 三、规范提案（本次要落的内容）

### 3.1 命名规则

```
独立审查记录（AC-N 要求的不携带实现上下文的新实例出具）
    → handoffs/YYYY-MM-DD-review.md
    同任务多份 → handoffs/YYYY-MM-DD-<scope>-review.md
                 （scope 为 kebab-case，如 archive / round2）

主控位复审（主控位会话对已整改内容的复核，不触发 I2）
    → handoffs/YYYY-MM-DD-coordinator-recheck.md

框架基线审查（与实现不同会话，满足框架基线但不触发 I2）
    → handoffs/YYYY-MM-DD-baseline-review.md
```

**约束**：

1. 日期用**出具审查结论的日期**，不是任务创建的日期。
2. **不加轮次序号**（`review2.md`、`review-round2.md` 一律不用）——  
   多轮审查用**不同日期**或 `<scope>` 区分。
3. 文件**首行标题内必须含任务号**，便于脱离目录浏览时仍可识别。
4. **交接文件命名不受本规范约束**（沿用 `handoff.md` 协议）。

### 3.2 落盘位置

> ⚠️ **本小节已被 §6 裁决二取代**（人类 2026-10-17 19:5x 裁定「同时改框架协议」）。  
> **最终执行方式见 §6**：写入**模板仓库** `projects/_workspace-template/.agents/protocols/handoff.md`  
> 的 §3.2 子节，再机械同步到项目快照。**不在项目 `AGENTS.md` 新开规范节。**

`.agents/` 与 `templates/` 是**逐字只读快照**（`AGENTS.md` §1/§9 已声明），  
其本意是禁止**在项目内独立修改**框架规范 —— 故先改唯一事实来源、再同步。

### 3.3 存量是否重命名

> ⚠️ **本小节已被 §6 裁决一取代**（人类原裁决「要重命名」→ 主控位实测**消解为无对象**）。  
> 最终结论见 §6：**11/11 全部已合规，一个都不改。**

原提案（已不适用，保留备查）：

- 重命名会改历史档案内容，而这些档案的 SHA 已被 TASK-043 等多处 Merge Record 引用；
- 收益仅为"整齐"，而破坏追溯链的代价真实存在。

---

## 四、验收标准

- [ ] **AC-1** 模板仓库 `projects/_workspace-template/.agents/protocols/handoff.md`  
  的 §3 下新增 **§3.2「审查记录」** 子节，含 3 类命名模式与 4 条约束；  
  原有交接命名内容完整移入 **§3.1**，**无内容丢失**
- [ ] **AC-2** 两副本逐字一致：  
  `diff -q projects/_workspace-template/.agents/protocols/handoff.md
      projects/shadcn-admin/.agents/protocols/handoff.md` 无输出
- [ ] **AC-3** 存量 11 份审查记录**文件未被重命名**（裁决一已消解为无对象）；  
  `git diff --name-status` 中**不得出现**任何 `R`（重命名）状态
- [ ] **AC-4** **36 处引用零改动**：下列文件名的引用点数量与改动前一致  
  （`2026-10-14-review.md` 4、`2026-10-15-review.md` 13、  
  `2026-10-15-archive-review.md` 6、`2026-10-16-review.md` 5、  
  `2026-10-17-review.md` 4、`2026-10-16-coordinator-recheck.md` 4）
- [ ] **AC-5** 项目内 `.agents/**` **未经手工编辑**：  
  该文件的变更只能来自模板仓库同步（用 `diff` 对照模板仓库版本自证）
- [ ] **AC-6** 规范支持两个特例：TASK-033「同任务多份审查」与  
  TASK-040「独立审查 / 主控位复审名称分区」
- [ ] **AC-7** 项目侧改动走 PR 流程：作业名集合未变、  
  `python3 scripts/audit-repo.py` 仍为 `PASS=7 FAIL=0 WARN=0`

---

## 五、File Scope

```yaml
File Scope:
  - projects/_workspace-template/.agents/protocols/handoff.md   # 段一：唯一事实来源
  - projects/shadcn-admin/.agents/protocols/handoff.md         # 段二：同步目标（只可由同步覆盖）
  - tasks/active/TASK-045-review-record-naming/**              # 本任务自身档案
  - tasks/review/TASK-045-review-record-naming/**
Non-Scope (files):
  - tasks/**/handoffs/**          # ★ 存量审查记录一律不改（裁决一已消解）
  - projects/_workspace-template/templates/**    # 模板文件本次不动
  - projects/shadcn-admin/templates/**
  - src/**  server/**  shared/**
  - .github/**                         # 不新增门禁/不改工作流
  - docs/**
```

> **路径基准**：本指派单跨两个仓库。下文命令均已标注 `cd` 目标，  
> 请严格按标注切换，**不要在错误的仓库里执行 `git` 命令**。
>
> - `E:/NDLDSN-WORKSPACE/projects/_workspace-template`（模板仓库，分支 `master`，**无远端**）
> - `E:/NDLDSN-WORKSPACE/projects/shadcn-admin`（项目仓库，远端 `huyanluanyuqaq/shadcn-admin`）

---

## 六、人类裁决（2026-10-17 19:5x）与执行方式

### 裁决一：存量 11 份审查记录要重命名 → **已消解：无可执行对象**

**实测结论：11 份文件名全部已符合本规范，一个都不需要改。**

校验命令与结果（执行位须**亲自复跑**确认）：

```bash
cd E:/NDLDSN-WORKSPACE/projects/shadcn-admin
find tasks -path "*/handoffs/*" -name "*-review*.md" | grep -v "to-reviewer" \
  | while read f; do
      bn=$(basename "$f")
      echo "$bn" | grep -qE '^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9-]*review\.md$' \
        && echo "  ✅ 已合规  $bn" || echo "  ⚠️ 不合规  $bn"
    done
```

⇒ 实测 **11/11 全部 ✅**。

**根因（务必理解，否则会做无用功）**：§3.1 的命名模式**是从现存 11 份记录的实际形态  
归纳出来的**，不是凭空设计 ⇒ 归纳结果必然与被归纳对象一致。

**⚠️ 若强行重命名，风险/收益严重倒挂**：这 11 个文件名在仓库内**共 36 处引用**  
（`2026-10-15-review.md` 13 处、`2026-10-15-archive-review.md` 6 处、  
`2026-10-16-review.md` 5 处、`2026-10-14-review.md` 4 处、  
`2026-10-17-review.md` 4 处、`2026-10-16-coordinator-recheck.md` 4 处）。  
改名的收益是 0，代价是 36 处引用同步修改 + 历史档案 SHA 被波及。

> **执行位须知**：本条裁决**已由主控位消解为「无对象」**。执行位**不得**为了"看起来做了事"  
> 而重命名任何文件。若复跑上述命令发现结果与 11/11 不符，**停下上报**，不要自行判断。

### 裁决二：同时改框架协议 `handoff.md` → **可执行，分两段**

**确认规范空白属实**：`handoff.md` §3 命名规则全文**只写**  
`HANDOFF-<seq>-<from>-to-<to>.md`，§2 示例亦全为交接 ⇒ 确无审查记录命名规定。

**两副本结构（实测）**：

| 路径                                                          | 角色          | 可否直接改                |
| ----------------------------------------------------------- | ----------- | -------------------- |
| `projects/_workspace-template/.agents/protocols/handoff.md` | **唯一事实来源**  | ✅ 可改（该仓库的 master 分支） |
| `projects/shadcn-admin/.agents/protocols/handoff.md`        | 项目内**只读快照** | ⚠️ 仅可由同步覆盖，不可手改      |

两副本 `diff` 实测**完全一致**（逐字快照属实）。

**★ 关键约束**：模板仓库虽是独立 Git 仓库，但**无远端**（`git remote -v` 为空）  
⇒ 它的改动**无法走 PR 审查**。执行方式只能是：

```
模板仓库本地提交  →  手工同步文件到项目快照  →  项目侧照常走 PR
```

**执行步骤（两段）**：

**段一 · 模板仓库（改唯一事实来源）**

```bash
cd E:/NDLDSN-WORKSPACE/projects/_workspace-template
git status --short                     # 须为空
git switch -c feat/TASK-045-review-record-naming
# 编辑 .agents/protocols/handoff.md：在 §3「命名规则」下新增子节
git add .agents/protocols/handoff.md
git commit -m "docs(protocol): handoff.md 补「审查记录命名」子节（规范空白填补）"
```

**§3 内的建议结构**（保持与既有章节体例一致，**不新开一级节**）：

```markdown
## 3. 命名规则

### 3.1 交接记录
HANDOFF-<seq>-<from>-to-<to>.md
（原有内容全部移入此处）

### 3.2 审查记录（**新增**）
独立审查记录（由不携带实现上下文的新实例出具）：
    YYYY-MM-DD-review.md
    同任务多份时：YYYY-MM-DD-<scope>-review.md（<scope> 为 kebab-case）

主控位复审（主控位会话复核，不触发 I2）：
    YYYY-MM-DD-coordinator-recheck.md

框架基线审查（与实现不同会话，满足框架基线但不触发 I2）：
    YYYY-MM-DD-baseline-review.md

约束：
  - 日期用**出具审查结论的日期**，不是任务创建日期；
  - **不加轮次序号**（禁 review2.md / review-round2.md），多轮用日期或 <scope> 区分；
  - 首行标题内必须含任务号；
  - 交接记录命名不受本节约束。
```

**段二 · 同步到项目快照 + 走 PR**

```bash
cd E:/NDLDSN-WORKSPACE
cp projects/_workspace-template/.agents/protocols/handoff.md \
   projects/shadcn-admin/.agents/protocols/handoff.md
# 校验两副本一致
diff -q projects/_workspace-template/.agents/protocols/handoff.md \
        projects/shadcn-admin/.agents/protocols/handoff.md && echo "同步完成"

cd projects/shadcn-admin
git switch -c chore/TASK-045-review-record-naming   # 若尚未建分支
git add .agents/protocols/handoff.md
git commit -m "docs(TASK-045): 同步框架 handoff.md 的审查记录命名规范"
```

> **⚠️ 只读快照规则的例外**：项目 `AGENTS.md` §1/§9 声明 `.agents/` 为「逐字只读快照」，  
> 其本意是**禁止在项目内独立修改框架规范**。本任务的做法是  
> **先改唯一事实来源、再机械同步** ⇒ 符合该规则的原意。  
> **执行位不得跳过段一直接在项目内编辑。**

### 若人类后续要求补登项目级落地说明

可在项目 `AGENTS.md` 增补一句指向 §3.2 的引用（可选，非必需）。

---

## 七、背景关联：这一步为何值得做

本轮调研发现，归档回写自动化（讨论于 2026-10-17 18:3x）的**前置依赖**就是命名统一：

- `Merge Record` 九要素中，「独立审查记录路径」是**唯一 GitHub 查不到**的要素；
- 该要素目前**只能靠人肉在 `handoffs/` 里翻**，且因命名不统一而**易漏**  
  （例如 `HANDOFF-001-developer-to-reviewer.md` 看似审查，实为交接）。

⇒ **命名统一是自动化的地基**。地基不牢，后面任何自动化都会漏读。

---

# ===== 以下为可直接发给执行位的指派正文 =====

你现在是 shadcn-admin 项目的**执行位（implementer）**。  
主控位已完成设计与实测，现在向你派遣一个**纯文档任务**。

## 你的任务

在**框架模板仓库**的 `.agents/protocols/handoff.md` 中新增 §3.2「审查记录」子节，  
填补一项规范空白；然后同步到项目快照。

## 必读（按顺序）

1. 指派单 §6 裁决二（含完整的两段式命令，**照它执行**）
2. `projects/_workspace-template/.agents/protocols/handoff.md` §2、§3（找准插入点）
3. `projects/shadcn-admin/tasks/done/TASK-040-customer-renewal/handoffs/2026-10-16-coordinator-recheck.md`  
   前 10 行 —— 这是规范要采纳的**既有好实践**
4. `projects/shadcn-admin/tasks/done/TASK-033-stage3-platform-record/handoffs/`  
   —— 两个文件并存 = 多份审查的特例

## 硬性要求

- **两段式**：① 先改模板仓库 `projects/_workspace-template/.agents/protocols/handoff.md`  
  → ② 再**机械复制**到项目快照 `projects/shadcn-admin/.agents/protocols/handoff.md`。  
  **不得跳过段一直接在项目内编辑。**
- §3 重组为 **§3.1 交接记录**（原有内容完整移入，**无内容丢失**）
  - **§3.2 审查记录**（新增）。**不新开一级节。**
- §3.2 须含三类命名（照抄指派单 §6 的结构块）：独立审查 / 主控位复审 / 框架基线审查。
- 须写明四条约束：日期用**出具结论的日期**；**不加轮次序号**；首行标题含任务号；  
  **交接命名不受影响**。
- 两副本最终必须 `diff` 无输出。
- 项目侧提交前跑 `python3 scripts/audit-repo.py`，须仍为 `PASS=7 FAIL=0 WARN=0`。

## ⚠️ 关于「重命名存量记录」——已消解，**不要执行**

人类曾裁决「存量 11 份要重命名」，但主控位实测发现：

```
find tasks -path "*/handoffs/*" -name "*-review*.md" | grep -v to-reviewer
  → 11 份，逐个正则校验 → 11/11 全部已合规
```

**根因**：规范是从现存 11 份的**实际形态归纳**出来的，归纳结果必然与对象一致。  
若强行改名：收益 0，代价是 **36 处引用同步修改** + 历史档案 SHA 被波及。

> **你不得重命名任何文件。** `git diff --name-status` 中不应出现任何 `R` 状态。  
> 若你复跑校验命令发现结果不是 11/11，**停下上报**，不要自行判断。

## 禁止事项

- ❌ 不得重命名任何存量档案（见上）。
- ❌ 不得在项目仓库里手改 `.agents/**`（只能由模板仓库同步覆盖）。
- ❌ 不得改 `templates/**`、业务代码、CI 工作流。
- ❌ **不得自行合并 PR**。开 PR 后停下，等主控位审查与人类授权。
- ❌ 不得 `git push` 模板仓库（**它没有远端**，push 会失败）。

## 交付

- 模板仓库：1 个提交（`feat` 或 `docs` 类型，描述补规范空白）
- 项目仓库：1 个提交（同步），footer `Refs: TASK-045`
- 按 `.github/PULL_REQUEST_TEMPLATE.md` 填全 PR 描述，**明确标注这是跨仓改动**
- 写 `handoffs/HANDOFF-002-implementer-to-coordinator.md`，报告：  
  模板仓库提交号 / 项目侧同步结果 / `diff` 一致性 / 存量零改动自证  
  （`git diff --name-status` 无 `R`）/ audit 结果
- 项目侧任务目录 `Status → REVIEW`，移入 `tasks/review/`

## 开工前先做

```bash
# 段一准备：模板仓库
cd E:/NDLDSN-WORKSPACE/projects/_workspace-template
git status --short                  # 须为空
git switch -c feat/TASK-045-review-record-naming

# 段二准备：项目仓库
cd E:/NDLDSN-WORKSPACE/projects/shadcn-admin
git fetch origin && git switch main && git pull --ff-only
git status --short                  # 须为空
git switch -c chore/TASK-045-review-record-naming
```

## 停手条件


出现下列任一情况，**立即停止并上报主控位**，不要自行变通：  
① 存量校验结果不是 11/11；② 模板仓库工作区不干净；  
③ 两副本在同步前 `diff` 已不一致；④ 任何一步需要 `git push` 模板仓库。
