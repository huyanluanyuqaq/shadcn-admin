# GitHub 平台配置清单（需人工在平台侧完成）

> **本清单中的操作无法通过提交仓库文件完成**，必须在平台的网页界面、命令行或接口中执行。
> **Agent 不代做这些操作。**
>
> **本文档只提供步骤与命令，不声称任何一项已经执行。**
> 执行完成后，将**实测结果**回填到项目的
> `docs/operations/github-capability.md`（模板：`templates/github/GITHUB-CAPABILITY.md`）。
>
> 依据：`.agents/protocols/github-capability-matrix.md`、`.agents/rules/github.md` §8

---

## 0. 前置条件

| # | 条件 | 说明 |
|---|------|------|
| 1 | 具备**管理员权限**的凭据 | 分支保护 / 规则集 / 协作者配置均需管理员权限 |
| 2 | 凭据具备 **`workflow` 范围** | 推送工作流文件时需要 |
| 3 | 确认仓库**可见性与计划等级** | 私有仓库通常需要更高计划等级才能启用分支保护（见 `github-capability-matrix.md` §5） |
| 4 | 仓库工作区**干净** | 避免配置与本地变更混淆 |

> ⚠️ **先确认第 3 项。** 若计划等级不支持，则本项目**无法启用平台门禁**，
> 应直接跳到 §6 记录为「无法启用」，不要继续尝试。

---

## 1. 检查当前状态（只读，可随时执行）

```bash
export OWNER="<owner>"
export REPO="<repo>"
export BRANCH="main"

# 仓库基本信息：可见性、Issue 开关、合并方式
gh api "repos/$OWNER/$REPO" \
  --jq '{private,visibility,has_issues,default_branch,allow_squash_merge,allow_merge_commit,allow_rebase_merge,delete_branch_on_merge}'

# 经典分支保护（未配置时返回 404）
gh api "repos/$OWNER/$REPO/branches/$BRANCH/protection" 2>&1 | head -40

# 规则集（GitHub 的另一套保护机制）
gh api "repos/$OWNER/$REPO/rulesets" 2>&1 | head -40

# 最近的工作流运行
gh run list -R "$OWNER/$REPO" --limit 10
```

**记录这些输出**，它们就是能力记录 §1 / §2 的原始证据。

---

## 2. 启用 Issues（可选）

**本框架不使用 Issue 作为状态与审查载体**，因此此项**不是必需**。
仅当需要 Issue 索引（Level 2 自动化）时才启用。

```bash
gh api -X PATCH "repos/$OWNER/$REPO" -F has_issues=true
```

> ⚠️ **启用前先完成 §5**，否则定时工作流可能自动关闭协作记录。

---

## 3. 配置分支保护（核心）

### 3.1 期望配置

| 设置项 | 值 | 对应 API 字段 |
|--------|----|-------------|
| 要求合并前必须经过 PR | 启用 | `required_pull_request_reviews`（**非 null**） |
| 要求批准数 | **0** | `required_approving_review_count: 0` |
| 要求状态检查通过 | 启用 | `required_status_checks.contexts` |
| 要求分支为最新 | 启用 | `required_status_checks.strict: true` |
| 不允许绕过 | 启用 | `enforce_admins: true` |
| 允许强制推送 | 禁用 | `allow_force_pushes: false` |
| 允许删除分支 | 禁用 | `allow_deletions: false` |

> **两个关键点，缺一即门禁空转：**
> 1. `required_pull_request_reviews` 必须**非 null**（否则不要求 PR，检查管不住直接推送）；
>    `required_approving_review_count` 必须为 **0**（单身份下设 ≥1 会变成空转门禁）。
> 2. `enforce_admins` 必须为 **true**，否则有管理员权限的账号默认绕过全部规则。
>
> ⚠️ 启用 `enforce_admins` 前请阅读 `github-capability-matrix.md` §6 的**自锁风险**。

### 3.2 执行

先写出配置文件 `protection.json`：

```json
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["verify"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": false,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 0
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
```

> `contexts` 中的名称**必须与工作流中的作业名完全一致**（模板使用的固定作业名为 `verify`）。
> 名称不匹配会导致必需检查永远处于「待处理」状态。

应用配置：

```bash
gh api -X PUT "repos/$OWNER/$REPO/branches/$BRANCH/protection" \
  -H "Accept: application/vnd.github+json" \
  --input protection.json
```

**幂等性：** `PUT` 是全量替换，重复执行结果一致。

**验证：**

