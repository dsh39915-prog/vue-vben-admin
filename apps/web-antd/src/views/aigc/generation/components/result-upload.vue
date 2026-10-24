<script setup lang="ts">
import type { AiImageResultBatch, AiImageSourcePage, WorkflowImage } from '#/api';

import { computed, ref, shallowRef } from 'vue';

import { Alert, Input, message, Modal, Select } from 'ant-design-vue';

import { saveAiImageResultApi, uploadWorkflowImageApi } from '#/api';

const props = defineProps<{
  styleId: string;
  styleNo?: string;
  sourcePage: AiImageSourcePage;
  batches: AiImageResultBatch[];
  initialImgId?: number;
}>();
const emit = defineEmits<{
  busy: [boolean];
  close: [];
  saved: [imgId: number];
}>();
const selectedImgId = ref(props.initialImgId);
const styleNo = ref(props.styleNo ?? '');
const selectedBatch = computed(() =>
  props.batches.find(
    (batch) =>
      batch.imgId === selectedImgId.value &&
      Number.isSafeInteger(batch.imgId) &&
      batch.imgId > 0,
  ),
);
const batchOptions = computed(() =>
  props.batches.map((batch) => ({
    label: batch.name || `生图记录 #${batch.imgId}`,
    value: batch.imgId,
  })),
);
const file = shallowRef<File>();
const uploaded = ref<WorkflowImage>();
const busy = ref(false);
const error = ref('');
function choose(event: Event) {
  if (busy.value) return;
  const input = event.target as HTMLInputElement;
  const selected = input.files?.[0];
  file.value = undefined;
  uploaded.value = undefined;
  error.value = '';
  if (!selected) return;
  if (!selected.type.startsWith('image/') || selected.size === 0) {
    input.value = '';
    message.warning('请选择非空的图片文件');
    return;
  }
  file.value = selected;
}
async function submit() {
  if (busy.value || !file.value || !props.styleId.trim()) return;
  const batch = selectedBatch.value;
  if (!batch) {
    message.warning('请选择图片所属批次');
    return;
  }
  busy.value = true;
  emit('busy', true);
  error.value = '';
  try {
    if (!uploaded.value) {
      const data = await uploadWorkflowImageApi(file.value);
      if (!data?.originalUrl || !data.previewUrl || !data.thumbnailUrl) {
        error.value = '上传未返回完整图片地址，请重试';
        return;
      }
      uploaded.value = data;
    }
    const saved = await saveAiImageResultApi({
      styleId: props.styleId,
      styleNo: styleNo.value.trim(),
      sourcePage: props.sourcePage,
      imgId: batch.imgId,
      originalUrl: uploaded.value.originalUrl,
      previewUrl: uploaded.value.previewUrl,
      thumbnailUrl: uploaded.value.thumbnailUrl,
    });
    if (saved === false) {
      error.value = '图片已上传，保存结果失败，请重试保存';
      return;
    }
    message.success('本地图片已保存');
    emit('saved', batch.imgId);
  } catch {
    error.value = uploaded.value
      ? '图片已上传，保存结果失败，请重试保存'
      : '图片上传失败，请重试';
  } finally {
    busy.value = false;
    emit('busy', false);
  }
}
</script>

<template>
  <Modal
    open
    title="上传本地结果图片"
    ok-text="上传并保存"
    :ok-button-props="{ disabled: !file || !selectedBatch }"
    :confirm-loading="busy"
    :closable="!busy"
    :keyboard="!busy"
    :mask-closable="false"
    :cancel-button-props="{ disabled: busy }"
    @ok="submit"
    @cancel="emit('close')"
  >
    <div class="flex flex-col gap-4 py-4">
      <p>请选择图片所属批次，上传后将加入该批次的结果与历史。</p>
      <label class="flex flex-col gap-2">
        <span>款号</span>
        <Input
          v-model:value="styleNo"
          aria-label="上传图片款号"
          :disabled="busy"
          :readonly="Boolean(props.styleNo?.trim())"
          placeholder="请输入款号"
        />
      </label>
      <div class="flex flex-col gap-2">
        <span>图片批次（必选）</span>
        <Select
          v-model:value="selectedImgId"
          aria-label="上传批次"
          :options="batchOptions"
          :disabled="busy"
          placeholder="请选择图片所属批次"
          show-search
          option-filter-prop="label"
        />
      </div>
      <label class="flex flex-col gap-2">
        <span>本地结果图片</span>
        <input type="file" accept="image/*" :disabled="busy" @change="choose" />
      </label>
      <Alert v-if="error" type="error" :message="error" show-icon />
    </div>
  </Modal>
</template>
