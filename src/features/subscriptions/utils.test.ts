import { describe, expect, it } from 'vitest'
import {
  defaultPoolSort,
  nextPoolSort,
  poolSortLabel,
  type PoolSort,
} from './utils'

describe('nextPoolSort', () => {
  it('默认状态为自定义排序升序', () => {
    expect(defaultPoolSort).toEqual({ sortBy: 'sortOrder', sortOrder: 'asc' })
  })

  it('点击未激活列头进入升序', () => {
    expect(nextPoolSort(defaultPoolSort, 'name')).toEqual({
      sortBy: 'name',
      sortOrder: 'asc',
    })
  })

  it('再次点击同一列头切换为降序', () => {
    const asc: PoolSort = { sortBy: 'name', sortOrder: 'asc' }
    expect(nextPoolSort(asc, 'name')).toEqual({
      sortBy: 'name',
      sortOrder: 'desc',
    })
  })

  it('第三次点击同一列头回到自定义排序（恢复可拖拽）', () => {
    const desc: PoolSort = { sortBy: 'name', sortOrder: 'desc' }
    expect(nextPoolSort(desc, 'name')).toEqual(defaultPoolSort)
  })

  it('切换列头时从升序重新开始，不受原列状态影响', () => {
    const nameDesc: PoolSort = { sortBy: 'name', sortOrder: 'desc' }
    expect(nextPoolSort(nameDesc, 'createdAt')).toEqual({
      sortBy: 'createdAt',
      sortOrder: 'asc',
    })
  })

  it('自定义排序下点 sortOrder 列头同样走 升→降→自定义 循环', () => {
    const custom: PoolSort = { sortBy: 'sortOrder', sortOrder: 'asc' }
    expect(nextPoolSort(custom, 'sortOrder')).toEqual({
      sortBy: 'sortOrder',
      sortOrder: 'desc',
    })
  })
})

describe('poolSortLabel', () => {
  it('各排序字段返回中文列名', () => {
    expect(poolSortLabel({ sortBy: 'sortOrder', sortOrder: 'asc' })).toBe(
      '自定义排序'
    )
    expect(poolSortLabel({ sortBy: 'name', sortOrder: 'asc' })).toBe('名称')
    expect(poolSortLabel({ sortBy: 'createdAt', sortOrder: 'asc' })).toBe(
      '创建时间'
    )
    expect(poolSortLabel({ sortBy: 'id', sortOrder: 'asc' })).toBe('ID')
  })
})
