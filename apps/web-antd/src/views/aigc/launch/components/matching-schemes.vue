<script setup lang="ts">
import type { SchemeImageKey } from '../workflow-helpers';

import type {
  LaunchTask,
  LibraryType,
  MatchingScheme,
  WorkflowContext,
  WorkflowImage,
} from '#/api';

import { computed, onUnmounted, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Card,
  Collapse,
  CollapsePanel,
  Empty,
  Form,
  FormItem,
  Input,
  message,
  Popconfirm,
  Space,
  Spin,
  Switch,
} from 'ant-design-vue';

import { getMatchingSchemesApi, saveMatchingSchemesApi } from '#/api';

import {
  decodeScheme,
  schemeImageFields,
  schemeImages,
  setSchemeImages,
  validateWorkflowImages,
} from '../workflow-helpers';
import WorkflowImages from './workflow-images.vue';
const props = defineProps<{
  task: LaunchTask;
  context?: WorkflowContext;
  editable: boolean;
}>();
const emit = defineEmits<{ changed: []; busy: [boolean] }>();
const schemes = ref<MatchingScheme[]>([]);
const sourceCount = ref(0);
const protectedClothing = ref<string[][]>([]);
const errors = ref<Record<string, string>>({});
const leftKeys: SchemeImageKey[] = [
  'aiMatchingImageUrl',
  'clothingProductUrls',
  'propImageUrls',
  'modelImageUrls',
  'sceneImageUrls',
  'aiGeneratedImageUrls',
];
const columns = [
  schemeImageFields.filter((f) => leftKeys.includes(f.key)),
  schemeImageFields.filter((f) => !leftKeys.includes(f.key)),
];
function libraryType(key: SchemeImageKey): LibraryType | undefined {
  return key === 'propImageUrls'
    ? 0
    : key === 'modelImageUrls'
      ? 1
      : key === 'sceneImageUrls'
        ? 2
        : undefined;
}
function fieldMax(key: SchemeImageKey) {
  return key === 'fullBodyReferenceUrls' ? 2 : undefined;
}
function updateImages(
  scheme: MatchingScheme,
  index: number,
  key: SchemeImageKey,
  value: WorkflowImage[],
) {
  setSchemeImages(scheme, key, value);
  delete errors.value[index + '.' + key];
}
const loading = ref(false);
const failed = ref('');
const saving = ref(false);
const pending = ref(0);
const remark = ref('');
const attachments = ref<WorkflowImage[]>([]);
const locked = computed(
  () =>
    !props.editable || loading.value || Boolean(failed.value) || saving.value,
);
let latest = 0;
async function load() {
  const request = ++latest;
  loading.value = true;
  failed.value = '';
  schemes.value = [];
  try {
    const data = await getMatchingSchemesApi(props.task.id);
    if (request !== latest) return;
    if (!Array.isArray(data)) throw new Error('搭配方案列表格式不正确');
    schemes.value = data.map(decodeScheme);
    sourceCount.value = schemes.value.length;
    protectedClothing.value = schemes.value.map((s) =>
      s.clothingProductUrls
        .filter((img) => img.isMain === 1)
        .map((img) => img.originalUrl),
    );
    errors.value = {};
  } catch (error) {
    if (request === latest)
      failed.value =
        error instanceof Error ? error.message : '搭配方案加载失败，请重试';
  } finally {
    if (request === latest) loading.value = false;
  }
}
function add() {
  schemes.value.push({
    styleNo: props.task.styleNo,
    styleName: '',
    hasOtherStyle: false,
    clothingProductUrls: [],
  });
}
async function save(status: 0 | 1) {
  if (locked.value || pending.value || !props.context) return;
  try {
    if (!schemes.value.length) throw new Error('请先添加搭配方案');
    errors.value = {};
    for (const [index, scheme] of schemes.value.entries()) {
      if (!scheme.styleNo.trim())
        errors.value[index + '.styleNo'] = '请填写款号';
      if (!scheme.styleName.trim())
        errors.value[index + '.styleName'] = '请填写款式（颜色）';
      for (const field of schemeImageFields) {
        const images = schemeImages(scheme, field.key);
        try {
          if ('required' in field && field.required && !images.length)
            throw new Error('请选择或上传' + field.label);
          if (field.key === 'fullBodyReferenceUrls' && images.length > 2)
            throw new Error('全身参考图最多 2 张');
          validateWorkflowImages(images, field.kind);
        } catch (error) {
          errors.value[index + '.' + field.key] = (error as Error).message;
        }
      }
    }
    if (Object.keys(errors.value).length)
      throw new Error('请检查方案中标红的必填项和图片');
    if (remark.value.length > 1000) throw new Error('方案备注最多 1000 字');
    if (attachments.value.length > 6) throw new Error('备注附件最多 6 张');
    validateWorkflowImages(attachments.value, 'temp');
  } catch (error) {
    message.warning((error as Error).message);
    return;
  }
  saving.value = true;
  try {
    const ids = await saveMatchingSchemesApi({
      ...props.context,
      schemes: schemes.value.map((s) => ({
        ...s,
        styleNo: s.styleNo.trim(),
        styleName: s.styleName.trim(),
      })),
      status,
      remarkInfoVO: {
        contentText: remark.value.trim(),
        imageUrls: attachments.value,
      },
    });
    if (
      !Array.isArray(ids) ||
      ids.length !== schemes.value.length ||
      ids.some((id) =>
        typeof id === 'number'
          ? !Number.isSafeInteger(id)
          : typeof id !== 'string' || !id.trim(),
      )
    ) {
      failed.value = '保存已返回，请重新加载方案以确认结果';
      emit('changed');
      return;
    }
    schemes.value.forEach((scheme, index) => {
      scheme.id = ids[index];
    });
    message.success(status === 0 ? '搭配方案已保存' : '搭配方案已提交');
    emit('changed');
  } catch {
    /* Shared API interceptor reports business failures. */
  } finally {
    saving.value = false;
  }
}
watch(
  () => props.task.id,
  () => {
    remark.value = '';
    attachments.value = [];
    pending.value = 0;
    void load();
  },
  { immediate: true },
);
watch(
  () => saving.value || pending.value > 0,
  (value) => emit('busy', value),
  { immediate: true },
);
onUnmounted(() => {
  latest += 1;
  emit('busy', false);
});
</script>
<template>
  <Spin :spinning="loading">
    <Alert v-if="failed" :message="failed" type="error" class="mb-4!">
      <template #action>
        <Button :disabled="saving || pending > 0" @click="load">
          <span>重新加载</span>
        </Button>
      </template>
    </Alert>
    <Alert
      v-if="!editable"
      type="info"
      message="当前节点可查看搭配方案；方案输出节点可编辑、保存和提交。"
      class="mb-4!"
    />
    <Empty
      v-if="!loading && !failed && !schemes.length"
      description="暂无搭配方案"
    />
    <Card
      v-for="(scheme, index) in schemes"
      :key="index"
      :title="`${scheme.styleNo || task.styleNo} · ${scheme.styleName || '新方案'}`"
      class="mb-4!"
    >
      <template #extra>
        <Button
          v-if="index >= sourceCount && scheme.id === undefined && editable"
          danger
          :disabled="locked || pending > 0"
          @click="schemes.splice(index, 1)"
        >
          <span>移除方案</span>
        </Button>
      </template>
      <Collapse :default-active-key="['images']">
        <CollapsePanel key="images" header="搭配方案素材">
          <Form :model="scheme" layout="vertical" :disabled="locked">
            <div class="grid grid-cols-1 gap-x-4 md:grid-cols-3">
              <FormItem
                label="款号"
                required
                :validate-status="
                  errors[`${index}.styleNo`] ? 'error' : undefined
                "
                :help="errors[`${index}.styleNo`]"
              >
                <Input
                  v-model:value="scheme.styleNo"
                  :disabled="index < sourceCount || locked"
                  placeholder="请输入方案款号"
                />
              </FormItem>
              <FormItem
                label="款式（颜色）"
                required
                :validate-status="
                  errors[`${index}.styleName`] ? 'error' : undefined
                "
                :help="errors[`${index}.styleName`]"
              >
                <Input
                  :disabled="index < sourceCount || locked"
                  v-model:value="scheme.styleName"
                  placeholder="例如：红色"
                />
              </FormItem>
              <FormItem label="是否合拍">
                <Switch v-model:checked="scheme.hasOtherStyle" />
              </FormItem>
            </div>
            <div class="grid grid-cols-1 gap-x-8 xl:grid-cols-2">
              <div
                v-for="(column, columnIndex) in columns"
                :key="columnIndex"
                class="min-w-0"
              >
                <FormItem
                  v-for="field in column"
                  :key="field.key"
                  :label="field.label"
                  :required="'required' in field && field.required"
                  :validate-status="
                    errors[`${index}.${field.key}`] ? 'error' : undefined
                  "
                  :help="errors[`${index}.${field.key}`]"
                >
                  <WorkflowImages
                    :model-value="schemeImages(scheme, field.key)"
                    :disabled="locked"
                    :kind="field.kind"
                    :multiple="'multiple' in field"
                    :style-no="scheme.styleNo"
                    :max-count="fieldMax(field.key)"
                    :library-type="libraryType(field.key)"
                    :protected-urls="
                      field.key === 'clothingProductUrls'
                        ? protectedClothing[index]
                        : undefined
                    "
                    @update:model-value="
                      updateImages(scheme, index, field.key, $event)
                    "
                    @busy="pending += $event"
                  />
                </FormItem>
              </div>
            </div>
          </Form>
        </CollapsePanel>
      </Collapse>
    </Card>
    <template v-if="editable && !failed">
      <Button :disabled="locked || pending > 0" class="mb-4!" @click="add">
        <span>添加搭配方案</span>
      </Button>
      <Form layout="vertical" :disabled="locked">
        <FormItem label="方案备注">
          <Input.TextArea
            v-model:value="remark"
            :rows="2"
            :maxlength="1000"
            show-count
          />
        </FormItem>
        <FormItem label="备注附件">
          <WorkflowImages
            v-model="attachments"
            :max-count="6"
            multiple
            :disabled="locked"
            @busy="pending += $event"
          />
        </FormItem>
      </Form>
      <Space>
        <Button
          :disabled="locked || pending > 0"
          :loading="saving"
          @click="save(0)"
        >
          <span>保存方案</span>
        </Button>
        <Popconfirm
          title="确定提交当前搭配方案并继续流程？"
          :disabled="locked || pending > 0"
          @confirm="save(1)"
        >
          <Button type="primary" :disabled="locked || pending > 0">
            <span>提交方案</span>
          </Button>
        </Popconfirm>
      </Space>
    </template>
  </Spin>
</template>
