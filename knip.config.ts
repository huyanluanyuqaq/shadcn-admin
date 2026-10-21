import type { KnipConfig } from 'knip'

/**
 * knip 白名单（TASK-047 纳入 CI，策略 = 白名单接入；AC-14）。
 *
 * 原则（见 TASK-047 Requirement 6）：本清单只收「已逐条评估后决定保留」的积压，
 * **新增积压仍会红**；定期清理由后续任务承接，禁止把新问题捂进本清单。
 * 每条 ignore 均带理由；调整本文件须在 TASK 档案中说明。
 */
const config: KnipConfig = {
  // 整目录忽略：shadcn/ui 原语按项目规则只经 shadcn CLI 增删（AGENTS.md §10），
  // 库存未用组件属于「组件库备用件」，不视为债务。
  ignore: [
    'src/components/ui/**',
    'src/components/layout/app-title.tsx', // 基座遗留徽标组件，备用
    'src/tanstack-table.d.ts', // 类型声明文件，运行时无导入方
  ],

  // shadcn 托管组件 src/components/ui/tabs.tsx / input-otp.tsx 的依赖。
  // 组件本身按规则保留，删除依赖会使其失去类型来源 → 必须保留。
  ignoreDependencies: ['@radix-ui/react-tabs', 'input-otp'],

  // 未使用文件（仅 files 一类，不影响其它问题报告）
  ignoreFiles: [
    // 品牌图标库（19 个 icon + index）：备用资产库，社交/渠道场景可直接取用，
    // 删除后将来重建成本高于持有成本 → 保留
    'src/assets/brand-icons/**',
    'src/components/learn-more.tsx', // 上游遗留的静态说明组件
    'src/components/layout/top-nav.tsx', // 上游遗留的顶部导航布局
    'src/test-utils/tanstack-table.ts', // 表格测试工具，测试场景备用
  ],

  // 未使用导出 / 导出类型（逐文件白名单；三类理由，见上方分组注释）：
  // A) features 的 api/queries 层刻意导出完整 CRUD 操作面（keys、查询参数、
  //    列映射），供后续任务直接复用而非重写 —— 导出面 > 当前使用面；
  // B) server 各模块导出保留给测试、smoke 脚本与运维侧复用；
  // C) 上游遗留 UI 组件的工具导出，组件保留则导出随同保留。
  ignoreIssues: {
    // A · 前端 CRUD 操作面
    'src/features/*/api.ts': ['exports', 'types'],
    'src/features/*/queries.ts': ['exports', 'types'],
    'src/features/customers/data/schema.ts': ['types'], // 表单类型随 schema 导出面保留
    'src/features/*/components/*-columns.tsx': ['types'], // 列定义与列映射配套导出

    // B · 前端工具 / server 模块
    'src/lib/utils.ts': ['exports'], // 通用工具（sleep 等，脚本场景用）
    'src/lib/api.ts': ['exports'], // ApiError / toQuery（错误处理与查询序列化通用件）
    'src/features/*/utils.ts': ['exports', 'types'],
    'server/src/env.ts': ['exports'], // isProduction 供部署诊断
    'server/src/middleware/auth.ts': ['exports'], // TOKEN_TTL_SECONDS 与 auth 配套
    'server/src/services/scheduler.ts': ['exports'], // stop* 作业句柄（运维/测试用）
    'server/src/services/telegram.ts': ['exports'], // 配置加载与消息构造（脚本用）
    'server/src/services/feishu.ts': ['exports'], // 同上（飞书渠道）
    'server/src/services/backup.ts': ['exports', 'types'],
    'server/src/services/logger.ts': ['types'], // LogLevel 声明面
    'server/src/services/subscription-errors.ts': ['types'], // 错误构造入参类型（诊断用）
    'server/src/services/subscription-parser.ts': ['types'], // 解析器类型面
    'server/src/db/index.ts': ['exports'], // schema 导出（迁移工具场景）
    'server/src/lib/crud.ts': ['exports', 'types'], // CRUD 工厂的通用导出面
  },
}

export default config
