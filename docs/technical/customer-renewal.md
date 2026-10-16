# 客户续期（Customer Renewal）设计

> **状态：已实现（rev4，e572da3）**（TASK-040）
> 设计者：主控位 / Architect · 2026-10-16
> 关联：`docs/decisions/ADR-004-renewal-duration-semantics.md`（时长口径与基准语义）、
> `tasks/review/TASK-040-customer-renewal/TASK.md`（任务档案，唯一事实来源）
>
> **★ 修订 rev2（2026-10-16，人类裁定）：** 快捷项的「N 个月」**不再按自然月计算**，
> 改为**与套餐档位统一为固定天数**（1/3/6/12 个月 = 30/90/180/360 天）⇒
> **本功能内部只有「天」一种单位**，原 `addMonths` 路径作废。依据：人类指令
> 「一个月不等于自然月，主张与档位统一」；论证、代价与被否方案见 ADR-004。
> **rev1 稿（自然月）已失效，不得据其实施。**
>
> **★ 修订 rev3（2026-10-16，人类裁定）：撤销 D-3 的「长期禁用」规则** ——
> 人类指令「没有长期有效的选项 不需要」⇒ **不设** `expireAt === null` 的禁用条件，
> 这类客户按「自今日起算」正常续期（与已过期同路径，§5.1），只读行显示 `未设置`。
> 禁用矩阵由 4 条收敛为 **3 条**（§3.4）。可达性与语义变化登记于 F13 与 L8。
>
> **★ 修订 rev4（2026-10-16，人类裁定 D-2）：** 人类指令「ADR-004 的 D-2 确认」⇒
> ADR-004 三项决策齐备并由 `Proposed` 转 **`Accepted`**。**本文内容零变更** —— 算法、交互、
> 禁用矩阵、边界与测试要求一律不变，仅关联 ADR 的状态与引用同步。
>
> **读者须知：** 本文是**功能设计**（交互、状态机、算法、边界、测试要求），
> 不重复 `api-contract.md` 的接口描述，不重复 ADR-004 的决策论证。

---

## 1 目标

在客户管理页的数据列表中，为**已选中单行的客户**提供「续期」入口：
把该客户的到期时间顺延 1 / 3 / 6 / 12 个月（= **30 / 90 / 180 / 360 天**，与套餐档位同口径），
或任意 **1–3650** 天。

> **口径要点（rev2）：** 本功能**内部只有「天」一种单位**。「个月」只出现在快捷项文案里，
> 并按套餐档位的固定天数换算（`planTiers`，§2 F9）。因此不存在「月」与「天」的算法分支，
> 也不存在自然月特有的月末 clamp 逻辑——代价是月末/闰年会出现日历漂移，
> 属**刻意行为**，见 §8 L5。

**可判定的达成标准：** 选中一行 → 工具栏「视图」左侧「续期」按钮可用 → 打开对话框 →
选择时长 → 对话框实时显示续期后的到期时间 → 确认 → 列表中该客户的「剩余天数」列随之更新。

**业务语义一句话：** 续期是**在既有到期时间之上顺延**（客户已付费的剩余时间不被吞掉），
而非「从今天重新计算」。

---

## 2 已实查事实（设计依据）

| # | 事实 | 位置 / 证据 |
|---|------|------------|
| F1 | 客户到期时间字段为 `Customer.expireAt`，类型 `number \| null`（epoch 毫秒）；`null` = **未设置到期时间**（列表显示「长期」）——**不**为其设立续期禁用规则（rev3，§3.4） | `shared/src/schema/entities.ts:94`；`customerSchema`（同文件 :108） |
| F2 | `null` 在列表「剩余天数」列显示为「长期」；`daysLeft(null)` 返回 `null` | `features/customers/utils.ts:40-43`；`features/customers/components/customers-columns.tsx:143-148` |
| F3 | 更新接口已存在且支持只改 `expireAt`：`PATCH /api/customers/:id` 用 `customerInputSchema.partial()` 校验，`dateKeys: ['expireAt','purchasedAt','subscriptionExpireAt']` 自动完成 number ↔ Date 转换 | `server/src/lib/crud.ts:220-247`；`server/src/routes/resources.ts:57-70` |
| F4 | 前端已有 `useUpdateCustomer()`（`PATCH` + 成功后 `invalidateQueries(['customers'])`） | `features/customers/api.ts:93-107` |
| F5 | CRUD 更新会自动写通用日志（`writeLog('info','客户','更新客户 #id')`），无需另建审计 | `server/src/lib/crud.ts:244` |
| F6 | 行选中态由 TanStack Table 的 `rowSelection` 承载，`getRowId = String(row.id)`；行点击 = 单选 + 展开，勾选框可多选 | `features/customers/components/customers-table.tsx:60,146,154,165-168` |
| F7 | 既有代码读取「选中行」的既有范式是 `table.getFilteredSelectedRowModel().rows` | `components/data-table/bulk-actions.tsx:39`；`features/customers/components/customers-multi-delete-dialog.tsx:22` |
| F8 | 「视图」按钮 = `DataTableViewOptions`，渲染在 `DataTableToolbar` 的最右端（`ms-auto`），工具栏共 6 处复用 | `components/data-table/view-options.tsx:23-31`；`components/data-table/toolbar.tsx:82` |
| F9 | 套餐档位周期口径是**固定天数** 30 / 90 / 180 / 360，`computeExpireAt` 用 `addDays`；**续期快捷项的 1/3/6/12 个月即取自该表（rev2）** | `shared/src/schema/entities.ts:49-54`；`features/customers/data/schema.ts:207-213` |
| F10 | 客户 `status` 与 `expireAt` **无任何自动联动**（服务端不存在 expired 扫描/回写逻辑） | `grep -rn "expired" server/src/` → 无匹配 |
| F11 | `date-fns ^4.1.0` 已在依赖中，无需新增依赖；续期只用 `addDays`（rev2），`addMonths` 仍由 `splitPlanCycles` 使用、**不得移除导入** | `package.json:59`；`features/customers/utils.ts:1-7,121` |
| F12 | 对话框编排范式：`customers-provider` 持有 `open`（对话类型）与 `currentRow`，`customers-dialogs` 按 `currentRow.id` 挂载并以 500ms 延迟清理 | `features/customers/components/customers-provider.tsx:5-11`；`customers-dialogs.tsx:16-54` |
| F13 | **`expireAt === null` 是代码上可达的状态**：新建客户表单默认 `expireAt: null`；编辑表单该字段留空时占位显示「长期有效（留空）」（日历可清除已选日期 ⇒ 也回到该状态）；列表对其显示「长期」。**但人类于 2026-10-16 裁定：不为该情形设立续期禁用规则**（视其为数据侧的"未设置"而非业务选项）⇒ 续期对这类客户**正常可用**，按「自今日起算」处理（与已过期客户同路径，§5.1），只读行显示「未设置」 | `features/customers/data/schema.ts:121,151`；`customers-action-dialog.tsx:676-690`；`customers-columns.tsx:143-148` |

