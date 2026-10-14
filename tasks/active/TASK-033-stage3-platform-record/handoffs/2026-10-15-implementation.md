# TASK-033 · 执行位交接记录（2026-10-15）

| 项 | 值 |
| -- | -- |
| 执行位 | 本会话（Implementer） |
| 分支 | `chore/TASK-033-stage3-record`（自 `main` = `e3231e7` 派生） |
| 角色声明 | 本记录由**执行位**编写。审查必须由**不携带实现上下文**的另一实例完成（`docs/agent-collaboration.md` §1）——**自我检查不等于独立审查**。 |

## 1. 交接检查清单（对应 `docs/agent-collaboration.md` §3 阶段 0 / 3）

| 检查项 | 结果 |
| ------ | ---- |
| 仓库 | `huyanluanyuqaq/shadcn-admin`（public fork） |
| 分支 | 已从最新 `main`（`e3231e7`）派生 |
| 工作区 | 开始时干净（`git status --short` 为空） |
| 规范 | 分支名符合 `<type>/TASK-<NNN>-<short-slug>`；提交 footer 含 `Refs: TASK-033` |
| 可行性 | 改动为 **3 个文档 + 1 个工作流触发/权限收窄**，无代码与依赖变更 |
| 授权范围 | 仅层 1 文件。**未**触碰 D12（删远端分支）、**未**动 D13 的裁决本身 |

## 2. 改动清单

| 文件 | 改动性质 |
| ---- | -------- |
| `docs/operations/github-capability.md` | §1 / §2 / §3 / §4 / §5 / §6 / §7 / §8 全面更新（**核心**） |
| `docs/agent-collaboration.md` | §6 落差表同步为 8 行，与能力记录 §5 逐行一致 |
| `AGENTS.md` | §14.4「平台门禁现状」由「尚未配置」改为如实描述 |
| `.github/workflows/stale.yml` | 处置：去定时触发、禁用 PR 侧处理、收窄权限 |
| `tasks/active/TASK-033-stage3-platform-record/**` | 本任务档案（新增） |

## 3. 逐条核对（R1–R8）

| # | 要求 | 结论 | 证据 / 位置 |
| - | ---- | ---- | ----------- |
| R1 | §2 改为已配置的真实终态 | **PASS** | §2 表格逐字段对应 API 字段；下方「两项刻意偏离」+「UI 陷阱」+「判据」 |
| R2 | §4 回填 V1 / V2 / V4 / V5 | **PASS** | §4 表格 + 两组原始输出代码块 + 「V1 与 V5 不可合并」说明 |
| R3 | §5 落差表更新并同步 `agent-collaboration.md` §6 | **PASS** | 两表**均为 8 行、四列同构**；两侧均加了「修改其一必须同步另一处」 |
| R4 | `AGENTS.md` §14.4 改为如实描述 | **PASS** | §14.4；**保留**了「禁止把计划写成已配置」并**新增**「反向失真同样禁止」 |
| R5 | §6 自动化能力现状更新 | **PASS** | 「修改分支保护」由「未实测」改为**「权限具备，但 Agent 侧未实测」**（见 §5 说明） |
| R6 | §7 待办重排 | **PASS** | 9 项 → 8 项，无跳号；已完成项移入独立段 |
| R7 | 处置 `stale.yml` | **PASS**（附未实测声明） | 三处收窄 + 文件内注释；`-1` 语义**未实跑**，已在 TASK.md `Known Issues` 3 与文件内注释中如实声明 |
| R8 | 不引入未实测断言 | **PASS**（自查） | 见 §5「本轮刻意避免的三处过度主张」 |

## 4. 命令与原始输出

### 4.1 分支保护终态（回填 §2 的依据）

```console
$ gh api repos/huyanluanyuqaq/shadcn-admin/branches/main/protection \
    --jq '{checks:[.required_status_checks.checks[].context], strict:.required_status_checks.strict,
           approvals:.required_pull_request_reviews.required_approving_review_count,
           enforce_admins:.enforce_admins.enabled, force_push:.allow_force_pushes.enabled,
           deletions:.allow_deletions.enabled, lock:.lock_branch.enabled}'
{"approvals":0,"checks":["audit","install-lint-build"],"deletions":false,
 "enforce_admins":true,"force_push":false,"lock":false,"strict":false}
```

> 配置前同命令返回 `404 Branch not protected`（见 §8 的漂移表行）。

### 4.2 门禁实测（2026-10-14，经用户单独授权后执行；回填 §4 的依据）

