# HANDOFF-{{SEQ}} — {{FROM_ROLE}} → {{TO_ROLE}}

> 复制本模板到 `tasks/<state>/<task-id>/handoffs/HANDOFF-<seq>-<from>-to-<to>.md`。
> 替换所有 `{{...}}`。删除本提示块。

---

## Meta

```yaml
From: {{agent-identifier}} ({{FROM_ROLE}})
To: {{TO_ROLE}}
Task: {{TASK-XXX}} — {{task title}}
Date: {{ISO-8601}}
Current State: {{BACKLOG|READY|ACTIVE|DESIGN|BLOCKED|CHANGES_REQUESTED|TEST_FAILED|REQUIREMENT_CHANGED|REVIEW|DONE}}
Previous Handoff: {{HANDOFF-NNN or "无（首个交接）"}}
```

---

## Completed Work

> 已完成的工作。**具体，非概括。**

- {{具体完成了什么 1}}
- {{具体完成了什么 2}}

> ❌ 反例："完成了相关开发工作。"
> ✅ 正例："在 `src/auth/login.py:42-58` 提取了 token 校验函数 `verify_token()`，并为其增加单元测试 3 个。"

---

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| {{path}} | {{新增/修改/删除}} | {{说明}} |

> 若无文件变更（如纯调研），写"无文件变更"。

---

## Tests

```yaml
命令: {{运行测试的具体命令}}
结果: {{通过 X / 失败 Y / 跳过 Z}}
覆盖: {{覆盖了哪些行为}}
未覆盖: {{哪些没测，为什么}}
```

---

## Known Issues

> 已知问题、限制、未解决项。**无则写"无"。**

- {{问题 1：现象 + 影响 + 是否阻塞}}
- 或：无

---

## Remaining Work

> 剩余待完成的工作。

- {{剩余项 1}}
- {{剩余项 2}}

> 若已全部完成，写"无"。

---

## Assumptions

> 本次工作中所做的假设。**接收方需要知道这些假设，以便在假设不成立时及时发现。**

- {{假设 1}}
- 或：无

---

## Risks

> 风险与缓解。

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| {{风险}} | {{影响}} | {{缓解}} |

> 若无风险，写"无"。

---

## Next Action

> **接收方的第一个具体动作。必须可立即执行，不得写成"继续"。**

{{例如：运行 `npm test`，然后审查 `src/auth/login.py` 的限流逻辑是否正确处理并发场景。}}

---

## References

> 相关文件、文档、Issue 的路径或链接。

- {{设计文档路径}}
- {{相关 Task}}
- {{外部参考}}
