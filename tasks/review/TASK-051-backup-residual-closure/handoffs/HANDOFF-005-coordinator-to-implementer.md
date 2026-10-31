# HANDOFF-005 — E-1 修复派单（主控位 → 执行位）

> 前置：I2 独立审查已 **PASS**（`handoffs/2026-10-31-review.md`，0 阻断 / 0 必须修 / 3 记录项）。
> 交付内容本身已无待修项。本轮**只**解决一件事：E-1 导致的 `install-lint-build` 红灯。
> `Requires Human Approval: false`（本派单不涉及破坏性操作），但**合并仍需人类显式授权**。

---

## 1. E-1 的裁定与路径选择（主控位决定，执行位照做，不再二选一）

**裁定：环境侧。** 不是本 PR 代码引入。三方证据一致：

| 证据 | 实测 |
| --- | --- |
| main 成功 run `41156271179`（2026-10-31T01:38Z） | `Image: ubuntu-24.04`（`install-lint-build` 与 `audit` 两个作业同） |
| PR 失败 run `41178010478`（2026-10-31T06:47Z） | `Image: ubuntu-26.04`（两个作业同） |
| 代码与依赖版本 | 两者之间**未变**：`playwright 1.59.1`、Node 22、pnpm 12.10.1 |

**零成本路径已试过并失败**（主控位 2026-10-31 执行）：

```text
gh run rerun 41178010478 --failed   → attempt 2 → conclusion=failure
本次镜像仍为 ubuntu-26.04           → ubuntu-latest 已稳定指向 26.04，重跑碰运气不成立
```

**决定：走路径 B —— 升 `playwright` 到 `1.64.1`。** 依据（全部为实测，不是推测）：

1. **路径 A 在当前身份配置下不可执行**，不只是「需授权」。实测：
   - 活动账号 `huyanluanyuqaq`：token scope `gist, read:org, repo`（**无** `workflow`），仓库权限 `admin:true / push:true`；
   - 唯一有 `workflow` 的非活动账号 `ndldsn`：仓库权限 **`push: false`（仅 `pull: true`）**
     ⇒ 它连分支都推不了，更推不了 `.github/workflows/**`。
   - 结论：走 A 必须先由人类改权限（补 scope 或把 `ndldsn` 加为协作者）。而 HD-2 已裁决
     「不补 `workflow` scope、禁网页绕过」⇒ 执行位**不得**尝试任何一条，遇到推送被拒须停工上报。
2. **路径 B 不撞 HD-2**：改的是根 `package.json` + `pnpm-lock.yaml`，不在 `.github/` 下。
   （此点亦更正主控位 round2 记录里「两者都撞 HD-2」的误述，见 §5。）
3. **B 的真实成本比预估低**：`@vitest/browser-playwright@4.1.4` 的 peerDependencies 实测为
   `{ "vitest": "4.1.4", "playwright": "*" }` ⇒ **playwright 的约束是 `*`**，
   **不需要**升 `@vitest/browser-playwright`，**不需要**动 `vitest 4.1.4`。
4. **版本支持已核对**（解包 `playwright-core` 比对 registry 字符串）：

   | 版本 | 支持的 ubuntu |
   | --- | --- |
   | `1.59.1`（当前） | 18.04 / 20.04 / 22.04 / **24.04** —— 无 26.04 |
   | `1.64.1`（目标） | 18.04 / 20.04 / 22.04 / 24.04 / **26.04** —— 含 |

5. **引擎要求满足**：`1.64.1` 的 `engines.node = ">=20"`；CI 用 `node-version: 22`，本机 Node v22.20.0。

> 一句话：缺陷是「工具链落后于 runner 镜像」，A 是钉死环境、B 是让工具链跟上。
> A 的正确性更高，但它被权限锁死；B 在当前权限下可执行，且顺带解决「24.04 将来也会被滚掉」的隐患。

---

## 2. 范围（**只允许改两个文件**）

| 文件 | 变更 |
| --- | --- |
| `package.json` | `devDependencies.playwright`：`1.59.1` → `1.64.1`（只改这一项） |
| `pnpm-lock.yaml` | 由 `pnpm install` 生成，不要手改 |

**明确禁止**（写了就是越界，须先上报）：

- 不得改 `.github/workflows/**`（HD-2；推送被拒即停工上报，禁网页绕过）；
- 不得改任何 `server/**` 或 `src/**` 业务代码、测试断言、文档语义；
- 不得升 `vitest` / `@vitest/browser-playwright` / `@playwright/test`（peer 是 `*`，无必要）；
- 不得顺手加 `--with-deps` 之外的脚本参数、不得改 `test:browser:install` 的命令形态；
- 不得升其他依赖（`pnpm install` 只应带来 playwright 及其直接依赖的变化）。

若 `pnpm install` 意外改动了无关依赖，**回退后上报**，不得把无关变更混进来。

---

## 3. 验证要求（缺一不可，全部留原始输出）

### 3.1 必跑

```bash
# 1) 装依赖（会更新 lockfile）
pnpm install

# 2) 重装浏览器（本机是 Windows，1.64.1 的 chromium 版本与 1.59.1 不同，必须重装）
pnpm test:browser:install

# 3) 前端全量（注意：必须先 build:shared，否则 shared 的 import 解析失败）
pnpm build:shared
pnpm test
```

### 3.2 前端全量结果必须做**基线对照**，不能只看「绿」