**由此得出的关键结论：本功能**不需要**任何服务端改动、共享 schema 改动或依赖改动**（F3/F4/F5/F11）。
实现范围完全落在前端 `src/features/customers/` 与一个通用工具栏插槽上。

---

## 3 按钮：显示、位置与禁用条件

### 3.1 位置

紧邻现有「视图」按钮的**左侧**，同在工具栏右端。

实现方式：给通用组件 `DataTableToolbar` 增加**可选**插槽 `actions?: React.ReactNode`，
渲染在 `<DataTableViewOptions/>` **之前**：

```tsx
// src/components/data-table/toolbar.tsx（唯一改动：新增可选插槽）
<div className='flex items-center gap-2'>
  {actions}
  <DataTableViewOptions table={table} />
</div>
```

- 插槽缺省为 `undefined`，另外 5 处调用方（emails / logs / notifications / plans / subscriptions）**行为与 DOM 完全不变**。
- 最终视觉顺序：`[搜索框] [筛选] [重置] … [续期] [视图] [刷新]`。
- **不采纳**的替代方案：在 `customers-table.tsx` 中把按钮渲染在 `<DataTableToolbar/>` 之后
  （即与「刷新」按钮并列）。原因是工具栏为 `justify-between` 且自身宽度由内容决定，
  该位置与「视图」之间会出现不可控的间隙，无法保证「紧邻」这一明确要求。

### 3.2 形态：常驻显示，只切换禁用

**按钮始终渲染**，只在可用/禁用之间切换；**不**根据选中状态隐藏。

| 取舍 | 说明 |
|------|------|
| 采纳「常驻 + 禁用」 | ① 无布局跳动；② 功能可发现——禁用态本身即传达「需先选一行」；③ 与同区域常驻的「刷新」按钮形态一致 |
| 不采纳「仅选中时渲染」 | 布局抖动；未选中行的用户看不到该功能存在，与「未选中时的处理」需**明确可见**的诉求相悖 |

参数：`variant='outline' size='sm'`，图标 `CalendarPlus`（`lucide-react`，项目已用），
文本「续期」，与「视图」按钮同高（`h-8`）。

### 3.3 选中行的解析（单一事实来源）

```tsx
// customers-table.tsx —— 与 F7 的既有范式一致
const selectedRows = table.getFilteredSelectedRowModel().rows
const selectedCustomer =
  selectedRows.length === 1 ? selectedRows[0].original : null
```

> ★ **易错点（必须遵守）：** 判定「选中一行」**不得**使用
> `Object.keys(table.getState().rowSelection).length`。`rowSelection` 是**按 id 记录的字典**，
> 翻页、改筛选、刷新数据后可能残留已不在当前数据集内的 id。只有 `getFilteredSelectedRowModel()`
> 会将其过滤掉——因此「选中了 1 行但该行已不存在」必须被归类为**未选中**（见 3.4 第 3 行）。

### 3.4 禁用条件（完整矩阵）

> **禁用条件共 3 条**（下表第 1–3 行）。第 4 行是**可用**态，仅为把矩阵补全，**不是**禁用条件。

| # | 条件 | 状态 | 悬浮提示（原生 `title`） |
|---|------|------|--------------------------|
| 1 | 未选中任何行（`selectedRows.length === 0`） | **disabled** | `请先在列表中选择一行客户` |
| 2 | 选中多行（`selectedRows.length >= 2`） | **disabled** | `一次只能续期一个客户（当前已选 N 行）` |
| 3 | 恰好选中 1 个 id，但该 id 已不在当前数据集中（翻页 / 筛选 / 刷新后残留） | **disabled** | `选中的客户不在当前数据中，请重新选择` |
| — | 其余情况（恰好 1 行；**含 `expireAt === null`**） | **enabled** | `续期：<客户名>` |

> **★ rev3（2026-10-16 人类裁定）：不设「长期 / 未设置到期时间」的禁用条件。**
> 人类指令：「没有长期有效的选项 不需要」。因此 `expireAt === null` 的客户**可以**从工具栏续期，
> 其基准取 `now`（与已过期客户同一条路径，§5.1），对话框只读行显示 `未设置`。
> **同时如实登记可达性（F13）**：表单默认值就是 `null`、编辑表单留空即「长期有效（留空）」、
> 列表显示「长期」⇒ 该状态在数据中是可能出现的，本条裁定意味着这类客户会被赋予**有限**到期时间。
> 该语义变化由对话框的只读行与预览（`（自今日起算）` + 具体新到期时间）在提交前呈现（§4.5），
> 并登记为 Known Issue L8。**注意区分**：这不是「允许把长期静默改写为有限期」——
> 变更结果在提交前可见；只是不再以禁用阻断。

