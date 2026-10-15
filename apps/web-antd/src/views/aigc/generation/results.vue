<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  Button,
  Card,
  Form,
  FormItem,
  Image,
  Input,
  Select,
  Space,
  Table,
  TabPane,
  Tabs,
} from 'ant-design-vue';

import { getAiImagePageApi } from '#/api';

import { useImageModels } from '../common/use-image-models';
import { useAigcPage } from '../common/use-page';
import BusinessResults from './components/business-results.vue';
import ResultModal from './components/result-modal.vue';

const route = useRoute();
const routeBusinessKey = computed(() =>
  route.name === 'ImageGenerationResults' &&
  typeof route.query.businessKey === 'string'
    ? route.query.businessKey.trim()
    : '',
);
const activeTab = ref(routeBusinessKey.value ? 'business' : 'all');
watch(routeBusinessKey, (key) => {
  if (key) activeTab.value = 'business';
});
const query = reactive({
  prompt: '',
  aiModelId: undefined as number | undefined,
});
const {
  rows,
  loading,
  pagination,
  load,
  search: searchPage,
  change,
} = useAigcPage(getAiImagePageApi, { ...query });
const { loadModels, modelOptions, modelName } = useImageModels();
const resultsOpen = ref(false);
const imgId = ref<number>();
const columns = [
  { title: '生图 ID', dataIndex: 'id', width: 100 },
  { title: '商品编码', dataIndex: 'goodsCode', width: 180 },
  { title: '模型', key: 'model', width: 220 },
  { title: '提示词', dataIndex: 'prompt', ellipsis: true, width: 300 },
  { title: '当前图片', key: 'results', width: 290 },
  { title: '创建时间', dataIndex: 'createTime', width: 180 },
  { title: '操作', key: 'action', fixed: 'right' as const, width: 140 },
];
function search() {
  return searchPage({ ...query, prompt: query.prompt.trim() });
}
function reset() {
  query.prompt = '';
  query.aiModelId = undefined;
  void search();
}
function showResults(id: number) {
  imgId.value = id;
  resultsOpen.value = true;
}
watch(
  activeTab,
  (tab) => {
    if (tab === 'all') {
      void load();
      void loadModels();
    }
  },
  { immediate: true },
);
</script>
<template>
  <Page
    title="AI 图片生成结果"
    description="查看生成图片、历史版本，或提交单张重新生成和材质增强"
  >
    <Tabs v-model:active-key="activeTab">
      <TabPane key="all" tab="全部结果">
        <Card class="mb-4!" :bordered="false">
          <Form :model="query" layout="inline" @finish="search">
            <FormItem label="图片模型">
              <Select
                v-model:value="query.aiModelId"
                :options="modelOptions"
                allow-clear
                show-search
                option-filter-prop="label"
                placeholder="全部模型"
                style="width: 220px"
              />
            </FormItem>
            <FormItem label="关键词">
              <Input
                v-model:value="query.prompt"
                allow-clear
                placeholder="请输入提示词关键词"
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
        <Card title="生成结果" :bordered="false">
          <template #extra>
            <Button :loading="loading" @click="load">
              <span>刷新</span>
            </Button>
          </template>
          <Table
            :columns="columns"
            :data-source="rows"
            :loading="loading"
            :pagination="pagination"
            :scroll="{ x: 1410 }"
            row-key="id"
            @change="change"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'model'">
                {{ modelName(record.aiModelId) }}
              </template>
              <Space v-else-if="column.key === 'results'" :size="4">
                <Image
                  v-for="result in (record.results || []).slice(0, 4)"
                  :key="result.id"
                  :src="
                    result.thumbnailUrl ||
                    result.previewUrl ||
                    result.originalUrl
                  "
                  :preview="{
                    src:
                      result.previewUrl ||
                      result.originalUrl ||
                      result.thumbnailUrl ||
                      undefined,
                  }"
                  :width="50"
                />
                <span>{{ record.results?.length || 0 }} 张</span>
              </Space>
              <Button
                v-else-if="column.key === 'action'"
                type="link"
                @click="showResults(record.id)"
              >
                <span>结果 / 历史</span>
              </Button>
            </template>
          </Table>
        </Card>
      </TabPane>
      <TabPane key="business" tab="按流程任务查询">
        <BusinessResults
          v-if="activeTab === 'business'"
          :business-key="routeBusinessKey"
        />
      </TabPane>
    </Tabs>
    <ResultModal v-model:open="resultsOpen" :img-id="imgId" @changed="load" />
  </Page>
</template>
