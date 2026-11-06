# HANDOFF-003 — TASK-064 整改记录与移交（Developer → Reviewer 新实例）

| 字段 | 值 |
|---|---|
| **From** | Developer（执行位，整改实施） |
| **To** | Reviewer 位（**不携带整改上下文的新实例**，独立复审） |
| **Task** | TASK-064 修正审计脚本门禁缺陷并对齐权威副本（Level L，P0） |
| **Date** | 2026-11-06 |
| **分支** | `fix/TASK-064-remediation`（自 PR #53 当前头 `34f58e0` 派生；整改完成后推入 PR #53 所在分支 `fix/TASK-064-gate-fixes-and-authority-alignment`） |
| **中央仓分支** | `fix/TASK-064-audit-script-authority`（C-1 订正提交 `9f11a9d`，已推送至 PR #1） |
| **整改依据** | §整改清单 C-1~C-6 / D-1（源自 `handoffs/2026-11-06-review.md` R-1~R-9 与 `handoffs/2026-11-06-security-review.md` S-1 / S-2） |

---

## 1. Current State

§整改清单 **C-1~C-6 与 D-1 七项已全部实施完成**（2026-11-06）。全部为**文档与测试订正**：
未动任何门禁的严重度、扫描面或判据，`shared/scripts/audit-project.py` **零改动**（与 PR 头 `34f58e0`
逐字节一致，`git diff 34f58e0 -- shared/scripts/audit-project.py` 为空）。

实跑验证：`python shared/scripts/audit-project.py` → `PASS=12 FAIL=0 WARN=2 SKIP=0` / exit 0
（A9 / A10 / A14 均 PASS）；`python scripts/check-traceability.py --base origin/main` → PASS。

**Developer 不自行批准本交付物**（I2 / `github.md` §6 受保护）；未合并、未关闭任何检查。

---

## 2. Completed Work（七项逐条对账）

| 项 | 处置 | 落点 |
|---|---|---|
| **C-1** | 「与 PR 模板章节是同一套 10 项切分」改如实表述：模板实为 **8 个 `##` 章节**；A9 的 10 项靠裸子串匹配命中（5 个章节标题 + 3 个章节内粗体标签 + 2 个标题子串），PASS **不能证明**章节一致 | ① 中央仓 `.agents/github.md` §3（提交 `9f11a9d`，先落并推送）→ ② 项目 `.agent-framework/github.md` §3（按 `shutil.copy2` 语义同步；中央仓 `core.autocrlf=true` 工作树为 CRLF、项目 `.gitattributes` `eol=lf` 工作树为 LF，裸 `cmp` 会报行尾差异，**行尾归一化后逐字节一致** —— A10 PASS，正是其归一化豁免的设计场景）；③ `docs/agent-collaboration.md` §5；④ HANDOFF-002 §2.2 同一切分复述加订正注记 |
| **C-2** | 「可检出/可消除同步回退」改「可检出**两仓工作树字节不一致**」；Known Issues 补自覆盖 / 自篡改两个盲区 | `Objective`（主控位已于 `34f58e0` 先行订正，本轮复核无误）；HANDOFF-002 §2.1 A14 行补能力边界；`negative-assertion-review.md` C18 断言列改写 + 能力边界；TASK.md Known Issues 新增 #12（自覆盖）/ #13（自篡改） |
| **C-3** | Merge Record 补记：顺序颠倒时 **A10 与 A14 均** FAIL（原只记 A10）；标注本地 PASS 依赖「中央仓工作树 checkout 在 feature 分支」这一非持久条件 | TASK.md Merge Record 跨仓登记段；HANDOFF-002 §8 同行遗漏补订正注记；合并前置的中央仓 head 引用 `4bdca16` → `9f11a9d` |
| **C-4** | PR 侧 CI run 订正为 **`42051018636`**（PR 头 `f9aeeba` 对应值）；原登记 `42049299643` / `42050504614` 注明对应更早 head，保留为历史记录 | TASK.md Merge Record「PR 侧 CI run」行 |
| **C-5** | C18 补写「A14 中央不可达时为 WARN」的适用条件（C9 已写、C18 未写） | `negative-assertion-review.md` C18 复核命令列（与 C9 同构：「中央仓不可达时 A10 / A14 输出 WARN 而非 FAIL，Standalone 限制下不构成强制」）；C18「上次复核」更新为 2026-11-06 |
| **C-6** | AC-5 区分档案数与编号数：A4 按 `TASK.md` 档案计数、A5 按可解析编号计数；整改时点实测 **65 个档案 / 64 个编号**（`find tasks -name TASK.md | wc -l` 对照 A4 / A5 输出） | TASK.md AC-5 |
| **D-1** | 补 A14 探针分支四情形：WARN（中央不可达）、纯 CRLF 行尾差异、从 `CHECKS` 移除 a14、FAIL 分支改恒真；每条附可复现命令；**探针台以 PR 头文件构造**（非 `origin/main` 沙箱） | 见 §4 |

