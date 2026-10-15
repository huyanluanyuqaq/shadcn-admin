# Protocol: Project Adoption

> 把**已存在的项目**接入本 Workspace。**核心铁律：只加不改（Additive Only）。**

---

## 1. 适用场景

- 已有一个正在开发的软件项目，希望纳入本 Workspace 统一协作。
- 项目可能已有：自己的 Git 历史、README、docs、测试、CI 配置、甚至已有的 `AGENTS.md` / `CLAUDE.md`。
- 项目可能有**完全不同于模板**的目录结构。

**不适用：** 从零创建新项目（那用 `shared/scripts/create_project.py`）。

---

## 2. 核心铁律：只加不改

> **迁移只追加"协调层"，绝不改动"代码层"。**

| 层 | 内容 | 迁移动作 |
|----|------|---------|
| **协调层** | `AGENTS.md`、`docs/`、`tasks/` | ✅ 追加 |
| **代码层** | 源码、测试、构建配置、CI、依赖清单 | ❌ 不动 |

**原因：** 迁移的目的是让 Agent 能协作，不是让项目"长得像模板"。
改动代码层会引入风险、破坏 Git 历史、可能弄坏构建。

---

## 3. 框架的目录约定不是强制要求

框架模板中的 `src/` / `tests/` / `scripts/` 是**起点建议**，不是规范。

> **项目 `AGENTS.md` §4 Project Structure 的作用，是记录项目的"实际"结构，而不是要求项目符合某个结构。**

因此：既有项目保持原布局，只需在 `AGENTS.md` 中如实描述即可。

---

## 4. 迁移前检查（Inspect）

**必须只读完成，不得修改任何文件。**

- [ ] 项目根路径
- [ ] 是否已有 Git 仓库（`git status`）
- [ ] 是否已有 `AGENTS.md` / `CLAUDE.md` / `.cursorrules` 等 Agent 配置
- [ ] 是否已有 `README.md`
- [ ] 是否已有 `docs/`，其结构与内容
- [ ] 是否已有测试与测试命令
- [ ] 是否已有 CI / 构建配置
- [ ] 技术栈识别（语言、框架、包管理器）
- [ ] 是否存在敏感文件（`.env`、密钥）—— **只识别，不读取内容**
- [ ] 项目目录结构概览

输出一份 **Adoption Report**：现状 + 冲突点 + 建议方案。

---

## 5. 迁移方式选择

### 方式 A — 移入 `projects/`

把项目（或其副本）放到 `projects/<name>/` 下。

| 优势 | 劣势 |
|------|------|
| 与其他项目共享 Workspace 规范 | 需要处理嵌套 Git 仓库 |
| Discovery 统一 | 项目路径变化 |
| 可用 `create_project.py` 的后续流程 | — |

**嵌套 Git 处理：**

| 情形 | 做法 |
|------|------|
| Workspace 本身**不是** Git 仓库 | ✅ 直接放入，无冲突（推荐） |
| Workspace **是** Git 仓库 | 用 Git submodule，或在 `.gitignore` 中排除该项目 |

### 方式 B — 就地采纳

项目留在原位置，只追加协调层文件。

| 优势 | 劣势 |
|------|------|
| 零路径变更，零风险 | 不在 Workspace 的 `projects/` 下，Discovery 看不到 |
| 适合大型或已部署项目 | 需在 `projects/README.md` 中登记外部路径 |

> **选择建议：** 项目小、无部署依赖 → 方式 A。项目大、已在运行、路径敏感 → 方式 B。

---

## 6. 资产映射规则

| 现有资产 | 处理方式 |
|---------|---------|
| `README.md` | **保留原内容**，仅追加"协作说明"章节（指向 `AGENTS.md`） |
| 已有 `AGENTS.md` / `CLAUDE.md` | **保留原内容**，与模板字段**合并**；冲突处保留原有意图 |
| 已有 `docs/` | 保留；按语义映射到 `requirements/ architecture/ technical/ decisions/ operations/`，不匹配的**保留原位置并在 `AGENTS.md` 中说明** |
| 已有 ADR | 迁入 `docs/decisions/`，**重新编号**并在索引中登记；原文不改 |
| 已有 TODO / issue 列表 | 转为 `tasks/backlog/` 下的 Task（逐条转，不合并） |
| 已有 `tests/` | **不动** |
| 已有 CI / 构建配置 | **不动** |
| 已有 `.gitignore` | **合并**（追加框架条目，不删除原有条目） |
| 已有 `.env` / 密钥文件 | **不动、不读、不提交**；确认 `.gitignore` 已覆盖 |

---

## 7. 迁移步骤

```
1. Inspect（只读）→ 产出 Adoption Report
        ↓
2. 选择迁移方式（A / B）→ 获得人类确认
        ↓
3. 备份（方式 A 若涉及移动）→ 确认备份可用
        ↓
4. 追加协调层：
     - 生成 AGENTS.md（基于模板，填入真实值，合并已有 Agent 配置）
     - 建 docs/ 五子目录，按 §6 映射现有文档
     - 建 tasks/{backlog,active,review,done}/handoffs
     - 建 docs/operations/agent-constraints.md（Standalone 支撑）
     - 合并 .gitignore
        ↓
5. 登记：在 projects/README.md 添加项目条目
        ↓
6. 验证：Agent 按 AGENTS.md → 项目 AGENTS.md → TASK.md 路径能读懂项目
        ↓
7. 报告：迁移了什么、没动什么、遗留问题
```

---

## 8. 禁止事项

- ❌ **不修改**任何源码、测试、构建配置
- ❌ **不删除**任何已有文件（含"看起来没用"的）
- ❌ **不覆盖**已有 `README.md` / `AGENTS.md` 内容
- ❌ **不读取**密钥文件内容（只识别存在性）
- ❌ **不初始化**项目的 Git（若已有仓库）
- ❌ 不为"对齐模板"而重命名或移动源码目录
- ❌ 不在未获人类确认前执行方式 A 的移动操作

---

## 9. 验证标准

迁移完成的判定：

- [ ] 项目 `AGENTS.md` 已存在且无残留 `{{...}}`（可自动填充项已填）
- [ ] `AGENTS.md` 如实描述了项目的**实际**结构（非模板结构）
- [ ] `docs/` 五个子目录存在（内容可为空）
- [ ] `tasks/` 四个状态目录存在
- [ ] `docs/operations/agent-constraints.md` 存在
- [ ] `.gitignore` 已合并且覆盖密钥文件
- [ ] 已在 `projects/README.md` 登记
- [ ] **代码层零改动**（`git diff` 确认，若原为 Git 仓库）
- [ ] 无任何文件被删除

---

## 10. 与 Change Safety 的关系

迁移本身通常是低风险（只加文件），但以下情形需按 `.agents/protocols/change-safety.md` 处理：

- 移动项目目录（涉及路径变更）
- 修改已有 Git 仓库的远程地址
- 合并 `.gitignore` 时移除既有条目
- 处理嵌套 Git 仓库（submodule 变更）
