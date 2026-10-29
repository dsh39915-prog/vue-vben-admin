<script setup lang="ts">
import type { LaunchTask } from '#/api';

import { Card, Descriptions, DescriptionsItem, Tag } from 'ant-design-vue';

import {
  flowStatusOptions,
  optionLabel,
  statusColor,
  visualLevelOptions,
} from '../helpers';
defineProps<{ task: LaunchTask }>();
</script>
<template>
  <Card title="任务信息" :bordered="false" class="mb-4!">
    <Descriptions :column="{ xs: 1, sm: 2, xl: 3 }" size="small">
      <DescriptionsItem label="款号">
        <strong>{{ task.styleNo }}</strong>
      </DescriptionsItem>
      <DescriptionsItem label="开发年份季节">
        {{ task.productSeason || '-' }}
      </DescriptionsItem>
      <DescriptionsItem label="品类">
        {{ task.category || '-' }}
      </DescriptionsItem>
      <DescriptionsItem label="视觉重要层级">
        {{ optionLabel(visualLevelOptions, task.visualLevel) }}
      </DescriptionsItem>
      <DescriptionsItem label="主推平台">
        {{ task.mainPlatform || '-' }}
      </DescriptionsItem>
      <DescriptionsItem label="流程状态">
        <Tag :color="statusColor(task.flowStatus)">
          {{ optionLabel(flowStatusOptions, task.flowStatus) }}
        </Tag>
      </DescriptionsItem>
      <DescriptionsItem label="上新时间">
        {{ task.launchTime || '-' }}
      </DescriptionsItem>
      <DescriptionsItem label="流程开始时间">
        {{ task.flowStartTime || '-' }}
      </DescriptionsItem>
      <DescriptionsItem label="商品要求货期">
        {{ task.productDeadline || '-' }}
      </DescriptionsItem>
    </Descriptions>
    <slot></slot>
  </Card>
</template>
