# TASK-031 交接记录 — PR 上 CI 的实测结果

- **协作位：** 执行位（Implementer）
- **日期：** 2026-10-14
- **分支：** `chore/TASK-031-github-framework-adoption`（HEAD `30d812f`）
- **PR：** [#1](https://github.com/huyanluanyuqaq/shadcn-admin/pull/1)（创建时为草稿态）
- **目的：** 补上阶段 2 唯一未完成的验收项——「PR 上 CI 如期触发并运行」。

> 本记录与 `2026-10-14-implementation.md` §4.5 对应：该节当时把「PR 上 CI」列为未执行，
> 原因是 `gh` 只读、Agent 无法创建 PR。该阻塞已于同日解除（见该文件 §4.7）。

---

## 1. 触发证据

```text
$ gh run list -R huyanluanyuqaq/shadcn-admin --limit 1
in_progress   chore(TASK-031): 在 shadcn-admin 落地双 Agent GitHub 协作框架（文件层）
              Continuous Integration   chore/TASK-031-github-framework-adoption
              pull_request   38531690034   9s   2026-10-14T07:56:45Z
```

- **事件类型：** `pull_request`（**不是** `push`）→ 证实 CI 确实在**合并之前**、**针对工作分支**运行
- **工作流：** `Continuous Integration`（`.github/workflows/ci.yml`）
- **Run id：** `38531690034` ｜ [run 页面](https://github.com/huyanluanyuqaq/shadcn-admin/actions/runs/38531690034)

## 2. 作业结果（原始输出）

```text
$ gh pr checks 1 -R huyanluanyuqaq/shadcn-admin
audit                pass   5s
install-lint-build   pass   1m16s
```

```text
$ gh run view 38531690034 -R huyanluanyuqaq/shadcn-admin \
    --json databaseId,event,headBranch,status,conclusion,jobs --jq '...'
{"conclusion":"success","event":"pull_request",
 "headBranch":"chore/TASK-031-github-framework-adoption",
 "id":38531690034,"status":"completed",
 "jobs":[
   {"name":"install-lint-build","databaseId":115744815237,
    "conclusion":"success","startedAt":"2026-10-14T07:56:48Z","completedAt":"2026-10-14T07:58:04Z"},
   {"name":"audit","databaseId":115744815314,
    "conclusion":"success","startedAt":"2026-10-14T07:56:49Z","completedAt":"2026-10-14T07:56:54Z"}]}
```

### 2.1 `install-lint-build` 的步骤

```text
✓ Install pnpm      ✓ Install dependencies   ✓ Build shared package
✓ Lint the code     ✓ Run Prettier check     ✓ Install browsers
✓ Run tests         ✓ Build the project      ✓ Complete job
```

> **关键确认：** 此前记录的风险「CI 的 Node 由 20 升到 22，PR 上 CI 未跑通前不能判定无风险」
> **已由本次运行消除**——`Run tests` 与 `Build the project` 在 CI 上均通过。

### 2.2 `audit` 作业的原始输出（CI 环境）

```text
$ python3 scripts/audit-repo.py
仓库级框架审计 @ /home/runner/work/shadcn-admin/shadcn-admin

[PASS] F1  覆盖全部 10 个必需字段
[PASS] F2  全部 3 个工作流均已声明 on 与 permissions
[PASS] F3  无占位符残留（共检查 8 个文件）
[PASS] F4  未发现明文密钥（共检查 9 个文件）
[PASS] F5  5 个框架文档存在、被引用且链接有效
[PASS] F6  2 个必需检查名与工作流作业名一致

PASS=6 FAIL=0 WARN=0
```

> 与本地输出**逐行一致**（仅路径前缀不同）。这验证了实现假设「`ubuntu-latest` 自带
> `python3`、脚本只用标准库、无需 `setup-python`」——该假设此前只在本机 Windows 上被间接支持。

## 3. 结论：对应的待验证项

| 项 | 原状态 | 本次结论 |
| -- | ------ | -------- |
| 阶段 2「PR 上 CI 如期触发」 | 未执行（`gh` 只读） | **已完成**（run `38531690034`，两作业全绿） |
| `docs/operations/github-capability.md` §4 **V3**（检查是否在合并前于工作分支运行） | 未实测 | **实测为「是」**（`pull_request` 事件、发布在 PR 分支、发生于合并之前） |

> **注意：这只是 V3。** V3 成立**不等于**门禁成立——检查会跑 ≠ 检查能拦住合并。

## 4. 仍未验证的部分（不因本次而成立）

| 项 | 为何仍未验证 |
| -- | ------------ |
| V1（状态检查能否拦截**直推**默认分支） | 需一次刻意失败的直推尝试，属破坏性操作，**未授权** |
| V2（例外名单为空时所有者是否仍受约束） | 平台门禁尚未配置 |
| V4（必需检查未通过时合并是否被阻止） | 需「分支保护 + 必需检查」已配置，且有一次失败的检查 |
| V5（直推默认分支是否被拒绝） | 同 V1，未授权 |

⇒ **本次全绿不构成门禁。** 在分支保护配置完成前，这两个作业只是「运行了的检查」，
不是「合并的前置条件」——此点在 `AGENTS.md` §14 与能力记录 §2/§5 中已披露。

## 5. 运行器附注（非失败，来自 run 的 annotations）

```text
! Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced
  to run on Node.js 24: actions/checkout@v4.
! The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026.
```

- 第一条指向 **action 自身的运行时**（`actions/checkout@v4`），**不是**本仓库 `node-version` 的设置；
  升级到 `actions/checkout@v5` 可消除该告警 —— 属可选清理，已登记为待办。
- 第二条是 GitHub 的运行器迁移预告，本任务不需动作。
