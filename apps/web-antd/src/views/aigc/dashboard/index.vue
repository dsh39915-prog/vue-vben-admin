<script lang="ts" setup>
import { Page } from '@vben/common-ui';

import {
  Button,
  Card,
  Col,
  List,
  ListItem,
  Progress,
  Row,
  Space,
  Statistic,
  Tag,
} from 'ant-design-vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const todoItems = [
  { name: '文案审核', count: 8, color: 'blue' },
  { name: '图片审核', count: 12, color: 'purple' },
  { name: '视频脚本审核', count: 3, color: 'orange' },
  { name: '页面上新', count: 5, color: 'green' },
];

const recentTasks = [
  { code: 'JMG63045', node: 'AI 模特图生成', owner: '黄柳雨', status: '进行中' },
  { code: 'JRG63248', node: '文案审核', owner: '李小明', status: '待处理' },
  { code: 'JMG63122', node: '修图审核', owner: '王伟', status: '待处理' },
  { code: 'JRG63098', node: '页面上新', owner: '黄柳雨', status: '已完成' },
];
</script>

<template>
  <Page description="统一查看上新流程、人工待办与 AI 生成任务" title="AIGC 工作台">
    <Row :gutter="16">
      <Col :lg="6" :sm="12" :xs="24">
        <Card class="mb-4!" :bordered="false">
          <Statistic title="进行中的上新任务" :value="26" />
        </Card>
      </Col>
      <Col :lg="6" :sm="12" :xs="24">
        <Card class="mb-4!" :bordered="false">
          <Statistic title="我的待办" :value="12" />
        </Card>
      </Col>
      <Col :lg="6" :sm="12" :xs="24">
        <Card class="mb-4!" :bordered="false">
          <Statistic title="今日生成图片" :value="368" suffix="张" />
        </Card>
      </Col>
      <Col :lg="6" :sm="12" :xs="24">
        <Card class="mb-4!" :bordered="false">
          <Statistic title="今日生成成功率" :value="96.8" suffix="%" />
        </Card>
      </Col>
    </Row>

    <Row :gutter="16">
      <Col :lg="16" :xs="24">
        <Card title="最近上新任务" :bordered="false">
          <template #extra>
            <Button type="link" @click="router.push('/launch/tasks')">查看全部</Button>
          </template>
          <List :data-source="recentTasks">
            <template #renderItem="{ item }">
              <ListItem>
                <div>
                  <div class="font-medium">{{ item.code }} · {{ item.node }}</div>
                  <div class="mt-1 text-xs text-gray-500">负责人：{{ item.owner }}</div>
                </div>
                <Tag :color="item.status === '已完成' ? 'success' : item.status === '进行中' ? 'processing' : 'warning'">
                  {{ item.status }}
                </Tag>
              </ListItem>
            </template>
          </List>
        </Card>
      </Col>
      <Col :lg="8" :xs="24">
        <Card class="mt-4! lg:mt-0!" title="我的待办" :bordered="false">
          <Space direction="vertical" size="middle" style="width: 100%">
            <div v-for="item in todoItems" :key="item.name" class="flex items-center justify-between">
              <Tag :color="item.color">{{ item.name }}</Tag>
              <strong>{{ item.count }}</strong>
            </div>
          </Space>
          <Button class="mt-5" block type="primary" @click="router.push('/launch/workbench')">
            进入人工任务工作台
          </Button>
        </Card>
        <Card class="mt-4!" title="本月任务完成率" :bordered="false">
          <Progress :percent="78" status="active" />
          <div class="mt-2 text-sm text-gray-500">已完成 156 / 计划 200</div>
        </Card>
      </Col>
    </Row>
  </Page>
</template>
