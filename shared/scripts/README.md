# scripts — 可复用脚本

存放**跨项目复用**的开发期脚本。

---

## 脚本清单

| 脚本 | 用途 |
|------|------|
| `create_project.py` | 从 `templates/project/` 创建新项目 |
| `audit_framework.py` | 框架自检：规则、协议、模板的一致性检查（只读、无网络） |
| `github_setup_checklist.md` | 需人工在平台侧完成的 GitHub 配置清单（非脚本） |

---

## create_project.py

从项目模板创建新项目。

### 用法

```bash
python shared/scripts/create_project.py <project-name> [选项]
```

### 选项

| 选项 | 说明 |
|------|------|
| `--description`, `-d` | 项目一句话描述 |
| `--tech-stack`, `-t` | 技术栈 |
| `--owner`, `-o` | 负责人 |
| `--git` | 初始化 Git 仓库并首次提交 |

### 示例

```bash
python shared/scripts/create_project.py api-gateway \
  --description "统一 API 网关" \
  --tech-stack "Go, Redis" \
  --owner "platform-team" \
  --git
```

### 行为

1. 校验项目名（小写字母 / 数字 / 连字符）。
2. 检查目标目录不存在（**不覆盖**已存在目录）。
3. 复制 `templates/project/` → `projects/<name>/`。
4. 替换可自动填充的占位符。
5. 可选初始化 Git。
6. 打印后续步骤。

### 设计约束

- **无副作用**：不覆盖、不删除任何已有内容。
- 只替换**可自动填充**的占位符，保留需人工填写的（如 `{{test command}}`）。
- 无需第三方依赖（仅标准库）。

---

## audit_framework.py

对 Workspace 的规则、协议、模板做本地一致性检查。**只读、无网络、无第三方依赖。**

### 用法

```bash
python shared/scripts/audit_framework.py
python shared/scripts/audit_framework.py --root E:/NDLDSN-WORKSPACE
python shared/scripts/audit_framework.py --json
python shared/scripts/audit_framework.py --only A6,A7
```

### 检查项

| 编号 | 检查内容 |
|------|---------|
| A1 | 文档内部链接有效性 |
| A2 | 文档中引用的仓库内路径是否存在 |
| A3 | YAML 可解析（缺 PyYAML 时降级为 SKIP 并明确报告） |
| A4 | 模板包内容与设计一致（含交付请求模板，不含无强制机制的文件） |
| A5 | 工作流的触发条件与最小权限 |
| A6 | 非模板文件中的占位符残留 |
| A7 | 明文凭据特征扫描 |
| A8 | 平台能力矩阵与规则的一致性 |
| A9 | 状态词表越界（WARN，需人工确认） |
| A10 | 协议与规则间的交叉引用完整性 |
| A11 | 工作流作业名与必需检查约定一致 |
| A12 | 审查制度的可执行性（回写与独立性披露条款） |
| A13 | 交付请求模板的必备字段覆盖 |

**退出码：** 存在 `FAIL` 时为 1，否则为 0。
**状态含义：** `PASS` 通过 / `FAIL` 确定的问题 / `WARN` 需人工复核 / `SKIP` 未执行（原因会打印）。

### 设计约束

- 只报告，**不修改任何文件**。
- 不做网络请求。
- 缺失可选依赖时**明确报告跳过**，不假装检查过。
- 模板目录（`templates/`）豁免占位符检查（模板本就包含占位符）。

---

## github_setup_checklist.md

需**人工在平台侧**完成的 GitHub 配置步骤（分支保护、必需检查、协作者、实测项）。
**Agent 不代做这些操作**，该文档也不声称任何一项已执行。

---

## 添加新脚本的规则

- 无第三方依赖优先。
- 必须幂等或明确说明副作用。
- 不得硬编码密钥。
- 涉及高风险操作的脚本必须在文件头注明。
- 与具体项目相关的脚本 → 放到该项目的 `scripts/`，不要放这里。
