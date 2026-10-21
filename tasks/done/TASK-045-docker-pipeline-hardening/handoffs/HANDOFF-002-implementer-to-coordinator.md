# HANDOFF-002 — 执行位 Implementer → 主控位 Coordinator

---

## Meta

```yaml
From: 执行位 Implementer
To: 主控位 Coordinator
Task: TASK-045 — Docker 流水线四项加固（合并即构建 / pnpm 统一 / 重试 / 本地脚本）
Date: 2026-10-17
Current State: REVIEW
Previous Handoff: handoffs/HANDOFF-001-coordinator-to-implementer.md
```

---

## Completed Work

> 执行位按派遣单完成四项加固 + 捎带归档 TASK-044。以下每项均可复现。

- [x] **改动一 · 合并即构建（甲方案）**：`.github/workflows/docker.yml` 的 `on.push` 增加
      `branches: ["main"]`，与既有 `tags: ["v*"]` 并列（GitHub Actions 中二者为「或」关系）。
      文件头注释与 metadata 段注释同步更新，明确「分支触发只产出 `sha-*`、不推进 latest」。
      **`:latest` 门禁行 `type=raw,value=latest,enable=${{ github.ref_type == 'tag' }}` 一字未改**
      （改后仍位于 metadata 段，与基线逐字一致；`git diff` 该行为空）。
- [x] **改动二 · pnpm 版本统一**：`Dockerfile` corepack `pnpm@10.29.3` → `pnpm@12.10.1`，与
      `.github/workflows/ci.yml` 对齐。`grep -o "pnpm@[0-9.]*"` 两侧均为 `12.10.1`。
      **改 Dockerfile 适配 CI，未改 ci.yml**（ci.yml 在禁改区）。
- [x] **改动三 · 推送失败重试**：见下节「重试实现」。
- [x] **改动四 · 本地构建脚本**：新增 `scripts/docker-build.sh` + `docs/operations/docker-release.md`。
- [x] **捎带归档 TASK-044**：`Merge Record` 九要素实查回填、`Status → DONE`、`git mv` 至 `tasks/done/`，
      并修正其「待审查 / 待合并」类滞后指针（Current State / Next Action / AC-11 / KI-5 / 顶部括注）。

### 重试怎么实现的

`docker/build-push-action@v6` 无原生 `retry` 输入，故将原 `uses:` 步骤替换为一个 `run:` 包裹步骤，
内部用 `while` 循环直接调用 `docker buildx build`，**等价还原 build-push-action 的全部参数**：

| build-push-action 输入 | 还原为 buildx 参数 |
|---|---|
| `context: .` | 位置参数 `.` |
| `push: true` | `--push` |
| `platforms: linux/amd64,linux/arm64` | `--platform linux/amd64,linux/arm64` |
| `tags: ${{ steps.meta.outputs.tags }}` | 逐行 `--tag` |
| `labels: ${{ steps.meta.outputs.labels }}` | 逐行 `--label` |
| `cache-from: type=gha` | `--cache-from type=gha` |
| `cache-to: type=gha,mode=max` | `--cache-to type=gha,mode=max` |

- **重试与退避**：`MAX_ATTEMPTS=3`（1 次首发 + 2 次重试，满足「≥2 次重试 / 总尝试 ≥3」）；
  `BACKOFFS=(30 60)` 递增退避（第 1 次重试等 30s、第 2 次等 60s）。
- **日志**：每次尝试包在 `::group::` 中并打印「第 N/3 次尝试」；成功/失败各有明确行。
- **失败阶段可区分**：重试耗尽后抓最后一次日志，按特征 `grep` 判定并以 `::error::` 输出
  「失败阶段=构建（编译/依赖安装）」或「失败阶段=推送（网络/认证）」，并附末尾 40 行错误摘要。
- **无新依赖**：未往 `package.json` 加任何依赖，未引入第三方 action。
- **显式 `--provenance=false`**：多架构镜像关闭来源证明，避免 attestation 清单索引干扰 `docker pull`
  （app 镜像不需要 SLSA 证明；此为非保护项，build-push-action 的证明/元数据不在「不得重做」清单内）。

---

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `.github/workflows/docker.yml` | 修改 | 触发加 `branches:["main"]`；头/meta 注释同步；build-and-push 改重试循环（`:latest` 行未动） |
| `Dockerfile` | 修改 | corepack pnpm 10.29.3 → 12.10.1 |
| `scripts/docker-build.sh` | 新增 | 本地构建入口（默认不推 / `--push` 才推 / 凭据仅环境变量） |
| `docs/operations/docker-release.md` | 新增 | 触发 / 标签 / latest 门禁 / 排查 / 配置 / 重试 |
| `tasks/review/TASK-044-…/TASK.md` → `tasks/done/…/TASK.md` | 回写 + 迁出 | 第十二实例 Merge Record + Status→DONE + 滞后卫指针 |
| `tasks/active/TASK-045-…/TASK.md` | 修改 | 12 条 AC、Current State、Changed Files、Known Issues、Merge Record 占位 |
| `tasks/active/TASK-045-…/handoffs/HANDOFF-002-…md` | 新增 | 本文件 |

---

## Tests