判定实现建议（顺序敏感，先窄后宽）：

```tsx
const renewDisabledReason =
  selectedRows.length === 0 ? '请先在列表中选择一行客户'
  : selectedRows.length > 1 ? `一次只能续期一个客户（当前已选 ${selectedRows.length} 行）`
  : !selectedCustomer ? '选中的客户不在当前数据中，请重新选择'
  : null
```

**关于提示的实现方式：** 使用**原生 `title` 属性**，不用 Radix `Tooltip`。
理由有二：① 与同区域既有「刷新」按钮的写法一致，零新增复杂度；
② **disabled 的按钮不派发指针事件**，Radix Tooltip 在其上无法弹出（需额外包一层
`<span tabIndex={0}>` 才能工作）——原生 `title` 无此问题。若后续确需富文本提示，
必须连带解决该事件问题，不得直接给 disabled 按钮套 `TooltipTrigger`。

**无障碍要求：** 禁用时按钮需带 `aria-disabled`（同时保留原生 `disabled`），
`aria-label` 动态化为 `续期：<客户名>`（可用时）或与 `title` 相同的禁用原因（不可用时），
保证键盘与读屏用户能获知不可用原因。

### 3.5 点击行为

```tsx
onClick={() => {
  if (!selectedCustomer || renewDisabledReason) return   // 双保险
  setCurrentRow(selectedCustomer)
  setOpen('renew')
}}
```

`expireAt` 的基准取**点击时刻**渲染中的该行数据（即 `selectedRows[0].original`）。

---

## 4 续期对话框：交互与确认逻辑

### 4.1 组件与打开路径

- 新增 `src/features/customers/components/customers-renew-dialog.tsx`（受控组件）。
- `customers-provider.tsx`：对话类型联合增加 `'renew'` → `'add' | 'edit' | 'delete' | 'archive' | 'renew'`。
- `customers-dialogs.tsx`：在 `currentRow` 分支内按既有范式注册
  （`key={`customer-renew-${currentRow.id}`}`，`onOpenChange` 中沿用 500ms 延迟清理 `currentRow`）。
- 用 `@/components/ui/dialog`（**不是** `ConfirmDialog` / `AlertDialog`）：本对话框需要承载
  表单型正文（单选组 + 输入框 + 实时预览），`ConfirmDialog` 只适合纯确认文案。

### 4.2 布局

```
┌─ 续期 · <客户名> ─────────────────────────────┐
│ 当前到期：2027-01-22 09:00       剩余 98 天    │
│ ────────────────────────────────────────────  │
│ 续期时长                                       │
│  (•) 1 个月 30 天    ( ) 3 个月 90 天          │
│  ( ) 6 个月 180 天   ( ) 12 个月 360 天        │
│  ( ) 自定义  [   __  ] 天                      │
│                                               │
│ 续期后到期时间：2028-01-17 09:00（+360 天）    │
│                                               │
│                        [取消]  [确认续期]      │
└───────────────────────────────────────────────┘
```

- 标题：`续期 · <客户名>`。
- 顶部只读信息行：`当前到期：<yyyy-MM-dd HH:mm>` + `剩余 N 天`（复用 `formatDateTime` / `daysLeft`）。
  到期时间为空（`expireAt === null`）时显示 `当前到期：未设置` + `无到期约束`（**不得**因该状态禁用本对话框——rev3，§3.4）。
- 单选组用 `@/components/ui/radio-group`（单选语义、键盘可达、读屏可读），
  而不是 4 个并列 `Button`（无法表达「单选」语义）。
- **★ 每个快捷项必须同时显示对应天数**（`1 个月 30 天`，天数用 `text-muted-foreground` 弱化）。
  本功能的口径是「月 = 套餐档位固定天数」而非自然月，把天数写在选项上，操作者才能在**提交前**
  自行验算——这是 §8 L5 月末漂移的唯一现实缓解手段，也是本设计的**强制项**，不得为「界面简洁」省略。
- 底部按钮：`取消`（`variant='outline'`）+ `确认续期`（默认主色，**不**用 destructive——续期不删除数据）。

### 4.3 状态模型（单一事实来源，禁止二义状态）

```ts
type RenewChoice = 'm1' | 'm3' | 'm6' | 'm12' | 'custom'

const [choice, setChoice] = useState<RenewChoice>('m1')   // 默认 1 个月
const [customDaysRaw, setCustomDaysRaw] = useState('')    // 仅存原始字符串

/** rev2：本功能只有「天」一种单位 —— 快捷项 = 档位固定天数，自定义 = 输入天数 */
const days: number | null =
  choice === 'custom' ? parseRenewDaysInput(customDaysRaw) : RENEW_PRESET_DAYS[choice]
```

**互斥规则（消除二义）：**

- 选择任一快捷项 → 立即清空 `customDaysRaw`（切回快捷项时不留残值）。
- 在输入框中键入任意字符 → **自动**把 `choice` 切为 `'custom'`。
  ⇒ 永远不可能同时存在「选中了 3 个月」与「填了 20 天」两个互相矛盾的值。
- 选择「自定义」且输入框为空/非法时，`days === null` → 确认按钮禁用（见 4.4）。

`RENEW_PRESET_DAYS` 映射：`{ m1: 30, m3: 90, m6: 180, m12: 360 }`，与 UI 文案「1 / 3 / 6 / 12 个月」
一一对应，其天数值**与套餐档位 `planTiers` 对齐并受单测锁定**（§5.2 约束 1）。
注意 12 个月 = **360** 天（档位口径），不是 365 天。

### 4.4 校验规则

手动天数输入框：`<Input type='text' inputMode='numeric' autoComplete='off' />`。