**V2 / V5 / V1（直推，以仓库所有者身份）**

```
remote: error: GH006: Protected branch update failed for refs/heads/main.
remote: - Changes must be made through a pull request.
remote: - 2 of 2 required status checks are expected.
 ! [remote rejected] tmp/v2-probe -> main (protected branch hook declined)
```

**V4（红灯 PR 合并）**

```
GET /repos/.../pulls/3        → {"mergeable":true,"mergeable_state":"blocked"}
PUT /repos/.../pulls/3/merge  → HTTP 405
  {"message":"Required status check \"install-lint-build\" is failing."}
main                          → 未变动（e3231e7）
```

**探针清理**：PR #3 已关闭；远端分支 `chore/v4-protection-probe` 与本地临时分支均已删除；
探针文件 `src/__protection-probe.ts` 已随分支移除；`git status --short` 干净；开放 PR = 0。

### 4.3 审计脚本

```
$ python scripts/audit-repo.py
[PASS] F1  覆盖全部 10 个必需字段
[PASS] F2  全部 3 个工作流均已声明 on 与 permissions
[PASS] F3  无占位符残留（共检查 8 个文件）
[PASS] F4  未发现明文密钥（共检查 9 个文件）
[PASS] F5  5 个框架文档存在、被引用且链接有效
[PASS] F6  2 个必需检查名与工作流作业名一致
PASS=6 FAIL=0 WARN=0

$ python shared/scripts/audit_framework.py   （工作空间级）
PASS=13  FAIL=0  WARN=0  SKIP=0
```

## 5. 未执行的测试及原因（如实登记）

| 未执行项 | 原因 |
| -------- | ---- |
| `pnpm lint` / `format:check` / `test` / `build` **未在本地跑** | 改动**不触及** `src/**`；而 `.prettierignore` 是**白名单**（仅 `src/` 等），`eslint .` 亦不覆盖 `docs/**` / `.github/**` / `tasks/**` / `AGENTS.md` ⇒ **这些检查对本轮改动不构成保护**。CI 仍会跑它们（用于证明「未破坏既有检查」），但**它们通过并不证明本轮文档改动正确** |
| `stale.yml` 的 `-1` 语义**未实跑** | 实跑会**真的**给沉寂 Issue 打标签/关闭。依据是 `actions/stale` 既有约定，属**未实测**（已两处声明） |
| 交付请求模板的**网页渲染** | 只能由人在浏览器目视；本任务提供「新建交付请求」页面链接供确认，**无需提交** |
| V5 的**阳性对照** | 由本交付请求本身承担 —— 合并成功即成立；合并前**不得**预先宣告 |

**本轮刻意避免的三处过度主张（自查）：**

1. **没有**把「Agent 可修改分支保护」写成「已实测可用」—— 实际从未调用过 `PUT .../protection`，
   故 §6 写为**「权限具备，但 Agent 侧未实测」**；
2. **没有**把目录 `rulesets` 的空白写成「不可用」—— 只陈述「本次刻意走经典分支保护、`rulesets` 仍为 `[]`」；
3. **没有**由直推被拒推出「仅靠必需检查就能拦住直推」—— §4 明确 V1 与 V5 的区别。

## 6. 假设、风险与回滚

- **假设**：分支保护在提交本变更期间保持现状（平台设置不在版本历史内，见能力记录 §8）。
- **风险 1 —— 自锁**：本 PR 修改了 `.github/workflows/stale.yml`。若该文件被写成非法 YAML，
  则 `ci.yml` 仍可运行（不同文件），故**不触发自锁**；但若误伤 `ci.yml`，则合并与直推会**同时被阻**，
  唯一逃生是网页端改规则。**本次未触碰 `ci.yml`。**
- **风险 2 —— 文档双双失同步**：§5 与 `agent-collaboration.md` §6 若只改一侧，
  会复现 TASK-031 的 C-2 类不实断言。两侧已互加同步要求。
- **回滚**：`git revert` 本 PR 的提交即可；`stale.yml` 的恢复步骤写在该文件注释内。

## 7. 移交主控位

- **待审**：本分支相对 `main`（`e3231e7`）的全部差异，以及本记录 §3 的 R1–R8 结论。
- **审查提示**：重点核 **R3 的两表是否真的逐行一致**、**§4 的原始输出是否与平台可复现**、
  以及**是否存在仍然失实的「未配置」类表述残留**。
- **须由用户完成的两项**：① 交付请求模板的网页渲染确认；② D13 / D12 的裁决。
