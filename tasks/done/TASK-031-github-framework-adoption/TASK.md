# TASK-031 — 在 shadcn-admin 落地双 Agent GitHub 协作框架（阶段 2）

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。
>
> **本 Task 是工作空间级框架落地计划「阶段 2 · 首个项目落地」的执行载体。**
> 设计来源：`.agents/proposals/dual-agent-github-collaboration-design-v1-draft.md` §15 阶段 2。
> 规范来源：`.agents/rules/github.md`、`.agents/protocols/github-collaboration.md`、
> `.agents/protocols/github-capability-matrix.md`（Standalone 模式下这三者不存在，见本文末「Standalone 说明」）。

---

## Meta

```yaml
Task ID: TASK-031
Title: 在 shadcn-admin 落地双 Agent GitHub 协作框架（阶段 2）
Workflow: chore
Status: DONE
Priority: P1
Owner: workbuddy
Owner Since: 2026-10-14
Assigned Role: developer
Created: 2026-10-14T07:00:00Z
Updated: 2026-10-14T08:45:00Z
Branch: chore/TASK-031-github-framework-adoption
Requires Human Approval: false
Platform Config Required: true   # 阶段 3（分支保护 / 必需检查）由用户在网页端完成
```

---

## Objective

把工作空间级「双 Agent GitHub 协作框架」的**文件层落地**到本仓库：
交付描述的载体（PR 模板）、CI 的最小权限与新增审计作业、发布与合并的解耦、
文档体系（协作流程 + Git 工作流 + 平台能力记录）。

**本 Task 只做文件层变更。** 平台侧配置（分支保护、必需检查、`gh` 凭据提权）属阶段 3，
**由用户操作，本 Task 不代做、不声称已完成**。

---

## Requirements

| # | 需求 | 实现载体 |
|---|------|---------|
| R1 | 交付请求模板改为框架模板，字段与层 1（任务文件 + 交接记录）一一对应，**不产生新信息** | `.github/PULL_REQUEST_TEMPLATE.md` |
| R2 | CI 显式声明最小权限 | `.github/workflows/ci.yml` 的 `permissions:` |
| R3 | CI 增加**仓库级框架审计**作业（只读、无网络、结果确定） | `scripts/audit-repo.py` + ci.yml 的 `audit` 作业 |
| R4 | CI 的 Node 版本与本机开发环境对齐 | ci.yml `node-version` |
| R5 | 合并与「对外发布镜像」解耦：不再由 push `main` 触发镜像发布 | `.github/workflows/docker.yml` 改为 tag-only（D8） |
| R6 | 依赖更新有覆盖（供应链） | `.github/dependabot.yml` |
| R7 | 协作流程与 Git 工作流有项目内文档（Standalone 下可用） | `docs/agent-collaboration.md`、`docs/git-workflow.md` |
| R8 | 平台能力与实测结论有**事实记录**（未配置项显式标注） | `docs/operations/github-capability.md` |
| R9 | 项目入口声明必需检查、合并策略、能力记录位置 | `AGENTS.md` §14 |
| R10 | 修正指向上游的失效/误导链接 | `.github/CONTRIBUTING.md`（P-08） |

---

## File Scope

```
Owned (created):
  - .github/dependabot.yml
  - .github/PULL_REQUEST_TEMPLATE.md          （由上游版本替换）
  - scripts/audit-repo.py
  - docs/agent-collaboration.md
  - docs/git-workflow.md
  - docs/operations/github-capability.md
  - tasks/**/TASK-031-github-framework-adoption/**   （本任务档案；随状态机在 active/ → review/ → done/ 间移动）
  - tasks/backlog/TASK-032-fix-stale-assertions/**   （协议 §9「遗留问题已有独立记录」授权新建）

Owned (modified):
  - .github/workflows/ci.yml
  - .github/workflows/docker.yml
  - .github/CONTRIBUTING.md
  - AGENTS.md

Reused (not modified):
  - src/**、server/**、shared/**、package.json、vite.config.ts、.prettierignore、.prettierrc
```

**明确不新增：** `.github/CODEOWNERS`、`.github/ISSUE_TEMPLATE/**` 的新模板（D1b=甲 下
`approvals=0` 时 CODEOWNERS 无强制力；Issue 不参与状态与审查）。

---

## Design Decisions

