<script lang="ts" setup>
import { reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import {
  Button,
  Card,
  Form,
  FormItem,
  Input,
  message,
  Select,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

interface LaunchTaskRow {
  assignee: string;
  code: string;
  currentNode: string;
  id: number;
  progress: number;
  status: '已完成' | '进行中' | '已暂停';
  title: string;
  updatedAt: string;
}

const loading = ref(false);
const query = reactive({
  keyword: '',
  status: undefined as string | undefined,
});

const columns = [
  { dataIndex: 'code', key: 'code', title: '商品编码', width: 130 },
  { dataIndex: 'title', key: 'title', title: '任务名称' },
  { dataIndex: 'currentNode', key: 'currentNode', title: '当前节点', width: 150 },
  { dataIndex: 'assignee', key: 'assignee', title: '负责人', width: 100 },
  { dataIndex: 'progress', key: 'progress', title: '进度', width: 100 },
  { dataIndex: 'status', key: 'status', title: '状态', width: 100 },
  { dataIndex: 'updatedAt', key: 'updatedAt', title: '更新时间', width: 170 },
  { fixed: 'right' as const, key: 'action', title: '操作', width: 160 },
];

const rows: LaunchTaskRow[] = [
  {
    id: 1,
    code: 'JMG63045',
    title: '秋季女装第一批上新',
    currentNode: 'AI 模特图生成',
    assignee: '黄柳雨',
    progress: 45,
    status: '进行中',
    updatedAt: '2026-09-02 10:28',
  },
  {
    id: 2,
    code: 'JRG63248',
    title: '轻户外系列上新',
    currentNode: '文案审核',
    assignee: '李小明',
    progress: 28,
    status: '进行中',
    updatedAt: '2026-09-02 09:46',
  },
  {
    id: 3,
    code: 'JMG63122',
    title: '通勤系列第二批上新',
    currentNode: '修图审核',
    assignee: '王伟',
    progress: 72,
    status: '已暂停',
    updatedAt: '2026-09-01 18:30',
  },
  {
    id: 4,
    code: 'JRG63098',
    title: '夏末清仓页面调整',
    currentNode: '流程结束',
    assignee: '黄柳雨',
    progress: 100,
    status: '已完成',
    updatedAt: '2026-09-01 16:12',
  },
];

function search() {
  loading.value = true;
  window.setTimeout(() => {
    loading.value = false;
  }, 250);
}

function reset() {
  query.keyword = '';
  query.status = undefined;
  search();
}
</script>

<template>
  <Page description="业务任务通过 businessKey 与 Flowable 流程实例关联" title="上新任务管理">
    <Card class="mb-4!" :bordered="false">
      <Form layout="inline">
        <FormItem label="关键词">
          <Input
            v-model:value="query.keyword"
            allow-clear
            placeholder="商品编码 / 任务名称"
            style="width: 240px"
          />
        </FormItem>
        <FormItem label="状态">
          <Select
            v-model:value="query.status"
            allow-clear
            placeholder="全部状态"
            style="width: 140px"
          >
            <Select.Option value="running">进行中</Select.Option>
            <Select.Option value="suspended">已暂停</Select.Option>
            <Select.Option value="completed">已完成</Select.Option>
          </Select>
        </FormItem>
        <FormItem>
          <Space>
            <Button type="primary" @click="search">查询</Button>
            <Button @click="reset">重置</Button>
          </Space>
        </FormItem>
      </Form>
    </Card>

    <Card :bordered="false">
      <template #title>
        <Space>
          <span>任务列表</span>
          <Tag color="blue">MVP</Tag>
        </Space>
      </template>
      <template #extra>
        <Button
          type="primary"
          @click="message.info('新建任务表单将在后端 AIGC 模块接口确定后接入')"
        >
          新建上新任务
        </Button>
      </template>
      <Table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="{ pageSize: 10, showSizeChanger: true }"
        row-key="id"
        :scroll="{ x: 1100 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'progress'">{{ record.progress }}%</template>
          <template v-else-if="column.key === 'status'">
            <Tag
              :color="
                record.status === '已完成'
                  ? 'success'
                  : record.status === '进行中'
                    ? 'processing'
                    : 'warning'
              "
            >
              {{ record.status }}
            </Tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <Space>
              <Button size="small" type="link" @click="message.info(`查看任务 ${record.code}`)">
                详情
              </Button>
              <Button size="small" type="link" @click="message.info(`查看流程 ${record.code}`)">
                流程
              </Button>
            </Space>
          </template>
        </template>
      </Table>
    </Card>
  </Page>
</template>
