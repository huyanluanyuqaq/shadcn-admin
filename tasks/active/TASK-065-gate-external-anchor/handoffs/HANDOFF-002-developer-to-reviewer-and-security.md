# HANDOFF-002 — TASK-065 实施记录与移交（Developer → Reviewer + Security）

| 字段 | 值 |
|---|---|
| **From** | Developer（执行位） |
| **To** | Reviewer 位 + Security 位（双重审查，Task Rules 增强条） |
| **Task** | TASK-065 为审计脚本门禁建立不随同步覆盖的外部锚点（Level L，P1） |
| **Date** | 2026-11-06 |
| **分支** | `feat/TASK-065-gate-external-anchor`（自 `main` @ `b3a260a` 派生） |
| **方案** | A+：CI 侧独立哈希校验 + 双址登记交叉校验 + 见证作业（选定理由见 TASK.md §Scope「方案选定」） |

---

## 1. Current State

锚点已落地并自验通过：`python shared/scripts/audit-project.py` → `PASS=12 FAIL=0 WARN=2 SKIP=0` /
exit 0；`python scripts/check-traceability.py --base origin/main` → PASS。**未合并、未批准、未把任何
作业加入 `required_status_checks`**（加入须人类再次批准，为合并后由主控位执行的步骤）。

---

## 2. Completed Work

| 组件 | 文件 | 职责 |
|---|---|---|
| 锚点作业 | `.github/workflows/gate-anchor.yml`（新增） | `gate-anchor`：on push(main) + PR；以登记的期望哈希校验 `shared/scripts/audit-project.py`；校验逻辑不在被校验文件内 |
| 校验逻辑 | `shared/scripts/gate_anchor_check.py`（新增） | 三方一致性：实际脚本哈希 == 工作流期望哈希 == 基线文件哈希；缺一即 FAIL（fail-closed）；只读、不执行被校验脚本 |
| 基线文件 | `.github/gate-anchor-baseline.txt`（新增） | 第二处期望哈希登记 + 来源 / 变更方式；与工作流交叉校验 |
| 见证作业 | `.github/workflows/ci.yml`（修改，仅新增作业） | `anchor-witness`：监视锚点作业在位性、配置完好性、校验逻辑登记哈希；与锚点作业不同文件 |

**与 A14 的职责分工（AC-7）：** A14 检出「项目副本 vs 中央副本」的**两仓工作树不一致**（保留原样，
本任务未改其判据）；本锚点检出「脚本 vs 已批准基线」的**回退**，且校验逻辑不在同步范围内 ——
两者覆盖的正是 TASK-064 双审查指出的 A14 自引用盲区（自覆盖 / 自篡改）。

---

## 3. Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `.github/workflows/gate-anchor.yml` | 新增 | 锚点作业（含 `on:` / `permissions:`，满足 A8） |
| `shared/scripts/gate_anchor_check.py` | 新增 | 校验逻辑；显式排除于 `SYNC_SCRIPTS`（登记于 TASK.md） |
| `.github/gate-anchor-baseline.txt` | 新增 | 基线哈希 + 来源登记 |
| `.github/workflows/ci.yml` | 修改 | 新增 `anchor-witness` 作业；现有四作业与触发条件未动 |
| `tasks/active/TASK-065-gate-external-anchor/TASK.md` | 修改 | 方案选定与理由、执行状态、AC、探针回写、Known Issues、Handoff #002 |
| `tasks/active/TASK-065-gate-external-anchor/handoffs/HANDOFF-002-…md` | 新增 | 本记录 |

---

## 4. Tests（四步实测：注入缺陷 → 实跑 → 恢复 → 复跑）

**探针台**（仓库外，仓库内零残留）：`E:\AiData\tmp` 本会话实测不可写（Access denied），
改用 OS 临时目录 `C:\Users\Admin\AppData\Local\Temp\TASK-065-anchor\`：

- `agent-framework/` = 中央仓沙箱副本（`.agents/` + `shared/scripts/` + `framework-version.json`），
  可运行**真实** `sync-framework.py`；
- `projects/shadcn-admin/` = 项目沙箱 git 仓库（`main`，干净），由真实仓库工作树副本 `git init` 而成；
- 见证作业的 `run:` 块以 pyyaml 从 `ci.yml` **原样抽取**后由 Git 自带 GNU bash/grep/sha256sum 执行
  （与 ubuntu-latest 同族工具），非复写品；
- 校验器按 CI 同方式调用：期望哈希从工作流文件读取（`--expected`），非探针硬编码。

基线哈希：已批准版 `audit-project.py` = `7eba9268a9b29554f242c159f1345abc46d2b50384cabea5f73c8f72d9fa463f`
（项目 `main` 与中央 `main` 逐字节一致）；回退前旧版（中央 `7c0e49b`）= `14f8a6a06653832610ca23ab4bc0a738569eb737cfab3554d962aefa647bea3b`。

### P0 基线

```text
checker: gate-anchor PASS：审计脚本与已批准基线一致（sha256=7eba9268…）      exit=0
witness: anchor-witness OK：gate-anchor 在位，配置与逻辑均完好              exit=0
```

### P1（AC-1a）删除被校验脚本

```text
checker: [FAIL] 被校验脚本缺失：shared\scripts\audit-project.py
         （审计脚本被删除？锚点不执行脚本，只校验其在位与哈希）                exit=1