| 决策 | 理由 |
|------|------|
| PR 模板**替换**而非新增第二个 | GitHub 只渲染 `.github/PULL_REQUEST_TEMPLATE.md` 这一路径；共存会造成"哪个生效"的歧义 |
| 审计作业放在**仓库内**独立脚本，而非复用工作空间脚本 | 工作空间脚本的扫描范围是 `.agents/`、`templates/`、`shared/` 且**显式排除 `projects/`**；本仓库被独立 clone 后看不到工作空间，门禁必须自持 |
| 审计脚本用 Python（仅标准库）、不使用 YAML 解析 | 与工作空间审计脚本同族，便于日后合并；只做文本/结构断言，避免引入依赖与网络 |
| 审计作业**不**调用 registry / `pnpm audit` | 依赖审计依赖外部网络，作为必需检查会产生不可控噪声；依赖更新由 Dependabot 覆盖（R6）。**此项已如实记为未纳入** |
| **不**把 CI 作业改名为 `verify` | 保持最小变更；必需检查名称以**本仓库实际作业名**为准，并在 `AGENTS.md` §14 与能力记录中声明 |
| `docker.yml` 保留 `workflow_dispatch` | 保留受控的人工发布出口；tag-only 只针对自动触发 |
| `latest` 标签语义**随触发方式改变** | 触发改为 tag-only 后，`:latest` 只在打版本 tag 时更新，不再随 `main` 前进 |
| `stale.yml` 本次**不动** | 属阶段 3 处置项（R7/P-10）；本次仅登记为已知遗留。**注意**：该工作流同时管理 Issues 与 PR，而本仓库 Issues 已启用（见 Known Issues 9），影响面比原判断更大 |
| 平台事实漂移的改正走**同分支追加提交**，不新建分支、不改写已推送历史 | 审查者需要看到「原断言 → 发现漂移 → 改正」的完整轨迹；重写历史会销毁证据本身 |

---

## Current State

