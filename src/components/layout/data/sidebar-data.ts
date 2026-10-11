import {
  LayoutDashboard,
  Bug,
  FileX,
  HelpCircle,
  Lock,
  Package,
  ServerOff,
  UserX,
  Users,
  Mail,
  ScrollText,
  Radio,
  Construction,
  Bell,
  Webhook,
  Send,
} from 'lucide-react'
import { type SidebarData } from '../types'

/**
 * 侧边栏导航（业务化改造后）。
 * 已移除：Tasks / Apps / Chats / Users（原演示模块）与 Clerk 相关入口；
 * 2026-10-10 移除设置模块（个人资料/账户/外观/通知/显示均为模板残留，无实际功能）。
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
          title: '通知中心',
          url: '/notifications',
          icon: Bell,
        },
        {
          title: 'Webhook 管理',
          url: '/webhooks',
          icon: Webhook,
        },
        {
          title: 'Telegram 机器人',
          url: '/telegram',
          icon: Send,
        },
        {
          title: '日志',
          url: '/logs',
          icon: ScrollText,
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
            {
              title: '500 服务错误',
              url: '/errors/internal-server-error',
              icon: ServerOff,
            },
            {
              title: '维护中',
              url: '/errors/maintenance-error',
              icon: Construction,
            },
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
