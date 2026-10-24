<script setup lang="ts">
import type { FormInstance } from 'ant-design-vue';

import type {
  AiImageFormValues,
  AiImageSaveParams,
  AiModelSizeConfig,
  PromptRecord,
  WorkflowImage,
} from '#/api';

import { computed, nextTick, onUnmounted, reactive, ref, watch } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router';

import {
  Alert,
  Button,
  Form,
  FormItem,
  FormItemRest,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Space,
} from 'ant-design-vue';

import {
  createAiImageApi,
  getAiImageApi,
  getAiModelSizeConfigApi,
  getPromptApi,
  getPromptCategoryListApi,
  getPromptPageApi,
  updateAiImageApi,
} from '#/api';

import { useImageModels } from '../../common/use-image-models';
import { imageUrls } from '../helpers';
import SourceImages from './source-images.vue';

const props = defineProps<{
  id?: number;
  open: boolean;
  embedded?: boolean;
  generationLabel?: '动作图' | '模特图';
  styleId?: string;
  styleNo?: string;
  disabled?: boolean;
  draftValue?: Partial<AiImageFormValues>;
}>();
const emit = defineEmits<{
  saved: [];
  busy: [boolean];
  draftChange: [AiImageFormValues];
  'update:open': [value: boolean];
}>();
const { models, modelsLoading, loadModels } = useImageModels();
const loading = ref(false);
const initializationFailed = ref(false);
const saving = ref(false);
const uploads = reactive({ original: false, reference: false });
const uploading = computed(() => uploads.original || uploads.reference);
const locked = computed(
  () =>
    loading.value ||
    initializationFailed.value ||
    saving.value ||
    uploading.value ||
    props.disabled,
);
const sizesLoading = ref(false);
const promptsLoading = ref(false);
const promptApplications = ref(0);
const formRef = ref<FormInstance>();
const submitStatus = ref<0 | 1>(0);
const sizeConfig = ref<AiModelSizeConfig | null>(null);
const categoryOptions = ref<Array<{ label: string; value: number }>>([]);
const prompts = ref<PromptRecord[]>([]);
const promptPage = ref(1);
const hasMorePrompts = ref(false);
const editor = reactive<AiImageFormValues>({
  prompt: '',
  num: 1,
  status: 0,
  type: 0,
});
let openRequest = 0;
let sizeRequest = 0;
let promptRequest = 0;
let appliedPromptRequest = 0;
const modelOptions = computed(() =>
  models.value.map((item) => ({
    label: `${item.modelName}${item.status !== 1 ? '（已禁用）' : ''}`,
    value: item.id,
    disabled: item.status !== 1,
  })),
);
const promptOptions = computed(() => {
  const options = prompts.value.map((item) => ({
    label: item.name,
    value: item.id,
  }));
  if (
    editor.promptId !== undefined &&
    !options.some((item) => item.value === editor.promptId)
  )
    options.push({
      label: `提示词 #${editor.promptId}`,
      value: editor.promptId,
    });
  return options;
});
const qualityOptions = computed(() =>
  (sizeConfig.value?.qualities ?? []).map((item) => ({
    label: item.quality,
    value: item.quality,
  })),
);
const availableSizes = computed(
  () =>
    sizeConfig.value?.qualities?.find((item) => item.quality === editor.quality)
      ?.sizes ?? [],
);
const sizeOptions = computed(() =>
  availableSizes.value.map((item) => ({
    label: `${item.aspectRatio} · ${item.size}`,
    value: item.size,
  })),
);
const referenceImages = computed(() => imageUrls(editor.referenceImg));
function sourceImages(
  original?: string,
  preview?: string,
  thumbnail?: string,
): WorkflowImage[] {
  const originals = imageUrls(original);
  const previews = imageUrls(preview);
  const thumbnails = imageUrls(thumbnail);
  return Array.from(
    { length: Math.max(originals.length, previews.length, thumbnails.length) },
    (_, index) => ({
      originalUrl: originals[index] || '',
      previewUrl:
        previews[index] || originals[index] || thumbnails[index] || '',
      thumbnailUrl:
        thumbnails[index] || previews[index] || originals[index] || '',
    }),
  );
}
const originalSources = computed({
  get: () =>
    sourceImages(
      editor.originalImg,
      editor.previewOriginalImg,
      editor.smallOriginalImg,
    ),
  set: (images: WorkflowImage[]) => {
    editor.originalImg = images.map((image) => image.originalUrl).join(',');
    editor.previewOriginalImg = images
      .map((image) => image.previewUrl)
      .join(',');
    editor.smallOriginalImg = images
      .map((image) => image.thumbnailUrl)
      .join(',');
  },
});
const referenceSources = computed({
  get: () =>
    sourceImages(
      editor.referenceImg,
      editor.previewReferenceImg,
      editor.smallReferenceImg,
    ),
  set: (images: WorkflowImage[]) => {
    appliedPromptRequest += 1;
    editor.referenceImg = images.map((image) => image.originalUrl).join(',');
    editor.previewReferenceImg = images
      .map((image) => image.previewUrl)
      .join(',');
    editor.smallReferenceImg = images
      .map((image) => image.thumbnailUrl)
      .join(',');
  },
});
const requiredRule = (label: string) => [
  { required: submitStatus.value === 1, message: `请输入${label}` },
];