---

## 3. Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `../agent-framework/.agents/github.md` | 修改（中央仓） | §3 失真表述订正，提交 `9f11a9d`，已推送至 PR #1 分支 |
| `.agent-framework/github.md` | 修改（同步） | 中央仓 `9f11a9d` 按 `shutil.copy2` 语义复制；行尾归一化后与中央副本逐字节一致（A10 PASS） |
| `docs/agent-collaboration.md` | 修改 | §5 改如实表述（模板 8 章节 / A9 裸子串匹配 / PASS 不证明章节一致） |
| `docs/operations/negative-assertion-review.md` | 修改 | C18 断言改「两仓工作树字节不一致」+ 能力边界 + WARN 适用条件 |
| `tasks/active/TASK-064-…/handoffs/HANDOFF-002-…md` | 修改 | §2.1 A14 能力边界、§2.2 同切分复述订正、§8 合并顺序遗漏补记 |
| `tasks/active/TASK-064-…/handoffs/HANDOFF-003-…md` | 新增 | 本记录（含 D-1 四情形探针原始输出） |
| `tasks/active/TASK-064-…/TASK.md` | 修改 | Known Issues #12/#13、Merge Record（C-3 / C-4）、AC-5（C-6）、整改勾选、Changed Files、Handoff #005、Current State / Next Action、Meta Updated |

**未改（Non-Scope 遵守）：** `shared/scripts/audit-project.py`（零改动）、`.github/workflows/**`、
`framework-version.json`、`src/**`、`server/**`、`shared/src/**`、`tasks/done/TASK-061/**`、
`tasks/done/TASK-062/**`（历史档案不回溯）、`.agent-framework/` 其余 6 篇。

---

## 4. Tests（D-1：A14 四情形探针，注入缺陷 → 实跑 → 恢复 → 复跑）

### 4.0 探针台构造（以 PR 头文件构造，非 `origin/main` 沙箱）

`E:\AiData\tmp` 本会话实测**仍不可写**（`New-Item` 报 Access denied），探针台用 OS 临时目录
`C:\Users\Admin\AppData\Local\Temp\TASK-064-remediation\`（仓库外，仓库内零残留）：

```powershell
$base = "C:\Users\Admin\AppData\Local\Temp\TASK-064-remediation"
# 主探针台：项目树副本（分支 HEAD 工作树；其中 shared/scripts/audit-project.py 与 PR 头 34f58e0
# 逐字节一致 —— git diff 为空、SHA256 相同）+ 中央仓镜像（.agents/ + 脚本 + framework-version.json）
robocopy "E:\NDLDSN-WORKSPACE\projects\shadcn-admin" "$base\bench-main\shadcn-admin" /E /XD .git node_modules /NFL /NDL /NJH /NJS /NP /NC /NS
robocopy "E:\NDLDSN-WORKSPACE\agent-framework\.agents" "$base\bench-main\agent-framework\.agents" /E /NFL /NDL /NJH /NJS /NP /NC /NS
Copy-Item "E:\NDLDSN-WORKSPACE\agent-framework\shared\scripts\audit-project.py" "$base\bench-main\agent-framework\shared\scripts\audit-project.py"
Copy-Item "E:\NDLDSN-WORKSPACE\agent-framework\framework-version.json" "$base\bench-main\agent-framework\framework-version.json"
# WARN 探针台：仅项目树副本，无中央镜像（A14 的两个候选路径 bench-warn/agent-framework 与 bench 上级均不存在）
robocopy "E:\NDLDSN-WORKSPACE\projects\shadcn-admin" "$base\bench-warn\shadcn-admin" /E /XD .git node_modules /NFL /NDL /NJH /NJS /NP /NC /NS
```

```text
$ (Get-FileHash $base\bench-main\shadcn-admin\shared\scripts\audit-project.py).Hash
7EBA9268A9B29554F242C159F1345ABC46D2B50384CABEA5F73C8F72D9FA463F   # 与仓库、中央镜像三方一致
$ git diff 34f58e0 -- shared/scripts/audit-project.py    # 空输出 = 探针对象即 PR 头脚本
```

**基线（bench-main）：**

```text
$ python shared/scripts/audit-project.py
[PASS] A10  .agent-framework/ 7 篇与中央仓逐字一致
[PASS] A14  审计脚本与中央仓权威副本逐字节一致
PASS=12  FAIL=0  WARN=2  SKIP=0
exit=0
```

### 4.1 情形 ① —— WARN（中央不可达）

```powershell
cd "$base\bench-warn\shadcn-admin"; python shared/scripts/audit-project.py
```

```text
[WARN] A2   无法定位中央规范版本文件，仅校验本项目版本 v2.0.0 格式合法
[WARN] A10  中央规范仓不可达；无法校验规范内容一致性（Standalone 限制）
[WARN] A14  中央规范仓不可达；无法校验审计脚本自身一致性（Standalone 限制）
PASS=9  FAIL=0  WARN=5  SKIP=0
exit=0
```

即 CI 单仓 checkout 下 A14 如实降级为 WARN（Known Issues #1 的实证，与 run `42049299643`
的 `audit` 作业输出同形）。

### 4.2 情形 ② —— 纯 CRLF 行尾差异（按设计豁免）

```powershell
$central = "$base\bench-main\agent-framework\shared\scripts\audit-project.py"
$orig = [System.IO.File]::ReadAllBytes($central)
# 注入：中央侧镜像整体转 CRLF（模拟 Windows 检出的中央副本），项目侧保持 LF
[System.IO.File]::WriteAllBytes($central, [System.Text.Encoding]::UTF8.GetBytes(
    ([System.Text.Encoding]::UTF8.GetString($orig)).Replace("`n", "`r`n")))
