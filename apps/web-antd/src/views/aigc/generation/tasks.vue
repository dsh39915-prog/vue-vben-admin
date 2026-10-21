<script setup lang="ts">
import type { AiImageTaskPageParams, AiImageTaskRecord, AiImageTaskStatistics } from '#/api';

import {
  computed,
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  watch,
} from 'vue';
import { onBeforeRouteLeave } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  Descriptions,
  DescriptionsItem,
  Form,
  FormItem,
  Image,
  message,
  Modal,
  Popconfirm,
  Progress,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  cancelAiImageTasksApi,
  deleteAiImageTaskApi,
  getAiImageTaskApi,
  getAiImageTaskPageApi,
  getAiImageTaskStatisticsApi,
  retryAiImageTasksApi,
  startAiImageTasksApi,
} from '#/api';

import { useImageModels } from '../common/use-image-models';
import { useAigcPage } from '../common/use-page';
import ResultModal from './components/result-modal.vue';
import { imagePreviewUrls, taskStatusColors, taskStatusOptions } from './helpers';

type TaskAction = 'cancel' | 'retry' | 'start';
const query = reactive<Omit<AiImageTaskPageParams, 'page' | 'pageSize'>>({
  sortKey: 'create_time',
  sortVal: 'desc',
});
const {
  rows,
  loading,
  pagination,
  load,
  search: searchPage,
  change,
} = useAigcPage(getAiImageTaskPageApi, { ...query });
const { modelName, modelOptions, models, modelsLoading, loadModels } = useImageModels();
const retryOpen = ref(false);
const retryIds = ref<number[]>([]);
const retryModelId = ref<number>();
const retryModels = computed(() =>
  models.value
    .filter((model) => model.status === 1)
    .map((model) => ({ label: model.modelName, value: model.id })),
);
function openRetry(ids: number[]) {
  if (
    busy.value ||
    !canPerform(
      'retry',
      rows.value.filter((item) => ids.includes(item.id)),
    ) ||
    ids.length !== rows.value.filter((item) => ids.includes(item.id)).length
  )
    return;
  retryIds.value = [...ids];
  retryModelId.value = undefined;
  retryOpen.value = true;
}
async function confirmRetry() {
  if (modelsLoading.value) return;
  if (
    retryModelId.value !== undefined &&
    !retryModels.value.some((model) => model.value === retryModelId.value)
  ) {
    message.warning('请选择可用的图片模型');
    return;
  }
  if (await perform('retry', retryIds.value, retryModelId.value)) retryOpen.value = false;
}
const statistics = ref<AiImageTaskStatistics>();
const selectedKeys = ref<number[]>([]);
const busy = ref(false);
const autoRefresh = ref(true);
const detailLoading = ref(false);
const detailOpen = ref(false);
const detail = ref<AiImageTaskRecord>();
const originalPreview = computed(
  () =>
    imagePreviewUrls(
      detail.value?.originalImg || detail.value?.smallOriginalImg,
      detail.value?.previewOriginalImg,
    )[0],
);
const referencePreviews = computed(() =>
  imagePreviewUrls(
    detail.value?.referenceImg || detail.value?.smallReferenceImg,
    detail.value?.previewReferenceImg,
  ),
);
const resultsOpen = ref(false);
const resultsId = ref<number>();
let active = false;
let timer: number | undefined;
let statisticsRequest = 0;
const selectedRows = computed(() =>
  rows.value.filter((item) => selectedKeys.value.includes(item.id)),
);
const taskTypes = [
  { label: '单图生成', value: 0 },
  { label: '批量生成', value: 1 },
];
const generateTypes = ['首次生成', '单张重新生成', '材质增强', '高清放大', '局部重绘'];
const columns = [
  { title: '任务 ID', dataIndex: 'id', width: 90 },
  { title: '生图 ID', dataIndex: 'imgId', width: 90 },
  { title: '任务类型', key: 'taskType', width: 110 },
  { title: '操作类型', key: 'generateType', width: 130 },
  { title: '模型', key: 'model', width: 210 },
  { title: '状态', key: 'status', width: 140 },
  { title: '进度', key: 'progress', width: 140 },
  { title: '生成数量', key: 'count', width: 100 },
  { title: '耗时（秒）', dataIndex: 'duration', width: 110 },
  { title: '创建时间', dataIndex: 'createTime', width: 180 },
  { title: '操作', key: 'action', fixed: 'right' as const, width: 350 },
];
const allowedStatuses: Record<TaskAction, number[]> = {
  start: [5],
  retry: [0, 3, 4],
  cancel: [0, 1],
};
function canPerform(action: TaskAction, items: AiImageTaskRecord[]) {
  return items.length > 0 && items.every((item) => allowedStatuses[action].includes(item.status));
}
function search() {
  selectedKeys.value = [];
  return searchPage({ ...query });
}
function reset() {
  Object.assign(query, {
    aiModelId: undefined,
    status: undefined,
    taskType: undefined,
    sourcePage: undefined,
    sortKey: 'create_time',
    sortVal: 'desc',
  });
  void search();
}
async function loadStatistics() {
  const request = ++statisticsRequest;
  try {
    const data = await getAiImageTaskStatisticsApi();
    if (request === statisticsRequest) statistics.value = data;
  } catch {
    /* The request interceptor displays errors. */
  }
}
async function refresh() {
  await Promise.all([load(), loadStatistics()]);
}
async function perform(action: TaskAction, ids: number[], modelId?: number) {
  const items = rows.value.filter((item) => ids.includes(item.id));
  if (busy.value) return false;
  if (items.length !== ids.length || !canPerform(action, items)) {
    message.warning('任务状态已变化，请刷新后重新选择');
    return false;
  }
  busy.value = true;
  try {
    const actions = {
      start: startAiImageTasksApi,
      cancel: cancelAiImageTasksApi,
    };
    const result =
      action === 'retry' ? await retryAiImageTasksApi(ids, modelId) : await actions[action](ids);
    if (result === false) {
      message.error('操作未成功，请重试');
      return false;
    }
    message.success(action === 'cancel' ? '取消请求已提交' : '任务已提交');
    selectedKeys.value = [];
    await refresh();
    return true;
  } catch {
    /* Keep the selection for a failed operation. */
    return false;
  } finally {
    busy.value = false;
  }
}
async function remove(id: number) {
  const record = rows.value.find((item) => item.id === id);
  if (!record) return;
  if (busy.value || [0, 1].includes(record.status)) return;
  busy.value = true;
  try {
    if ((await deleteAiImageTaskApi(record.id)) === false) {
      message.error('删除未成功，请重试');
      return;
    }
    message.success('删除成功');
    selectedKeys.value = [];
    await refresh();
  } catch {
    /* The request interceptor displays errors. */
  } finally {
    busy.value = false;
  }
}
async function showDetail(id: number, open = true) {
  if (detailLoading.value) return;
  detailLoading.value = true;
  try {
    const data = await getAiImageTaskApi(id);
    if (data === null) {
      message.warning('该任务不存在，请刷新列表');
      return;
    }
    if (!open && (!detailOpen.value || detail.value?.id !== id)) return;
    detail.value = data;
    if (open) detailOpen.value = true;
  } catch {
    /* The request interceptor displays errors. */
  } finally {
    detailLoading.value = false;
  }
}
function showResults(imgId: number) {
  resultsId.value = imgId;
  resultsOpen.value = true;
}
function stopTimer() {
  if (timer !== undefined) window.clearTimeout(timer);
  timer = undefined;
}
function schedule() {
  stopTimer();
  if (!active || !autoRefresh.value) return;
  timer = window.setTimeout(async () => {
    if (
      active &&
      !document.hidden &&
      !loading.value &&
      !busy.value &&
      !detailLoading.value &&
      rows.value.some((item) => [0, 1].includes(item.status))
    ) {
      await refresh();
      if (active && detailOpen.value && detail.value) await showDetail(detail.value.id, false);
    }
    schedule();
  }, 5000);
}
watch(autoRefresh, schedule);
onMounted(() => {
  active = true;
  void refresh();
  void loadModels();
  schedule();
});
onActivated(() => {
  if (!active) {
    active = true;
    void refresh();
    schedule();
  }
});
onDeactivated(() => {
  active = false;
  stopTimer();
  if (!busy.value) retryOpen.value = false;
});
onBeforeRouteLeave(() => {
  if (busy.value) {
    message.warning('任务操作处理中，请稍候');
    return false;
  }
  retryOpen.value = false;
  return true;
});
onUnmounted(() => {
  active = false;
  stopTimer();
  statisticsRequest += 1;
});
</script>
<template>
  <Page title="AI 生图任务中心" description="查看生图进度、处理暂存与失败任务，并查看图片结果">
    <div class="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-6">
      <Card :bordered="false">
        <Statistic title="总任务" :value="statistics?.totalCount ?? '-'" />
      </Card>
      <Card :bordered="false">
        <Statistic title="等待中" :value="statistics?.waitingCount ?? '-'" />
      </Card>
      <Card :bordered="false">
        <Statistic title="生成中" :value="statistics?.runningCount ?? '-'" />
      </Card>
      <Card :bordered="false">
        <Statistic title="成功" :value="statistics?.successCount ?? '-'" />
      </Card>
      <Card :bordered="false">
        <Statistic title="失败" :value="statistics?.failCount ?? '-'" />
      </Card>
      <Card :bordered="false">
        <Statistic title="暂存" :value="statistics?.stagingCount ?? '-'" />
      </Card>
    </div>
    <Card class="mb-4!" :bordered="false">
      <Form :model="query" layout="inline" @finish="search">
        <FormItem label="状态">
          <Select
            v-model:value="query.status"
            :options="taskStatusOptions"
            allow-clear
            placeholder="全部状态"
            style="width: 130px"
          />
        </FormItem>
        <FormItem label="模型">
          <Select
            v-model:value="query.aiModelId"
            :options="modelOptions"
            :loading="modelsLoading"
            allow-clear
            show-search
            option-filter-prop="label"
            placeholder="全部模型"
            style="width: 220px"
          />
        </FormItem>
        <FormItem label="任务类型">
          <Select
            v-model:value="query.taskType"
            :options="taskTypes"
            allow-clear
            placeholder="全部类型"
            style="width: 130px"
          />
        </FormItem>
        <FormItem label="来源">
          <Select
            v-model:value="query.sourcePage"
            :options="taskTypes"
            allow-clear
            placeholder="全部来源"
            style="width: 130px"
          />
        </FormItem>
        <FormItem label="排序">
          <Select
            v-model:value="query.sortVal"
            :options="[
              { label: '创建时间倒序', value: 'desc' },
              { label: '创建时间正序', value: 'asc' },
            ]"
            style="width: 150px"
          />
        </FormItem>
        <FormItem>
          <Space>
            <Button type="primary" html-type="submit">
              <span>查询</span>
            </Button>
            <Button @click="reset">
              <span>重置</span>
            </Button>
          </Space>
        </FormItem>
      </Form>
    </Card>
    <Card title="任务列表" :bordered="false">
      <template #extra>
        <Space>
          <span>自动刷新</span>
          <Switch v-model:checked="autoRefresh" />
          <Button :loading="loading" :disabled="busy" @click="refresh">
            <span>刷新</span>
          </Button>
        </Space>
      </template>
      <Space class="mb-4!" wrap>
        <Button
          :disabled="busy || !canPerform('start', selectedRows)"
          @click="perform('start', selectedKeys)"
        >
          <span>批量启动</span>
        </Button>
        <Button
          :disabled="busy || !canPerform('retry', selectedRows)"
          @click="openRetry(selectedKeys)"
        >
          <span>批量重试</span>
        </Button>
        <Popconfirm
          title="确定取消选中的任务？"
          :disabled="busy || !canPerform('cancel', selectedRows)"
          @confirm="perform('cancel', selectedKeys)"
        >
          <Button danger :disabled="busy || !canPerform('cancel', selectedRows)">
            <span>批量取消</span>
          </Button>
        </Popconfirm>
        <div class="text-sm text-muted-foreground">已选 {{ selectedKeys.length }} 项</div>
      </Space>
      <Table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="pagination"
        :scroll="{ x: 1720 }"
        row-key="id"
        :row-selection="{
          selectedRowKeys: selectedKeys,
          onChange: (keys) => (selectedKeys = keys.map(Number)),
          getCheckboxProps: () => ({ disabled: busy }),
        }"
        @change="
          (page) => {
            selectedKeys = [];
            change(page);
          }
        "
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'model'">
            {{ modelName(record.modelId) }}
          </template>
          <template v-else-if="column.key === 'taskType'">
            {{ record.taskType === 1 ? '批量生成' : '单图生成' }}
          </template>
          <template v-else-if="column.key === 'generateType'">
            {{ generateTypes[record.generateType] || '-' }}
          </template>
          <Tag v-else-if="column.key === 'status'" :color="taskStatusColors[record.status]">
            <span>{{
              record.statusDesc ||
              taskStatusOptions.find((item) => item.value === record.status)?.label ||
              record.status
            }}</span>
          </Tag>
          <Progress
            v-else-if="column.key === 'progress'"
            :percent="record.progress ?? 0"
            :status="record.status === 3 ? 'exception' : record.status === 2 ? 'success' : 'normal'"
            size="small"
          />
          <template v-else-if="column.key === 'count'">
            {{ record.resultCount ?? 0 }} / {{ record.imgNum ?? 0 }}
          </template>
          <Space v-else-if="column.key === 'action'" :size="0">
            <Button
              type="link"
              size="small"
              :disabled="detailLoading || busy"
              @click="showDetail(record.id)"
            >
              <span>详情</span>
            </Button>
            <Button type="link" size="small" @click="showResults(record.imgId)">
              <span>图片结果</span>
            </Button>
            <Button
              v-if="record.status === 5"
              type="link"
              size="small"
              :disabled="busy"
              @click="perform('start', [record.id])"
            >
              <span>启动</span>
            </Button>
            <Button
              v-if="allowedStatuses.retry.includes(record.status)"
              type="link"
              size="small"
              :disabled="busy"
              @click="openRetry([record.id])"
            >
              <span>重试</span>
            </Button>
            <Popconfirm
              v-if="[0, 1].includes(record.status)"
              title="确定取消该任务？"
              @confirm="perform('cancel', [record.id])"
            >
              <Button type="link" size="small" danger :disabled="busy">
                <span>取消</span>
              </Button>
            </Popconfirm>
            <Popconfirm
              v-if="![0, 1].includes(record.status)"
              title="确定删除该任务？"
              @confirm="remove(record.id)"
            >
              <Button type="link" size="small" danger :disabled="busy">
                <span>删除</span>
              </Button>
            </Popconfirm>
          </Space>
        </template>
      </Table>
    </Card>
    <Modal v-model:open="detailOpen" title="生图任务详情" :width="850" :footer="null">
      <template v-if="detail">
        <Alert
          v-if="detail.errorMessage"
          type="error"
          :message="detail.errorMessage"
          class="mb-4!"
        />
        <Descriptions bordered :column="2" size="small">
          <DescriptionsItem label="任务 ID">
            <div>{{ detail.id }}</div>
          </DescriptionsItem>
          <DescriptionsItem label="流程任务 KEY">
            <div>{{ detail.businessKey || '-' }}</div>
          </DescriptionsItem>
          <DescriptionsItem label="暂停状态">
            <div>
              {{ detail.pauseFlag === 1 ? '暂停' : detail.pauseFlag === 0 ? '正常' : '-' }}
            </div>
          </DescriptionsItem>
          <DescriptionsItem label="生图 ID">
            <div>{{ detail.imgId }}</div>
          </DescriptionsItem>
          <DescriptionsItem label="状态">
            <div>
              {{
                detail.statusDesc ||
                taskStatusOptions.find((item) => item.value === detail?.status)?.label
              }}
            </div>
          </DescriptionsItem>
          <DescriptionsItem label="模型">
            <div>{{ modelName(detail.modelId) }}</div>
          </DescriptionsItem>
          <DescriptionsItem label="生成数量">
            <div>{{ detail.resultCount ?? 0 }} / {{ detail.imgNum ?? 0 }}</div>
          </DescriptionsItem>
          <DescriptionsItem label="耗时（秒）">
            <div>{{ detail.duration ?? '-' }}</div>
          </DescriptionsItem>
          <DescriptionsItem label="操作类型">
            <div>{{ generateTypes[detail.generateType ?? 0] || '-' }}</div>
          </DescriptionsItem>
          <DescriptionsItem label="来源结果">
            <div>{{ detail.sourceResultId || '-' }}</div>
          </DescriptionsItem>
          <DescriptionsItem label="尺寸 / 比例">
            <div>{{ detail.imageSize || '-' }} / {{ detail.aspectRatio || '-' }}</div>
          </DescriptionsItem>
          <DescriptionsItem label="画质">
            <div>{{ detail.quality || '-' }}</div>
          </DescriptionsItem>
          <DescriptionsItem label="创建时间">
            <div>{{ detail.createTime || '-' }}</div>
          </DescriptionsItem>
          <DescriptionsItem label="开始时间">
            <div>{{ detail.beginTime || '-' }}</div>
          </DescriptionsItem>
          <DescriptionsItem label="完成时间">
            <div>{{ detail.dealTime || '-' }}</div>
          </DescriptionsItem>
          <DescriptionsItem label="操作人 ID">
            <div>{{ detail.userId || '-' }}</div>
          </DescriptionsItem>
          <DescriptionsItem label="进度" :span="2">
            <Progress :percent="detail.progress ?? 0" />
          </DescriptionsItem>
          <DescriptionsItem label="提示词" :span="2">
            <p class="whitespace-pre-wrap">
              {{ detail.prompt || '-' }}
            </p>
          </DescriptionsItem>
          <DescriptionsItem v-if="originalPreview" label="原图" :span="2">
            <Image :src="originalPreview" :width="100" />
          </DescriptionsItem>
          <DescriptionsItem v-if="referencePreviews.length" label="参考图" :span="2">
            <Space wrap>
              <Image
                v-for="(url, index) in referencePreviews"
                :key="index"
                :src="url"
                :width="80"
              />
            </Space>
          </DescriptionsItem>
          <DescriptionsItem v-if="detail.errorDetail" label="错误详情" :span="2">
            <pre class="whitespace-pre-wrap break-all text-sm">{{ detail.errorDetail }}</pre>
          </DescriptionsItem>
        </Descriptions>
        <Button class="mt-4" type="primary" @click="showResults(detail.imgId)">
          <span>查看图片结果</span>
        </Button>
      </template>
    </Modal>
    <Modal
      v-model:open="retryOpen"
      title="重试生图任务"
      :confirm-loading="busy"
      :closable="!busy"
      :mask-closable="!busy"
      :keyboard="!busy"
      :cancel-button-props="{ disabled: busy }"
      :ok-button-props="{ disabled: modelsLoading }"
      @ok="confirmRetry"
    >
      <p class="mb-4">已选择 {{ retryIds.length }} 个任务，仅等待中或失败的任务可以重试。</p>
      <Form :model="{ modelId: retryModelId }" layout="vertical">
        <FormItem label="重试模型">
          <Select
            v-model:value="retryModelId"
            :options="retryModels"
            :loading="modelsLoading"
            :disabled="busy"
            show-search
            option-filter-prop="label"
            allow-clear
            placeholder="沿用各任务原模型"
          />
        </FormItem>
      </Form>
      <p class="text-sm text-muted-foreground">
        不选择模型时沿用各任务原模型；选择后所有选中任务使用该模型重试。
      </p>
    </Modal>
    <ResultModal v-model:open="resultsOpen" :img-id="resultsId" @changed="refresh" />
  </Page>
</template>
