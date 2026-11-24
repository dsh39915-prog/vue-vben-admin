<script setup lang="ts">
import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue';

import type {
  SystemLoginLog,
  SystemLogKind,
  SystemLogQuery,
  SystemOperationLog,
} from '#/api';

import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  FormItem,
  Input,
  Row,
  Select,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

import { getSystemLogsApi } from '#/api';
import { useMenuTitle } from '#/composables/use-menu-title';

const props = defineProps<{ kind: SystemLogKind }>();
const title = useMenuTitle();
const { RangePicker } = DatePicker;
type LogRecord = SystemLoginLog | SystemOperationLog;
const filters = reactive({
  username: '',
  succeeded: undefined as '0' | '1' | undefined,
});
const dateRange = ref<[string, string]>();
let appliedFilters: Omit<SystemLogQuery, 'page' | 'pageSize'> = {};
const records = ref<LogRecord[]>([]);
const loading = ref(false);
const listFailed = ref(false);
const pagination = reactive({ current: 1, pageSize: 20, total: 0 });
let listRequest = 0;

const columns = computed<TableColumnsType<LogRecord>>(() => [
  { dataIndex: 'id', title: 'ID', width: 90 },
  { dataIndex: 'username', title: '登录名', width: 150 },
  { dataIndex: 'userId', title: '用户 ID', width: 100 },
  { dataIndex: 'succeeded', title: '结果', width: 90 },
  ...(props.kind === 'login-logs'
    ? [
        { dataIndex: 'realName', title: '姓名', width: 130 },
        { dataIndex: 'message', title: '结果说明', width: 240, ellipsis: true },
        { dataIndex: 'operatingSystem', title: '操作系统', width: 140 },
        { dataIndex: 'browser', title: '浏览器', width: 140 },
        {
          dataIndex: 'userAgent',
          title: '客户端信息',
          width: 260,
          ellipsis: true,
        },
      ]
    : [
        { dataIndex: 'action', title: '操作', width: 180 },
        { dataIndex: 'requestMethod', title: '请求方法', width: 100 },
        {
          dataIndex: 'requestPath',
          title: '请求路径',
          width: 260,
          ellipsis: true,
        },
        { dataIndex: 'httpStatus', title: 'HTTP 状态', width: 110 },
        { dataIndex: 'durationMs', title: '耗时（毫秒）', width: 130 },
        { dataIndex: 'failureType', title: '失败类型', width: 180 },
        { dataIndex: 'remark', title: '备注', width: 220, ellipsis: true },
      ]),
  { dataIndex: 'ipAddress', title: '来源 IP', width: 160 },
  { dataIndex: 'createdAt', title: '记录时间', width: 200 },
]);

async function loadList(
  page = pagination.current,
  pageSize = pagination.pageSize,
) {
  const request = ++listRequest;
  loading.value = true;
  listFailed.value = false;
  try {
    const data = await getSystemLogsApi(props.kind, {
      ...appliedFilters,
      page,
      pageSize,
    });
    if (request !== listRequest) return;
    records.value = data.records;
    Object.assign(pagination, {
      current: data.page,
      pageSize: data.pageSize,
      total: data.total,
    });
  } catch {
    if (request === listRequest) listFailed.value = true;
  } finally {
    if (request === listRequest) loading.value = false;
  }
}
function search() {
  appliedFilters = {
    username: filters.username.trim() || undefined,
    succeeded:
      filters.succeeded === undefined ? undefined : filters.succeeded === '1',
    startTime: dateRange.value?.[0],
    endTime: dateRange.value?.[1],
  };
  void loadList(1);
}
function reset() {
  filters.username = '';
  filters.succeeded = undefined;
  dateRange.value = undefined;
  search();
}
function changePage(value: TablePaginationConfig) {
  const pageSize = value.pageSize ?? pagination.pageSize;
  void loadList(
    pageSize === pagination.pageSize ? (value.current ?? 1) : 1,
    pageSize,
  );
}
onMounted(() => void loadList());
</script>

<template>
  <Page :title="title">
    <Card class="filter-card" title="筛选条件">
      <Form
        name="system-log-filter"
        :model="filters"
        layout="vertical"
        @finish="search"
      >
        <Row :gutter="16">
          <Col :xs="24" :sm="12" :lg="6" :xl="3">
            <FormItem label="登录名" name="username">
              <Input
                v-model:value="filters.username"
                :maxlength="64"
                allow-clear
              />
            </FormItem>
          </Col>
          <Col :xs="24" :sm="12" :lg="6" :xl="3">
            <FormItem label="结果" name="succeeded">
              <Select
                v-model:value="filters.succeeded"
                :options="[
                  { label: '成功', value: '1' },
                  { label: '失败', value: '0' },
                ]"
                allow-clear
                placeholder="全部"
              />
            </FormItem>
          </Col>
          <Col :xs="24" :sm="24" :lg="12" :xl="6">
            <FormItem label="时间范围">
              <RangePicker
                v-model:value="dateRange"
                class="w-full"
                show-time
                value-format="YYYY-MM-DDTHH:mm:ss"
                format="YYYY-MM-DD HH:mm:ss"
              />
            </FormItem>
          </Col>
        </Row>
        <div class="flex justify-end">
          <Space>
            <Button type="primary" html-type="submit" :loading="loading">
              查询
            </Button>
            <Button @click="reset">重置</Button>
          </Space>
        </div>
      </Form>
    </Card>
    <Card :title="title">
      <template #extra>
        <Button :loading="loading" @click="loadList()">刷新</Button>
      </template>
      <Alert
        v-if="listFailed"
        class="mb-4"
        message="日志加载失败，请刷新重试"
        type="error"
        show-icon
      />
      <Table
        :columns="columns"
        :data-source="records"
        :loading="loading"
        row-key="id"
        :scroll="{ x: 1900 }"
        :pagination="{
          ...pagination,
          showSizeChanger: true,
          pageSizeOptions: ['20', '50', '100'],
          showTotal: (total) => `共 ${total} 条`,
        }"
        @change="changePage"
      >
        <template #bodyCell="{ column, text }">
          <Tag
            v-if="column.dataIndex === 'succeeded'"
            :color="
              text === true ? 'success' : text === false ? 'error' : 'default'
            "
          >
            {{ text === true ? '成功' : text === false ? '失败' : '未知' }}
          </Tag>
          <template v-else-if="column.dataIndex === 'createdAt'">
            {{ typeof text === 'string' ? text.replace('T', ' ') : '—' }}
          </template>
          <template v-else>{{ text ?? '—' }}</template>
        </template>
      </Table>
    </Card>
  </Page>
</template>
