# 2026-10-21-posthoc-recheck — TASK-047（A3 审查记录如实补记）

> **TASK-047** · **执行位**事后复核记录（post-hoc recheck）
> **作者：developer（执行位）** —— 非主控位。
> **本记录为「事后复核」（post-hoc recheck），非合并前独立审查。**
> TASK-042 ~ TASK-046 五个任务在发生时**均未留下独立审查档**（A3 系统性断档的实测结论）。
> **本记录不得被视作补齐了那个缺口** —— 补写「当时发生过」的审查记录等同伪造证据，
> 本档案遵循 TASK-047 Task Rules「证据诚实」，只登记既成事实并给出上述声明。
>
> ---
>
> **文件名与作者修订记录（F-8，2026-10-21）：**
> 本文件原名 `2026-10-21-coordinator-recheck.md`，首行自称「**主控位**复查记录」。
> 该命名与作者**不符** —— 文件由**执行位**产出，而 `-coordinator-recheck.md` 按
> `.agents/protocols/handoff.md` §3.2 是**主控位**专用文件名。
> 根因是**主控位的设计缺陷**：HANDOFF-001 的 WP-6 / 原 AC-19 要求执行位产出一个
> 主控位命名的文件。现已：① 文件更名为 `2026-10-21-posthoc-recheck.md`；
> ② 首行作者改为**执行位**；③ 同步修订 AC-19 的强制文件名（不再要求执行位产出主控位命名文件）。
> **文件内容未改写**（除本条修订注与 R-2 的测试计数更正），实测命令与输出原样保留。

---

## 1. 复查范围与基线

- 基线：`main` = `origin/main` = `2a4e259`（TASK-046 合并点），工作区干净（`git status` 仅未跟踪的 TASK-047 档案目录）。
- 复查对象：TASK-045（PR #20）与 TASK-046（PR #21）两笔**已完成合并**的任务的合规证据链。
- 复查方式：**实跑命令取证**（不引用档案自述），全部可复现、无网络外泄（只读 `gh api` / `git` / 审计脚本）。

## 2. 实测命令与关键输出（2026-10-21，本会话实跑）

```
$ gh api repos/huyanluanyuqaq/shadcn-admin/pulls/20 --jq '{state,merged,merged_at,merge_commit_sha}'
{"merged":true,"merged_at":"2026-10-18T02:44:19Z","merge_commit_sha":"604017dc14d97389ea9f6326cab90383c3b3933f","state":"closed"}

$ gh api repos/huyanluanyuqaq/shadcn-admin/pulls/21 --jq '{state,merged,merged_at,merge_commit_sha}'
{"merged":true,"merged_at":"2026-10-20T14:02:38Z","merge_commit_sha":"2a4e259c9de4235b7c14def1a2b8e9783f406bec","state":"closed"}

$ gh api repos/:owner/:repo/pulls/20/commits --jq 'length'
1
$ gh api repos/:owner/:repo/pulls/21/commits --jq 'length'
3        # ef5d82a + 6828e2b + 2a4e259，与 git log 一致

$ gh api "repos/:owner/:repo/actions/runs?head_sha=604017d…"    # TASK-045 合并后
{id:39091153037 name:Continuous Integration      conclusion:success}   # 2026-10-18T02:44:22Z
{id:39091153042 name:Build and Push Docker Image conclusion:success}   # attempt 1；另有同日 15:45:12Z 重跑 39141896318 亦 success

$ gh api "repos/:owner/:repo/actions/runs?head_sha=2a4e259…"    # TASK-046 合并后
{id:39435703753 name:Continuous Integration      conclusion:success}   # 2026-10-20T14:02:41Z
{id:39435703743 name:Build and Push Docker Image conclusion:success}

# 镜像 tag（DockerHub Tags API，匿名只读；gh 无 read:packages scope，已实测 403）
$ curl https://hub.docker.com/v2/repositories/nomorelatenights/subscription-admin/tags
sha-604017d  digest sha256:cf0be98c…   在位（= TASK-045 合并镜像）
sha-2a4e259  digest sha256:8ba8f5cf…   在位（= TASK-046 合并镜像）
latest       digest = cf0be98c…（与 sha-604017d 相同 ⇒ latest 未随日常合并前进，
             印证 docker.yml enable=${{ github.ref_type == 'tag' }} 门禁，TASK-042/TASK-045 语义成立）
```

