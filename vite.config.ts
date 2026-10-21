/// <reference types="vitest/config" />
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { playwright } from '@vitest/browser-playwright'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './shared/src'),
    },
  },
  server: {
    // 开发态：Vite(:5173) 将 /api 转发到后端(:3000)，避免跨域与端口拼接
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
    // 监视器排除 tasks/：chokidar 持有子目录句柄时，Windows 上 git mv/mv
    // 移动「含子目录的目录」会被 MoveFile 拒绝（Permission denied）。
    // tasks/ 为任务文档目录，无需 HMR；node_modules/.git/dist 为显式保留的默认忽略项。
    watch: {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/tasks/**',
      ],
    },
  },
  test: {
    silent: 'passed-only',
    unstubEnvs: true,
    // 显式恢复 Vitest **文档声称**的默认排除项（TASK-047 F-2）。
    //
    // 根因（实测，非推断）：Vitest 4.1.4 的**运行时**默认 exclude 只有
    //   ["**/node_modules/**", "**/.git/**"]
    // （node_modules/vitest/dist/chunks/defaults.*.js），而其类型声明里的 JSDoc
    // 仍写着含 `**/dist/**` 在内的长列表 —— **文档声称有排除，运行时并没有**。
    // 于是 shared/tsconfig.json 把 `*.test.ts` 一并编译进 `shared/dist/` 后，
    // vitest 连编译产物里的测试一起收集，同一组用例执行两遍。
    // 实证（CI run 39537943459，install-lint-build 的 Run tests 步骤）：
    //   ✓ chromium  shared/dist/schema/traffic.test.js (17 tests)
    //   ✓ chromium  shared/src/schema/traffic.test.ts  (17 tests)
    //   Test Files 27 passed (27) / Tests 342 passed (342)
    // 27 个文件里有一个是编译产物；342 = 真实用例 + 17 次重复执行。
    // 计数随 shared/dist 的新鲜度漂移，不可作为验收判据。
    //
    // 注意：`exclude` 是**整体替换**默认值（不是追加），故必须显式保留
    // node_modules 与 .git 两项，否则 vitest 会去收集 node_modules 内的测试。
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
    ],
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
    coverage: {
      // include: ['src/**/*.{js,jsx,ts,tsx}'], // Uncomment to expand the report to all src/**/* so untested modules appear as 0% coverage.
      exclude: [
        'src/components/ui/**',
        'src/assets/**',
        'src/tanstack-table.d.ts',
        'src/routeTree.gen.ts',
        'src/test-utils/**',
        'src/routes/**',
      ],
    },
  },
})
