# GitHub 协作模板包

供项目复制使用的 GitHub 协作模板。**不直接生效**，需复制到目标项目的对应位置。

## 模板清单

| 模板 | 复制到 | 用途 |
|------|--------|------|
| `PULL_REQUEST_TEMPLATE.md` | `<project>/.github/PULL_REQUEST_TEMPLATE.md` | 交付请求描述字段（映射任务文件与 Handoff） |
| `GITHUB-CAPABILITY.md` | `<project>/docs/operations/github-capability.md` | **能力与实测记录**（事实陈述，非规则） |
| `dependabot.yml` | `<project>/.github/dependabot.yml` | 依赖更新 |
| `workflows/ci-node-pnpm.yml` | `<project>/.github/workflows/ci.yml` | Node + pnpm 项目的 CI 工作流 |
| `workflows/ci-generic.yml` | `<project>/.github/workflows/ci.yml` | 语言无关 CI 骨架 |

**两个工作流模板二选一**，按项目技术栈选择。

## 使用步骤

1. 选择与项目技术栈匹配的 CI 模板，复制并替换全部 `{{...}}` 占位符。
2. 复制交付请求模板。
3. 基于 `GITHUB-CAPABILITY.md` 建立项目的**能力记录**（替换占位符，未实测项保持「未实测」）。
4. 按 `shared/scripts/github_setup_checklist.md` 在平台侧完成**无法通过提交文件实现**的配置
   （分支保护、必需检查、协作者、凭据）。
5. 配置完成后**实测**并回填能力记录的 §4。
6. 在项目 `AGENTS.md` 中声明必需检查清单、合并策略与能力记录位置。

## 规则依据

| 主题 | 文件 |
|------|------|
| 端到端流程 | `.agents/protocols/github-collaboration.md` |
| 平台能力与强制力边界 | `.agents/protocols/github-capability-matrix.md` |
| 协作位与独立性 | `.agents/protocols/dual-agent-model.md` |
| 平台层强制规则 | `.agents/rules/github.md` |
| 分支与提交规范 | `.agents/rules/git.md` |

## 刻意不含的内容

| 不含 | 原因 |
|------|------|
| `CODEOWNERS` | 仅自动请求审查者，**不创建独立身份、不启用审批、不阻止合并**。在未要求批准的配置下不产生强制力 |
| Issue 表单模板 | 本框架不使用 Issue 作为状态与审查载体；任务状态以任务文件为唯一来源 |
| 平台保护配置文件 | 分支保护 / 规则集**无法通过提交文件完成**，只能在平台侧配置 |

> ⚠️ **不要为了「看起来完整」而添加这些文件。**
> 每个文件都应有对应的强制机制；没有强制机制的声明属于虚假保证。