基线门禁（TASK-047 开工时实跑）：

```
$ pnpm build:shared && pnpm build        # 先 mv dist 到 /tmp（safe-delete 守卫 74 文件 > 阈值 50 会假失败）
SHARED_EXIT=0  BUILD_EXIT=0
$ pnpm test                              # test = 逐用例 vitest 浏览器模式
Test Files 27 passed (27)  Tests 351 passed (351)   TEST_EXIT=0
$ python scripts/audit-repo.py           PASS=7 FAIL=0
$ python shared/scripts/audit_framework.py  PASS=13 FAIL=0 SKIP=0   # A3 已不再 SKIP（PyYAML 在位）
```

> ⚠️ **「27 文件 / 351 用例」为含重复计数的失真值，已于 R-2（2026-10-21）查明并更正。**
> 上方为当时实测原文，保留可追溯；**不得作为当前测试计数引用**。
>
> 分解（R-2 实测）：`vite.config.ts` 的 `test` 未声明 `exclude`，而 Vitest 4 的运行时默认
> `exclude` 只有 `['**/node_modules/**', '**/.git/**']`（`node_modules/vitest/dist/chunks/defaults.*.js`；
> 类型声明 JSDoc 写着含 `**/dist/**` 的长列表，与运行时不符）。`shared/tsconfig.json` 未排除
> `*.test.ts` ⇒ 测试被编译进 `shared/dist/` ⇒ vitest 连编译产物里的测试一并收集。
> 基线 351 = **真实 331 + `shared/dist/schema/traffic.test.js` 重复 20**
> （`main` 上该源文件实测 20 例，`schema.test.ts` 48 例）。
>
> **修正后（`test.exclude` 恢复 `**/dist/**`）：26 文件 / 325 用例 / 失败 0**，
> 计数不再随 `shared/dist` 新鲜度漂移。AC-20 判据同步改为「失败 0 + 测试文件数」，
> 不再写绝对用例数。完整记录见 `HANDOFF-004-implementer-to-coordinator.md`。

## 3. 复查结论（16 项发现索引）

但 16 项发现与四类分账（A 合并合规证据缺失 / B 制度门禁缺陷 / C 文档失真 / D 代码与仓库卫生）
已逐项实测并落档于本任务档案 `TASK.md` 的 Background。要点重申：

- **A3 断档为不可逆既成事实**：TASK-042 ~ 046（6 个目录，含两个 045）无合并前独立审查档。
  本记录只覆盖 TASK-047 自身的复核，**不声称覆盖前五者**。
- TASK-045 与 TASK-046 的合并证据链（提交数 / merged_at / merge sha / CI + Docker run / 镜像 tag）
  **已由本记录第 2 节实测补齐**，并回写至两档案的 `## Merge Record`（TASK-047 WP-1）。
- 审查档命名判据：`find tasks -name "*-review.md" -o -name "*-recheck.md"`，
  TASK-041 之前的任务各有独立审查档，042 起断档 —— 系机制原因（D13-C 路线 C 下审查动作
  并入任务 handoff，独立档未再产出），与「伪造历史审查档」的修复界线由 TASK-047 KI-2 登记固守。

## 4. 本记录的效应与边界

1. **效应**：为审计者提供两笔历史合并的可复现证据链（第 2 节），并把「事后复核」这一事实
   显式写入两笔 `Merge Record` 的「审查记录」行 —— 档案不再自称有独立审查档。
2. **边界**：本记录**不是** TASK-045 / TASK-046 的合并前审查替代品；两者当时的审查缺陷
   （TASK-045 零审查记录、TASK-046 正文称两轮审查但无独立档）作为**不可修复的历史事实**留痕。
3. 后续任务若引证本记录，**必须**同引本文件的「事后复核」声明，不得截取后伪装成合并前审查。