> **不用 `type='number'`：** 浏览器允许 `1e3`、`+1`、`1.5`，且不同浏览器/输入法的本地化行为
> 不一致（中文全角数字等），校验结果不可预测。用文本输入 + 显式正则更可控、更可测。

| 输入 | 结果 | 提示（输入框下方，`role='alert'` 或 `aria-describedby`） |
|------|------|----------------------------------------------------------|
| 空 | 无效 | `请输入天数` |
| `1` – `3650` 的纯数字（允许前后空格，`trim` 后判定） | 有效 | 无 |
| `0` / 负数（`-3`） | 无效 | `天数必须是 1–3650 之间的整数` |
| 小数（`1.5`） | 无效 | 同上 |
| 非数字（`abc`、`1e3`、`+1`、全角 `１２`） | 无效 | 同上 |
| `> 3650` | 无效 | `单次续期最长 3650 天（约 10 年）` |

配套纯函数（放 `features/customers/utils.ts`，便于单测）：

```ts
/** 快捷项：1/3/6/12 个月。天数值与套餐档位 `planTiers` 对齐（ADR-004 D-1），并由单测锁定（§5.2） */
export const RENEW_PRESET_DAYS = { m1: 30, m3: 90, m6: 180, m12: 360 } as const
export type RenewPresetKey = keyof typeof RENEW_PRESET_DAYS   // 'm1' | 'm3' | 'm6' | 'm12'
export type RenewChoice = RenewPresetKey | 'custom'

export const RENEW_MAX_DAYS = 3650

/** 合法 → 返回整数天数；否则返回 null（纯字符串判定，不做隐式数值转换） */
export function parseRenewDaysInput(raw: string): number | null {
  const trimmed = raw.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const days = Number(trimmed)
  return days >= 1 && days <= RENEW_MAX_DAYS ? days : null
}
```

**边界注意（`>3650` 与 `0` 的提示不同）：** 两者都为 `null`，但提示文案需区分。
实现建议：让 `parseRenewDaysInput` 只回答「是否合法」，另用一个轻量分支
（`/^\d+$/.test(t) && Number(t) > RENEW_MAX_DAYS`）决定展示哪条文案；**不要**为此把纯函数改成返回错误码，
保持「纯函数只判合法性、文案留在组件」的分离。

### 4.5 实时预览

预览区在每次状态变化时重算，格式固定为：

```
续期后到期时间：<yyyy-MM-dd HH:mm>（+N 天）
```

- 基准为**未来**到期时，额外在上方只读行提示 `自原到期时间顺延`。
- 基准为**已过期**时，只读行显示 `已过期 N 天`，并在预览行追加 `（自今日起算）`，
  使操作者能明确区分两种基准（这是本功能最容易被误解的一点，必须显式呈现）。
- **到期时间为空（`expireAt === null`）时**，只读行显示 `当前到期：未设置`，
  预览行同样追加 `（自今日起算）` —— 与已过期客户**共用同一条基准路径**（§5.1），
  不新增任何交互元素。操作者在确认前即可看到该客户将获得的具体到期时间，
  因此「无到期约束 → 有限到期」的变化是可见的（rev3；登记为 L8）。
- **增量恒以「天」表述**（`+30 天` / `+360 天`），**不做** `+1 个月` 这类措辞——
  rev2 口径下「个月」只是快捷项文案，实际执行的量是固定天数，预览必须与执行保持一致。
- `days === null`（自定义非法或为空）时，预览行显示 `—`，且确认按钮禁用。

### 4.6 确认与提交

```ts
const updateCustomer = useUpdateCustomer()   // 复用既有 hook（F4）

async function handleConfirm() {
  if (days === null || updateCustomer.isPending) return
  const nextExpireAt = computeRenewedExpireAt(currentRow.expireAt, days)
  try {
    await updateCustomer.mutateAsync({ id: currentRow.id, input: { expireAt: nextExpireAt } })
    toast.success(`已为客户「${currentRow.name}」续期 ${labelOf(choice, days)}，新到期时间 ${formatDateTime(nextExpireAt)}`)
    onOpenChange(false)
  } catch (error) {
    toast.error(getErrorMessage(error, '续期失败'))
  }
}
```

`labelOf(choice, days)`：快捷项 → `1 个月（30 天）`（档位口径，天数照实写出）；
自定义 → `45 天`。二者都**必须含天数**，理由同 §4.2 的强制项。

| 环节 | 规则 |
|------|------|
| 载荷 | **只提交 `{ expireAt }`**。不得把 `purchasedAt`、`status`、`trafficTotal` 等现有字段一并回传（那会把表单默认值误写成数据库真值——既有 `toCustomerInput` 之所以安全，是因为它来自完整表单上下文；本对话框没有该上下文） |
| 防重复提交 | `isPending` 期间：确认按钮 `disabled` + 显示 `Loader2` 旋转图标；取消按钮同时 `disabled`；对话框禁止通过 ESC / 遮罩关闭（`onOpenChange` 内 `if (isPending) return`） |
| 二次确认 | **不设**。本对话框本身即确认步骤：变更结果在提交前已完整展示（新到期时间 + 增量），且操作**可逆**（再点「编辑」即可改回）。再套一层 `ConfirmDialog` 属冗余 |
| 成功 | `toast.success`（含客户名、时长、新到期时间）→ 关闭对话框 → **保留行选中**（便于连续处理下一行）→ 列表刷新由 `useUpdateCustomer` 的 `invalidateQueries(['customers'])` 自动完成（F4），无需手工 refetch |
| 失败 | `toast.error(getErrorMessage(error, '续期失败'))`，**对话框保持打开**（不清空已选时长），以便直接重试 |
| 关闭 | 已有 500ms 延迟清理 `currentRow`，与既有 edit/archive/delete 一致；重新打开时状态重置为默认（`choice='m1'`、`customDaysRaw=''`），因组件带 `key={customer-renew-${id}}` 会被重新挂载 |

