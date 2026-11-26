<script setup lang="ts">
import type { FormInstance } from 'ant-design-vue';

import type { AppInfo, AppRecommendationInput, AppSort } from '#/api';

import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Form,
  FormItem,
  message,
  Modal,
  Radio,
} from 'ant-design-vue';

import { addAppRecommendationApi, getAppInfoDetailsApi } from '#/api';

import { platformOptions, recommendationColumnOptions } from './data';

const props = defineProps<{
  app?: Pick<AppInfo, 'appName' | 'id' | 'platform' | 'sort'>;
  open: boolean;
}>();
const emit = defineEmits<{ added: []; 'update:open': [value: boolean] }>();
const formRef = ref<FormInstance>();
const working = ref(false);
const form = reactive({
  column: 1 as AppRecommendationInput['column'] | undefined,
  platform: undefined as AppRecommendationInput['platform'] | undefined,
  iosVersion: -1 as AppRecommendationInput['iosVersion'],
});
const detectedSort = ref<AppSort>();
const typeLoading = ref(false);
const typeFailed = ref(false);
let typeRequest = 0;
const typeLabel = computed(() => {
  if (detectedSort.value === 1) return '软件';
  if (detectedSort.value === 2) return '游戏';
  return typeLoading.value ? '识别中…' : '未识别';
});
const recommendPlatforms = platformOptions.filter(
  (item) => item.value === 101 || item.value === 102,
);
const versionOptions = [
  { label: '普通推荐', value: -1 },
  { label: '14.5 版本（217IPUA）', value: 1 },
];
const saveDisabled = computed(
  () =>
    working.value ||
    typeLoading.value ||
    typeFailed.value ||
    detectedSort.value === undefined,
);

async function identifyType() {
  const request = ++typeRequest;
  const app = props.app;
  detectedSort.value = undefined;
  typeLoading.value = false;
  typeFailed.value = false;
  if (app?.sort === 1 || app?.sort === 2) {
    detectedSort.value = app.sort;
    return;
  }
  if (!app || !Number.isInteger(app.id) || app.id <= 0) {
    typeFailed.value = true;
    return;
  }
  typeLoading.value = true;
  try {
    const detail = await getAppInfoDetailsApi(app.id);
    if (request !== typeRequest) return;
    if (detail.sort === 1 || detail.sort === 2)
      detectedSort.value = detail.sort;
    else typeFailed.value = true;
  } catch {
    if (request === typeRequest) typeFailed.value = true;
  } finally {
    if (request === typeRequest) typeLoading.value = false;
  }
}
function initialPlatform(platform: number | undefined) {
  if (platform === 102) return 102;
  if (platform === 101 || platform === 103) return 101;
}
function close() {
  if (!working.value) emit('update:open', false);
}
async function save() {
  const app = props.app;
  if (
    saveDisabled.value ||
    !props.open ||
    !app ||
    !Number.isInteger(app.id) ||
    app.id <= 0 ||
    !formRef.value
  )
    return;
  working.value = true;
  try {
    await formRef.value.validate();
    const { column, platform } = form;
    const sort = detectedSort.value;
    if (column === undefined || platform === undefined || sort === undefined)
      return;
    await addAppRecommendationApi({
      id: app.id,
      column,
      platform,
      sort,
      type: 0,
      iosVersion: form.iosVersion,
    });
    if (!props.open || props.app?.id !== app.id) return;
    message.success('应用推荐成功');
    emit('update:open', false);
    emit('added');
  } catch {
    // 接口错误统一提示，保留当前选择以便重试。
  } finally {
    working.value = false;
  }
}
watch(
  () => [props.open, props.app?.id] as const,
  async ([open]) => {
    ++typeRequest;
    if (!open) return;
    Object.assign(form, {
      column: 1,
      platform: initialPlatform(props.app?.platform),
      iosVersion: -1,
    });
    void identifyType();
    await nextTick();
    formRef.value?.clearValidate();
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  ++typeRequest;
});
</script>

<template>
  <Modal
    :open="open"
    :title="`推荐应用：${app?.appName ?? ''}`"
    :width="760"
    :confirm-loading="working"
    :closable="!working"
    :keyboard="!working"
    :mask-closable="false"
    :ok-button-props="{ disabled: saveDisabled }"
    :cancel-button-props="{ disabled: working }"
    ok-text="确认推荐"
    cancel-text="取消"
    @cancel="close"
    @ok="save"
  >
    <p class="text-muted-foreground mb-4">
      应用 ID：{{ app?.id }} · 应用类型：{{ typeLabel }}
    </p>
    <Alert
      v-if="typeFailed"
      class="mb-4"
      message="无法识别应用类型，请重试"
      type="error"
      show-icon
    >
      <template #action>
        <Button size="small" :disabled="working" @click="identifyType">
          重新识别
        </Button>
      </template>
    </Alert>
    <Form
      ref="formRef"
      name="app-recommendation"
      :model="form"
      :disabled="working"
      layout="vertical"
    >
      <FormItem
        label="推荐版本"
        name="iosVersion"
        :rules="[{ required: true, message: '请选择推荐版本' }]"
      >
        <Radio.Group
          v-model:value="form.iosVersion"
          class="recommendation-options"
          data-recommendation-field="iosVersion"
          :options="versionOptions"
          option-type="button"
          button-style="solid"
        />
      </FormItem>
      <FormItem
        label="运行平台"
        name="platform"
        :rules="[{ required: true, message: '请选择运行平台' }]"
      >
        <Radio.Group
          v-model:value="form.platform"
          class="recommendation-options"
          data-recommendation-field="platform"
          :options="recommendPlatforms"
          option-type="button"
          button-style="solid"
        />
      </FormItem>
      <FormItem
        label="推荐栏目"
        name="column"
        :rules="[{ required: true, message: '请选择推荐栏目' }]"
      >
        <Radio.Group
          v-model:value="form.column"
          class="recommendation-options"
          data-recommendation-field="column"
          :options="recommendationColumnOptions"
          option-type="button"
          button-style="solid"
        />
      </FormItem>
    </Form>
  </Modal>
</template>

<style scoped>
.recommendation-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.recommendation-options :deep(.ant-radio-button-wrapper) {
  border-inline-start-width: 1px;
  border-radius: 4px;
}

.recommendation-options :deep(.ant-radio-button-wrapper::before) {
  display: none;
}
</style>
