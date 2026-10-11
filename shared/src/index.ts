/**
 * 前后端共享层。
 *
 * 后端以 `@repo/shared` 包形式引入（编译产物 dist/）；
 * 前端通过 tsconfig paths 与 Vite alias `@shared` 引入（源码）。
 * 两侧共用同一份 zod schema，接口变更在编译期即可发现。
 */
export * from './schema/common.js'
export * from './schema/enums.js'
export * from './schema/entities.js'
export * from './schema/notifications.js'
export * from './schema/traffic.js'