### 4.7 并发与陈旧快照（如实披露）

服务端**无乐观锁 / 版本号字段**（`customerSchema` 无 `version`），因此存在如下窗口：
A 会话打开对话框后，B 会话改动了同一客户的到期时间，A 确认时按**点击时刻的快照**计算并覆盖。

- 后果：B 的修改被覆盖（last-write-wins）。
- 缓解：无（不引入版本号属超出本任务范围的结构变更）；**登记为 Known Issue**，
  并在本文件 §8 明示。若后续需要，应另立任务引入 `updatedAt` 前置条件校验（`PATCH` 带
  `expectedUpdatedAt`，不符返 409）。**本任务不得**顺手实现校验后置条件——那是接口语义变更，
  触发 ADR 与 `api-contract.md` 更新。

---

## 5 续期时长与到期时间的计算与更新

### 5.1 计算模型

```
base        = expireAt == null ? now : max(expireAt, now)
newExpireAt = addDays(base, days)

days = 快捷项 → RENEW_PRESET_DAYS（30 / 90 / 180 / 360，与套餐档位 planTiers 对齐）
       自定义 → parseRenewDaysInput(raw)（1–3650 的整数；非法为 null ⇒ 禁止提交）
```

**逐项理由：**

| 决策 | 理由 |
|------|------|
| 未来到期 → 以**原到期时刻**为基准 | 客户已付费的剩余时间必须保留；从今天重算等于吞掉剩余天数 |
| 已过期 → 以 **`now`** 为基准 | 已过期客户没有可顺延的剩余时间；从过期日补算会让客户为「已经过去的空窗期」付费 |
| `null`（未设置到期时间）→ 以 `now` 为基准 | 与「已过期」共用同一个 `max(expireAt, now)` 表达式（`expireAt == null` 时取 `now`）⇒ 语义为「无到期约束 ⇒ 自今日起算」。**rev3 起该路径 UI 可达**（人类裁定不设禁用条件，F13），故它**不是**死代码，必须有单测（§7.1）与界面呈现（§4.5） |
| 用 `max(...)` 而非分支 | 一个表达式同时覆盖「未来顺延」与「已过期自今日」两种语义，无第三分支 |
| **只有 `addDays` 一种推进方式（rev2）** | 人类裁定「与档位统一」：套餐档位周期本就是固定天数（F9），`computeExpireAt` 亦用 `addDays` ⇒ 全系统只有一种「月」的定义，算法收敛为单一路径，无单位分支、无月末 clamp 分支。代价见 §8 L5 与 ADR-004 |
| 保留基准的时分秒 | `addDays` 保留时间部分，因此未来到期客户续期后到期**时刻**不变（如始终 09:00），与既有 `formatDateTime` 展示一致 |

### 5.2 纯函数签名（放 `src/features/customers/utils.ts`）

```ts
/**
 * 计算续期后的到期时间（epoch ms）。
 *
 * 基准 = max(expireAt, now)；expireAt 为 null 时取 now（UI 不可达，防御性兜底）。
 * 统一按**天数**推进（addDays），保留基准的时分秒。
 *
 * @param days 续期天数：快捷项取 RENEW_PRESET_DAYS，自定义取 parseRenewDaysInput 的结果（1..3650）
 * @param now  便于测试注入固定时刻，默认 Date.now()
 */
export function computeRenewedExpireAt(
  expireAt: number | null | undefined,
  days: number,
  now: number = Date.now()
): number {
  const base = expireAt == null ? now : Math.max(expireAt, now)
  return addDays(base, days).getTime()
}
```

选择「纯函数 + 可注入 `now`」的理由：① 逻辑可被 `utils.test.ts` 直接锁定（含月末漂移、过期基准、
`null` 兜底等边界），不依赖浏览器时钟；② 组件只负责取值与展示，业务算法单点可测。

**约束 1（快捷项与套餐档位对齐）——必须由单测守住：**

```ts
// utils.test.ts —— 档位若变更，此测试失败 ⇒ 强制一次显式决策，而非静默漂移
const tierDays = (tier: PlanTier) => planTiers.find((t) => t.value === tier)?.days
it('快捷项天数与套餐档位对齐', () => {
  expect(RENEW_PRESET_DAYS).toEqual({
    m1: tierDays('monthly'),      // 30
    m3: tierDays('quarterly'),    // 90
    m6: tierDays('semiannual'),   // 180
    m12: tierDays('yearly'),      // 360
  })
  expect(RENEW_PRESET_DAYS).toEqual({ m1: 30, m3: 90, m6: 180, m12: 360 })  // 字面量锁定当前契约
})
```

> **为何用「字面量 + 对齐单测」而不是直接 `RENEW_PRESET_DAYS = { m1: planTiers[0].days, … }`：**
> 直接派生会让档位调整**静默**改变续期语义；索引式派生还有「档位重排后静默错配」的风险。
> 字面量 + 对齐单测既保证可读性，又把档位变更转化为一次**阻断 CI 的显式决策**，
> 与 ADR-004 D-1 的裁定链路（人类裁定 → 文档 → 代码）一致。

### 5.3 边界情形（必须由单测覆盖）

