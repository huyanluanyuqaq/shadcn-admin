# Agent Constraints（受保护规则摘要）

> 本文件是受保护规则的**要点摘要**。自 TASK-039（2026-10-15）起 `.agents/` 已随仓库版本化，
> 两种模式下均可直接读取原文；与 `.agents/rules/*.md`、`.agents/protocols/*.md` **原文**不一致时，以原文为准。
> 本摘要不可作为削弱任何受保护规则的依据。

---

## 1. Security（安全）

- 密钥、令牌、密码**不得**写入代码、文档或提交记录。使用环境变量或密钥管理。
- 不得读取、打印或转储 `.env`、密钥文件内容。
- 认证、授权、密钥处理相关的变更，必须经 **Security 角色**审查。
- 所有用户输入必须校验（本项目使用 zod）后方可进入业务逻辑与数据层。
- 数据库访问不得拼接原始 SQL 字符串；参数一律通过 ORM 绑定。

## 2. Change Safety（变更安全）

- 生产环境部署、破坏性迁移、历史改写类操作，需**人类明确批准**。
- 变更前说明影响范围，变更后说明回滚方式。
- 不允许为「对齐模板」而重命名或移动既有源码目录。

## 3. Git 禁止操作

- 禁止 `--force` 推送到共享分支（`main` 等）。
- 禁止重写已推送的提交历史（`rebase -i` / `reset --hard` 后强推）。
- 禁止跳过钩子的提交（`--no-verify`），除非人类明确要求。
- 禁止提交密钥文件；提交前确认 `.gitignore` 已覆盖。
- 本项目为上游 fork，禁止从上游网页复制文件覆盖本地（会破坏 Git 历史）；
  需同步时应通过 upstream remote 合并。

## 4. Testing 禁止事项

- 禁止通过修改测试来「让测试变绿」；测试失败应修复实现。
- 禁止删除或跳过既有测试以通过 CI。
- 禁止以保护性 try/catch 吞掉错误来规避失败。

## 5. Permissions / 职责分离

- 一次任务中 Agent 必须声明当前扮演的 Role，不得越界执行其他 Role 的专属动作。
- **Developer 不得自我批准 Review**；Review 必须由 Reviewer 角色独立给出 PASS / FAIL。
- 同一 Task 同一时刻只有一个 Owner。

## 6. 本项目附加约束

- 包管理器固定为 **pnpm**。
- `src/routeTree.gen.ts` 与 `src/components/ui/` 为生成/托管文件，禁止手工编辑。
- 架构方案获人类确认前，不得改动代码层（`src/`、`package.json`、`vite.config.ts`）。
- 禁止从 `projects/business-manager`（Tailwind 3.4）复制组件到本项目（Tailwind 4）—— 版本不兼容。
