# TASK-031 交接记录 — 实施与自测

- **协作位：** 执行位（Implementer）
- **日期：** 2026-10-14
- **分支：** `chore/TASK-031-github-framework-adoption`
- **基线：** `main` @ `05bf884`

> 本记录是 PR 描述内容的**层 1 来源**（映射见 `docs/agent-collaboration.md` §5）。
> PR 描述**不应**包含本文件之外的独有事实。

---

## 1. 实际变更

### 新增

| 文件 | 说明 |
| ---- | ---- |
| `.github/dependabot.yml` | 依赖更新（npm / github-actions / docker） |
| `scripts/audit-repo.py` | 仓库级框架一致性审计（Python，仅标准库，只读、无网络） |
| `docs/agent-collaboration.md` | 协作位职责、10 阶段流程、PR 字段映射、落差披露 |
| `docs/git-workflow.md` | 分支命名、提交规范、rebase-merge、禁止操作 |
| `docs/operations/github-capability.md` | 平台能力与实测记录（事实陈述） |
| `tasks/active/TASK-031-github-framework-adoption/**` | 本任务档案与交接 |

### 修改

| 文件 | 变更 |
| ---- | ---- |
| `.github/PULL_REQUEST_TEMPLATE.md` | 由上游模板**替换**为框架模板（覆盖 10 个必需字段） |
| `.github/workflows/ci.yml` | ① 新增工作流级 `permissions: contents: read`；② 新增 `audit` 作业；③ `node-version` 20 → 22（与本地对齐） |
| `.github/workflows/docker.yml` | 触发由 `push main` + `tags v*` 改为 **`tags v*` + `workflow_dispatch`**（D8） |
| `.github/CONTRIBUTING.md` | 修正上游链接与 Discussions 指引；明确 Issues 关闭；PR 指引对齐新模板 |
| `AGENTS.md` | 新增 §14 GitHub Collaboration；§9 文档位置表补 3 个新文档 |

### 刻意未做（排除范围）

- 未新增 `.github/CODEOWNERS`（`approvals=0` 时无强制力）。
- 未新增 Issue 模板（Issue 不参与状态与审查；D11 保留上游资产）。
- 未改 CI **触发条件**（`pull_request` 触发本已存在）。
- 未改 CI 既有作业名（保持最小变更；必需检查名以实际作业名为准并已声明）。
- 未修改 `src/**`、`server/**`、`shared/**`、`package.json`、vitest/ESLint/Prettier 配置。
- 未处置 `stale.yml`（属平台侧待决项，见 `docs/operations/github-capability.md` §7）。
- 未修改 `AGENTS.md` §13.2 的过时断言「纯前端，无持久层」（见 §5 遗留问题）。

---

## 2. 兼容性 / 安全 / 部署影响

**所做的假设：**

1. `ubuntu-latest` 自带 `python3`（脚本只用标准库，未引入 `setup-python`）。
2. `actions/checkout@v4`、`actions/setup-node@v4` 与既有依赖一致。
3. `.prettierignore` 为白名单模式，`.github/`、`docs/`、`scripts/`、`AGENTS.md` 不在格式化范围内
   （已在本地实测确认 `format:check` 仍通过）。

**风险：**

- CI 的 Node 由 20 升到 22：本地无法复现 Linux 运行器环境，**PR 上 CI 未跑通前不能判定无风险**。
  已用本机 Node 22.22.2 跑通 lint / format / test / build 作为间接证据。
- `docker.yml` 改为 tag-only 后，镜像发布不再随 `main` 前进；`:latest` 语义随之改变
  （只在打版本 tag 时更新）。**这是有意的行为变更**，需在发布流程中被知晓。

**安全影响：** `ci.yml` 新增最小权限声明（只读）；`audit` 作业只读、无网络。

**部署影响：** 无。本次**不触发**任何镜像发布（合并到 `main` 不再触发 `docker.yml`）。

---

## 3. 回滚方案

- **未合并前：** 删除分支即可，`main` 未受影响。
- **合并后：** `git revert` 对应提交；`docker.yml` 的触发块可单独还原
  （把 `tags: ["v*"]` 换回 `branches: ["main"]` + `tags: ["v*"]`）。
- 本次不涉及数据迁移、密钥或不可逆操作。

---

## 4. 测试与验证（原始输出）

### 4.1 本地检查

```text
$ pnpm format:check
> prettier --check .
Checking formatting...
All matched files use Prettier code style!
（exit 0）

$ pnpm lint
> eslint .
（无输出，exit 0）

$ pnpm build
dist/assets/_authenticated-BvdGU1JB.js       364.09 kB │ gzip: 104.89 kB
✓ built in 30.14s
（BUILD_EXIT=0）

$ pnpm test
 Test Files  25 passed (25)
      Tests  303 passed (303)
   Duration  14.53s
（TEST_EXIT=0）
```

### 4.2 仓库级框架审计

```text
$ python3 scripts/audit-repo.py
仓库级框架审计 @ E:/NDLDSN-WORKSPACE/projects/shadcn-admin

[PASS] F1  覆盖全部 10 个必需字段
[PASS] F2  全部 3 个工作流均已声明 on 与 permissions
[PASS] F3  无占位符残留（共检查 8 个文件）
[PASS] F4  未发现明文密钥（共检查 9 个文件）
[PASS] F5  5 个框架文档存在、被引用且链接有效
[PASS] F6  2 个必需检查名与工作流作业名一致

PASS=6 FAIL=0 WARN=0
（exit 0）
```