| 情形 | 输入（`expireAt` / `days`） | 期望 `newExpireAt` |
|------|---------------------------|-------------------|
| 未来到期 · 1 个月 | `2027-01-22 09:00`，30 天 | `2027-02-21 09:00`（**时刻不变**） |
| 未来到期 · 3 个月 | 同上，90 天 | `2027-04-22 09:00` |
| 未来到期 · 12 个月 | 同上，360 天 | `2028-01-17 09:00`（**比自然年短 5 天，刻意**） |
| 未来到期 · 自定义 | 同上，365 天 | `2028-01-22 09:00`（自定义天数可精确到自然年） |
| 已过期（`expireAt < now`） | `2025-05-20 09:00`，`now = 2026-10-16 09:00`，30 天 | `2026-11-15 09:00` = `now + 30 天`（**不补回**已过去的空窗期） |
| 已过期 · 极值 | 同上，3650 天 | `now + 3650 天`，不溢出 |
| `null`（未设置到期时间） | `null`，30 天 | `now + 30 天`（**rev3 起为可达路径**，与已过期客户同基准；界面呈现见 §4.5） |
| **月末漂移（刻意，rev2）** | `2026-01-31 09:00`，30 天 | **`2026-03-02 09:00`** —— 自然月口径会是 `2026-02-28`；**不得改回 `addMonths`** |
| **月末漂移（刻意，rev2）** | `2026-08-31 09:00`，180 天 | **`2027-02-27 09:00`** —— 同上，刻意 |
| 闰年基准（按天数推进） | `2024-02-29 09:00`，360 天 | `2025-02-23 09:00`（**不是** `2025-02-28`） |
| 跨年 12 个月 | `2026-10-16 09:00`，360 天 | `2027-10-11 09:00` |
| 极值 | 任意基准，3650 天 | `addDays(base, 3650)`，不溢出（仍 < `Number.MAX_SAFE_INTEGER`） |

> **★ 审查与实施纪律（本节最易被误判的一点）：** 上表中**标注「刻意」的全部行**（2 行月末漂移、
> 1 行闰年基准、1 行 12 个月 = 360 天）都是
> **人类裁定口径（与套餐档位统一为固定天数）的直接后果，属刻意行为**。
> 任何把这些结果当作缺陷、把 `addDays` 改回 `addMonths` 的改动，都是**越界**——
> 属于 ADR-004 方案 A 的重议范围，不是缺陷修复。用例名须体现「刻意 / tier-aligned」字样，
> 以免后续读者按「正确性」直觉把它删掉。

**时区：** 全部使用 `date-fns` 的**本地时区**语义，与既有 `formatDateTime` / `daysLeft` /
`splitPlanCycles` 一致。不引入 UTC 口径，避免同一列表内两种时间语义并存。
（`addDays` 按本地日历日推进，保留墙上时刻；跨夏令时会使绝对时刻平移 ±1 小时，本项目无夏令时区，不构成实际影响。）

### 5.4 更新方式（写入路径）

```
对话框确认
  └─ useUpdateCustomer().mutateAsync({ id, input: { expireAt: <epoch ms> } })   // F4
       └─ PATCH /api/customers/:id   body: { "expireAt": 1799999999999 }        // F3
            ├─ customerInputSchema.partial() 校验（expireAt: z.number().int().nullable().optional()）
            ├─ dateKeys 将 number → Date 写入 SQLite
            ├─ writeLog('info','客户','更新客户 #id')                            // F5
            └─ 返回序列化后的 Customer（Date → epoch ms）
       └─ onSuccess → invalidateQueries(['customers']) → 列表与筛选行自动刷新    // F4
```

**本次写入刻意不动的字段及其理由：**

| 字段 | 是否改动 | 理由 |
|------|---------|------|
| `expireAt` | ✅ 唯一改动项 | 续期的定义 |
| `purchasedAt` | ❌ 不改 | 它是套餐周期的**锚点**（`splitPlanCycles` 以它为起点按月推进）。改动它会让历史周期整体重排；不改则仅表现为「周期列表多出若干周期」——这正是续期的正确呈现。**副作用披露**：客户详情面板（行展开）的套餐周期列表会因到期推后而新增周期，属预期行为 |
| `status` | ❌ 不改 | 服务端不存在 `status` 与 `expireAt` 的联动（F10）。若某客户状态被人工置为「已过期」，续期后**不会**自动回到「启用」——需操作者另行编辑。登记为 Known Issue |
| `trafficUsed` / `trafficTotal` / `trafficManualCap` | ❌ 不改 | 与续期无关；**尤其不得**像 `toCustomerInput` 那样回填整表单（见 §4.6 载荷规则） |
| 订阅相关字段 | ❌ 不改 | 续期不触发订阅同步；`afterWrite` 钩子仅订阅资源注册了调度器重载（`server/src/routes/resources.ts:123-129`），客户资源无此钩子 |

**审计：** 沿用 CRUD 的通用日志（F5），日志模块可查「更新客户 #id」。不新建专用审计表——
若需要「续期记录（原到期 → 新到期 → 操作者）」的独立流水，属独立需求，须另立任务。

### 5.5 变更边界声明

| 层 | 是否改动 |
|----|---------|
| 服务端 `server/**` | **不改**（接口已具备所需能力，F3） |
| 共享层 `shared/src/**` | **不改**（`expireAt` 已在 `customerInputSchema` 内，F1） |
| 依赖 `package.json` | **不改**（`date-fns` 已在，F11） |
| 路由 `src/routes/**` / `routeTree.gen.ts` | **不改**（不新增页面） |
| `src/components/ui/**` | **不改**（`dialog` / `radio-group` / `input` / `label` 均已存在） |

---

## 6 文件清单（实施范围）

**新增：**

| 文件 | 说明 |
|------|------|
| `src/features/customers/components/customers-renew-dialog.tsx` | 续期对话框（§4 全部交互） |
| `src/features/customers/components/customers-renew-dialog.test.tsx` | 对话框交互与校验测试 |
| `src/features/customers/components/customers-renew-button.test.tsx` | 禁用矩阵 + 打开路径测试 |

**修改：**

