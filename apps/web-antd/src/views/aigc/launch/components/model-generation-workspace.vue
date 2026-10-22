<script setup lang="ts">
import type {
  ImageGenerationNodeKey,
  ModelGenerationDraft,
} from '../model-generation-draft';

import type {
  AiImageFormValues,
  LaunchTask,
  MatchingScheme,
  ProductStyle,
  StyleImageItem,
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
  Spin,
} from 'ant-design-vue';

import {
  auditFlowTaskApi,
  getFlowDraftApi,
  getMatchingSchemesApi,
  getProductStylesApi,
  queryMatchStylesApi,
  saveFlowDraftApi,
  saveStyleImagesApi,
} from '#/api';
import {
  getDrawingTaskPage,
  useDrawingAccess,
} from '#/features/drawing/access';

import { readModelGenerationDraft } from '../model-generation-draft';
import {
  canHandleTask,
  decodeScheme,
  getWorkflowContext,
  validateWorkflowImages,
} from '../workflow-helpers';
import ModelStyleGenerator from './model-style-generator.vue';
import WorkflowImages from './workflow-images.vue';

const props = defineProps<{
  task: LaunchTask;
  context?: WorkflowContext;
  editable: boolean;
}>();
const emit = defineEmits<{
  busy: [boolean];
  changed: [];
  cancel: [];
  rejected: [];
}>();
const access = useDrawingAccess();
const generationNode = computed<ImageGenerationNodeKey | undefined>(() => {
  const key = props.context?.nodeKey;
  return key === 'aiImageModelTask' || key === 'aiImageActionTask'
    ? key
    : undefined;
});
const imageLabel = computed(() =>
  generationNode.value === 'aiImageActionTask' ? '动作图' : '模特图',
);
const imageField = computed(() =>
  generationNode.value === 'aiImageActionTask'
    ? 'aiActionImageUrls'
    : 'aiModelImageUrls',
);
const styles = ref<ProductStyle[]>([]);
const schemes = ref<MatchingScheme[]>([]);
const images = ref<Record<string, WorkflowImage[]>>({});
const generations = ref<Record<string, Partial<AiImageFormValues>>>({});
const historyBatches = ref<Record<string, 'all' | number>>({});
const pending = ref<Record<string, boolean>>({});
const loading = ref(false);
const failed = ref(false);
const loadError = ref('');
const saving = ref(false);
const operation = ref<'draft' | 'reject' | 'submit'>();
const submitConfirmOpen = ref(false);
const remark = ref('');
const attachments = ref<WorkflowImage[]>([]);
const uploading = ref(0);
const activeStyle = ref<string>();
const busy = computed(
  () =>
    saving.value ||
    uploading.value > 0 ||
    Object.values(pending.value).some(Boolean),
);
const count = computed(() =>
  Object.values(images.value).reduce(
    (total, values) => total + values.length,
    0,
  ),
);
const locked = computed(
  () => !props.editable || loading.value || failed.value || saving.value,
);
let requestId = 0;
async function load() {
  if (busy.value) return;
  const request = ++requestId;
  loading.value = true;
  failed.value = false;
  loadError.value = '';
  styles.value = [];
  try {
    if (!props.context || !generationNode.value)
      throw new Error('当前节点信息不完整，请刷新任务');
    const [taskStyles, sourceSchemes, rawDraft] = await Promise.all([
      getProductStylesApi(props.task.id),
      getMatchingSchemesApi(props.task.id),
      getFlowDraftApi({
        procInstId: props.context.procInstId,
        nodeKey: props.context.nodeKey,
      }),
    ]);
    let sourceStyles = taskStyles;
    if (generationNode.value === 'aiImageActionTask') {
      const styleNos = [...new Set(taskStyles.map((style) => style.styleNo))];
      const candidates = (
        await Promise.all(
          styleNos.map((styleNo) => queryMatchStylesApi(styleNo)),
        )
      ).flat();
      sourceStyles = taskStyles.map((style) => ({
        ...style,
        aiModelImageUrls:
          candidates.find(
            (candidate) =>
              String(candidate.id) === String(style.id) &&
              candidate.styleNo === style.styleNo,
          )?.aiModelImageUrls ??
          style.aiModelImageUrls ??
          [],
      }));
    }
    if (request !== requestId) return;
    if (!Array.isArray(sourceSchemes))
      throw new Error('搭配方案列表格式不正确');
    const draft = readModelGenerationDraft(rawDraft, generationNode.value);
    schemes.value = sourceSchemes.map(decodeScheme);
    const savedStyles = new Map(
      draft?.styles.map((style) => [style.styleId, style]),
    );
    generations.value = Object.fromEntries(
      sourceStyles.map((style) => [
        String(style.id),
        savedStyles.get(String(style.id))?.generation ?? {},
      ]),
    );
    historyBatches.value = Object.fromEntries(
      sourceStyles.map((style) => [
        String(style.id),
        savedStyles.get(String(style.id))?.historyBatchId ?? 'all',
      ]),
    );
    images.value = Object.fromEntries(
      sourceStyles.map((style) => [
        String(style.id),
        savedStyles.get(String(style.id))?.selectedImages ?? [],
      ]),
    );
    remark.value = draft?.remarkInfoVO.contentText ?? '';
    attachments.value = draft?.remarkInfoVO.imageUrls ?? [];
    pending.value = {};
    activeStyle.value = sourceStyles.some(
      (style) => String(style.id) === draft?.activeStyleId,
    )
      ? draft?.activeStyleId
      : sourceStyles[0]
        ? String(sourceStyles[0].id)
        : undefined;
    styles.value = sourceStyles;
  } catch (error) {
    if (request === requestId) {
      failed.value = true;
      loadError.value =
        error instanceof Error && error.message.startsWith('草稿数据')
          ? error.message
          : '素材或草稿加载失败，请重新加载后再操作';
    }
  } finally {
    if (request === requestId) loading.value = false;
  }
}
async function saveDraft() {
  if (locked.value || busy.value || !props.context || !generationNode.value)
    return;
  const draft: ModelGenerationDraft = {
    version: 1,
    formType: generationNode.value,
    activeStyleId: activeStyle.value,
    styles: styles.value.map((style) => ({
      styleId: String(style.id),
      generation: generations.value[String(style.id)] ?? {},
      selectedImages: images.value[String(style.id)] ?? [],
      historyBatchId: historyBatches.value[String(style.id)] ?? 'all',
    })),
    remarkInfoVO: { contentText: remark.value, imageUrls: attachments.value },
  };
  saving.value = true;
  operation.value = 'draft';
  try {
    await saveFlowDraftApi({
      ...props.context,
      formDataJson: JSON.stringify(draft),
    });
    message.success('整体保存成功');
  } catch {
    // Keep the entire form for retry; saving a draft never validates required fields.
  } finally {
    saving.value = false;
    operation.value = undefined;
  }
}
function schemeFor(style: ProductStyle) {
  return schemes.value.find(
    (scheme) =>
      scheme.styleNo === style.styleNo && scheme.styleName === style.styleName,
  );
}
async function reject() {
  if (locked.value || busy.value || !props.context || !generationNode.value)
    return;
  try {
    if (!remark.value.trim()) throw new Error('请填写驳回原因');
    if (remark.value.length > 1000) throw new Error('图片备注最多 1000 字');
    if (attachments.value.length > 6) throw new Error('备注附件最多 6 张');
    validateWorkflowImages(attachments.value, 'temp');
  } catch (error) {
    message.warning((error as Error).message);
    return;
  }
  const context = { ...props.context };
  const taskId = props.task.id;
  saving.value = true;
  operation.value = 'reject';
  let rejected = false;
  try {
    // Recheck the current node and employee scope before returning the task.
    const scope = access.scopeFor(context.nodeKey);
    let current: LaunchTask | undefined;
    for (let pageNo = 1; ; pageNo++) {
      const page = await getDrawingTaskPage({ pageNo, pageSize: 200 }, scope);
      current = page.list.find((row) => row.id === taskId);
      if (current || !page.list.length || pageNo * 200 >= page.total) break;
    }
    const next = getWorkflowContext(current);
    if (
      !current ||
      !canHandleTask(current) ||
      next?.procInstId !== context.procInstId ||
      next?.nodeTaskId !== context.nodeTaskId ||
      next?.nodeKey !== context.nodeKey
    )
      throw new Error('任务状态或节点已变化，请刷新任务后重试');
    const completed = await auditFlowTaskApi({
      ...context,
      auditInfoVO: {
        auditStatus: 2,
        contentText: remark.value.trim(),
        imageUrls: attachments.value,
      },
    });
    if (completed !== true) {
      message.warning('驳回未成功，请重试');
      return;
    }
    message.success('已驳回到上一节点');
    rejected = true;
  } catch (error) {
    if (error instanceof Error) message.warning(error.message);
    // Keep the generation parameters, selected images and remarks for retry.
  } finally {
    saving.value = false;
    operation.value = undefined;
  }
  if (rejected) emit('rejected');
}
function validateSubmission(): StyleImageItem[] | undefined {
  const field = imageField.value;
  const items: StyleImageItem[] = styles.value
    .filter((style) => images.value[String(style.id)]?.length)
    .map((style) => ({
      styleId: style.id,
      [field]: images.value[String(style.id)]!.map(
        ({ originalUrl, previewUrl, thumbnailUrl }) => ({
          originalUrl,
          previewUrl,
          thumbnailUrl,
        }),
      ),
    }));
  if (!items.length) {
    message.warning(`请先选择或上传本次提交的${imageLabel.value}`);
    return;
  }
  try {
    if (!remark.value.trim()) throw new Error('请填写备注说明');
    for (const item of items) validateWorkflowImages(item[field] ?? [], 'base');
    validateWorkflowImages(attachments.value, 'temp');
    if (remark.value.length > 1000) throw new Error('图片备注最多 1000 字');
    if (attachments.value.length > 6) throw new Error('备注附件最多 6 张');
  } catch (error) {
    message.warning((error as Error).message);
    return;
  }
  return items;
}
function changeSubmitConfirmation(open: boolean) {
  if (!open) {
    submitConfirmOpen.value = false;
    return;
  }
  if (locked.value || busy.value) return;
  submitConfirmOpen.value = Boolean(validateSubmission());
}
async function submit() {
  submitConfirmOpen.value = false;
  if (locked.value || busy.value || !props.context || !generationNode.value)
    return;
  const items = validateSubmission();
  if (!items) return;
  saving.value = true;
  operation.value = 'submit';
  try {
    const completed = await saveStyleImagesApi({
      ...props.context,
      items,
      remarkInfoVO: {
        contentText: remark.value.trim(),
        imageUrls: attachments.value,
      },
    });
    if (completed !== true) {
      message.warning(`${imageLabel.value}未提交成功，请重试`);
      return;
    }
    message.success(`${imageLabel.value}已提交`);
    emit('changed');
  } catch {
    // Retain selected results, uploads and remarks for retry.
  } finally {
    saving.value = false;
    operation.value = undefined;
  }
}
watch(busy, (value) => emit('busy', value), { flush: 'sync' });
watch(
  () => props.task.id,
  () => {
    void load();
  },
  { immediate: true },
);
onUnmounted(() => {
  requestId += 1;
  emit('busy', false);
});
</script>