本仓库有已知陷阱：`shared/tsconfig` 会把 `*.test.ts` 编进 `shared/dist`，
vitest 会**重复收集** `shared/dist/**/*.test.js`，导致用例数虚高且漂移。
⇒ 断言「N 例」之前，必须：

1. 用 `git stash` 或在临时 worktree 里回到**未升级的 `a17a6ab`**，跑同一套 `pnpm build:shared && pnpm test`，
   记下**基线用例数**与**基线失败集**；
2. 升级后再跑，与基线**逐项**比对（不是只比总数）。

判定规则：

- 若升级后**新增失败**（基线没有的失败项）⇒ 视为升级引入，**先上报**，不得自行改断言或跳过；
- 若失败集与基线**完全相同** ⇒ 判为既有问题，如实记录并在交接里点名；
- 用例数变化必须能解释（例如 `dist` 重复收集导致的差异），不能只写「N 通过」。

### 3.3 门禁（取真实退出码，不要用管道后的 `$?`）

```bash
pnpm exec eslint .            > /tmp/x.log 2>&1; echo "eslint=$?"
pnpm exec prettier --check .  > /tmp/x.log 2>&1; echo "prettier=$?"
pnpm exec tsc -b              > /tmp/x.log 2>&1; echo "tsc=$?"
pnpm knip                     > /tmp/x.log 2>&1; echo "knip=$?"
python scripts/audit-repo.py  > /tmp/x.log 2>&1; echo "audit=$?"
```

期望：`eslint=0`、`prettier=0`、`tsc=0`、`knip=0`、`audit` 输出 `PASS=9 FAIL=0`。

### 3.4 与本次改动无关但必须重跑（防止误伤）

```bash
pnpm --filter server restore-check      # 期望 24 通过 / 0 失败
pnpm --filter server retention-check    # 期望 10 通过 / 0 失败
pnpm --filter server restore-e2e        # 期望 21 通过 / 0 失败（一次即可，不必两次）
```

> `restore-e2e` 会起真实服务。**严禁**对 `server/data/app.db` 做任何操作；
> 结束后复核其 mtime 仍为 `2026-10-13 23:04:22`，并把复核结果写进交接。

---

## 4. 提交与 PR

**两个独立提交**（不要合成一个，否则审查无法分离依赖变更与档案）：

1. `chore(deps): 升 playwright 1.59.1 → 1.64.1（runner 已滚到 ubuntu-26.04）`
   —— 只含 `package.json` + `pnpm-lock.yaml`
2. `docs(TASK-051): 收口 I2 独立审查与 E-1 决定`
   —— 含下列**四份未跟踪档案**与本轮新增，全部已在工作区，直接 `git add`：
   - `tasks/review/TASK-051-…/handoffs/2026-10-31-coordinator-review.md`
   - `tasks/review/TASK-051-…/handoffs/2026-10-31-coordinator-review-round2.md`
   - `tasks/review/TASK-051-…/handoffs/HANDOFF-003-coordinator-to-implementer.md`
   - `tasks/review/TASK-051-…/handoffs/2026-10-31-review.md`（I2 记录）
   - `tasks/review/TASK-051-…/handoffs/HANDOFF-005-coordinator-to-implementer.md`（本文件）
   - `tasks/review/TASK-051-…/TASK.md`（已被主控位修改）

**KI-11 提醒**：这些档案当前是未跟踪状态，且本文件自身也是其中一份。
⇒ **不要**在交接里写「工作区干净 / `git status` 为空」；应写「档案已随本提交入库」。

推送后等 **CI 转绿**（`install-lint-build` 必须 success），然后停下。

---

## 5. 对 I2 三个记录项的处置（主控位裁定，执行位照此落档）

| 项 | 处置 |
| --- | --- |
| **5-1** AC-12 引注「20 个文件」在 head 上已过期 | **采纳**。改为不写死数字（写「`git diff --name-only main...HEAD` 全量核对」），避免每轮都滞后。 |
| **5-2**「两条路都撞 HD-2」表述不准确 | **采纳并加强**。主控位实测 `ndldsn` 对该仓库 `push: false` ⇒ 路径 A 不是「需授权」，而是**当前身份下不可执行**。已在 §1 更正，round2 记录不回改（保留时间线）。 |
| **5-3** 第二账号有 `workflow` scope | **记录属实，但不构成可行路径**。`workflow` scope 与仓库写权限是两件事：该账号 `pull: true / push: false`。执行位**不得**尝试切换账号推送。 |

---

## 6. 红线

- 不合并、不打 tag、不自行判定 PASS；
- 不改 `.github/workflows/**`；推送被拒即**停工上报**，禁网页绕过（HD-2）；
- 前端出现新失败时**先上报**，不得改断言 / 加 skip / 降标准；
- 不得对 `server/data/app.db` 做任何恢复、替换、删除、rename；
- 不夹带任何与 E-1 无关的改动。

---

## 7. 交付物

`handoffs/HANDOFF-006-implementer-to-coordinator.md`，须含：

1. 两个提交的 SHA 与各自文件清单；
2. `pnpm test` 的**基线与升级后**两次原始输出（含用例数与失败集对比表）；
3. 五项门禁的真实退出码；
4. 三个 server 脚本的重跑输出，以及 `server/data/app.db` 的 mtime 复核；
5. 新 head 上的 `gh pr checks 26` 输出（`install-lint-build` 是否转绿）；
6. 如实标注**未做**的事（例如未在 Linux 本机跑脚本）。
