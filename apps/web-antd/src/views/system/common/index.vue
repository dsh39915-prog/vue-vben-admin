<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Card, Empty } from 'ant-design-vue';

const route = useRoute();
const title = computed(() => String(route.meta.title || '系统管理'));
</script>

<template>
  <Page :title="title">
    <Card :bordered="false">
      <Empty :description="`${title}暂未开放`" />
    </Card>
  </Page>
</template>