> 上表为**本机实际输出原样粘贴**（含本机路径）。CI 上的输出尚未产生——
> 该作业需在 PR 创建后才会运行，见 §4.5。

### 4.3 审计脚本的**负向测试**（工具本身也需被验证）

为避免"检查器精度问题产生假绿灯/假警报"，对 4 类缺陷做了受控注入 → 确认必须 FAIL → 复原：

```text
N1 改 ci.yml 作业名 audit→audit-renamed   → [FAIL] F6 1 处不一致          ✔ 按预期失败
N2 删 ci.yml 的 permissions:              → [FAIL] F2 1 处不合格          ✔ 按预期失败
N3 docs 注入 {{PLACEHOLDER}}              → [FAIL] F3 1 处占位符残留      ✔ 按预期失败
N4 PR 模板删「回滚方案」字段               → [FAIL] F1 模板缺少 1 个必需字段 ✔ 按预期失败
复原后基线                                 → PASS=6 FAIL=0 WARN=0        ✔
```

复原经逐字节比对确认（`diff -q` 三个被注入文件全部一致）。

### 4.4 YAML 可解析性

```text
[OK]   .github/workflows/ci.yml
[OK]   .github/workflows/docker.yml
[OK]   .github/workflows/stale.yml
[OK]   .github/dependabot.yml
```

### 4.5 未执行的测试及原因

| 未执行 | 原因 |
| ------ | ---- |
| PR 上 CI（`install-lint-build` + `audit`） | **Agent 无法创建 PR**（见 §4.6 的实测证据）。需用户重新认证 `gh` 或在浏览器创建 PR 后自动触发 |
| 分支保护 / 必需检查是否生效（V1–V5） | 平台门禁**尚未配置**，属阶段 3（用户操作） |
| `docker.yml` 改为 tag-only 后的实际发布 | 需一次受控打 tag 发布；本次刻意不触发 |
| `docker pull` / 镜像内容 | 与本次变更无关，未触及 Dockerfile |

### 4.6 「Agent 无法创建 PR」的实测证据

```text
$ gh api repos/huyanluanyuqaq/shadcn-admin --jq '.permissions'
{"admin":false,"maintain":false,"pull":true,"push":false,"triage":false}

$ gh pr create --base main --head chore/TASK-031-github-framework-adoption ...
pull request create failed: GraphQL: must be a collaborator (createPullRequest)
（exit 1）
```

**结论：** `git push` 可用而 `gh pr create` 不可用**并不矛盾** —— 二者使用不同凭据：
推送走 SSH 密钥（仓库所有者），`gh` 走 OAuth token（另一身份，对本仓库只有只读权限）。
→ 「Agent 能推分支」不等于「Agent 能创建 PR」。

---

## 5. 遗留问题

1. **`gh` 凭据只读** —— Agent 无法创建/合并 PR。需用户重新认证或在浏览器操作。
2. **平台门禁未启用** —— 分支保护、必需检查、禁止绕过均未配置；
   「禁止直推 `main`」**当前平台不强制**。已在 `AGENTS.md` §14.4 与
   能力记录 §2/§5 中显式披露，并写入 PR 模板尾注。
3. **`AGENTS.md` §13.2 的过时断言**（「纯前端，无持久层」）**本次未修改**：
   它不在阶段 2 的文件清单内，且修正前需先核实当前真实状态，避免用另一句未经验证的话替换。
   应作为独立小任务处理（框架 §13.4「否定性断言复核」清单中的一项）。
4. **依赖漏洞审计未纳入 CI**：Dependabot 只覆盖"有更新时提 PR"，不构成 CVE 门禁。
   若纳入，需评估外部网络对必需检查稳定性的影响。
5. **`stale.yml` 未处置**：定时任务可能在 120 天后关闭不活跃 PR。
6. **`docs/operations/known-pitfalls.md` 等历史文档未纳入审计链接检查范围**：
   本审计只覆盖框架自制文档，避免历史死链造成噪声。

---

## 6. 交接检查清单（执行位自检）

- [x] 静态检查（`pnpm lint`）、格式检查（`pnpm format:check`）、测试（303/303）、构建（`pnpm build`）本地全部通过
- [x] 无调试残留、无密钥或敏感信息、无与任务无关的重构
- [x] 每个提交的 footer 含 `Refs: TASK-031`
- [x] 任务文件的变更文件清单与已知问题已如实更新
- [x] 交接记录包含测试的**原始输出**（含负向测试）
- [x] 未削弱任何受保护规则（未改 `git.md` / `security.md` / `change-safety.md` 等）
- [x] 平台未强制的约定已在 PR 模板与能力记录中显式标注

---

## 7. 给主控位的审查要点（建议）

1. `ci.yml` 的 `audit` 作业是否应设为**必需检查**（当前能力记录标为「是」）。
2. `docker.yml` 的 `:latest` 语义变更是否为期望行为。
3. `scripts/audit-repo.py` 的检查项是否覆盖了本仓库真正重要的框架不变量。
4. `AGENTS.md` §14.4 的落差披露是否足够直白。
5. 遗留问题 3（§13.2 过时断言）是否应在本 PR 内一并修正，还是另立任务。
