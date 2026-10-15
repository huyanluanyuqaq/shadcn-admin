# decisions — 架构决策记录（ADR）

存放 Architecture Decision Records。

## 命名

```
ADR-001.md
ADR-002.md
ADR-003.md
...
```

编号**单调递增，不复用**。即使某个 ADR 被废弃，其编号也保留。

## 状态流转

```
Proposed → Accepted → Deprecated
                    ↘ Superseded（被新 ADR 取代）
```

## 何时必须创建 ADR

- 引入或替换核心依赖 / 框架 / 数据库
- 改变系统架构（分层、模块边界、通信方式）
- 在有合理替代方案时做出有长期影响的选择
- 接受一项重要的技术债
- 推翻先前的 ADR

## 何时不需要 ADR

- 日常实现细节
- 可轻易回滚的局部变更
- 已被上级 ADR 覆盖的重复决策

## 模板

见 `ADR-000-template.md`。

## 索引

> 创建 ADR 后请在此登记。

| 编号 | 标题 | 状态 | 日期 |
|------|------|------|------|
| — | （尚无 ADR） | — | — |
