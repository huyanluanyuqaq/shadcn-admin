import { Hono } from 'hono'
import {
  categoryInputSchema,
  customerInputSchema,
  emailAccountInputSchema,
  emailProviderInputSchema,
  planInputSchema,
  poolInputSchema,
  subscriptionInputSchema,
} from '@repo/shared'
import {
  categories,
  customers,
  emailAccounts,
  emailProviders,
  plans,
  subscriptionPool,
  subscriptions,
} from '../db/schema.js'
import { createCrudRoutes } from '../lib/crud.js'

/**
 * 7 个资源的 CRUD 路由。
 * 每个资源自动获得：分页列表 / 单条 / 创建 / 更新 / 删除 / 批量删除。
 * 契约见 docs/technical/api-contract.md。
 */
export const resourceRoutes = new Hono()

resourceRoutes.route(
  '/categories',
  createCrudRoutes({
    table: categories,
    input: categoryInputSchema,
    name: '分类',
    searchCols: [categories.name, categories.description],
    sortCols: { createdAt: categories.createdAt, id: categories.id, name: categories.name },
  }),
)

resourceRoutes.route(
  '/plans',
  createCrudRoutes({
    table: plans,
    input: planInputSchema,
    name: '套餐',
    searchCols: [plans.name, plans.description],
    filterCols: { status: plans.status },
    sortCols: { createdAt: plans.createdAt, id: plans.id, price: plans.price, name: plans.name },
  }),
)

resourceRoutes.route(
  '/customers',
  createCrudRoutes({
    table: customers,
    input: customerInputSchema,
    name: '客户',
    searchCols: [customers.name, customers.email, customers.remark],
    filterCols: { status: customers.status, categoryId: customers.categoryId, planId: customers.planId },
    sortCols: {
      createdAt: customers.createdAt,
      id: customers.id,
      name: customers.name,
      expireAt: customers.expireAt,
    },
    dateKeys: ['expireAt'],
  }),
)

resourceRoutes.route(
  '/subscriptions',
  createCrudRoutes({
    table: subscriptions,
    input: subscriptionInputSchema,
    name: '订阅',
    searchCols: [subscriptions.name, subscriptions.url],
    filterCols: {
      customerId: subscriptions.customerId,
      poolId: subscriptions.poolId,
      syncStatus: subscriptions.syncStatus,
      enabled: subscriptions.enabled,
    },
    sortCols: {
      createdAt: subscriptions.createdAt,
      id: subscriptions.id,
      expireAt: subscriptions.expireAt,
      lastRunAt: subscriptions.lastRunAt,
    },
    dateKeys: ['expireAt'],
  }),
)

resourceRoutes.route(
  '/subscription-pools',
  createCrudRoutes({
    table: subscriptionPool,
    input: poolInputSchema,
    name: '订阅池',
    searchCols: [subscriptionPool.name, subscriptionPool.url, subscriptionPool.remark],
    sortCols: { createdAt: subscriptionPool.createdAt, id: subscriptionPool.id, name: subscriptionPool.name },
  }),
)

resourceRoutes.route(
  '/email-providers',
  createCrudRoutes({
    table: emailProviders,
    input: emailProviderInputSchema,
    name: '邮箱提供商',
    searchCols: [emailProviders.name, emailProviders.domain],
    sortCols: { createdAt: emailProviders.createdAt, id: emailProviders.id, name: emailProviders.name },
  }),
)

resourceRoutes.route(
  '/emails',
  createCrudRoutes({
    table: emailAccounts,
    input: emailAccountInputSchema,
    name: '邮箱账号',
    searchCols: [emailAccounts.email, emailAccounts.remark],
    filterCols: {
      providerId: emailAccounts.providerId,
      customerId: emailAccounts.customerId,
      status: emailAccounts.status,
    },
    sortCols: { createdAt: emailAccounts.createdAt, id: emailAccounts.id, email: emailAccounts.email },
  }),
)
