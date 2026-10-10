import { Hono } from 'hono'
import {
  categoryInputSchema,
  customerInputSchema,
  emailBindingInputSchema,
  planInputSchema,
  poolInputSchema,
  subscriptionInputSchema,
} from '@repo/shared'
import {
  categories,
  customers,
  emailBindings,
  plans,
  subscriptionPool,
  subscriptions,
} from '../db/schema.js'
import { createCrudRoutes } from '../lib/crud.js'

/**
 * 6 个资源的 CRUD 路由。
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
  '/email-bindings',
  createCrudRoutes({
    table: emailBindings,
    input: emailBindingInputSchema,
    name: '邮箱绑定',
    searchCols: [emailBindings.email, emailBindings.remark],
    filterCols: {
      subscriptionId: emailBindings.subscriptionId,
      status: emailBindings.status,
    },
    sortCols: {
      createdAt: emailBindings.createdAt,
      id: emailBindings.id,
      email: emailBindings.email,
      status: emailBindings.status,
    },
    uniqueHint: '该邮箱已存在，每个邮箱只能绑定一条订阅，请直接编辑已有绑定',
  }),
)