<template>
  <Spin :spinning="loading">
    <Alert v-if="failed" type="error" :message="loadError" class="mb-4!">
      <template #action>
        <div>
          <Button @click="load">
            <span>重新加载</span>
          </Button>
        </div>
      </template>
    </Alert>
    <Empty
      v-if="!loading && !failed && !styles.length"
      description="暂无商品款式"
    />
    <Collapse
      v-if="!failed && styles.length"
      :active-key="activeStyle"
      accordion
      @change="
        !busy && (activeStyle = typeof $event === 'string' ? $event : undefined)
      "
    >
      <CollapsePanel
        v-for="style in styles"
        :key="String(style.id)"
        :header="`${style.styleNo} · ${style.styleName}`"
      >
        <template #extra>
          <div class="text-xs text-muted-foreground">
            待提交 {{ images[String(style.id)]?.length ?? 0 }} 张
          </div>
        </template>
        <ModelStyleGenerator
          :image-label="imageLabel"
          :style="style"
          :scheme="schemeFor(style)"
          :model-value="images[String(style.id)] ?? []"
          :generation="generations[String(style.id)]"
          :history-batch-id="historyBatches[String(style.id)]"
          :disabled="locked || uploading > 0"
          @update:model-value="images[String(style.id)] = $event"
          @busy="pending[String(style.id)] = $event"
          @generation-change="generations[String(style.id)] = $event"
          @batch-change="historyBatches[String(style.id)] = $event"
        />
      </CollapsePanel>
    </Collapse>
    <Card
      v-if="!loading && !failed"
      title="备注与提交"
      class="mt-4!"
      :bordered="false"
    >
      <Form layout="vertical" :disabled="locked || busy">
        <FormItem label="备注说明" required>
          <Input.TextArea
            v-model:value="remark"
            :rows="2"
            :maxlength="1000"
            show-count
            placeholder="填写备注说明（提交或驳回时必填）"
          />
        </FormItem>
        <FormItem label="备注附件（最多 6 张）">
          <WorkflowImages
            v-model="attachments"
            multiple
            compact
            kind="temp"
            :max-count="6"
            :disabled="locked || Object.values(pending).some(Boolean)"
            @busy="uploading += $event"
          />
        </FormItem>
      </Form>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="text-sm text-muted-foreground">
          已选 {{ count }} 张，提交
          {{ Object.values(images).filter((values) => values.length).length }}
          个款式
        </div>
        <div class="flex flex-wrap justify-end gap-3">
          <Popconfirm
            v-if="editable"
            title="确认驳回到上一节点？"
            ok-text="确认驳回"
            :ok-button-props="{ danger: true }"
            :disabled="locked || busy"
            @confirm="reject"
          >
            <Button
              danger
              aria-label="驳回"
              :disabled="locked || busy"
              :loading="saving && operation === 'reject'"
            >
              <span>驳回</span>
            </Button>
          </Popconfirm>
          <Button :disabled="locked || busy" @click="emit('cancel')">
            <span>取消</span>
          </Button>
          <Button
            :disabled="locked || busy"
            :loading="saving && operation === 'draft'"
            @click="saveDraft"
          >
            <span>保存</span>
          </Button>
          <Popconfirm
            :title="`确认将所选${imageLabel}提交到当前流程节点？`"
            :open="submitConfirmOpen"
            :disabled="locked || busy"
            @open-change="changeSubmitConfirmation"
            @confirm="submit"
          >
            <Button
              type="primary"
              :disabled="locked || busy"
              :loading="saving && operation === 'submit'"
            >
              <span>提交</span>
            </Button>
          </Popconfirm>
        </div>
      </div>
    </Card>
  </Spin>
</template>
