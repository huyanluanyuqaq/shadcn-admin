# Rule: Git

> 通用 Git 规范。**技术栈无关。**

---

## 1. 分支模型

每个 Task 一个分支，命名：

```
<type>/<task-id>-<short-slug>
```

`<type>` ∈ `feature` | `bugfix` | `refactor` | `research` | `release` | `docs` | `chore`

示例：

```
feature/TASK-012-user-login
bugfix/TASK-031-null-pointer-on-empty-cart
refactor/TASK-045-extract-payment-gateway
docs/TASK-050-update-adr-003
```

**主分支约定：**

- `main` —— 稳定分支，始终可构建、可发布。
- 禁止直接向 `main` 推送；一律通过合并进入。

## 2. 提交信息

采用 Conventional Commits 风格：

```
<type>(<scope>): <subject>

<body>

<footer>
```

- `subject` 使用祈使句、不超过 72 字符、不以句号结尾。
- `body` 说明**为什么**（what 已由 diff 说明）。
- `footer` 引用 Task ID 与关联 Issue。

示例：

```
fix(cart): prevent null dereference on empty cart

The cart total was computed before the empty-cart guard ran,
causing a null dereference when the cart had no items.

Refs: TASK-031
```

**type 取值：** `feat` | `fix` | `refactor` | `test` | `docs` | `chore` | `perf` | `build` | `ci`

## 3. 原子提交

- 一个提交只做一件事。
- 重构与功能变更**不得混在同一提交**。
- 每个提交应当可独立理解、可独立回滚。

## 4. 提交前检查

- [ ] 构建通过
- [ ] 测试通过
- [ ] 无调试代码 / 打印语句
- [ ] 无密钥或敏感信息
- [ ] 无大体积二进制文件
- [ ] 提交信息符合规范

## 5. 合并

- 合并前必须：Review PASS + 测试通过。
- 优先使用**压缩合并**（squash）以保持 `main` 历史线性清晰（项目可覆盖）。
- 合并后删除已合并的分支。

## 6. 禁止操作（受保护）

以下属于**高风险 Git 操作**，执行前必须按 `.agents/protocols/change-safety.md` 处理：

| 操作 | 风险 |
|------|------|
| `git push --force`（尤其对共享分支） | 覆盖他人工作 |
| `git reset --hard` | 丢失未提交改动 |
| `git clean -fdx` | 删除未跟踪文件 |
| 改写已推送的历史（rebase / amend） | 破坏他人本地历史 |
| 删除分支（未确认已合并） | 丢失工作 |
| `git filter-branch` / 历史重写 | 不可逆 |

**绝对禁止：**

- ❌ 提交密钥、令牌、密码、证书
- ❌ 在共享分支上强制推送
- ❌ 未经确认删除他人分支

## 7. 忽略文件

- 每个项目维护自己的 `.gitignore`。
- 不提交构建产物、依赖目录、本地配置、密钥文件。
- 若密钥已被提交 → 立即轮换密钥（仅删除文件不够）。

## 8. 冲突处理

- 冲突必须在**理解双方意图**后解决，禁止盲目选择一边。
- 解决后必须重新运行测试。
- 无法判断时，向相关 Agent / 人类请求澄清。

---

## 与项目规则的关系

项目可在 `AGENTS.md` 中补充分支命名前缀、提交语言、合并策略等。
**第 6 节的禁止操作属于受保护规则，不可被项目覆盖。**
