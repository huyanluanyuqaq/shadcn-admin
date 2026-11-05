# HANDOFF-002 — TASK-064 实施记录与移交（Developer → Reviewer + Security）

| 字段 | 值 |
|---|---|
| **From** | Developer（执行位） |
| **To** | Reviewer 位 + Security 位（双重审查，Task Rules 增强条） |
| **Task** | TASK-064 修正审计脚本门禁缺陷并对齐权威副本（Level L，P0） |
| **Date** | 2026-11-05 |
| **分支** | `fix/TASK-064-gate-fixes-and-authority-alignment`（自 `origin/main` @ `1f931ce` 派生） |
| **中央仓分支** | `fix/TASK-064-audit-script-authority`（自 `7c0e49b` 派生，已推送） |

---

## 1. Current State

实现与四步实测**已完成**，`python shared/scripts/audit-project.py` 实跑
`PASS=12 FAIL=0 WARN=2 SKIP=0` / exit 0；`scripts/check-traceability.py --base origin/main` PASS。
未合并、未推送项目侧分支、未创建 PR —— 等审查位结论。

---

## 2. Completed Work

### 2.1 代码（`shared/scripts/audit-project.py`，A1–A14）

| 项 | 改动 | 对应 |
|---|---|---|
| **A10** | 行尾归一化后再比对（`.replace(b"\r\n", b"\n")`）；纯行尾差异不判 FAIL，实质字节差异仍 FAIL | R-1 / AC-1 |
| **A14（新增）** | 比对项目副本与中央权威副本的 `audit-project.py`；逐字节一致 → PASS，仅行尾不同 → PASS（附注），实质不同 → **FAIL**；中央不可达 → WARN | R-2 ② / AC-2 |
| **A5** | 补 Meta `Task ID` 可解析性校验（`TASK_META_ID`，承旧 F9 的两种 Meta 形态）；不可解析 → **FAIL** | 决定 1 / AC-5 |
| **A7** | 占位符残留 WARN → **FAIL**；扫描范围维持 8 文件 | 决定 1 / AC-3 |
| **A8** | glob `*.yml` → `*.y*ml`（补 `.yaml` 盲区） | 决定 1 / AC-4 |
| **A9** | 模板缺失 WARN → **FAIL** | 决定 2 / AC-6 |
| **A11** | 无声明表 WARN → **FAIL** | 决定 2 / AC-6 |
| **A13** | **未改**（无 L 级档案时保持 SKIP） | 决定 2 / AC-6 |
| **A6** | **未改**（`main` 上 `sk-` 已在 HARD，修正已生效） | R-2 ① 只是把中央副本对齐过来 |

### 2.2 文档

| 文件 | 改动 |
|---|---|
| `.agent-framework/github.md` | §3 字段清单 8 行 → **10 行**，与 PR 模板章节、A9 硬编码清单同切分（决定 3）。由中央仓 `4bdca16` 同步而来，未在项目内手改 |
| `docs/agent-collaboration.md` | §5 字段映射表 9 行 → **10 行**，同一切分（决定 3） |
| `docs/operations/negative-assertion-review.md` | C9 → A10；C12 → A11；C18 → A10 + A14（决定 4） |
| `tasks/done/TASK-062-restore-audit-gates/TASK.md` | AC-1 尾句订正 + Known Issues 补第 4 条（决定 5） |
| `tasks/done/TASK-062-restore-audit-gates/handoffs/2026-11-05-f1-f10-comparison.md` | **新增**：F1–F10 逐条对照 + 已知收窄清单 + 探针输出 + 跨仓登记（R-4） |

### 2.3 跨仓先后关系（Requirements 5）

