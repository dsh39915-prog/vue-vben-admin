import type { RouteRecordRaw } from 'vue-router';

const systemPage = () => import('#/views/system/common/index.vue');
const connectedSystemPage = () =>
  import('#/views/system/common/connected-page.vue');

const routes: RouteRecordRaw[] = [
  {
    name: 'SystemManagement',
    path: '/system',
    meta: {
      icon: 'lucide:settings',
      order: 70,
      title: '系统管理',
    },
    children: [
      {
        name: 'SystemUser',
        path: 'user',
        component: connectedSystemPage,
        meta: { icon: 'lucide:users', title: '用户管理' },
      },
      {
        name: 'SystemRole',
        path: 'role',
        component: connectedSystemPage,
        meta: { icon: 'lucide:shield-check', title: '角色管理' },
      },
      {
        name: 'SystemMenu',
        path: 'menu',
        component: () => import('#/views/system/menu/index.vue'),
        meta: { icon: 'lucide:menu', title: '菜单管理' },
      },
      {
        name: 'SystemDept',
        path: 'dept',
        component: connectedSystemPage,
        meta: { icon: 'lucide:network', title: '部门管理' },
      },
      {
        name: 'SystemPost',
        path: 'post',
        component: connectedSystemPage,
        meta: { icon: 'lucide:contact', title: '岗位管理' },
      },
      {
        name: 'SystemTenant',
        path: 'tenant',
        component: systemPage,
        meta: { icon: 'lucide:building-2', title: '租户管理' },
      },
      {
        name: 'SystemTenantPackage',
        path: 'tenant-package',
        component: systemPage,
        meta: { icon: 'lucide:package-open', title: '租户套餐' },
      },
      {
        name: 'SystemAiModel',
        path: 'ai-model',
        component: () => import('#/views/aigc/model/index.vue'),
        meta: { icon: 'lucide:cpu', title: '模型管理' },
      },
      {
        name: 'SystemDict',
        path: 'dict',
        component: systemPage,
        meta: { icon: 'lucide:book-key', title: '字典管理' },
      },
      {
        name: 'SystemConfig',
        path: 'config',
        component: systemPage,
        meta: { icon: 'lucide:sliders-horizontal', title: '参数设置' },
      },
      {
        name: 'SystemNotice',
        path: 'notice',
        component: systemPage,
        meta: { icon: 'lucide:megaphone', title: '通知公告' },
      },
      {
        name: 'SystemOperateLog',
        path: 'operate-log',
        component: connectedSystemPage,
        meta: { icon: 'lucide:file-clock', title: '操作日志' },
      },
      {
        name: 'SystemLoginLog',
        path: 'login-log',
        component: connectedSystemPage,
        meta: { icon: 'lucide:log-in', title: '登录日志' },
      },
      {
        name: 'SystemOnlineUser',
        path: 'online-user',
        component: systemPage,
        meta: { icon: 'lucide:user-round-check', title: '在线用户' },
      },
      {
        name: 'SystemJob',
        path: 'job',
        component: systemPage,
        meta: { icon: 'lucide:timer', title: '定时任务' },
      },
      {
        name: 'SystemDataMonitor',
        path: 'data-monitor',
        component: systemPage,
        meta: { icon: 'lucide:database-zap', title: '数据监控' },
      },
      {
        name: 'SystemServerMonitor',
        path: 'server-monitor',
        component: systemPage,
        meta: { icon: 'lucide:server-cog', title: '服务监控' },
      },
      {
        name: 'SystemCacheMonitor',
        path: 'cache-monitor',
        component: systemPage,
        meta: { icon: 'lucide:gauge', title: '缓存监控' },
      },
      {
        name: 'SystemCacheList',
        path: 'cache-list',
        component: systemPage,
        meta: { icon: 'lucide:list-tree', title: '缓存列表' },
      },
    ],
  },
];

export default routes;
