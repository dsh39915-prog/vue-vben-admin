<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Card, Empty } from 'ant-design-vue';

const route = useRoute();
const title = computed(() => String(route.meta.title || '业务模块'));

const descriptions: Record<string, string> = {
  AiModelManagement: '配置图片、视频与多模态模型供应商、能力和调用参数',
  AssetCategory: '维护图片和视频素材的业务分类',
  GenerationTaskCenter: '集中查看 AI 任务的排队、运行、成功、失败与取消状态',
  ImageAsset: '管理生成图、原始图、参考图及其对象存储信息',
  ImageGeneration: '创建图片生成任务并实时查看生成进度与结果',
  ImageStatistics: '按模型、人员、时间与成功率分析图片生成情况',
  LaunchProcess: '管理 AIGC 上新 BPMN 流程定义、版本与部署状态',
  LaunchWorkbench: '依据 Flowable taskDefinitionKey 动态承载人工节点表单',
  MultimodalChat: '使用文本与素材进行多轮多模态创作',
  PromptCategory: '维护提示词分类树',
  PromptTemplate: '维护版本化提示词模板及变量定义',
  VideoAsset: '管理视频成片、片段与对象存储信息',
  VideoGeneration: '创建视频生成任务并查看异步任务进度',
  VideoStatistics: '按模型、人员、时间与成功率分析视频生成情况',
};

const description = computed(
  () => descriptions[String(route.name)] || '',
);
</script>

<template>
  <Page :description="description" :title="title">
    <Card :bordered="false">
      <Empty :description="`${title}暂未开放`" />
    </Card>
  </Page>
</template>