cd "$base\bench-main\shadcn-admin"; python shared/scripts/audit-project.py   # 注入后实跑
# 恢复
[System.IO.File]::WriteAllBytes($central, $orig)
python shared/scripts/audit-project.py                                        # 恢复后复跑
```

```text
[PASS] A14  审计脚本与中央仓权威副本内容一致（行尾已归一化）     # 注入后：PASS=12 FAIL=0 / exit 0
[PASS] A14  审计脚本与中央仓权威副本逐字节一致                  # 恢复后：PASS=12 FAIL=0 / exit 0
```

### 4.3 情形 ③ —— 从 `CHECKS` 移除 a14（自篡改之一）

```python
import pathlib, shutil, subprocess, sys
proj = pathlib.Path(r"C:\Users\Admin\AppData\Local\Temp\TASK-064-remediation\bench-main\shadcn-admin\shared\scripts\audit-project.py")
pristine = pathlib.Path(r"E:\NDLDSN-WORKSPACE\projects\shadcn-admin\shared\scripts\audit-project.py")
data = proj.read_bytes()
old = b"a13_merge_record,\n          a14_script_consistency]"      # 字节级注入，保留 LF
assert data.count(old) == 1
open(proj, "wb").write(data.replace(old, b"a13_merge_record]"))
subprocess.run([sys.executable, "shared/scripts/audit-project.py"], cwd=proj.parent.parent)   # 注入后实跑
shutil.copy2(pristine, proj)                                                             # 恢复
subprocess.run([sys.executable, "shared/scripts/audit-project.py"], cwd=proj.parent.parent)   # 恢复后复跑
```

```text
--- 注入后（exit=0） ---
[PASS] A13  4 个 L 级档案均含 Merge Record（另 61 个非 L 级不强检）
PASS=11  FAIL=0  WARN=2  SKIP=0        # 输出中已无 A14 行，FAIL=0 / exit 0，无人报警
--- 恢复后（exit=0） ---
[PASS] A14  审计脚本与中央仓权威副本逐字节一致
PASS=12  FAIL=0  WARN=2  SKIP=0
```

### 4.4 情形 ④ —— FAIL 分支改恒真 + 中央侧真实漂移（自篡改之二）

```python
import pathlib, shutil, subprocess, sys
proj = pathlib.Path(r"...\bench-main\shadcn-admin\shared\scripts\audit-project.py")
central = pathlib.Path(r"...\bench-main\agent-framework\shared\scripts\audit-project.py")
pristine = pathlib.Path(r"E:\NDLDSN-WORKSPACE\projects\shadcn-admin\shared\scripts\audit-project.py")
central_pristine = pathlib.Path(r"E:\NDLDSN-WORKSPACE\agent-framework\shared\scripts\audit-project.py")
data, cdata = proj.read_bytes(), central.read_bytes()
cond = b'if raw_proj.replace(b"\r\n", b"\n") != raw_central.replace(b"\r\n", b"\n"):'
assert data.count(cond) == 1
open(proj, "wb").write(data.replace(cond, b"if False:  # TAMPERED: FAIL branch made constant-true"))
open(central, "wb").write(cdata + b"\n# TASK-064 probe drift: central-side real difference\n")
subprocess.run([sys.executable, "shared/scripts/audit-project.py"], cwd=proj.parent.parent)   # 双重注入后实跑
shutil.copy2(pristine, proj)                                                             # 仅恢复项目侧（中央漂移保留）
subprocess.run([sys.executable, "shared/scripts/audit-project.py"], cwd=proj.parent.parent)   # 实跑：漂移应显形
shutil.copy2(central_pristine, central)                                                  # 恢复中央侧
subprocess.run([sys.executable, "shared/scripts/audit-project.py"], cwd=proj.parent.parent)   # 恢复后复跑
```

```text
--- 双重注入后（exit=0） ---
[PASS] A14  审计脚本与中央仓权威副本内容一致（行尾已归一化）     # 恒真分支掩盖了真实的中央侧漂移
PASS=12  FAIL=0  WARN=2  SKIP=0        # 无人报警
--- 仅恢复项目侧、中央漂移保留（exit=1） ---
[FAIL] A14  审计脚本与中央仓权威副本不一致（同步会覆盖门禁自身）
PASS=11  FAIL=1  WARN=2  SKIP=0        # 漂移真实存在；此前是被篡改掩盖，不是被豁免
--- 全部恢复后（exit=0） ---
[PASS] A14  审计脚本与中央仓权威副本逐字节一致
PASS=12  FAIL=0  WARN=2  SKIP=0
```

**四情形结论：** A14 能检出「项目副本 vs 中央副本」的字节不一致（含按设计豁免纯行尾），
中央不可达时如实 WARN；**不能**检出「同步把两侧一并回退」（自覆盖）与「针对 A14 自身的篡改」
（自篡改）。与 Reviewer 位 §3.1 / Security 位情形④⑤的独立实测一致，即 Known Issues #12 / #13。

### 4.5 自动验证（AC-11）

```text
$ python shared/scripts/audit-project.py
[PASS] A9   PR 模板覆盖必需字段
[PASS] A10  .agent-framework/ 7 篇与中央仓逐字一致
[PASS] A14  审计脚本与中央仓权威副本逐字节一致
PASS=12  FAIL=0  WARN=2  SKIP=0
exit=0
$ python scripts/check-traceability.py --base origin/main
[traceability] PASS —— 14 个提交均引用了真实存在的任务。
```

**未执行的测试：** `pnpm test / lint / build` 未执行（本轮无 `src/**` / `server/**` 变更，
由 CI `install-lint-build` 覆盖）；`E:\AiData\tmp` 不可写故探针台在 OS 临时目录（见 §4.0）。

---

## 5. Known Issues

1. **提交 `f6b27e2` 的说明含原始失真表述**（「现统一为与 `.github/PULL_REQUEST_TEMPLATE.md`
   章节一致的 10 项」）。PR 分支是共享分支，按 `.agent-framework/git.md` §6 **禁止强制推送、
   不重写历史**；订正由 HANDOFF-002 §2.2 的订正注记与本轮提交说明承载。请复审位确认该处置可接受。
2. **`shared/scripts/audit-project.py` 文件头第 5 行「A14 校验审计脚本自身未被同步回退」及
   A14 docstring 的表述同样超出判据能力，但本轮未改**：改脚本会立即破坏两仓逐字节一致
   （A14 自身转 FAIL）且须再走一次中央仓同步，而 C-2 的授权范围仅限 Objective /
   HANDOFF-002 §2.1 / C18 三处。建议复审位裁定：随 TASK-065 的外部锚点工作在中央仓一并订正，
   或另立整改轮。
3. **TASK.md Constraints 的兼容行「现有 63 个任务档案……63/63」同样混用档案数与编号数**，
   但 C-6 的授权范围仅限 AC-5，未改；建议复审位裁定口径。
4. **探针台路径：** `E:\AiData\tmp` 本会话实测不可写（Access denied），与实现会话一致；
   Reviewer 位会话实测该路径可写（见其记录 §5）。此为会话沙箱差异，非环境常量。
5. **合并前置不变：** 先合并中央规范仓 PR #1（head 现为 `9f11a9d`），再合并本 PR；
   顺序颠倒会使 `main` 上 A10 与 A14 同时 FAIL，叠加 `enforce_admins=true` 即成自锁。

---

## 6. Remaining Work

1. **复审（新实例，不携带整改上下文）：** 逐条复核 C-1~C-6 / D-1 的落点与探针复现。
2. **Security 位复审**（Task Rules 增强条：S-1 的订正是否闭合「表述超出判据能力」这一阻断点；
   注意 S-1 的根因——密钥门禁可回退路径——由 TASK-065 的外部锚点承担，不由本任务闭合）。
3. 主控位按 `github.md` §5 在合并前实测回填 Merge Record 并执行合并授权（先中央仓 PR #1）。
4. 人类另议：是否给 A10 / A14 补 CI 侧校验；Known Issues #2 / #3 的裁定；外部锚点（TASK-065）。

---

## 7. Assumptions

1. 「PR 头文件」= 分支 HEAD 树；其中 `shared/scripts/audit-project.py` 与 PR 头 `34f58e0`
   逐字节一致（`git diff` 为空 + SHA256 相同），故 A14 探针对象即 PR 头脚本。
2. 探针台用工作树副本而非 `git archive`（`.gitattributes` 声明 `eol=lf`，两者内容等价）。
3. `Objective` 的订正由主控位在 `34f58e0` 先行完成，本轮仅复核、未再改动。
4. 中央仓 C-1 订正按「中央先落并推送 → 再按 `shutil.copy2` 语义同步项目」执行
   （`9f11a9d` 先推送，再复制；两仓工作树行尾惯例不同，一致性以 A10 的行尾归一化比较为准，
   PASS）；`sync-framework.py` 本体仍拒绝非 `main` 分支（实测 exit 1），同步按其 copy 语义
   手工执行，与 HANDOFF-002 §2.3 同一做法。

---

## 8. Risks

| 风险 | 影响 | 缓解 |
|---|---|---|
| 复审认为脚本头 / docstring 的「同步回退」表述也须订正 | 需再动脚本 + 中央仓同步，A14 比对对象随之改变 | 已在 Known Issues #2 显式登记并建议裁定路径，不擅自扩大范围 |
| 中央仓 PR #1 未合并期间合并本 PR | `main` 上 A10 / A14 立即 FAIL，叠加 `enforce_admins=true` 自锁 | Merge Record 已补记「A10 与 A14 均 FAIL」+ 本地 PASS 的非持久条件 |
| 只订正文档而未落地外部锚点 | 密钥门禁的可回退路径仍在 | 已由 TASK-065 承载并经人类 2026-11-06 裁决；本任务不声称已闭合 |
| 探针台在 OS 临时目录被清理 | 复现需重建 | §4.0 的构造命令完整可复现 |

---

## 9. Next Action

**移交不携带整改上下文的新实例复审。** 复审入口：

```bash
cd E:/NDLDSN-WORKSPACE/projects/shadcn-admin
git log --oneline 34f58e0..HEAD                              # 本轮整改提交
git diff 34f58e0..HEAD                                        # 本轮整改 diff（应全为文档）
python shared/scripts/audit-project.py                        # 期望 PASS=12 FAIL=0 WARN=2 SKIP=0 / exit 0
python scripts/check-traceability.py --base origin/main       # 期望 PASS
git -C ../agent-framework log --oneline 4bdca16..HEAD         # 中央仓 C-1 提交 9f11a9d
```

复审要点建议：① C-1 的订正表述是否如实（模板 8 章节、A9 裸子串匹配、PASS 不证明章节一致）；
② C-2 的三处改写 + Known Issues #12/#13 是否覆盖 R-2 / S-1 的表述失真；③ C-3 / C-4 的 Merge Record
补记是否完整；④ C-5 的 WARN 适用条件是否与 C9 同构；⑤ C-6 的档案数 / 编号数区分是否正确；
⑥ D-1 四情形探针是否可按 §4 命令复现，且探针台确以 PR 头文件构造；⑦ 是否有任何门禁的严重度、
扫描面或判据被改动（**预期：无**）。

**Developer 不自行批准本交付物**（I2 / `github.md` §6 受保护）；不合并、不关闭检查。

---

*本记录依据 `.agent-framework/collaboration.md` §2 I2 与 §5 出具；Developer 仅实施整改，批准与合并归主控位 / 人类。*
