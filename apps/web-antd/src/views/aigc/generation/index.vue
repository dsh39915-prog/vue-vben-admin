<script setup lang="ts">
import type { Dayjs } from 'dayjs';

import type { AiImagePageParams } from '#/api';

import { onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  Button,
  Card,
  DatePicker,
  Form,
  FormItem,
  Image,
  Input,
  InputNumber,
  Select,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

import { getAiImagePageApi } from '#/api';

import { useImageModels } from '../common/use-image-models';
import { useAigcPage } from '../common/use-page';
import ImageEditor from './components/image-editor.vue';
import ResultModal from './components/result-modal.vue';
import { imagePreviewUrls, sourcePageOptions } from './helpers';

const route = useRoute();
const router = useRouter();
const query = reactive<Omit<AiImagePageParams, 'page' | 'pageSize'>>({});
const timeRange = ref<[Dayjs, Dayjs]>();
const referenceFilter = ref<number>();
const {
  rows,
  loading,
  pagination,
  load,
  search: searchPage,
  change,
} = useAigcPage(getAiImagePageApi, { ...query });
const { modelName, modelOptions, modelsLoading, loadModels } = useImageModels();
const editorOpen = ref(false);
const editingId = ref<number>();
const resultsOpen = ref(false);
const resultsId = ref<number>();
const columns = [
  { title: 'ID', dataIndex: 'id', width: 80 },
  { title: '款号', dataIndex: 'styleNo', width: 180 },
  { title: '原图', key: 'original', width: 110 },
  { title: '参考图', key: 'reference', width: 170 },
  { title: '提示词', dataIndex: 'prompt', ellipsis: true, width: 260 },
  { title: '模型', key: 'model', width: 200 },
  { title: '尺寸 / 画质', key: 'size', width: 180 },
  { title: '数量', dataIndex: 'num', width: 80 },
  { title: '当前结果', key: 'result', width: 170 },
  { title: '状态', key: 'status', width: 100 },
  { title: '创建时间', dataIndex: 'createTime', width: 180 },
  { title: '操作', key: 'action', width: 190, fixed: 'right' as const },
];
function search() {
  return searchPage({
    ...query,
    isImg:
      referenceFilter.value === undefined
        ? undefined
        : referenceFilter.value === 1,
    prompt: query.prompt?.trim() || undefined,
    styleNo: query.styleNo?.trim() || undefined,
    beginTime: timeRange.value?.[0].format('YYYY-MM-DD'),
    endTime: timeRange.value?.[1].format('YYYY-MM-DD'),
  });
}
function reset() {
  for (const key of Object.keys(query) as Array<keyof typeof query>)
    delete query[key];
  timeRange.value = undefined;
  referenceFilter.value = undefined;
  void search();
}
function edit(id?: number) {
  editingId.value = id;
  editorOpen.value = true;
}
function showResults(id: number) {
  resultsId.value = id;
  resultsOpen.value = true;
}
async function refresh() {
  await Promise.all([load(), loadModels()]);
}
onMounted(() => {
  void refresh();
  const id = Number(route.query.imgId);
  if (Number.isInteger(id) && id > 0) showResults(id);
});
</script>
<template>
  <Page title="AI 图片生成" description="新建生图任务、暂存参数和查看生成图片">
    <Card class="mb-4!" :bordered="false">
      <Form :model="query" layout="inline" @finish="search">
        <FormItem label="图片模型">
          <Select
            v-model:value="query.aiModelId"
            :options="modelOptions"
            :loading="modelsLoading"
            allow-clear
            show-search
            option-filter-prop="label"
            placeholder="全部模型"
            style="width: 210px"
          />
        </FormItem>
        <FormItem label="关键词">
          <Input
            v-model:value="query.prompt"
            allow-clear
            placeholder="请输入提示词关键词"
          />
        </FormItem>
        <FormItem label="款号">
          <Input
            v-model:value="query.styleNo"
            allow-clear
            placeholder="请输入款号"
          />
        </FormItem>
        <FormItem label="参考图">
          <Select
            v-model:value="referenceFilter"
            :options="[
              { label: '有参考图', value: 1 },
              { label: '无参考图', value: 0 },
            ]"
            allow-clear
            placeholder="全部"
            style="width: 130px"
          />
        </FormItem>
        <FormItem label="时间范围">
          <DatePicker.RangePicker v-model:value="timeRange" />
        </FormItem>
        <FormItem label="尺寸">
          <Input
            v-model:value="query.size"
            allow-clear
            placeholder="例如 1536x2048"
            style="width: 150px"
          />
        </FormItem>
        <FormItem label="操作人 ID">
          <InputNumber
            v-model:value="query.operatorId"
            :min="1"
            :precision="0"
          />
        </FormItem>
        <FormItem label="来源页面">
          <Select
            v-model:value="query.sourcePage"
            :options="sourcePageOptions"
            allow-clear
            placeholder="全部"
            style="width: 120px"
          />
        </FormItem>
        <FormItem label="审批">
          <Select
            v-model:value="query.approval"
            :options="[
              { label: '不通过', value: 0 },
              { label: '通过', value: 1 },
            ]"
            allow-clear
            placeholder="全部"
            style="width: 120px"
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
    <Card title="生图记录" :bordered="false">
      <template #extra>
        <Space>
          <Button :loading="loading" @click="refresh">
            <span>刷新</span>
          </Button>
          <Button @click="router.push('/task-center')">
            <span>任务中心</span>
          </Button>
          <Button type="primary" @click="edit()">
            <span>新建图片生成</span>
          </Button>
        </Space>
      </template>
      <Table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="pagination"
        :scroll="{ x: 1900 }"
        row-key="id"
        @change="change"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'model'">
            {{ modelName(record.aiModelId) }}
          </template>
          <template v-else-if="column.key === 'original'">
            <Image
              v-if="
                imagePreviewUrls(record.originalImg, record.previewOriginalImg)
                  .length
              "
              :src="
                imagePreviewUrls(
                  record.originalImg,
                  record.previewOriginalImg,
                )[0]
              "
              :width="50"
            />
            <span v-else>-</span>
          </template>
          <template v-else-if="column.key === 'reference'">
            <Space
              v-if="
                imagePreviewUrls(
                  record.referenceImg,
                  record.previewReferenceImg,
                ).length
              "
              :size="4"
              wrap
            >
              <Image
                v-for="(url, index) in imagePreviewUrls(
                  record.referenceImg,
                  record.previewReferenceImg,
                )"
                :key="index"
                :src="url"
                :width="40"
              />
            </Space>
            <span v-else>-</span>
          </template>
          <template v-else-if="column.key === 'size'">
            {{ record.size || '-' }} / {{ record.quality || '-' }}
          </template>
          <Space v-else-if="column.key === 'result'" :size="4">
            <Image
              v-for="result in (record.results || []).slice(0, 3)"
              :key="result.id"
              :src="
                result.thumbnailUrl || result.previewUrl || result.originalUrl
              "
              :preview="{
                src:
                  result.previewUrl ||
                  result.originalUrl ||
                  result.thumbnailUrl ||
                  undefined,
              }"
              :width="40"
            />
            <span>{{ record.results?.length || 0 }} 张</span>
          </Space>
          <Tag
            v-else-if="column.key === 'status'"
            :color="record.status === 0 ? 'default' : 'processing'"
          >
            <span>{{ record.status === 0 ? '暂存' : '已提交' }}</span>
          </Tag>
          <Space v-else-if="column.key === 'action'" :size="0">
            <Button type="link" size="small" @click="edit(record.id)">
              <span>编辑</span>
            </Button>
            <Button type="link" size="small" @click="showResults(record.id)">
              <span>详情 / 结果</span>
            </Button>
          </Space>
        </template>
      </Table>
    </Card>
    <ImageEditor v-model:open="editorOpen" :id="editingId" @saved="load" />
    <ResultModal
      v-model:open="resultsOpen"
      :img-id="resultsId"
      @changed="load"
    />
  </Page>
</template>