| 文件 | 变更 |
|------|------|
| `src/features/customers/utils.ts` | 新增 `RENEW_PRESET_DAYS` / `RenewPresetKey` / `RenewChoice` / `RENEW_MAX_DAYS` / `parseRenewDaysInput` / `computeRenewedExpireAt` |
| `src/features/customers/utils.test.ts` | 增补纯函数用例（§5.3 全表 + `parseRenewDaysInput` 全表） |
| `src/features/customers/components/customers-table.tsx` | 派生 `selectedRows` / `selectedCustomer` / `renewDisabledReason`；向 `DataTableToolbar` 传 `actions` 插槽 |
| `src/components/data-table/toolbar.tsx` | 新增可选 `actions` 插槽（缺省行为不变） |
| `src/features/customers/components/customers-provider.tsx` | 对话类型联合加 `'renew'` |
| `src/features/customers/components/customers-dialogs.tsx` | 注册 `CustomersRenewDialog` |
| `docs/technical/customer-renewal.md` | 本文（实施完成后补「已实现」状态与提交锚点） |
| `docs/decisions/ADR-004-renewal-duration-semantics.md` | 已由人类裁定 D-1 / D-2 / D-3 三项并按 rev2 / rev3 改写，`Status` 为 **`Accepted`** |

**明确不改：** `src/features/customers/api.ts`（`useUpdateCustomer` 已足够）、
`src/features/customers/data/schema.ts`（不新增 zod 表单 schema——本对话框用局部状态而非
`react-hook-form`，理由见 §7 末）、`src/components/ui/**`、`server/**`、`shared/**`。

---

## 7 测试要求

沿用项目既有的浏览器模式测试写法（参照 `customers-table.test.tsx`：
`vi.hoisted` + `vi.mock('../api')` + `await render(...)`；需要精确匹配的文本用 `{ exact: true }`）。

### 7.1 纯函数（`utils.test.ts`）

- `parseRenewDaysInput`：`''` / `'abc'` / `'1e3'` / `'+1'` / `'1.5'` / `'-3'` / `'0'` / `'1 '` / `'3650'` / `'3651'` / 全角 `'１２'`。
- `computeRenewedExpireAt`：§5.3 全表（**必须**含表中标注「刻意」的全部 4 行、已过期基准、
  `null`（未设置）基准），
  且每个用例都注入固定 `now`，断言**不依赖运行时刻**。
- `RENEW_PRESET_DAYS` 与 `planTiers` 的对齐断言（§5.2 约束 1）。

> 措辞要求：锁定刻意漂移的用例名须含「刻意」或「tier-aligned」，避免后续被按「正确性」直觉删改。

### 7.2 对话框（`customers-renew-dialog.test.tsx`，mock `../api` 的 `useUpdateCustomer`）

| 用例 | 断言 |
|------|------|
| 默认状态 | 「1 个月」被选中（且显示 `30 天`）；预览 = 原到期 + 30 天；确认按钮可用 |
| 切换快捷项 | 选「6 个月」→ 预览变为 +180 天对应时刻 |
| 快捷项按档位天数换算 | 选「12 个月」→ `mutateAsync` 收到 `expireAt = addDays(base, 360)`（**非 365**，rev2 口径） |
| 输入天数自动切换 | 在输入框键入 `45` → 快捷项全部取消选中；`mutateAsync` 收到 `expireAt = addDays(base, 45)` |
| 非法输入 | `0` / `abc` / `3651` → 确认按钮 disabled + 对应提示文案可见 |
| 已过期客户 | 只读行显示 `已过期 N 天`，预览含 `（自今日起算）` |
| 未设置到期时间（`expireAt: null`） | 只读行显示 `未设置`，预览含 `（自今日起算）`，确认按钮**可用**（rev3：不得禁用）；`mutateAsync` 收到 `expireAt = addDays(now, days)` |
| 提交成功 | `mutateAsync` 参数为 `{ id, input: { expireAt } }`（**仅** expireAt 一个键）；`toast.success` 被调用；对话框关闭 |
| 提交失败 | `mutateAsync` reject → `toast.error` 被调用；对话框**仍打开** |
| 提交中 | `isPending: true` → 确认与取消均 disabled，重复点击不产生第二次 `mutateAsync` |

### 7.3 按钮（`customers-renew-button.test.tsx`）

| 用例 | 断言 |
|------|------|
| 未选中 | 续期按钮 `disabled`，提示为「请先在列表中选择一行客户」 |
| 勾选一行 | 转为可用 |
| 勾选两行 | 复为 `disabled`，提示含「2 行」 |
| 选中未设置到期时间的客户（`expireAt: null`） | **可用**（rev3：不再禁用）；点击后对话框打开且只读行显示 `未设置` |
| 点击 | `role='dialog'` 出现，标题含客户名 |

> **测试数据：** 沿用 `makeCustomer` 工厂（`customers-table.test.tsx` 已定义），
> 至少构造「未来到期」「已过期」「未设置（`expireAt: null`）」三类客户。

> **为何不用 `react-hook-form` + zod schema：** 本对话框只有两个字段且二者互斥（§4.3），
> 用局部 `useState` 表达「单一事实来源」比引入 RHF 的 `register`/`watch` 更直观、更好测；
> 同时可规避项目既有陷阱——`FormLabel` **必须**包在 `FormControl` 内（TASK-018）。
> 若采用 `<Label htmlFor>` + `<Input id>` 的直接关联，则不受该约束影响。
> **禁止**为了「统一风格」而把简单局部状态改写成 RHF 表单。

---

## 8 已知限制（刻意不做，需在 TASK-040 的 Known Issues 中同步登记）

