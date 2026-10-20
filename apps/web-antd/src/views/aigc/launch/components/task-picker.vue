<script setup lang="ts">
import type { LaunchTask } from '#/api';
import type { DrawingTaskScope } from '#/features/drawing/access';

import { onMounted, ref } from 'vue';

import {
  Alert,
  Button,
  Form,
  FormItem,
  Input,
  Modal,
  Table,
} from 'ant-design-vue';

import { getLaunchTaskPageApi } from '#/api';
import { getDrawingTaskPage } from '#/features/drawing/access';

import { useAigcPage } from '../../common/use-page';
import { flowStatusOptions, optionLabel } from '../helpers';
const props = defineProps<{ scope?: DrawingTaskScope }>();
const emit = defineEmits<{ select: [LaunchTask]; close: [] }>();
const failed = ref('');
const keyword = ref('');
const { rows, loading, pagination, load, search, change } = useAigcPage(
  async ({ page, pageSize, styleNo }) => {
    failed.value = '';
    let data;
    try {
      const params = { pageNo: page, pageSize, styleNo };
      data = props.scope
        ? await getDrawingTaskPage(params, props.scope)
        : await getLaunchTaskPageApi(params);
    } catch (error) {
      failed.value =
        error instanceof Error ? error.message : '任务加载失败，请重试';
      throw error;
    }
    return {
      records: data.list,
      total: data.total,
      current: page,
      size: pageSize,
    };
  },
  { styleNo: undefined as string | undefined },
);
const columns = [
  { title: 'ID', dataIndex: 'id', width: 80 },
  { title: '款号', dataIndex: 'styleNo' },
  { title: '当前节点', dataIndex: 'currentNodeName' },
  { title: '流程状态', key: 'status', width: 110 },
  { title: '操作', key: 'action', width: 100 },
];
onMounted(load);
</script>
<template>
  <Modal
    open
    title="选择上新任务"
    :width="1000"
    :footer="null"
    @cancel="emit('close')"
  >
    <Form
      :model="{ keyword }"
      layout="inline"
      class="mb-4!"
      @finish="search({ styleNo: keyword.trim() || undefined })"
    >
      <FormItem label="款号">
        <Input
          v-model:value="keyword"
          placeholder="按款号查询任务"
          allow-clear
        />
      </FormItem>
      <FormItem>
        <Button type="primary" html-type="submit" :loading="loading">
          <span>查询任务</span>
        </Button>
      </FormItem>
    </Form>
    <Alert v-if="failed" :message="failed" type="error" class="mb-4!" />
    <Table
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="pagination"
      row-key="id"
      @change="change"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          {{ optionLabel(flowStatusOptions, record.flowStatus) }}
        </template>
        <Button
          v-else-if="column.key === 'action'"
          type="link"
          @click="emit('select', record as LaunchTask)"
        >
          <span>选择</span>
        </Button>
      </template>
    </Table>
  </Modal>
</template>