```bash
gh api "repos/$OWNER/$REPO/branches/$BRANCH/protection" \
  --jq '{required_status_checks, enforce_admins, required_pull_request_reviews, allow_force_pushes, allow_deletions}'
```

> **说明：** 若仓库为私有且计划等级不支持分支保护，此命令会失败。
> 此时**如实记录为「无法启用」**，不要改用其他方式伪装。

### 3.3 备选：规则集（Rulesets）

规则集是另一套机制。可用 `gh api repos/$OWNER/$REPO/rulesets` 查看。
**注意：** 规则集的例外名单通常只有组织仓库可配；个人账号仓库可能无法使用全部能力。
采用规则集时，必须按其自身规则名重写配置，**不得直接套用 §3.1 的字段名**。

---

## 4. 协作者与第二身份（可选）

**本框架默认使用单身份**，因此此项**通常不需要**。

仅当需要**平台级**的「实现者 ≠ 批准者」时，才需要第二身份：

```bash
# 查看现有协作者
gh api "repos/$OWNER/$REPO/collaborators"

# 添加协作者（需要管理员权限）
gh api -X PUT "repos/$OWNER/$REPO/collaborators/<username>" -f permission=push
```

> ⚠️ 引入第二身份后，两端必须使用**不同的密钥或令牌**，不得共享同一份凭据文件。
> 同时需重新评估 §3.1 的 `required_approving_review_count`（此时可设为 1）。
>
> **若维持单身份，则必须披露：独立审查为流程约定，平台不强制。**

---

## 5. 处置定时工作流

平台的定时工作流可能**自动关闭沉寂的交付请求或 Issue**，造成协作记录丢失。

| 动作 | 说明 |
|------|------|
| 评估 | 检查 `.github/workflows/` 中是否存在自动关闭（stale）类工作流 |
| 处置 | 停用 / 提高阈值 / 排除受保护标签 |
| 时机 | **在启用 Issues 之前**完成 |

```bash
# 查看仓库中的工作流
gh workflow list -R "$OWNER/$REPO"
```

---

## 6. 实测（必做，不得跳过）

配置完成后**必须实测**下列项。详细定义见
`.agents/protocols/github-capability-matrix.md` §8。实测前一律标注「未实测」。

| 编号 | 验证方法 | 期望结果 |
|------|---------|---------|
| **V1** | （兴趣项）配置后观察一次被拒的直推 | 拒绝理由中包含必需检查 |
| **V2** | 在例外名单为空时，用自己的账号尝试强制推送 / 删除分支 | 被拒绝（否则规则对所有者无强制力） |
| **V3** | 在一个测试分支上提交并推送 | 检查**在合并之前**运行 |
| **V4** | 制造一次检查失败后尝试合并 | 合并按钮不可用 / 被阻止（阴性对照） |
| **V5** | 检查全绿后合并自己的 PR | **合并成功**（阳性对照，与 V4 成对；证明门禁不误伤合规交付） |

> **V5 编号裁决（TASK-034，2026-10-15）：** 本表 V5 的旧期望值曾写作「合并成功，**且分支被自动删除**」。
> 「自动删除头分支」是**独立的平台设置**（`Automatically delete head branches`），与门禁无关，
> 且删除远端分支需**单独授权** —— 故它**不构成 V5 的通过条件**，已从期望值中移除。
> 旧口径中的「直推是否被拒」一义由 V1（检查角度）与 V2（所有者角度）承载，不再占用 V5。

**建议做法：** 用一个**纯文档的最小变更**（例如修改一个 README 的一行）走完整流程，
把它作为制度的首个验收证据，而不是凭空断言配置有效。

---

## 7. 记录与回填

把下列内容写入项目的 `docs/operations/github-capability.md`：

1. §1 的原始输出（可见性、计划等级、是否可启用保护）；
2. §3 的验证输出（保护配置实际内容）；
3. §6 的实测结论（V1–V5 逐项）；
4. 未能完成的事项与原因（**如实记录，不得美化**）。

同时在项目 `AGENTS.md` 的 GitHub 章节中声明必需检查清单与能力记录位置。

---

## 8. 明确不做的事

- ❌ **Agent 不代做**本清单中的任何平台写操作。
- ❌ **不把未执行的配置**描述为已完成。
- ❌ **不把未实测的机制**写入制度当作已生效。
- ❌ **不使用管理员绕过**来「解决」门禁造成的阻塞 —— 绕过等于门禁作废。
- ❌ **不在「合并即发布」的场景下启用自动合并**。
