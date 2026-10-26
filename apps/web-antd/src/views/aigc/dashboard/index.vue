<script lang="ts" setup>
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Button, Card, Col, Empty, Row } from 'ant-design-vue';

const router = useRouter();
</script>

<template>
  <Page
    description="统一查看上新流程、人工待办与 AI 生成任务"
    title="AIGC 工作台"
  >
    <Card class="mb-4!" title="任务统计" :bordered="false">
      <Empty description="暂无统计数据" />
    </Card>
    <Row :gutter="16">
      <Col :lg="16" :xs="24">
        <Card title="最近上新任务" :bordered="false">
          <template #extra>
            <Button type="link" @click="router.push('/launch/tasks')">
              查看全部
            </Button>
          </template>
          <Empty description="请前往上新任务列表查看任务" />
        </Card>
      </Col>
      <Col :lg="8" :xs="24">
        <Card class="mt-4! lg:mt-0!" title="我的待办" :bordered="false">
          <Empty description="请前往人工任务工作台查看待办" />
          <Button
            class="mt-5"
            block
            type="primary"
            @click="router.push('/launch/workbench')"
          >
            进入人工任务工作台
          </Button>
        </Card>
      </Col>
    </Row>
  </Page>
</template>