restored: gate-anchor PASS …                                                exit=0
```

锚点不依赖被校验脚本可执行 —— 脚本被删后锚点仍运行并给出预期信号。

### P2（AC-1b）篡改被校验脚本（`A14` → `A15`，3 字节）

```text
checker: [FAIL] 审计脚本与已批准基线不一致（疑似被同步回退或直接替换）：
         actual=370bc731… expected=7eba9268…                                exit=1
restored: gate-anchor PASS …                                                exit=0
```

### P3（AC-2）真实同步回退，端到端

```text
# 中央仓沙箱脚本 := 7c0e49b（回退前版本）
$ python <bench>/agent-framework/shared/scripts/sync-framework.py --project shadcn-admin
  将同步 7 个规范文件 -> .agent-framework/；1 个脚本 -> shared/scripts/
  [OK] 已提交到分支 chore/framework-sync-2.0.0
$ git merge --ff-only chore/framework-sync-2.0.0     # 模拟人类审查后合并同步分支
  Fast-forward … shared/scripts/audit-project.py | 552 +----------------------
# 项目脚本 sha256 = 14f8a6a0…（== 7c0e49b 真本）
checker: [FAIL] 审计脚本与已批准基线不一致（疑似被同步回退或直接替换）：
         actual=14f8a6a0… expected=7eba9268…                                exit=1
```

**对照（回退态旧脚本自跑）：**

```text
A14 行: <无 A14 —— 判据随旧脚本一并消失>
A6  行: [WARN] A6  2 处疑似凭据，需人工复核
汇总:   PASS=11  FAIL=0  WARN=2  SKIP=0        exit=0
```

即：回退后旧脚本全绿无人报警，而锚点红灯 —— 正是 A14 盲区被闭合的实证。

### P4（AC-3a）移除锚点作业 / 整份删除锚点工作流

```text
witness: ::error::anchor-witness: .github/workflows/gate-anchor.yml 中不存在 gate-anchor 作业    exit=1
witness: ::error::anchor-witness: 锚点工作流缺失：.github/workflows/gate-anchor.yml               exit=1
restored: anchor-witness OK …                                                                    exit=0
```

### P5（AC-3b）篡改工作流期望哈希（改 `000…0`，脚本不动）

```text
checker: [FAIL] actual=7eba9268… expected=0000…                                                  exit=1
         [FAIL] 锚点配置漂移：基线文件与工作流期望哈希不一致
witness: ::error::anchor-witness: 基线哈希与工作流期望哈希不一致（锚点配置漂移）                  exit=1
restored: gate-anchor PASS …                                                                     exit=0
```

### P6（AC-3c）对抗性双重篡改：回退脚本 + 同步把工作流期望改成旧值，基线文件不动

```text
checker: [FAIL] 锚点配置漂移：基线文件与工作流期望哈希不一致
         （baseline=7eba9268… expected=14f8a6a0…）                                                exit=1
         [FAIL] 基线文件与脚本不一致（baseline=7eba9268… actual=14f8a6a0…）
restored: gate-anchor PASS …                                                                     exit=0
```

### P7（AC-3d）把校验逻辑改为恒真

```text
checker: （被改恒真，静默 exit=0 —— 校验已失效）
witness: ::error::anchor-witness: 锚点校验逻辑哈希与登记值不一致（逻辑被篡改？）                  exit=1
restored: anchor-witness OK …                                                                    exit=0
```

### P6''（登记残留）三重一致篡改：脚本 + 工作流 + 基线全改成旧版

```text
checker: gate-anchor PASS（sha256=14f8a6a0…）   exit=0
witness: anchor-witness OK                     exit=0
```

仓内无机械信号，仅 PR diff 可观察 —— 已如实登记于 TASK.md Known Issues #5，**不声称可防协同篡改**。

### P8（AC-4）同步范围实测

```text
$ python sync-framework.py --project shadcn-admin --dry-run
  将同步 7 个规范文件 -> .agent-framework/；1 个脚本 -> shared/scripts/
    [dry-run] change-safety.md / collaboration.md / git.md / github.md /
               permissions.md / quality.md / rule-precedence.md
    [dry-run] shared/scripts/audit-project.py