> 2026-10-14 07:00 阶段 2 启动：分支 `chore/TASK-031-github-framework-adoption` 已从 `main`（`05bf884`）派生。
> 2026-10-14 07:10 文件层实施完成并推送，本地全绿（见 `handoffs/2026-10-14-implementation.md`）。
> 2026-10-14 07:52（UTC）`gh` 重新认证为仓库所有者 `huyanluanyuqaq`，
> **「Agent 无法创建 PR」的阻塞解除**（见同文件 §4.7）。
> 同批复核发现**平台事实漂移**：`has_issues` 由阶段 1 记录的 `false` 变为 `true`，
> 据此改正分支上 4 处断言、新增能力记录 §8「平台事实漂移记录」（见同文件 §1「追加修正」）。
> 下一步：提交追加修正 → 创建 PR → 观察 CI → 主控审查。
> 2026-10-14 07:56（UTC）**PR [#1](https://github.com/huyanluanyuqaq/shadcn-admin/pull/1) 已创建**（草稿态），
> CI 随即以 `pull_request` 事件触发，**两作业全绿**（run `38531690034`）→
> 阶段 2 最后一项验收「PR 上 CI 如期触发」**完成**
> （**后另发现**阶段 2 还有一项验收「PR 模板在 GitHub 网页渲染正常」**未人工确认**，
> 见 `Known Issues` 第 15 项 —— 二者不矛盾：本任务自身的验收标准 R1–R10 已全部满足）。（见 `handoffs/2026-10-14-ci-verification.md`）。
> 2026-10-14 08:28（UTC）**协议阶段 8 独立审查完成**。审查者为一个**独立上下文的新实例**
> （`dual-agent-model.md` §5.1 的 I2 补救手段：实现者不得验收自己的变更）。结论 **需要整改**：
> 2 项阻断（均为留痕类，非内容/代码缺陷），R1–R10 全部 PASS、修改范围零越界。
> 两项阻断已在本提交内关闭 → Status `ACTIVE` → `REVIEW`，档案移入 `tasks/review/`。
> 审查全文见 `handoffs/2026-10-14-review.md`。
> 2026-10-14 08:42（UTC）**合并完成**：PR #1 以 **rebase-merge** 合入 `main`，
> `main` 由 `05bf884` 前进到 `da93f4b`（rebase 重写 SHA，原分支 tip `03d9f02` 的等价提交已落 `main`）。
> **状态变更与归档（`Status` → `DONE`、档案移入 `tasks/done/`）随回写提交 PR #2 生效** ——
> 在 PR #1 合并后的 `main`（`da93f4b`）上，本任务**仍是 `REVIEW` 且仍在 `tasks/review/`**
> （见下方「合并后核验」的核对命令）。
> 合并后的实测结果见 `Merge Record`：**`docker.yml` 未触发**（发布解耦生效）、
> `main` 上 `push` 触发的 CI 两作业全绿；**平台门禁仍未生效**（`protection` = 404）。
> 合并后回写（本提交）按 `rules/github.md` §4 走**独立交付请求**，而非直推 `main`
> —— 由此暴露的框架内部张力已登记为 **D13**（见 `Known Issues` 第 14 项）。

---

## Verification

| 项 | 结果 |
|----|------|
| `pnpm format:check` | **通过**（All matched files use Prettier code style） |
| `pnpm lint` | **通过**（无输出，exit 0） |
| `pnpm test` | **通过**：25 文件 / **303 例全绿** |
| `pnpm build` | **通过**（✓ built in 30.14s，exit 0） |
| `python scripts/audit-repo.py` | **PASS=6 FAIL=0 WARN=0**（含 4 项受控负向测试，均已按预期失败） |
| YAML 可解析（4 个文件） | **通过**（PyYAML 6.0.3） |
| PR 上 CI（`install-lint-build` + `audit`） | **通过**：run `38531690034`（`pull_request` opened），两作业全绿（1m16s / 5s）。原始输出见 `handoffs/2026-10-14-ci-verification.md` |
| PR 上 CI（tip `d67dcf1`，`synchronize`） | **通过**：run `38532099210`，两作业全绿（1m24s / 5s）。补记层 1（此前只出现在 PR 评论，属层 2 未回写） |
| 独立审查（协议 §5 / §10 N1） | **已完成**：审查实例 `agent-2bed4676-7adc-424a-aaf0-5924f8b2983f`（**独立上下文**，非实现者）。首轮结论 = **需要整改**（2 项留痕类阻断，均已关闭），另有复审记录。**完整结论以 `handoffs/2026-10-14-review.md` §9 为准，本行不另作判定**（逐条 R1–R10 PASS/FAIL 见同文件 §3） |
| `main` 上 CI（`push` 触发，合并后自动运行） | **通过**：run `38537067337`，`install-lint-build` ✅ ／ `audit` ✅ |
| 发布解耦（D8 的实测） | **成立**：合并后 `main` 上**没有** `Build and Push Docker Image` 运行。对比历史——TASK-028 / 029 / 030 合并时**均有**该运行 → 解耦真实生效，而非仅仅写在文件里 |
| 平台门禁是否生效（V1/V2/V4/V5） | **未实测**：分支保护尚未配置（阶段 3，用户操作）。V3 已实测为「是」 |

> ⚠️ **CI 全绿 ≠ 门禁成立。** 分支保护未配置前，这两个作业只是「运行了的检查」，
> 不是「合并的前置条件」。详见 `docs/operations/github-capability.md` §2/§5。

原始输出见 `handoffs/2026-10-14-implementation.md` §4。

---

## Known Issues

1. ~~**`gh` 凭据只读**~~ → **2026-10-14 已解除**：`gh` 已重新认证为仓库所有者
   （`permissions` 实测 `admin` / `push` / `pull` / `maintain` / `triage` 全为 `true`）。
   遗留缺口：新凭据 **scopes 缺 `workflow`**，`gh workflow run` 与重跑作业不可用（**不影响** PR 操作）。
2. **平台门禁尚未启用**：分支保护 / 必需检查 / 禁止绕过 **均未配置**。
   因此「禁止直推 `main`」**当前仍是纯文档约定，平台不强制**。
3. **「实现者 ≠ 批准者」无平台强制**：单身份（D1=B）下平台无法区分两个协作位。
4. **依赖审计未纳入 CI**（见 Design Decisions）：Dependabot 只覆盖"有更新时提 PR"，不覆盖 CVE 门禁。
5. **`stale.yml` 未处置**：定时任务可能关闭长期不活跃的 PR（阈值 120 天）。
6. **上游遗留资产未清理**：`ISSUE_TEMPLATE/`、`CODE_OF_CONDUCT.md`、`FUNDING.yml`、`netlify.toml`
   仍为上游内容（D11：保留并在 `AGENTS.md` §14 标注不适用）。
7. **`AGENTS.md` §13.2 的断言疑似过时，「是否成立」本任务不作判定**：原文称「纯前端，无持久层」，
   而仓库存在 `server/` 目录，故**有可能不成立**；但本任务**未独立核实**，故**不作结论**。
   本次**不动**（不在阶段 2 文件清单内，且避免用另一句未经验证的话替换）。
   已另立 **`TASK-032` 核实并修正**；对应框架 §13.4「否定性断言复核」清单。
8. **`docs/operations/known-pitfalls.md` 等历史文档未纳入审计链接检查范围**（避免历史死链造成噪声）。
9. **平台事实漂移（本 PR 内已处置，但仍需确认）**：`has_issues` 已由阶段 1 记录的 `false`
   变为 `true`（同批读取的 `has_projects` / `has_wiki` 未变 → 属设置被改动，非当初读错）。
   分支上 4 处「Issues 关闭」的断言已改正，能力记录新增 §8 漂移记录。
   **需主控确认：** D2 的理由已改写为「避免双写 + 独立 clone 后状态完整」，不再引用
   「Issues 不可用」——请确认该理由足以**独立**支撑 D2，否则 D2 需重新裁决。
10. **提交 `5b2e00c` 的信息含已失效表述（已登记，不重写历史）** —— 独立审查的阻断项 B2。
    该提交信息以「本仓库 Issues 已关闭」作为修改理由，而实测 `has_issues=true`。
    因**不改写已推送历史**（重写会销毁「原断言 → 发现漂移 → 改正」的证据链，见 Design Decisions 末条），
    予以保留并在此**显式登记**：**以仓库内文档的现述为准**，该提交信息中的此句不再成立。
    复核命令：`git log main..HEAD --format='%h%n%B---' | grep -B2 "Issues 已关闭"`。
11. **测试计数口径**：handoff 的「25 文件 / 303 例」是 **vitest 运行器口径**；源文件独立计数为 **24**。
    差 1 **应为** `shared/dist/schema/traffic.test.js`（`shared/src/schema/traffic.test.ts` 的**编译副本**）
    被一并纳入 —— **推断依据**：`vite.config.ts` 的 `test` 段无自定义 `include` / `exclude`，
    vitest 默认仅排除 `node_modules` 与 `.git`。**运行器逐例输出无法在本环境复现**（浏览器模式依赖注册失败）。
    后续引用须注明口径，避免被误判为夸大。
12. **审计脚本 F4（明文密钥检查）不覆盖 `handoffs/`**：扫描范围为框架文档 + 工作流 + 脚本自身；
    任务档案（含粘贴的原始输出）不在扫描内。本次无真值，属**覆盖面提示**。
13. **审查独立性的残余限制**：审查实例与实现实例**上下文独立**（满足 `dual-agent-model.md` §5.1 的补救手段），
    但**同模型、同平台凭据**。单一平台身份下平台审计无法区分两个协作位 —— 结构性限制，本任务无法消除。
14. **★ 框架内部张力 D13（待裁决）**：`rules/github.md` **§4 禁止直接推送默认分支**，
    而 **§6 要求「合并后必须回写任务文件」**（状态、合并标识、检查运行标识、遗留问题）——
    而回写**只能发生在合并之后**，两者不可能同时通过「直推」满足。
    历史惯例（TASK-001~030）实际是**合并后直推 `main`** 完成回写：证据是
    `gh pr list --state all` 显示本仓库此前**没有任何 PR**（PR #1 是首个），
    因此那些「归档 + Merge Record」提交只可能落在 `main` 上。
    本任务按 §4 改为**走独立交付请求**（本条所在的 PR），代价是需要一个短生命周期的
    **记录分支**，这又与 §2「一个任务一个分支」形成第二处张力。
    **已在设计稿 §17 登记为 D13（待用户裁决）**；本任务采用的临时做法与理由见本文件 `Merge Record`
    与 `docs/operations/github-capability.md` §7。
15. **阶段 2 有一项验收未完成（已如实标注，不随本任务「完成」而掩盖）**：设计稿 §15 的阶段 2 验收中含
    「**PR 模板在 GitHub 渲染正常（需人工在网页确认一次）**」。本任务的 PR #1 描述是**用 API 写入的**，
    **没有经过模板**，因此该渲染**从未被人工确认**。本任务自身的验收标准（R1–R10）不包含此项，
    故不影响 `Status = DONE`；但**阶段 2 作为整体尚未完全验收**。
    → 需在阶段 3 由用户打开一次 GitHub 的「新建 PR」页面确认模板渲染（若模板中的 HTML 注释或字段渲染异常，
    会在那里暴露）。此项已同步登记到设计稿 §15 阶段 2 的「状态」行。

---

## Merge Record

**合并前须满足的四项（协议 §6 / §9）：**

| 条件 | 状态 |
|------|------|
| 审查通过 | **通过**（协议 §5 / §9）—— 首轮 = 需要整改 → 2 项留痕类阻断关闭 → **复审 3 轮后 PASS**（由同一独立实例续审）。**结论的唯一来源：** `handoffs/2026-10-14-review.md` §9.3 |
| 必需检查通过 | **通过**（run `38531690034` / `38532099210`，两作业全绿） |
| 分支保护条件满足 | **未配置** → 该条**不构成平台门禁**，仅为制度约定（`docs/operations/github-capability.md` §2/§5） |
| 必要的授权 | **用户在本轮明确选择「合并 PR #1」**；远端分支删除**未获授权**，故合并时**不删除**工作分支 |

| 项 | 值 |
|----|----|
| 交付载体 | PR [#1](https://github.com/huyanluanyuqaq/shadcn-admin/pull/1)（本仓库**首个 PR**） |
| 合并策略 | **rebase-merge**（`rules/github.md` §6，显式覆盖 `git.md` §5 的 squash 默认） |
| 提交范围 | `main`（`05bf884`）→ 分支 tip，**11 个提交**（其中**最后 1 个**为本审查留痕提交；此前 tip 为 `d67dcf1`，即审查时点）。核对：`git log --oneline main..HEAD \| wc -l` |
| CI · `pull_request` opened | run `38531690034`：`install-lint-build` 1m16s ✅ ／ `audit` 5s ✅ |
| CI · `pull_request` synchronize（`d67dcf1`） | run `38532099210`：`install-lint-build` 1m24s ✅ ／ `audit` 5s ✅ |
| CI · `pull_request` synchronize（审查留痕提交 `03d9f02`） | run `38536855765`：`install-lint-build` 1m17s ✅ ／ `audit` 4s ✅ |
| CI · 合并后 `main`（`push`） | run `38537067337`：`install-lint-build` ✅ ／ `audit` ✅ |
| **合并标识** | PR [#1](https://github.com/huyanluanyuqaq/shadcn-admin/pull/1)；`merged_at` = `2026-10-14T08:42:46Z`；`merged_by` = `huyanluanyuqaq`；`merge_commit_sha` = **`da93f4b`**（rebase-merge 重写 SHA；原分支 tip `03d9f02` 的内容已等价落 `main`） |
| 发布影响（**实测**，非预期） | **未发布镜像**：`main` 上未出现 `Build and Push Docker Image` 运行 → D8 解耦成立（对照见 `Verification`） |
| 分支删除 | **未执行** —— `rules/github.md` §6 要求「合并后删除该工作分支」，但**远端分支删除属破坏性操作，用户未授权**（与 D12 同域）。已登记为待授权项（`docs/operations/github-capability.md` §7） |

**合并后核验（2026-10-14 08:44Z）：**

- `main` HEAD = `da93f4b`；变更已落 `main`（`.github/dependabot.yml`、`scripts/audit-repo.py`、
  `docs/operations/github-capability.md`、`tasks/review/TASK-031-github-framework-adoption/handoffs/2026-10-14-review.md` 等）
  —— 注意：审查记录在 `main`（`da93f4b`）上位于 **`tasks/review/`**；
  本任务档案**随本 PR（#2）**才移入 `tasks/done/`（`git ls-tree -r da93f4b | grep "tasks/done/TASK-031"` → 空）
- `main` 上 `push` 触发 CI run `38537067337` ✅ 两作业全绿
- `main` 上**无** Docker 运行 → 解耦实证
- `gh api repos/huyanluanyuqaq/shadcn-admin/branches/main/protection` 仍返回 **404 Branch not protected**
  → **平台门禁仍未生效**，与 `docs/operations/github-capability.md` §2 / §5 的披露一致
- 远端分支 `chore/TASK-031-github-framework-adoption` **仍在**（未授权删除）
- 归档回写本身按 `rules/github.md` **§4** 走独立交付请求（`chore/TASK-031-archive-record`），
  **未直推 `main`**；由此暴露的 §4 / §6 张力见 `Known Issues` 第 14 项（D13）

---

## Standalone 说明

本仓库被单独 `git clone` 后没有工作空间，`.agents/**` 不存在。此时：

- 本 Task 引用的 `design v1-draft`、`github.md`、`github-collaboration.md` 不可读；
- 但 `docs/agent-collaboration.md`、`docs/git-workflow.md`、`docs/operations/github-capability.md`
  是**仓库内自持**的，Standalone 下仍然可读且有效。
