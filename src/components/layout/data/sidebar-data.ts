import {
  LayoutDashboard,
  Bug,
  FileX,
  HelpCircle,
  Lock,
  Bell,
  Package,
  Palette,
  ServerOff,
  Settings,
  Wrench,
  UserCog,
  UserX,
  Users,
  Mail,
  ScrollText,
  Radio,
  Construction,
} from 'lucide-react'
import { type SidebarData } from '../types'

/**
 * 侧边栏导航（业务化改造后）。
 * 已移除：Tasks / Apps / Chats / Users（原演示模块）与 Clerk 相关入口。
 */
export const sidebarData: SidebarData = {
  user: {
    name: '管理员',
    email: 'admin@example.com',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [
    {
      name: '订阅管理系统',
      logo: Radio,
      plan: '自托管版',
    },
  ],
  navGroups: [
    {
      title: '概览',
      items: [
        {
          title: '仪表盘',
          url: '/',
          icon: LayoutDashboard,
        },
      ],
    },
    {
      title: '业务管理',
      items: [
        {
          title: '客户管理',
          url: '/customers',
          icon: Users,
        },
        {
          title: '订阅管理',
          url: '/subscriptions',
          icon: Radio,
        },
        {
          title: '套餐管理',
          url: '/plans',
          icon: Package,
        },
        {
          title: '邮箱管理',
          url: '/emails',
          icon: Mail,
        },
      ],
    },
    {
      title: '系统',
      items: [
        {
          title: '日志',
          url: '/logs',
          icon: ScrollText,
        },
        {
          title: '通知设置',
          url: '/settings/notifications',
          icon: Bell,
        },
        {
          title: '设置',
          icon: Settings,
          items: [
            {
              title: '资料',
              url: '/settings',
              icon: UserCog,
            },
            {
              title: '账户',
              url: '/settings/account',
              icon: Wrench,
            },
            {
              title: '外观',
              url: '/settings/appearance',
              icon: Palette,
            },
            {
              title: '显示',
              url: '/settings/display',
              icon: LayoutDashboard,
            },
          ],
        },
      ],
    },
    {
      title: '其他',
      items: [
        {
          title: '错误示例',
          icon: Bug,
          items: [
            { title: '401 未授权', url: '/errors/unauthorized', icon: Lock },
            { title: '403 禁止访问', url: '/errors/forbidden', icon: UserX },
            { title: '404 未找到', url: '/errors/not-found', icon: FileX },
            { title: '500 服务错误', url: '/errors/internal-server-error', icon: ServerOff },
            { title: '维护中', url: '/errors/maintenance-error', icon: Construction },
          ],
        },
        {
          title: '帮助中心',
          url: '/help-center',
          icon: HelpCircle,
        },
      ],
    },
  ],
}
