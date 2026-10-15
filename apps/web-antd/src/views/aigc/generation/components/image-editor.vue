<script setup lang="ts">
import type { FormInstance } from 'ant-design-vue';

import type { AiImageSaveParams, AiModelSizeConfig, PromptRecord } from '#/api';

import { computed, nextTick, onUnmounted, reactive, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Form,
  FormItem,
  Image,
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
import { imagePreviewUrls, imageUrls } from '../helpers';

const props = defineProps<{ id?: number; open: boolean }>();
const emit = defineEmits<{ saved: []; 'update:open': [value: boolean] }>();
const { models, modelsLoading, loadModels } = useImageModels();
const loading = ref(false);
const saving = ref(false);
const sizesLoading = ref(false);
const promptsLoading = ref(false);
const formRef = ref<FormInstance>();
const submitStatus = ref<0 | 1>(0);
const sizeConfig = ref<AiModelSizeConfig | null>(null);
const categoryOptions = ref<Array<{ label: string; value: number }>>([]);
const prompts = ref<PromptRecord[]>([]);
const promptPage = ref(1);
const hasMorePrompts = ref(false);
const editor = reactive<AiImageSaveParams>({
  prompt: '',
  num: 1,
  status: 0,
  type: 0,
});
let openRequest = 0;
let sizeRequest = 0;
let promptRequest = 0;
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
const originalPreview = computed(
  () => imagePreviewUrls(editor.originalImg, editor.previewOriginalImg)[0],
);
const referencePreviews = computed(() =>
  imagePreviewUrls(editor.referenceImg, editor.previewReferenceImg),
);
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
  try {
    const data = await getPromptApi(id);
    if (editor.promptId !== id || editor.promptType !== category || !props.open)
      return;
    if (data === null) {
      message.warning('该提示词不存在，请刷新选项');
      return;
    }
    editor.prompt = data.userPrompt ?? '';
    if (data.referenceImg) {
      editor.referenceImg = imageUrls(data.referenceImg).join('\n');
      editor.previewReferenceImg = '';
    }
  } catch {
    /* The request interceptor displays errors. */
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
    if (reset && config?.qualities?.length) {
      editor.quality = config.qualities[0]?.quality;
      changeQuality();
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
  const request = ++openRequest;
  loading.value = true;
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
      goodsCode: data?.goodsCode ?? '',
      businessKey: data?.businessKey ?? '',
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
    });
    categoryOptions.value = categories.map((item) => ({
      label: item.name,
      value: item.id,
    }));
    formRef.value?.clearValidate();
    await Promise.all([loadSizeConfig(false), loadPrompts()]);
  } catch {
    if (request === openRequest) emit('update:open', false);
  } finally {
    if (request === openRequest) loading.value = false;
  }
}
async function submit(status: 0 | 1) {
  if (saving.value || loading.value || sizesLoading.value) return;
  submitStatus.value = status;
  await nextTick();
  try {
    await formRef.value?.validate();
  } catch {
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
  saving.value = true;
  try {
    const data: AiImageSaveParams = {
      ...editor,
      prompt: editor.prompt.trim(),
      goodsCode: editor.goodsCode?.trim(),
      businessKey: editor.businessKey?.trim() || undefined,
      previewOriginalImg: editor.previewOriginalImg?.trim(),
      previewReferenceImg: imageUrls(editor.previewReferenceImg).join(','),
      referenceImg: referenceImages.value.join(','),
      type: editor.num > 1 ? 1 : 0,
      status,
    };
    if (editor.id === undefined) {
      delete data.id;
      await createAiImageApi(data);
    } else await updateAiImageApi({ ...data, id: editor.id });
    message.success(
      status === 0 ? '暂存成功' : '生成任务已提交，可在任务中心查看进度',
    );
    emit('update:open', false);
    emit('saved');
  } catch {
    /* Preserve all entered values on failure. */
  } finally {
    saving.value = false;
  }
}
watch(
  () => [props.open, props.id],
  () => {
    if (props.open) void initialize();
    else {
      openRequest += 1;
      sizeRequest += 1;
      promptRequest += 1;
    }
  },
  { immediate: true },
);
onUnmounted(() => {
  openRequest += 1;
  sizeRequest += 1;
  promptRequest += 1;
});
</script>
<template>
  <Modal
    :open="open"
    :title="id === undefined ? '新建图片生成' : '编辑图片生成'"
    :width="800"
    :mask-closable="false"
    :closable="!saving"
    :keyboard="!saving"
    @cancel="emit('update:open', false)"
  >
    <Alert
      v-if="loading"
      type="info"
      message="正在加载生图参数…"
      class="mb-4"
    />
    <Form
      ref="formRef"
      :model="editor"
      layout="vertical"
      :disabled="loading || saving"
    >
      <FormItem label="商品编码" name="goodsCode">
        <Input v-model:value="editor.goodsCode" placeholder="请输入商品编码" />
      </FormItem>
      <FormItem label="流程任务标识" name="businessKey">
        <Input
          v-model:value="editor.businessKey"
          placeholder="请输入流程任务标识（选填）"
        />
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
          allow-clear
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
        <Input.TextArea
          v-model:value="editor.prompt"
          :rows="5"
          placeholder="输入提示词，或选择模板填入后修改"
        />
      </FormItem>
      <FormItem label="原图地址" name="originalImg">
        <Input
          v-model:value="editor.originalImg"
          placeholder="请输入原图地址"
          @change="editor.previewOriginalImg = ''"
        />
        <Image
          v-if="originalPreview"
          class="mt-2"
          :src="originalPreview"
          :width="90"
        />
      </FormItem>
      <FormItem label="预览原图地址" name="previewOriginalImg">
        <Input
          v-model:value="editor.previewOriginalImg"
          placeholder="选填，留空时使用原图预览"
        />
      </FormItem>
      <FormItem label="参考图地址" name="referenceImg">
        <Input.TextArea
          v-model:value="editor.referenceImg"
          :rows="3"
          placeholder="每行一个参考图地址，也可用逗号分隔"
          @change="editor.previewReferenceImg = ''"
        />
        <Space class="mt-2" wrap>
          <Image
            v-for="(url, index) in referencePreviews"
            :key="index"
            :src="url"
            :width="70"
          />
        </Space>
      </FormItem>
      <FormItem label="预览参考图地址" name="previewReferenceImg">
        <Input.TextArea
          v-model:value="editor.previewReferenceImg"
          :rows="3"
          placeholder="选填，按参考图顺序填写，每行一个地址，也可用逗号分隔"
        />
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
        <InputNumber v-model:value="editor.num" :min="1" :precision="0" />
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
    <template #footer>
      <Space>
        <Button :disabled="saving" @click="emit('update:open', false)">
          <span>取消</span>
        </Button>
        <Button
          :loading="saving && submitStatus === 0"
          :disabled="loading || saving || sizesLoading"
          @click="submit(0)"
        >
          <span>暂存</span>
        </Button>
        <Button
          type="primary"
          :loading="saving && submitStatus === 1"
          :disabled="loading || saving || sizesLoading"
          @click="submit(1)"
        >
          <span>生成图片</span>
        </Button>
      </Space>
    </template>
  </Modal>
</template>