| # | 限制 | 影响 | 处置 |
|---|------|------|------|
| L1 | 无乐观锁/版本号，last-write-wins（§4.7） | 并发编辑可能互相覆盖 | 披露；需前置条件校验时另立任务（接口语义变更） |
| L2 | 不自动把 `status` 从「已过期」改回「启用」（F10） | 操作者需手动改状态 | 对话框不暗示会自动修正；登记 Known Issue |
| L3 | 不支持批量续期（选中多行时按钮禁用） | 运营效率 | 批量续期是独立需求（需定义「各客户时长相同还是按各自基准」），另立任务 |
| L4 | 不支持缩短到期时间（负数） | 需用「编辑」 | 明确 Non-Scope：负面语义应走编辑表单 |
| L5 | **与套餐档位统一为固定天数后，月末/闰年出现日历漂移（rev2，刻意）**：`2026-01-31` 续 1 个月 = `2026-03-02`（非 `02-28`）；`2026-08-31` 续 6 个月 = `2027-02-27`；12 个月 = 360 天比自然年短 5 天 | 「续 1 个月」在月末客户眼中不是整月；跨闰年也会少几天 | **人类裁定口径的固有代价，接受并披露。** 缓解：① 每个快捷项直接显示天数（`1 个月 30 天`）+ 预览用 `+N 天`；② 需精确到某日时用自定义天数（如 365）或「编辑」。**★ 这不是缺陷：不得改回 `addMonths`**（属 ADR-004 方案 A 重议范围）。三处防线：本行 + TASK-040 Notes + ADR-004 负面第 1/2 条 |
| L6 | 无续期专用审计流水 | 只能看到通用「更新客户 #id」日志 | 需独立流水时另立任务 |
| L7 | 续期不触发订阅同步 | 订阅侧到期时间不变 | 订阅到期由同步引擎维护（`subscriptionExpireAt`），与客户到期是两套字段，本就无联动 |
| L8 | **未设置到期时间（`expireAt === null`）的客户续期后由「无到期约束」变为有限到期（rev3）** —— 人类裁定不为其设禁用条件（F13/§3.4），故该语义变化是允许的；且该状态**可达**（新建客户表单默认 `null`、编辑表单留空即「长期有效（留空）」，列表显示「长期」） | 若数据中确有此类客户，一次续期即把「长期」改写成具体到期日；事后需靠日志与人工记忆回溯 | 已披露并**在提交前呈现**：对话框只读行显示 `未设置`、预览追加 `（自今日起算）` 并给出具体新到期时间（§4.5）⇒ 变更结果可见，不是静默改写。**★ 不得**为「修正」此行为而恢复禁用条件或对 `null` 抛出——那与人类裁定相悖。若业务后续要求区分「真正的长期客户」，须另立任务（含数据侧如何表达） |

---

## 9 决策索引

| 编号 | 决定 | 依据 | 被否替代方案 |
|------|------|------|-------------|
| D1 | 按钮常驻显示、只切换禁用 | §3.2 | 仅选中时渲染（布局抖动、不可发现） |
| D2 | 位置在「视图」左侧，经 `DataTableToolbar` 可选插槽实现 | §3.1（F8） | 渲染在工具栏之后（无法保证紧邻） |
| D3 | 「选中一行」以 `getFilteredSelectedRowModel()` 判定，不用 `rowSelection` 字典长度 | §3.3（F6/F7） | 读 `rowSelection` 长度（翻页后残留 id 会误判） |
| D4 | 禁用提示用原生 `title`，不用 Radix `Tooltip` | §3.4（disabled 元素不派发指针事件） | `TooltipTrigger` 直套 disabled 按钮（提示永不弹出） |
| D5 | **不设**「未设置到期时间（`expireAt === null`）」的禁用条件；这类客户按 `now` 起算正常续期，只读行显示 `未设置` | §3.4 / F13 / ADR-004 D-3（人类裁定 rev3） | 原设计「禁用 + 引导走编辑」（人类裁定不需要，ADR-004 方案 E 记录被否理由） |
| D5b | 只读行与预览**必须**呈现基准（`未设置` / `已过期 N 天` / `自原到期时间顺延`）与具体新到期时间 | §4.5 / L8 | 不加提示（会让 L8 的语义变化变为静默改写） |
| D6 | 快捷项「N 个月」= 套餐档位固定天数（30/90/180/360），自定义 = 天数；**内部只有「天」一种单位** | ADR-004 D-1（人类裁定）；§5.1 | 自然月 `addMonths`（本轮被人类否决：与档位并存两种「月」） |
| D6b | 快捷项天数用字面量声明 + 单测对齐 `planTiers`；UI 强制显示天数 | §5.2 约束 1 与 §4.2 强制项 | 直接派生（档位变更时静默改变续期语义）／索引式派生（重排后静默错配） |
| D7 | 基准 = `max(expireAt, now)`；`null` 兜底 `now` | §5.1 | 一律自今日重算（吞掉已付剩余天数） |
| D8 | 对话框即确认，不叠加二次确认弹窗 | §4.6 | 再套 `ConfirmDialog`（冗余，结果已在提交前展示） |
| D9 | 只提交 `{ expireAt }` 单一字段 | §4.6 / §5.4 | 回传整表单（会把默认值误写成真值） |
| D10 | 手动天数上限 3650 天、纯文本输入 + 正则校验 | §4.4 | `type='number'`（允许 `1e3`/`+1`/小数，行为不可控） |
| D11 | 不引入后端接口、共享 schema、依赖改动 | §2 结论（F3/F4/F5/F11） | 新增 `POST /customers/:id/renew` 专用端点（重复既有能力） |

ADR-004 覆盖 D5（含 D5b）/D6（含 D6b）/D7 三项**业务语义**级决策（含代价与替代方案论证）。

---

## 10 与 TASK-040 验收标准的对应

| 验收标准 | 对应章节 |
|---------|---------|
| 按钮位置与形态、禁用矩阵 | §3.1–§3.4 |
| 对话框交互、校验、预览、确认/失败路径 | §4 |
| 时长与到期时间计算、写入路径、副作用 | §5 |
| 测试覆盖 | §7 |
| 范围与非范围 | §6 / §8 |
