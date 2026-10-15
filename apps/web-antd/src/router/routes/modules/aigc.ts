import type { RouteRecordRaw } from 'vue-router';

const placeholder = () => import('#/views/aigc/common/module-page.vue');

const routes: RouteRecordRaw[] = [
  {
    name: 'LaunchManagement',
    path: '/launch',
    meta: { icon: 'lucide:workflow', order: 10, title: '上新管理' },
    children: [
      {
        name: 'LaunchTaskList',
        path: 'tasks',
        component: () => import('#/views/aigc/launch/task-list.vue'),
        meta: { icon: 'lucide:list-checks', title: '任务管理' },
      },
      {
        name: 'LaunchWorkbench',
        path: 'workbench',
        component: placeholder,
        meta: { icon: 'lucide:clipboard-check', title: '人工任务工作台' },
      },
      {
        name: 'LaunchProcess',
        path: 'process',
        component: placeholder,
        meta: { icon: 'lucide:git-branch', title: '流程管理' },
      },
    ],
  },
  {
    name: 'AiCreation',
    path: '/generation',
    meta: { icon: 'lucide:sparkles', order: 20, title: 'AI 创作' },
    children: [
      {
        name: 'ImageGeneration',
        path: 'image',
        component: () => import('#/views/aigc/generation/index.vue'),
        meta: { icon: 'lucide:image', title: '图片生成' },
      },
      {
        name: 'ImageGenerationResults',
        path: 'results',
        component: () => import('#/views/aigc/generation/results.vue'),
        meta: { icon: 'lucide:images', title: '图片生成结果' },
      },
      {
        name: 'MultimodalChat',
        path: 'chat',
        component: placeholder,
        meta: { icon: 'lucide:messages-square', title: '多模态聊天' },
      },
      {
        name: 'VideoGeneration',
        path: 'video',
        component: placeholder,
        meta: { icon: 'lucide:clapperboard', title: '视频生成' },
      },
    ],
  },
  {
    name: 'PromptManagement',
    path: '/prompt',
    meta: { icon: 'lucide:braces', order: 30, title: '提示词管理' },
    children: [
      {
        name: 'PromptCategory',
        path: 'categories',
        component: () => import('#/views/aigc/prompt/categories.vue'),
        meta: { icon: 'lucide:folder-tree', title: '提示词类别' },
      },
      {
        name: 'PromptTemplate',
        path: 'templates',
        component: () => import('#/views/aigc/prompt/templates.vue'),
        meta: { icon: 'lucide:notebook-tabs', title: 'AI 提示词' },
      },
    ],
  },
  {
    name: 'AssetManagement',
    path: '/asset',
    meta: { icon: 'lucide:library', order: 40, title: '素材管理' },
    children: [
      {
        name: 'AssetCategory',
        path: 'categories',
        component: () => import('#/views/aigc/assets/categories.vue'),
        meta: { icon: 'lucide:folders', title: '分类管理' },
      },
      {
        name: 'ImageAsset',
        path: 'images',
        component: () => import('#/views/aigc/assets/images.vue'),
        meta: { icon: 'lucide:images', title: '图片素材' },
      },
      {
        name: 'VideoAsset',
        path: 'videos',
        component: placeholder,
        meta: { icon: 'lucide:film', title: '视频素材' },
      },
    ],
  },
  {
    name: 'GenerationTaskCenter',
    path: '/task-center',
    component: () => import('#/views/aigc/generation/tasks.vue'),
    meta: {
      icon: 'lucide:circle-gauge',
      order: 50,
      title: '任务中心',
    },
  },
  {
    name: 'Statistics',
    path: '/statistics',
    meta: {
      icon: 'lucide:chart-no-axes-combined',
      order: 60,
      title: '数据统计',
    },
    children: [
      {
        name: 'ImageStatistics',
        path: 'image',
        component: placeholder,
        meta: { icon: 'lucide:chart-column', title: '图片生成统计' },
      },
      {
        name: 'VideoStatistics',
        path: 'video',
        component: placeholder,
        meta: { icon: 'lucide:chart-line', title: '视频生成统计' },
      },
    ],
  },
];

export default routes;
