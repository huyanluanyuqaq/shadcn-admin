# Git 工作流

> **目的：** 规定本仓库的分支、提交与合并规范。
>
> 与 GitHub 平台相关的内容（交付请求、检查、审查）见
> [`agent-collaboration.md`](./agent-collaboration.md)。

---

## 1. 分支模型

一个任务一个分支：

```
<type>/TASK-<NNN>-<short-slug>
```

`<type>` 取 Conventional Commits 的 type 集合：
`feat` | `fix` | `docs` | `refactor` | `test` | `chore` | `perf` | `build` | `ci`

示例：

```
feat/TASK-030-subscription-row-expand-panel
fix/TASK-041-null-pointer-on-empty-cart
docs/TASK-031-github-framework-adoption
```

**主分支约定：**

- `main` —— 稳定分支，始终可构建。
- **禁止直接向 `main` 推送**；一律通过交付请求（PR）合并进入。
- 工作分支**必须从最新的 `main` 派生**，且**必须推送到远端**（防止只在本地而丢失）。

> ✅ **自 2026-10-14 起，「禁止直推 `main`」已由平台强制** —— 仓库已配置经典分支保护
> （要求合并前必须经过 PR、必需检查 `install-lint-build` + `audit`、不允许绕过）。
> 已实测：以**仓库所有者身份**直推 `main` 亦被 `GH006` 拒绝。
> 逐字段配置与实测证据见 [`operations/github-capability.md`](./operations/github-capability.md) §2 / §4，
> 与本仓库 [`agent-collaboration.md`](./agent-collaboration.md) §6 的落差表一致。

---

## 2. 提交信息

采用 Conventional Commits：

```
<type>(<scope>): <subject>

<body>

<footer>
```

- `subject` 用祈使句、不超过 72 字符、不以句号结尾。
- `body` 说明**为什么**（what 已由 diff 说明）。
- `footer` **必须**包含任务引用：`Refs: TASK-<NNN>`。

示例：

```
fix(web): prevent null dereference on empty subscription row

The expand panel read the row before the empty guard ran.

Refs: TASK-041
```

---

## 3. 原子提交

- 一个提交只做一件事。
- 重构与功能变更**不得混在同一提交**。
- 每个提交应当可独立理解、可独立回滚。

**提交前检查：** 构建通过、测试通过、无调试残留、无密钥、无大体积二进制、
提交信息符合规范。

---

## 4. 合并

- **默认合并策略：`rebase-merge`**（保持 `main` 线性，同时保留可追溯的提交粒度）。
- 合并前必须满足：审查通过 + 必需检查通过 + 分支保护条件满足 + 必要的授权。
- 合并后**删除**该工作分支。
- 合并后**必须回写** `TASK.md` 的 `Merge Record`：提交范围、PR 号、CI run id、遗留问题。

> **本条覆盖上层通用规范中「优先 squash」的默认值。**
> 原因：`rebase-merge` 与本仓库既有的 fast-forward 习惯一致，
> 且不产生压缩合并造成的证据颗粒度损失。
> 「合并前必须 Review PASS + 测试通过」「合并后删除分支」两点继续有效。

> **合并不等于发布。** `docker.yml` 由**两类事件**触发：合并/推送到 `main` 会构建并推送
> `sha-<短SHA>` 镜像，**不推进** `latest` 与版本号；只有推送版本 tag（`v*`）才对外发布。
> 即：**普通合并会产生镜像，但不会改变 `latest`**。
> 拦截 `latest` 的是 metadata-action 的 `enable=${{ github.ref_type == 'tag' }}` 门禁，
> 不是触发器 —— 详见 [`operations/docker-release.md`](./operations/docker-release.md) §3。

---

## 5. 禁止操作

| 操作 | 原因 |
| ---- | ---- |
| 直接推送 `main` | 绕过交付与检查门禁 |
| 对共享分支强制推送（`--force`） | 覆盖他人工作 |
| `git reset --hard` / `git clean -fdx` | 丢失未提交或未跟踪内容 |
| 改写**已推送**的历史（rebase / amend） | 破坏他人本地历史 |
| 在未确认已合并的情况下删除分支 | 丢失工作 |

**绝对禁止：** 提交密钥/令牌/密码/证书；在共享分支上强制推送；未经确认删除他人分支。

> 若密钥已被提交 → **立即轮换密钥**（仅删除文件不够）。
