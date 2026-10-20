<script setup lang="ts">
import type { FormInstance } from 'ant-design-vue';

import type { LaunchTaskUpdateParams } from '#/api';

import { onMounted, onUnmounted, reactive, ref } from 'vue';

import {
  Alert,
  Button,
  DatePicker,
  Divider,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Select,
  Spin,
  Tag,
} from 'ant-design-vue';

import { getLaunchTaskApi, updateLaunchTaskApi } from '#/api';

import {
  flowStatusOptions,
  optionLabel,
  overdueOptions,
  statusColor,
  visualLevelOptions,
} from '../helpers';

const props = defineProps<{ id: number }>();
const emit = defineEmits<{ saved: []; close: [] }>();
const saving = ref(false);
const loading = ref(true);
const loadFailed = ref(false);
const formRef = ref<FormInstance>();
const editor = reactive<
  Omit<
    LaunchTaskUpdateParams,
    'id' | 'launchTime' | 'productDeadline' | 'visualLevel'
  > & {
    launchTime?: string;
    productDeadline?: string;
    visualLevel?: number;
    category: string;
    mainPlatform: string;
    productSeason: string;
    styleNo: string;
  }
>({ productSeason: '', category: '', mainPlatform: '', styleNo: '' });
let latestRequest = 0;
async function load() {
  const request = ++latestRequest;
  loading.value = true;
  loadFailed.value = false;
  try {
    const data = await getLaunchTaskApi(props.id);
    if (request !== latestRequest) return;
    if (!data) {
      message.warning('该上新任务不存在，请刷新列表');
      emit('close');
      return;
    }
    Object.assign(editor, {
      productSeason: data.productSeason ?? '',
      category: data.category ?? '',
      mainPlatform: data.mainPlatform ?? '',
      styleNo: data.styleNo,
      visualLevel: data.visualLevel,
      flowStatus: data.flowStatus,
      launchTime: data.launchTime ?? undefined,
      productDeadline: data.productDeadline ?? undefined,
      dateOverdueStatus: data.dateOverdueStatus,
      dateOverdueDesc: data.dateOverdueDesc ?? '',
      timeOverdueStatus: data.timeOverdueStatus,
      timeOverdueDesc: data.timeOverdueDesc ?? '',
    });
  } catch {
    if (request === latestRequest) loadFailed.value = true;
  } finally {
    if (request === latestRequest) loading.value = false;
  }
}
async function save() {
  if (saving.value || loading.value || loadFailed.value) return;
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  saving.value = true;
  const business = {
    productSeason: editor.productSeason.trim(),
    category: editor.category.trim(),
    mainPlatform: editor.mainPlatform.trim(),
    visualLevel: editor.visualLevel,
    launchTime: editor.launchTime || undefined,
    productDeadline: editor.productDeadline || undefined,
  };
  try {
    // Detail responses omit extInfo and creation-only fields; do not overwrite them.
    await updateLaunchTaskApi({
      ...business,
      id: props.id,
      launchTime: editor.launchTime || null,
      productDeadline: editor.productDeadline || null,
      visualLevel: editor.visualLevel ?? null,
      dateOverdueStatus: editor.dateOverdueStatus,
      dateOverdueDesc: editor.dateOverdueDesc,
      timeOverdueStatus: editor.timeOverdueStatus,
      timeOverdueDesc: editor.timeOverdueDesc,
    });
    message.success('保存成功');
    emit('saved');
    emit('close');
  } catch {
    /* Keep the form available for retry. */
  } finally {
    saving.value = false;
  }
}
onMounted(load);
onUnmounted(() => {
  latestRequest += 1;
});
</script>
<template>
  <Modal
    open
    title="编辑上新任务"
    :width="1000"
    :body-style="{ maxHeight: '70vh', overflowY: 'auto' }"
    :confirm-loading="saving"
    :ok-button-props="{ disabled: loading || loadFailed }"
    :closable="!saving"
    :keyboard="!saving"
    :mask-closable="false"
    :cancel-button-props="{ disabled: saving }"
    ok-text="保存"
    cancel-text="取消"
    @ok="save"
    @cancel="emit('close')"
  >
    <Alert
      v-if="loadFailed"
      type="error"
      message="任务信息加载失败，请重试"
      class="mb-4!"
    >
      <template #action>
        <Button size="small" @click="load"><span>重试</span></Button>
      </template>
    </Alert>
    <Spin :spinning="loading">
      <Form
        ref="formRef"
        :model="editor"
        :disabled="saving || loading || loadFailed"
        layout="vertical"
      >
        <div class="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <FormItem
            label="款号"
            name="styleNo"
            :rules="[
              { required: true, whitespace: true, message: '请输入款号' },
            ]"
          >
            <Input
              v-model:value="editor.styleNo"
              disabled
              placeholder="请输入款号"
            />
          </FormItem>
          <FormItem
            label="开发年份季节"
            name="productSeason"
            :rules="[
              {
                required: true,
                whitespace: true,
                message: '请输入开发年份季节',
              },
            ]"
          >
            <Input
              v-model:value="editor.productSeason"
              placeholder="例如：2026秋"
            />
          </FormItem>
          <FormItem
            label="品类"
            name="category"
            :rules="[
              { required: true, whitespace: true, message: '请输入品类' },
            ]"
          >
            <Input v-model:value="editor.category" placeholder="例如：针织裤" />
          </FormItem>
          <FormItem
            label="主推平台"
            name="mainPlatform"
            :rules="[
              { required: true, whitespace: true, message: '请输入主推平台' },
            ]"
          >
            <Input
              v-model:value="editor.mainPlatform"
              placeholder="请输入主推平台"
            />
          </FormItem>
          <FormItem label="视觉重要层级" name="visualLevel">
            <Select
              v-model:value="editor.visualLevel"
              :options="visualLevelOptions"
              allow-clear
              placeholder="请选择视觉重要层级"
            />
          </FormItem>
          <FormItem label="流程状态">
            <Tag :color="statusColor(editor.flowStatus)">
              {{ optionLabel(flowStatusOptions, editor.flowStatus) }}
            </Tag>
          </FormItem>
          <FormItem label="上新时间" name="launchTime">
            <DatePicker
              v-model:value="editor.launchTime"
              show-time
              value-format="YYYY-MM-DD HH:mm:ss"
              class="w-full"
            />
          </FormItem>
          <FormItem label="商品要求货期" name="productDeadline">
            <DatePicker
              v-model:value="editor.productDeadline"
              show-time
              value-format="YYYY-MM-DD HH:mm:ss"
              class="w-full"
            />
          </FormItem>
        </div>
        <Divider orientation="left">逾期信息</Divider>
        <div class="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <FormItem label="日期逾期情况" name="dateOverdueStatus">
            <Select
              v-model:value="editor.dateOverdueStatus"
              :options="overdueOptions"
            />
          </FormItem>
          <FormItem label="耗时逾期情况" name="timeOverdueStatus">
            <Select
              v-model:value="editor.timeOverdueStatus"
              :options="overdueOptions"
            />
          </FormItem>
          <FormItem label="日期逾期描述" name="dateOverdueDesc">
            <Input.TextArea v-model:value="editor.dateOverdueDesc" :rows="2" />
          </FormItem>
          <FormItem label="耗时逾期描述" name="timeOverdueDesc">
            <Input.TextArea v-model:value="editor.timeOverdueDesc" :rows="2" />
          </FormItem>
        </div>
      </Form>
    </Spin>
  </Modal>
</template>