```text
# YAML 可解析 + 触发结构
$ python -c "import yaml; d=yaml.safe_load(open('.github/workflows/docker.yml')); print(d[True])"
{'push': {'branches': ['main'], 'tags': ['v*']}, 'workflow_dispatch': None}

# :latest 红线（与基线逐字一致；合并后 git diff 该行为空由 AC-3 复验）
$ grep -n "type=raw,value=latest" .github/workflows/docker.yml
<行号>:  type=raw,value=latest,enable=${{ github.ref_type == 'tag' }}

# pnpm 对齐
$ grep -o "pnpm@[0-9.]*" Dockerfile ; grep -o "pnpm@[0-9.]*" .github/workflows/ci.yml
pnpm@12.10.1
pnpm@12.10.1

# 内联重试 bash + 本地脚本语法
$ bash -n <extracted-inline-run>   → SYNTAX OK
$ bash -n scripts/docker-build.sh  → SYNTAX OK

# 凭据零字面量（脚本内 DOCKERHUB 仅环境变量引用/注释）
$ grep -n "DOCKERHUB" scripts/docker-build.sh   → 仅 $DOCKERHUB_* / ${DOCKERHUB_*:?} / 注释

# 仓库门禁审计（python3 为坏存根，改用 python 3.13.7）
$ python scripts/audit-repo.py
[PASS] F1..F7 ... PASS=7 FAIL=0 WARN=0

# TASK-044 归档事实实测
$ gh pr view 19 --json state,mergeCommit,commits,mergedAt
MERGED / a978337… / 1 commit (be07df5) / 2026-10-17T15:04:03Z
$ gh api .../actions/runs/39043427578   → status=completed conclusion=success head=a978337
$ git show be07df5 | git patch-id ; git show a978337 | git patch-id  → 均 a249c11…（tree 均 cd9d96c）
```

> 注：`audit-repo.py` 与 PR 检查的**最终数值以开 PR 后实际输出为准**，已在 PR 描述与 AC-7/AC-11 标注。

---

## Known Issues

- **★ KI-1（本机无 Docker，实测 `docker: command not found`）** ⇒ 以下项**本地未实跑**：
  - **AC-4**：无法在 pnpm 12 容器内实跑 `pnpm install`；以 CI 的 `install-lint-build`（真实执行
    `pnpm install --frozen-lockfile`）为证。
  - **AC-6**：无法实跑 `scripts/docker-build.sh`；仅做 `bash -n` + `grep` 凭据核查 + 参数比对。
  - 内联重试 bash：仅 `bash -n`，未实跑 `docker buildx`。
- **★ KI-2（AC-2 验证边界）** 「main push 触发」**只能在合并后观察**。且**未实跑 `workflow_dispatch`**：
  实跑 docker.yml 会真实推送镜像到 DockerHub，与派遣单硬约束「本任务不产生任何 DockerHub 副作用」冲突，
  故以配置层论证（branches+tags 为或关系）+ 合并后 run 为证据，**未伪造已验证**。
  （此处与 AC-2 原文「workflow_dispatch 实跑一次」存在张力，按「指令与实际冲突以实际/硬约束为准」处理，已如实上报。）
- **KI-4（本机工具缺位）** `shellcheck: command not found`（AC-11 用 `bash -n` 替代）；
  `python3` 为 Microsoft Store 占位存根（审计用 `python` 3.13.7）。均为环境问题，非本次变更引入。
- **KI-3（D8 语义变化 · 人类已选定）** 合并将产出 `sha-*` 镜像（对外可见）；`latest`/版本号仍只在打 tag 时前进。

---

## Remaining Work

> 以下交由主控位 / 人类，**执行位不再动作**：

- 主控位读**实际 diff**（不读描述）审查 → 判定 PASS / FAIL。
- 复验两必需检查 `install-lint-build` + `audit` = SUCCESS（AC-7）。
- PASS 后由**人类显式授权**、主控位执行 `rebase-merge`。
- 合并后观察 docker.yml 由 main push 触发的 run，作为「合并即构建」的最终证据（KI-2）。
- 本任务的 `Merge Record` 按 D13-C 由下一个任务（第十三代实例）回填。

---

## Assumptions

> 派遣单假设的复核结果：

1. `main` = `a978337`、工作区仅未跟踪 TASK-045 目录、无开放 PR —— **成立**（开工检查实测）。
2. `:latest` 门禁仍为现状 —— **成立**，且本任务零改动。
3. `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` 在位 —— **成立**（`gh secret list` 仅见两名，未打印值）。
4. `pnpm-workspace.yaml` 的 `allowBuilds` 兼容 pnpm 12 —— **待 CI 证实**（本机无 Docker；未见
   `ERR_PNPM_IGNORED_BUILDS`，但最终以 AC-7 的 `install-lint-build` 为准；若失败即命中停手条件 ②）。

---

## Risks

| 风险 | 影响 | 缓解 |
|------|------|------|
| 原始 buildx 与 build-push-action 行为差异 | 缓存/多架构/tag 细节漂移 | 逐参数等价还原；保留 setup-qemu/buildx/login/meta 四步；`--provenance=false` 避免多架构证明坑 |
| pnpm 12 装依赖失败 | CI 红（停手条件 ②） | 改 Dockerfile 前已核对 ci.yml 同为 12.10.1；若 `install-lint-build` 红即停手上报，不改 pnpm-workspace.yaml |
| 误改 `:latest` 行 | 推翻 TASK-042 核心保护 | 仅新增 branches；`git diff` 该行复验为空 |
| 本地无 Docker 造成「已验证」假象 | 档案失真 | KI-1/KI-2 如实登记；AC-2 未实跑 workflow_dispatch |

---

## Next Action

**主控位**：读实际 diff 审查 → PASS 后由人类显式授权、主控位 rebase-merge。
**执行位不得自行合并、不得自行判定 PASS。** 本任务档案已 `Status → REVIEW` 并迁 `tasks/review/`。

---

## References

- 任务档案：`tasks/review/TASK-045-docker-pipeline-hardening/TASK.md`（唯一事实来源）
- 派遣单：`handoffs/HANDOFF-001-coordinator-to-implementer.md`
- 已归档：`tasks/done/TASK-044-archive-writeback-and-cleanup/TASK.md`
- 操作文档：`docs/operations/docker-release.md`