| 顺序 | 仓 / 分支 | 提交 | 动作 |
|---|---|---|---|
| 1 | `agent-framework` / `fix/TASK-064-audit-script-authority` | `48e892d63f5f66162bb3ee9d78335698699157d1` | 脚本落地（A14 + A10 归一化 + `sk-` 回 HARD + A5/A7/A8/A9/A11 修正） |
| 2 | 同上 | `4bdca167faf16a09ea609a413cb9d8c664ef6bd3` | `.agents/github.md` §3 统一 10 项 |
| 3 | 同上 | — | **已推送** `origin`（2026-11-05） |
| 4 | `shadcn-admin` / `fix/TASK-064-…` | `079c16b` 起 | 按 `sync-framework.py` 的同一 `shutil.copy2` 语义复制 `.agents/github.md` 与 `shared/scripts/audit-project.py` 到项目侧，`cmp` 逐字节 IDENTICAL |

> `sync-framework.py` 本体在非 `main` 分支上被拒（实测 exit 1：
> `[FAIL] 当前分支 fix/TASK-064-gate-fixes-and-authority-alignment != main`），故在交付分支上
> 按其 copy 语义手工执行同一操作。`framework-version.json` **不在**本次同步范围（本任务不是框架版本发布）。

---

## 3. Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `shared/scripts/audit-project.py` | 修改 | A1–A14；新增 A14 |
| `.agent-framework/github.md` | 修改（同步） | 由中央仓 `4bdca16` 复制 |
| `docs/agent-collaboration.md` | 修改 | §5 字段表 9 → 10 行 |
| `docs/operations/negative-assertion-review.md` | 修改 | C9 / C12 / C18 判据改指向现行检查 |
| `tasks/done/TASK-062-restore-audit-gates/TASK.md` | 修改 | AC-1 订正 + Known Issues #4 |
| `tasks/done/TASK-062-restore-audit-gates/handoffs/2026-11-05-f1-f10-comparison.md` | 新增 | F1–F10 逐条对照记录（R-4） |
| `tasks/active/TASK-064-gate-fixes-and-authority-alignment/**` | 修改/新增 | 任务档案与交接记录 |

**未改（Non-Scope 遵守）：** `src/**`、`server/**`、`shared/src/**`、`package.json`、
`pnpm-lock.yaml`、`.github/workflows/**`、`framework-version.json`、
`tasks/**`（除 TASK-062 与 TASK-064 两项外）。

---

## 4. Tests（四步实测：注入缺陷 → 实跑 → 恢复 → 复跑）