# 真实同步后，锚点相关文件字节比对：
IDENTICAL  .github/workflows/gate-anchor.yml
IDENTICAL  .github/gate-anchor-baseline.txt
IDENTICAL  shared/scripts/gate_anchor_check.py
IDENTICAL  .github/workflows/ci.yml
# 同步提交实际改动：framework-version.json（1 file changed）
```

### 自动验证（AC-6）

```text
$ python shared/scripts/audit-project.py
PASS=12  FAIL=0  WARN=2  SKIP=0      exit=0
$ python scripts/check-traceability.py --base origin/main
[traceability] PASS —— 14 个提交均引用了真实存在的任务。
```

**未执行的测试：** `pnpm test / lint / build` 未执行（无 `src/**` / `server/**` 变更，CI
`install-lint-build` 覆盖）；`pnpm knip` 实测不分析 `.py`（新增不可引用 `.ts` 会报、`.py` 不报，
已用临时探针文件双向验证）；`prettier --check` 对本 PR 全部变更文件通过。

---

## 5. Known Issues

1. **三重一致篡改无仓内机械信号**（P6'' 实证）：脚本 + 工作流 + 基线三处一起改即全绿；
   仅 PR diff 可观察 + 合并后 `required_status_checks` 兜底。不得声称可防协同篡改。
2. **锚点 / 见证均未入必需检查集**：加入须人类再次批准且遵守 §14.1 顺序（AC-5 为合并后步骤）。
3. **`gate_anchor_check.py` 与同步目标同目录**：不在 `SYNC_SCRIPTS` 列（显式排除并登记）；
   若未来 `SYNC_SCRIPTS` 扩展到它，见证作业的登记哈希可检出（FAIL）。
4. **期望哈希维护成本**：每次批准脚本变更须同 PR 更新两处登记；漏改即 FAIL（安全方向）。
5. **探针台在 OS 临时目录**：`E:\AiData\tmp` 本会话实测不可写。

---

## 6. Remaining Work

1. **Reviewer 位独立审查**（L 级必需，I2：实现者 ≠ 批准者）。
2. **Security 位审查**（Task Rules 增强条：本任务改动安全门禁基础设施）。
3. 主控位：合并 → 观察至少一次成功上报 → **人类再次批准后**加入必需检查集（AC-5）。
4. 主控位：锚点生效后回写 TASK-064 档案登记「风险已闭合」及其判据（合并后步骤）。

---

## 7. Assumptions

1. 「已批准基线」= TASK-064 合并版脚本（项目 `main` 与中央 `main` 逐字节一致，sha256 双方实测相同）。
2. 见证作业的 `run:` 块以 pyyaml 原样抽取执行，未复写；本地 GNU 工具与 CI 同族。
3. 探针台的「真实同步」指沙箱内运行真实 `sync-framework.py`，未触碰真实仓库。
4. 合并策略 rebase-merge 下，同步产物落在 `chore/framework-sync-*` 分支待审 —— 探针以
   「合并该分支」模拟回退落地，这是该工具语义下回退生效的真实路径。

---

## 8. Risks

| 风险 | 影响 | 缓解 |
|---|---|---|
| 三重一致篡改 | 仓内全绿 | PR diff 可见 + 登记可追溯 + 合并后必需检查兜底；Known Issues #1/#5 如实登记 |
| 锚点作业未入必需检查 | 不阻断合并 | 硬约束要求的顺序；AC-5 留空；主控位合并后单独执行 |
| 期望哈希忘更新 | 合法脚本变更被 FAIL | 失败方向安全；两处登记 + 档案登记义务 |
| `SYNC_SCRIPTS` 未来扩张 | 锚点逻辑可被覆盖 | 见证作业登记哈希检出；扩张须走中央仓 PR |
| 新作业引入 CI 假红 | 阻塞 PR | 本 PR 实跑四作业全绿后才开 PR；见证/锚点均为纯文件检查 |

---

## 9. Next Action

**移交 Reviewer 位与 Security 位双重审查（不携带实现上下文的新实例）。** 复审入口：

```bash
cd E:/NDLDSN-WORKSPACE/projects/shadcn-admin
git diff main...feat/TASK-065-gate-external-anchor
python shared/scripts/audit-project.py                 # 期望 PASS=12 FAIL=0 WARN=2 SKIP=0 / exit 0
python scripts/check-traceability.py --base origin/main # 期望 PASS
python shared/scripts/gate_anchor_check.py --expected "$(grep -Eo 'EXPECTED_AUDIT_SCRIPT_SHA256: *"?[0-9a-f]{64}' .github/workflows/gate-anchor.yml | grep -Eo '[0-9a-f]{64}')"
```

审查要点建议：① 校验逻辑确在 `audit-project.py` 之外（AC-1）；② 回退路径端到端实证（AC-2/P3）；
③ 自篡改三类情形的可观察信号（AC-3/P4-P7）与残留登记是否诚实（AC-8）；④ 同步范围排除的实证
（AC-4/P8）；⑤ 双址登记的维护义务是否可执行；⑥ 是否有任何门禁被判据削弱（**预期：无** ——
`audit-project.py` 零改动，现有四作业未动）。

**Developer 不自行批准本交付物**（I2 / `github.md` §6 受保护）；不合并、不改平台配置。

---

*本记录依据 `.agent-framework/collaboration.md` §2 I2 与 §5 出具。*
