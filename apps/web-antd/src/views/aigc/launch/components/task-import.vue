<script setup lang="ts">
import { ref, shallowRef } from 'vue';

import { Alert, message, Modal } from 'ant-design-vue';

import { importLaunchTasksApi } from '#/api';

const emit = defineEmits<{
  busy: [boolean];
  imported: [];
  close: [];
}>();
const file = shallowRef<File>();
const importing = ref(false);
const completed = ref(false);
const result = ref('');
const error = ref('');

function chooseFile(event: Event) {
  if (importing.value || completed.value) return;
  const input = event.target as HTMLInputElement;
  const selected = input.files?.[0];
  file.value = undefined;
  error.value = '';
  if (!selected) return;
  if (!/\.(xlsx|xls)$/i.test(selected.name)) {
    input.value = '';
    message.warning('请选择 .xlsx 或 .xls 格式的 Excel 文件');
    return;
  }
  if (selected.size === 0) {
    input.value = '';
    message.warning('不能导入空文件');
    return;
  }
  file.value = selected;
}
async function submit() {
  if (importing.value) return;
  if (completed.value) {
    emit('close');
    return;
  }
  if (!file.value) return;
  importing.value = true;
  error.value = '';
  emit('busy', true);
  try {
    const data = await importLaunchTasksApi(file.value);
    completed.value = true;
    emit('imported');
    if (typeof data === 'string' && data.trim()) result.value = data;
    else
      error.value =
        '导入请求已完成，但未返回有效说明，请核对任务列表后再操作。';
  } catch {
    error.value = '导入失败，请检查文件内容及接口错误提示后重试。';
  } finally {
    importing.value = false;
    emit('busy', false);
  }
}
</script>

<template>
  <Modal
    open
    title="导入上新任务"
    :width="600"
    :confirm-loading="importing"
    :ok-button-props="{ disabled: !file && !completed }"
    :closable="!importing"
    :keyboard="!importing"
    :mask-closable="false"
    :cancel-button-props="{ disabled: importing }"
    :ok-text="completed ? '完成' : '开始导入'"
    cancel-text="关闭"
    @ok="submit"
    @cancel="emit('close')"
  >
    <div class="flex flex-col gap-4 py-4">
      <Alert
        type="info"
        message="请使用当前上新任务 Excel 模板"
        description="支持 .xlsx、.xls 文件，请保留模板表头和列顺序，选择文件后点击开始导入。"
        show-icon
      />
      <label class="flex flex-col gap-2">
        <span>任务 Excel 文件</span>
        <input
          type="file"
          accept=".xlsx,.xls"
          :disabled="importing || completed"
          @change="chooseFile"
        />
      </label>
      <Alert v-if="result" type="success" :message="result" show-icon />
      <Alert
        v-if="error"
        :type="completed ? 'warning' : 'error'"
        :message="error"
        show-icon
      />
    </div>
  </Modal>
</template>