async function loadPrompts(more = false) {
  const request = ++promptRequest;
  const page = more ? promptPage.value + 1 : 1;
  if (!more) {
    prompts.value = [];
    hasMorePrompts.value = false;
  }
  promptsLoading.value = true;
  try {
    const data = await getPromptPageApi({
      categoryId: editor.promptType,
      page,
      pageSize: 100,
    });
    if (request !== promptRequest) return;
    prompts.value = more ? [...prompts.value, ...data.records] : data.records;
    promptPage.value = page;
    hasMorePrompts.value =
      data.records.length > 0 && prompts.value.length < data.total;
  } catch {
    /* The request interceptor displays errors. */
  } finally {
    if (request === promptRequest) promptsLoading.value = false;
  }
}
async function changeCategory() {
  editor.promptId = undefined;
  await loadPrompts();
}
async function applyPrompt() {
  if (editor.promptId === undefined) return;
  const id = editor.promptId;
  const category = editor.promptType;
  const request = ++appliedPromptRequest;
  promptApplications.value += 1;
  try {
    const data = await getPromptApi(id);
    if (
      request !== appliedPromptRequest ||
      editor.promptId !== id ||
      editor.promptType !== category ||
      !props.open
    )
      return;
    if (data === null) {
      message.warning('该提示词不存在，请刷新选项');
      return;
    }
    editor.prompt = data.userPrompt ?? '';
    if (data.referenceImg) {
      editor.referenceImg = imageUrls(data.referenceImg).join('\n');
      editor.previewReferenceImg = '';
      editor.smallReferenceImg = '';
    }
  } catch {
    /* The request interceptor displays errors. */
  } finally {
    promptApplications.value -= 1;
  }
}
async function loadSizeConfig(reset = true) {
  const request = ++sizeRequest;
  sizeConfig.value = null;
  sizesLoading.value = false;
  if (reset) {
    editor.size = undefined;
    editor.quality = undefined;
    editor.aspectRatio = undefined;
  }
  const model = models.value.find((item) => item.id === editor.aiModelId);
  if (!model) return;
  sizesLoading.value = true;
  try {
    const config = await getAiModelSizeConfigApi(model.modelCode);
    if (request !== sizeRequest) return;
    sizeConfig.value = config;
    if (config?.qualities?.length) {
      if (!editor.quality) editor.quality = config.qualities[0]?.quality;
      if (!editor.size) editor.size = availableSizes.value[0]?.size;
      if (!editor.aspectRatio) changeSize();
    }
  } catch {
    /* Manual size entry remains available if configuration fails. */
  } finally {
    if (request === sizeRequest) sizesLoading.value = false;
  }
}
function changeQuality() {
  const size = availableSizes.value[0];
  editor.size = size?.size;
  editor.aspectRatio = size?.aspectRatio;
}
function changeSize() {
  editor.aspectRatio = availableSizes.value.find(
    (item) => item.size === editor.size,
  )?.aspectRatio;
}
async function initialize() {
  appliedPromptRequest += 1;
  const request = ++openRequest;
  const draft =
    props.embedded && props.draftValue ? { ...props.draftValue } : undefined;
  loading.value = true;
  initializationFailed.value = false;
  sizeConfig.value = null;
  submitStatus.value = 0;
  try {
    const [data, categories] = await Promise.all([
      props.id === undefined
        ? Promise.resolve(undefined)
        : getAiImageApi(props.id),
      getPromptCategoryListApi(),
      loadModels(),
    ]);
    if (request !== openRequest || !props.open) return;
    if (data === null) {
      message.warning('该生图记录不存在');
      emit('update:open', false);
      return;
    }
    Object.assign(editor, {
      id: data?.id,
      styleNo: data?.styleNo ?? props.styleNo ?? '',
      styleId: data?.styleId ?? props.styleId ?? '',
      sourcePage: data?.sourcePage,
      prompt: data?.prompt ?? '',
      num: data?.num ?? 1,
      aiModelId: data?.aiModelId ?? undefined,
      promptId: data?.promptId ?? undefined,
      promptType: data?.promptType ?? undefined,
      originalImg: data?.originalImg ?? '',
      previewOriginalImg: data?.previewOriginalImg ?? '',
      previewReferenceImg: imageUrls(data?.previewReferenceImg).join('\n'),
      referenceImg: imageUrls(data?.referenceImg).join('\n'),
      smallOriginalImg: data?.smallOriginalImg ?? '',
      smallReferenceImg: data?.smallReferenceImg ?? '',
      size: data?.size ?? '',
      quality: data?.quality ?? '',
      aspectRatio: data?.aspectRatio ?? '',
      status: data?.status ?? 0,
      type: (data?.num ?? 1) > 1 ? 1 : 0,
      ...draft,
    });
    if (editor.aiModelId === undefined || editor.aiModelId === null)
      editor.aiModelId = models.value.find((model) => model.status === 1)?.id;
    if (props.embedded) {
      editor.id = undefined;
      editor.styleId = props.styleId;
      editor.styleNo = props.styleNo;
    }
    categoryOptions.value = categories.map((item) => ({
      label: item.name,
      value: item.id,
    }));
    formRef.value?.clearValidate();
    await Promise.all([loadSizeConfig(false), loadPrompts()]);
  } catch {
    if (request === openRequest) initializationFailed.value = true;
    if (request === openRequest && !props.embedded) emit('update:open', false);
  } finally {
    if (request === openRequest) loading.value = false;
  }
}
async function submit(status: 0 | 1) {
  if (locked.value || sizesLoading.value) return;
  submitStatus.value = status;
  await nextTick();
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  const styleNo = editor.styleNo?.trim();
  if (!styleNo) {
    message.warning('请输入款号');
    return;
  }
  if (
    status === 1 &&
    !models.value.some(
      (item) => item.id === editor.aiModelId && item.status === 1,
    )
  ) {
    message.warning('请选择已启用的图片模型');
    return;
  }
  if (saving.value || uploading.value) return;
  const num = editor.num;
  if (num === null) return;
  saving.value = true;
  try {
    const data: AiImageSaveParams = {
      ...editor,
      num,
      prompt: editor.prompt.trim(),
      styleNo,
      styleId: editor.styleId?.trim() || undefined,
      sourcePage: props.embedded
        ? props.generationLabel === '动作图'
          ? 6
          : 5
        : editor.id === undefined
          ? num > 1
            ? 1
            : 0
          : (editor.sourcePage ?? (num > 1 ? 1 : 0)),
      previewOriginalImg: editor.previewOriginalImg?.trim(),
      previewReferenceImg: imageUrls(editor.previewReferenceImg).join(','),
      referenceImg: referenceImages.value.join(','),
      type: num > 1 ? 1 : 0,
      status,
    };
    if (editor.id === undefined) {
      delete data.id;
      await createAiImageApi(data);
    } else await updateAiImageApi({ ...data, id: editor.id });
    message.success(
      status === 0 ? '暂存成功' : '生成任务已提交，可在任务中心查看进度',
    );
    if (!props.embedded) emit('update:open', false);
    emit('saved');
  } catch {
    /* Preserve all entered values on failure. */
  } finally {
    saving.value = false;
  }
}
function addImages(target: 'original' | 'reference', images: WorkflowImage[]) {
  if (locked.value) return false;
  const sources = target === 'original' ? originalSources : referenceSources;
  const merged = [...sources.value];
  for (const image of images) {
    if (!merged.some((item) => item.originalUrl === image.originalUrl))
      merged.push(image);
  }
  sources.value = merged;
  return true;
}
defineExpose({ addImages });
watch(
  () =>
    loading.value ||
    saving.value ||
    uploading.value ||
    sizesLoading.value ||
    promptsLoading.value ||
    promptApplications.value > 0,
  (value) => emit('busy', value),
  { flush: 'sync' },
);
watch(
  editor,
  () => {
    if (props.embedded) emit('draftChange', { ...editor });
  },
  { deep: true, flush: 'sync' },
);
watch(
  () => [props.open, props.id],
  () => {
    if (props.open) void initialize();
    else {
      openRequest += 1;
      sizeRequest += 1;
      promptRequest += 1;
      appliedPromptRequest += 1;
    }
  },
  { immediate: true },
);
function guardNavigation() {
  if (props.open && (saving.value || uploading.value)) {
    message.warning('图片正在上传或保存，请完成后再离开');
    return false;
  }
  return true;
}
onBeforeRouteLeave(guardNavigation);
onBeforeRouteUpdate(guardNavigation);
onUnmounted(() => {
  emit('busy', false);
  openRequest += 1;
  sizeRequest += 1;
  promptRequest += 1;
  appliedPromptRequest += 1;
});
</script>
<template>
  <component
    :is="embedded ? 'div' : Modal"
    :class="{ 'embedded-image-editor': embedded }"
    v-bind="
      embedded
        ? {}
        : {
            open,
            title: id === undefined ? '新建图片生成' : '编辑图片生成',
            width: 800,
            maskClosable: false,
            closable: !saving && !uploading,
            keyboard: !saving && !uploading,
          }
    "
    @cancel="!saving && !uploading && emit('update:open', false)"
  >
    <Alert
      v-if="loading"
      type="info"
      message="正在加载生图参数…"
      class="mb-4"
    />
    <Alert
      v-if="embedded && initializationFailed"
      type="error"
      message="生图参数加载失败，请重试"
      class="mb-4!"
    >
      <template #action>
        <Button @click="initialize">
          <span>重新加载参数</span>
        </Button>
      </template>
    </Alert>
    <Form ref="formRef" :model="editor" layout="vertical" :disabled="locked">
      <FormItem
        v-if="!embedded"
        label="款号"
        name="styleNo"
        :rules="[{ required: true, whitespace: true, message: '请输入款号' }]"
      >
        <Input v-model:value="editor.styleNo" placeholder="请输入款号" />
      </FormItem>
      <FormItem v-if="!embedded" label="款式 ID" name="styleId">
        <Input
          v-model:value="editor.styleId"
          placeholder="请输入款式 ID（选填）"
        />
      </FormItem>
      <FormItem v-if="embedded" label="原图区域" name="originalImg">
        <SourceImages
          v-model="originalSources"
          label="原图"
          multiple
          :disabled="locked"
          @busy="uploads.original = $event"
        />
        <div class="text-muted-foreground mt-2 text-xs">
          可从素材池加入或本地上传多张原图，按显示顺序参与生成。
        </div>
      </FormItem>
      <FormItem v-if="embedded" label="参考图区域" name="referenceImg">
        <SourceImages
          v-model="referenceSources"
          multiple
          :disabled="locked"
          @busy="uploads.reference = $event"
        />
        <div class="text-muted-foreground mt-2 text-xs">
          参考图按显示顺序参与生成，可前后移动调整。
        </div>
      </FormItem>
      <FormItem
        label="图片模型"
        name="aiModelId"
        :rules="requiredRule('图片模型')"
      >
        <Select
          v-model:value="editor.aiModelId"
          :options="modelOptions"
          :loading="modelsLoading"
          show-search
          option-filter-prop="label"
          placeholder="请选择图片模型"
          @change="loadSizeConfig()"
        />
      </FormItem>
      <FormItem
        label="提示词"
        name="prompt"
        :rules="[
          {
            required: submitStatus === 1,
            whitespace: true,
            message: '请输入提示词',
          },
        ]"
      >
        <FormItemRest>
          <Space class="mb-4!" wrap>
            <Select
              v-model:value="editor.promptType"
              :options="categoryOptions"
              allow-clear
              placeholder="提示词类别"
              style="width: 180px"
              @change="changeCategory"
            />
            <Select
              v-model:value="editor.promptId"
              :options="promptOptions"
              :loading="promptsLoading"
              allow-clear
              show-search
              option-filter-prop="label"
              placeholder="选择提示词模板"
              style="width: 280px"
              @change="applyPrompt"
            />
            <Button
              v-if="hasMorePrompts"
              :loading="promptsLoading"
              @click="loadPrompts(true)"
            >
              <span>加载更多提示词</span>
            </Button>
          </Space>
        </FormItemRest>
        <Input.TextArea
          v-model:value="editor.prompt"
          :rows="5"
          placeholder="输入提示词，或选择模板填入后修改"
        />
      </FormItem>
      <FormItem v-if="!embedded" label="原图区域" name="originalImg">
        <SourceImages
          v-model="originalSources"
          :disabled="locked"
          @busy="uploads.original = $event"
        />
      </FormItem>
      <FormItem v-if="!embedded" label="参考图区域" name="referenceImg">
        <SourceImages
          v-model="referenceSources"
          multiple
          :disabled="locked"
          @busy="uploads.reference = $event"
        />
        <div class="text-muted-foreground mt-2 text-xs">
          参考图按显示顺序参与生成，可前后移动调整。
        </div>
      </FormItem>
      <FormItem
        label="生成数量"
        name="num"
        :rules="[
          {
            required: true,
            type: 'number',
            min: 1,
            message: '生成数量至少为 1',
          },
        ]"
      >
        <InputNumber
          :value="editor.num ?? undefined"
          :min="1"
          :precision="0"
          @change="editor.num = typeof $event === 'number' ? $event : null"
        />
      </FormItem>
      <FormItem label="画质" name="quality">
        <Select
          v-if="qualityOptions.length"
          v-model:value="editor.quality"
          :options="qualityOptions"
          @change="changeQuality"
        />
        <Input
          v-else
          v-model:value="editor.quality"
          placeholder="请输入模型支持的画质，例如 2K"
        />
      </FormItem>
      <FormItem label="图片尺寸" name="size" :rules="requiredRule('图片尺寸')">
        <Select
          v-if="sizeOptions.length"
          v-model:value="editor.size"
          :options="sizeOptions"
          :loading="sizesLoading"
          @change="changeSize"
        />
        <Input
          v-else
          v-model:value="editor.size"
          placeholder="请输入模型支持的尺寸，例如 1536x2048"
        />
      </FormItem>
      <FormItem label="图片比例" name="aspectRatio">
        <Input
          v-model:value="editor.aspectRatio"
          :disabled="sizeOptions.length > 0"
          placeholder="请输入图片比例，例如 3:4"
        />
      </FormItem>
    </Form>
    <div v-if="embedded" class="flex flex-wrap justify-end gap-2">
      <Button
        type="primary"
        :disabled="locked || sizesLoading"
        :loading="saving && submitStatus === 1"
        @click="submit(1)"
      >
        <span>立即生成（{{ generationLabel || '模特图' }}）</span>
      </Button>
    </div>
    <template #footer>
      <Space>
        <Button
          :disabled="saving || uploading"
          @click="emit('update:open', false)"
        >
          <span>取消</span>
        </Button>
        <Button
          :loading="saving && submitStatus === 0"
          :disabled="loading || saving || sizesLoading || uploading"
          @click="submit(0)"
        >
          <span>暂存</span>
        </Button>
        <Button
          type="primary"
          :loading="saving && submitStatus === 1"
          :disabled="loading || saving || sizesLoading || uploading"
          @click="submit(1)"
        >
          <span>生成图片</span>
        </Button>
      </Space>
    </template>
  </component>
</template>

<style scoped>
.embedded-image-editor :deep(.ant-form) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 16px;
}
.embedded-image-editor :deep(.ant-form-item:nth-child(-n + 4)) {
  grid-column: 1 / -1;
}
.embedded-image-editor :deep(.ant-form-item) {
  min-width: 0;
  margin-bottom: 16px;
}
@media (max-width: 640px) {
  .embedded-image-editor :deep(.ant-form) {
    grid-template-columns: minmax(0, 1fr);
  }
}
.embedded-image-editor :deep(.ant-space),
.embedded-image-editor :deep(.ant-space-item),
.embedded-image-editor :deep(.ant-select) {
  max-width: 100%;
}
</style>
