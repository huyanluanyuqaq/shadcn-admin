# HANDOFF-001 — 主控位 Coordinator → 执行位 Implementer

---

## Meta

```yaml
From: 主控位 Coordinator
To: 执行位 Implementer
Task: TASK-045 — Docker 流水线四项加固（合并即构建 / pnpm 统一 / 重试 / 本地脚本）
Date: 2026-10-17
Current State: ACTIVE
Previous Handoff: 无（首个交接）
```

---

## Completed Work

> 主控位已完成的部分（你**不需要**重做，但你**需要**复核）。

- [x] **镜像流水线全量只读核查**（用户要求「实现自动构建推送」，实测发现 TASK-042 已实现 90%+
      ⇒ 定位为**加固而非重建**，避免覆盖既有设计决策）。
- [x] **确认四个缺口**：G1 无法合并触发、G2 pnpm 大版本漂移、G3 零重试、G4 无本地入口。
- [x] **实测「合并确实产生 `event=push`」**：今天四次合并均触发 CI ⇒ G1 技术方案成立。
- [x] **实测否决「自动打 tag」**：`GITHUB_TOKEN` 推送不触发新 workflow run（GitHub 内置递归防护）
      ⇒ 必须引入 PAT 才能串联；**人类已于 23:4x 选定甲方案，乙方案否决**。

---

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `tasks/active/TASK-045-docker-pipeline-hardening/TASK.md` | 新增 | 任务档案 |
| `tasks/active/TASK-045-docker-pipeline-hardening/handoffs/HANDOFF-001-coordinator-to-implementer.md` | 新增 | 本文件 |

---

## Tests

```yaml
命令: 未运行（设计阶段产物，零代码变更）
结果: 不适用
覆盖: 不适用
未覆盖: 全部验证留待你按 AC-1 ~ AC-12 实施
```

---

## Known Issues

- **★ 本机没有 Docker**（实测 `docker: command not found`）。
  ⇒ **AC-4（pnpm 对齐后的安装）与 AC-6（脚本本地构建）无法本地实跑**，
  必须以 **CI 实跑**（AC-7）补足。**不得声称「本地已验证」。**
- **AC-2 有验证边界**：「main push 触发」**只能在合并后**观察到（PR 合并前无法构造该事件）。
  须如实说明该边界，**不得伪造已验证**。合并后的 run 即最终证据。

---

## Remaining Work

按 `TASK.md` 的 Implementation Plan 执行，全部 AC 均未开始：

- **Phase 1**：基线 → `docker.yml` 加 `branches: ["main"]` → 确认 `:latest` 行未改
- **Phase 2**：`Dockerfile` pnpm 对齐 → 加重试与分阶段日志
- **Phase 3**：新增 `scripts/docker-build.sh` + `docs/operations/docker-release.md`
- **Phase 4**：回写 TASK-044（第十二实例）→ 审计 → 提交开 PR → **停下**

---

## Assumptions

> 以下是主控位做出的假设。**若某条不成立，立即停下上报。**

1. **`main` 仍为 `a978337`**。若已推进，**不要**因此改变做法（重新 fetch 复核即可）。
2. **`:latest` 门禁仍是现状**（`enable=${{ github.ref_type == 'tag' }}`）。
   若你发现该行已被改动，**停下报告**——这是本任务的零削弱红线。
3. **`DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` 仍在位**。你仍须自己用
   `gh secret list` 复核（**只看名字，不打印值**）。
4. **`pnpm-workspace.yaml` 的 `allowBuilds` 写法兼容 pnpm 12**。
   ⚠️ 这是**假设**，不是事实。若 pnpm 12 报 `ERR_PNPM_IGNORED_BUILDS`，
   **停下上报，不得改那个文件**（它在你的 Non-Scope 里）。

---

## Risks

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| **顺手给 `:latest` 也加 main 触发** | 每次合并都覆盖线上最新版本 ⇒ **推翻 TASK-042 的核心保护** | R2 + AC-3（`git diff` 该行须为空）；人类已明确否决自动 tag |
| **误以为要实现自动打 tag** | 引入 PAT、扩大攻击面 | R 段与 Task Rules 明确「**不得实现**」；人类已否决 |
| **`branches` + `tags` 语义理解错（当成「与」）** | 合并构建不触发 | Notes 第 1 条；AC-2 要求实跑验证 |
| **等 CI 超时误判为失败** | 误报 | QEMU 多架构耗时 10~20 分钟属正常；Notes 第 2 条 |
| **pnpm 12 导致 install 失败** | CI 红 | 遇 `ERR_PNPM_IGNORED_BUILDS` **停止上报**，不改 `pnpm-workspace.yaml` |
| **本地脚本写死凭据** | **凭据入库**（安全事故） | R7 + AC-6（grep 验证无字面量）；脚本默认**不推送** |
| **改了 `ci.yml` 去对齐 pnpm** | 触发 CI 红（改工作流即触发） | File Scope 已把它列入 Non-Scope；**改 Dockerfile 反向对齐** |
| **AC-2 伪造已验证** | 档案失真 | KI-2 已说明验证边界；**诚实记录比好看重要** |

---

## Next Action

**接收方（执行位）的第一个具体动作，按序执行：**

1. 读完 `tasks/active/TASK-045-docker-pipeline-hardening/TASK.md`，
   重点是 §4.3（甲方案的技术前提）与 §4.4（**已否决的乙方案**）。

2. 执行 **AC-1 前置基线**，把原始输出记下：

   ```bash
   cd E:/NDLDSN-WORKSPACE/projects/shadcn-admin
   git fetch origin
   git rev-parse main origin/main          # 期望两处 a978337
   git status --short                     # 期望为空
   gh api repos/huyanluanyuqaq/shadcn-admin/pulls \
     --jq '.[] | select(.state=="open") | .number'   # 期望为空
   ```

3. **先记录 `:latest` 当前状态**（这是后面的比对基准）：

   ```bash
   grep -n "type=raw,value=latest" .github/workflows/docker.yml
   ```

4. 确认无误 ⇒ `git switch main && git pull --ff-only`，然后
   `git switch -c chore/TASK-045-docker-pipeline-hardening`，进入 Phase 1。

> **不得跳过第 3 步。** `:latest` 门禁是本任务的零削弱红线，
> 没有改动前的基准就无法证明「未削弱」。

---

## References

- 任务档案：`tasks/active/TASK-045-docker-pipeline-hardening/TASK.md`（唯一事实来源）
- 待改工作流：`.github/workflows/docker.yml`（`:latest` 行约 L84）
- 待改镜像：`Dockerfile`（corepack pnpm 版本）
- 待回写：`tasks/review/TASK-044-archive-writeback-and-cleanup/TASK.md`（第十二实例）
- 体例参考：`tasks/done/TASK-042-ci-server-typecheck-and-release-gate/TASK.md`
- 规范：`AGENTS.md` §13（DoD）、§14（GitHub 协作）、§14.2（rebase-merge）