**执行环境说明：** `E:\AiData\tmp` 在本会话**不可写**（沙箱对该路径只读，实测
`New-Item` / `Set-Content` 均 Access denied），探针台改用 OS 临时目录
`C:\Users\Admin\AppData\Local\Temp\TASK-064-probe\sandbox\`：

- `shadcn-admin/` = `origin/main` @ `1f931ce` 的 **git worktree**（`.gitattributes` 声明 `eol=lf`，LF 检出）
- `agent-framework/` = 中央仓 `.agents/` + `shared/scripts/` + `framework-version.json` 镜像
- 每个探针**恢复后** `git status --porcelain` 均为空（仓库内零残留）

**基线：** 旧脚本（A1–A13）`PASS=11 FAIL=0 WARN=2 SKIP=0` / exit 0；
新脚本（A1–A14）`PASS=12 FAIL=0 WARN=2 SKIP=0` / exit 0。

| # | 探针 | 注入缺陷 | 旧脚本 | 新脚本 | 恢复后复跑 |
|---|---|---|---|---|---|
| 1 | A10-1 | `.agent-framework/git.md` 全量转 CRLF（纯行尾差异） | `[FAIL] A10 … 1 处差异` / exit 1 | `[PASS] A10` / exit 0 | `[PASS] A10` / exit 0 |
| 2 | A10-2 | 同文件第 101 字节取反（1 字节实质差异） | `[FAIL] A10 … 1 处差异` / exit 1 | `[FAIL] A10 … 1 处差异（行尾已归一化）` / exit 1 | `[PASS] A10` / exit 0 |
| 3 | A14-1 | 项目侧脚本第 201 字节取反 | **无 A14**，exit 0 | `[FAIL] A14 …（同步会覆盖门禁自身）` / exit 1 | `[PASS] A14 逐字节一致` / exit 0 |
| 4 | A7-1 | `.agent-framework/collaboration.md` 追加 `{{PROBE_TOKEN}}` | `[WARN] A7` / exit 0 | `[FAIL] A7 1 处占位符残留` / exit 1 | `[PASS] A7 …（检查 8 个文件）` / exit 0 |
| 5 | A8-1 | 新增无 `on:`/`permissions:` 的 `probe-no-on.yaml` | `[PASS] A8 3 个工作流…` / exit 0（盲区） | `[FAIL] A8 2 处不合格（共 4 个工作流）` / exit 1 | `[PASS] A8 3 个工作流…` / exit 0 |
| 6 | A5-1 | 移除 TASK-063 档案 Meta 的 `Task ID:` 行 | `[WARN] A5 编号唯一…` / exit 0 | `[FAIL] A5 1 个档案的 Meta Task ID 不可解析` / exit 1 | `[WARN] A5 编号唯一…` / exit 0 |
| 7 | A11-1 | 删除 `AGENTS.md` §14.1 声明表 | `[WARN] A11 …未声明必需检查表` / exit 0 | `[FAIL] A11 …未声明必需检查表` / exit 1 | `[PASS] A11 3 个必需检查名…` / exit 0 |
| 8 | A9-1 | 删除 `.github/PULL_REQUEST_TEMPLATE.md` | `[WARN] A9 缺少 PR 模板` / exit 0 | `[FAIL] A9 缺少 PR 模板` / exit 1 | `[PASS] A9 PR 模板覆盖必需字段` / exit 0 |
| 9 | A13-1 | 移走全部 `Level: L` 档案 | —（逻辑未改） | `[SKIP] A13 无 L 级档案在检（跳过 61 个）` / exit 0 | `[PASS] A13 2 个 L 级档案…` / exit 0 |
| 10 | CMP-1 | `cmp` 两仓脚本 | — | exit 0，**IDENTICAL** | — |

**扫描范围（AC-3「维持或扩大」）：** A7 旧/新均为 8 文件；A8 旧 3 个（`*.yml`）、新 3 个
（`*.y*ml`；注入 `.yaml` 后在检 4 个）。
**现有档案全过（AC-5）：** 分支上 64 个 `TASK.md` 全部含可解析 Meta `Task ID`，A5 无 FAIL。

**自动验证（AC-11）：**

```text
$ python shared/scripts/audit-project.py
[PASS] A1  .agent-framework/ 7 篇规范 + framework-version.json 均在位
[PASS] A2  版本一致 v2.0.0
[PASS] A3  无迁移前遗留目录
[PASS] A4  64 个档案的 Status 与目录一致、Owner 齐全
[WARN] A5  编号唯一（63 个）；断档 1 处、已登记豁免 1 组
[WARN] A6  2 处疑似凭据，需人工复核
[PASS] A7  无占位符残留（检查 8 个文件）
[PASS] A8  3 个工作流均已声明 on 与 permissions
[PASS] A9  PR 模板覆盖必需字段
[PASS] A10  .agent-framework/ 7 篇与中央仓逐字一致
[PASS] A11  3 个必需检查名与工作流作业名一致
[PASS] A12  8 个规范文档存在、被引用且链接有效
[PASS] A13  3 个 L 级档案均含 Merge Record（另 61 个非 L 级不强检）
[PASS] A14  审计脚本与中央仓权威副本逐字节一致
PASS=12  FAIL=0  WARN=2  SKIP=0
exit=0
```

**环境注记：** `scripts/check-traceability.py` 在本机需 `safe.directory` 才能解析基线
（本会话的全局 gitconfig 不可写，实测以 `GIT_CONFIG_COUNT=1 / GIT_CONFIG_KEY_0=safe.directory /
GIT_CONFIG_VALUE_0=*` 注入后 PASS）。CI 上无此问题（checkout 属同一身份）。

**CI 实测（PR #53，run `42049299643`，`event=pull_request`）：** 四作业全 pass
（`install-lint-build` 1m25s / `audit` 6s / `traceability` 6s / `smoke` 17s）。
`audit` 作业日志原文（节选）：

```text
模式：Standalone 审计（shadcn-admin）
[WARN] A2  无法定位中央规范版本文件，仅校验本项目版本 v2.0.0 格式合法
[WARN] A5  编号唯一（63 个）；断档 1 处、已登记豁免 1 组
[WARN] A6  2 处疑似凭据，需人工复核
[WARN] A10  中央规范仓不可达；无法校验规范内容一致性（Standalone 限制）
[WARN] A14  中央规范仓不可达；无法校验审计脚本自身一致性（Standalone 限制）
PASS=9  FAIL=0  WARN=5  SKIP=0
```

即 **A10 / A14 在 CI 单仓 checkout 下确实降级为 WARN**（Known Issues #1 的实证，非推测）。

**未执行的测试：** `pnpm test` / `pnpm lint` / `pnpm build` **未执行** —— 本任务不改动
`src/**`、`server/**`、`shared/src/**`、`package.json`，无前端/后端代码变更；这些作业由 CI 的
`install-lint-build` 覆盖。`smoke` 作业同理（需真实库快照）。

---

## 5. Known Issues

1. **A10 / A14 在 CI 单仓 checkout 内必然降级为 WARN。** CI 只 checkout 本仓，中央规范仓不可达
   （A10 / A2 已实测如此，run `41988096514`；A14 同形）。**不得声称 CI 已强制**；
   是否补 CI 侧校验需人类另议。本任务的实测均在「项目 + 中央仓镜像」同工作区下完成。
2. **A14 的行尾豁免是刻意设计，不是放松断言。** 与 A10 同构：只豁免纯行尾差异
   （Windows `core.autocrlf` 检出 vs Linux CI），实质内容差异一律 FAIL。
   AC-2 的「逐字节一致」由 `cmp` 作为验收判据实测（IDENTICAL）。
3. **中央仓 `templates/project/.agent-framework/github.md` 与 `.agents/github.md` 存在既有漂移**
   （本次改动前即缺 TASK-062 新增的一行；本次又扩大差距）。不在本任务 File Scope 内，**未改**；
   新项目由 `create_project.py` 从该模板创建，会拿到旧口径副本。建议另立任务。
4. **`shared/scripts/README.md` 仍描述已删除的 `audit_framework.py`，且未提及 `audit-project.py`。**
   既有漂移，不在 File Scope 内，**未改**。
5. **`docs/operations/collaboration-audit.md` / `known-pitfalls.md` 仍引用 `scripts/audit-repo.py`。**
   属历史审计/事件记录，按「不回溯修改历史档案」原则**未改**；与本次订正的
   `negative-assertion-review.md`（现行判据清单）性质不同。
6. **`ci.yml` 两处注释漂移未修**（`ci.yml:80` 写「A1~A9」实际 A1–A14；`ci.yml:103` 写
   traceability「尚未成为门禁」实际已是必需检查）。TASK-064 Non-Scope 禁改 `.github/`，**不修**。
7. **A6 有 2 处 WARN**（`server/scripts/smoke.ts:803` 测试固件密码字面量；
   `tasks/done/TASK-061-adopt-agent-framework/handoffs/2026-11-05-review.md:84` 审查记录引用该固件）。
   均为 suspect 级，非真实凭据；是否为测试固件增加豁免需人类决定（承 TASK-062 Known Issues #1）。
8. **派单产物由本分支携带。** 主控位派单提交 `15383f7`（分支 `docs/TASK-064-dispatch`）在领取时点
   尚未合入 `main`，本分支以 `cherry-pick` 重放为 `95262a9`。**请主控位勿再单独合并该派单分支。**

---

## 6. Remaining Work

1. Reviewer 位独立审查（L 级必需，I2：实现者 ≠ 批准者）。
2. **Security 位审查**（Task Rules 增强条：本任务改动密钥检测、占位符、工作流声明、任务编号等
   安全相关门禁，`AGENTS.md` §10 要求「须经 Security 角色审查后方可合入」）。
3. 主控位按 `github.md` §5 实测填入 Merge Record 并合并（同一 PR 内自填，不延后）。
4. 人类另议：是否给 A10 / A14 补 CI 侧校验；是否处理 Known Issues #3 / #4 的既有漂移。

---

## 7. Assumptions

1. 「最新 main」= `origin/main` @ `1f931ce`（2026-11-05 实测 `git ls-remote`）。本地 `main` 原落后 2 个提交，已 ff。
2. 派单产物随本任务入库（TASK-064 Dependencies 授权「随本任务或前置 PR 入库」）。
3. `.agent-framework/github.md` 的改动按「中央仓先落并推送 → 再同步到项目」执行；因
   `sync-framework.py` 拒绝非 main 分支，同步步骤按其同一 `shutil.copy2` 语义手工执行并以 `cmp` 校验。
4. 决定 4 的「改指向现行检查」按**断言的实际语义**映射为 A10 / A11 / A10+A14，
   而非任务正文括号里的字面「A10 / A8 / A5」—— A8 校验的是 `on:`/`permissions:`、
   A5 校验的是任务编号，与 C9 / C12 / C18 的三条断言不是同一件事。此偏差已在
   `2026-11-05-f1-f10-comparison.md` 与本记录中显式登记，请审查位复核。
5. 探针台用 OS 临时目录而非 `E:\AiData\tmp\<task-id>\`（后者在本会话不可写）。

---

## 8. Risks

| 风险 | 影响 | 缓解 |
|---|---|---|
| A14 在 CI 内降级为 WARN | 项目侧脚本在 CI 上不被强制看护 | 已在档案写明适用条件；本地/同工作区可强制 |
| 门禁强度变化引发既有 CI 假红 | A7/A9/A11 由 WARN 改 FAIL 后，若仓库存在占位符/缺模板/缺声明表会直接红 | 已实跑确认当前树三者均 PASS（exit 0） |
| A5 新增 Meta 校验可能让历史档案变红 | 阻断合并 | 已实测 64/64 档案含可解析 Meta `Task ID` |
| 中央仓 PR 未先合并即同步到项目 | 项目 `.agent-framework/` 与中央 `origin/main` 暂时不一致 → A10 假红 | 已在 Handoff 中要求**先合并中央仓 PR**；若顺序颠倒，A10 会如实报 FAIL（这是正确行为） |
| 派单分支被重复合并 | 同一内容两次进入 `main` | 内容相同，合并可自动解决；已在 Current State 中告警 |

---

## 9. Next Action

**移交 Reviewer 位与 Security 位双重审查。** 审查入口：

```bash
cd E:/NDLDSN-WORKSPACE/projects/shadcn-admin
git diff origin/main...fix/TASK-064-gate-fixes-and-authority-alignment
python shared/scripts/audit-project.py                      # 期望 PASS=12 FAIL=0 WARN=2 SKIP=0
python scripts/check-traceability.py --base origin/main     # 期望 PASS
```

审查要点建议：① A14 是否真能检出「脚本自身漂移」而非空壳；② A10/A14 的行尾豁免是否**只**豁免行尾；
③ A7/A9/A11 的 WARN→FAIL 是否伴随任何断言放宽（**没有**，仅严重度与 glob 范围变化）；
④ 三处字段口径是否真为同一套 10 项；⑤ C9/C12/C18 的检查映射是否与断言语义相符；
⑥ 跨仓先后关系是否与中央仓推送记录一致。

**Developer 不自行批准本交付物**（I2 / `github.md` §6 受保护）。
