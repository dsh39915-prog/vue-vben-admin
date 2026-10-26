import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      hideInMenu: true,
      icon: 'lucide:layout-dashboard',
      order: -1,
      title: '工作台',
    },
    name: 'Dashboard',
    path: '/dashboard',
    children: [
      {
        name: 'AigcOverview',
        path: 'overview',
        component: () => import('#/views/aigc/dashboard/index.vue'),
        meta: {
          hideInMenu: true,
          affixTab: true,
          icon: 'lucide:house',
          title: '首页',
        },
      },
    ],
  },
];

export default routes;
