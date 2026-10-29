<script setup lang="ts">
import type { LaunchTask, MatchingScheme, WorkflowImage } from '#/api';

import { computed, onUnmounted, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Collapse,
  CollapsePanel,
  Empty,
  Form,
  FormItem,
  Input,
  message,
  Modal,
} from 'ant-design-vue';

import { auditFlowTaskApi, getMatchingSchemesApi } from '#/api';
import {
  getDrawingTaskPage,
  useDrawingAccess,
} from '#/features/drawing/access';

import {
  canHandleTask,
  decodeScheme,
  getWorkflowContext,
  validateWorkflowImages,
} from '../workflow-helpers';
import MatchingSchemePreview from './matching-scheme-preview.vue';
import MatchingSchemeReview from './matching-scheme-review.vue';
import WorkflowImages from './workflow-images.vue';

const props = defineProps<{ task: LaunchTask }>();
const emit = defineEmits<{ close: []; changed: []; busy: [boolean] }>();
const access = useDrawingAccess();
const loadedTask = ref<LaunchTask>();
const schemes = ref<MatchingScheme[]>([]);
const loading = ref(false);
const failed = ref('');
const saving = ref<1 | 2>();
const pending = ref(0);
const remark = ref('');
const remarkError = ref('');
const attachments = ref<WorkflowImage[]>([]);
const previewScheme = ref<MatchingScheme>();
const busy = computed(() => saving.value !== undefined || pending.value > 0);
const editable = computed(() => canHandleTask(loadedTask.value));
const disabled = computed(
  () =>
    loading.value ||
    Boolean(failed.value) ||
    !editable.value ||
    !schemes.value.length ||
    Boolean(previewScheme.value) ||
    busy.value,
);
let active = true;

async function scopedTask() {
  const scope = access.scopeFor('aiMatchingAudit');
  for (let pageNo = 1; ; pageNo++) {
    const page = await getDrawingTaskPage({ pageNo, pageSize: 200 }, scope);
    const found = page.list.find((row) => row.id === props.task.id);
    if (found) return found;
    if (!page.list.length || pageNo * 200 >= page.total) break;
  }
  throw new Error(
    '任务已流转、未分配给你或不属于当前环节，请关闭窗口并刷新列表',
  );
}
async function load() {
  loading.value = true;
  failed.value = '';
  loadedTask.value = undefined;
  schemes.value = [];
  try {
    // Verify node and assignee before requesting submitted materials.
    const current = await scopedTask();
    if (!active) return;
    const data = await getMatchingSchemesApi(current.id);
    if (!active) return;
    if (!Array.isArray(data)) throw new Error('搭配方案列表格式不正确');
    schemes.value = data.map(decodeScheme);
    loadedTask.value = current;
  } catch (error) {
    if (active)
      failed.value =
        error instanceof Error ? error.message : '审核材料加载失败，请重试';
  } finally {
    if (active) loading.value = false;
  }
}
async function verifyContext() {
  try {
    const current = await scopedTask();
    const previous = getWorkflowContext(loadedTask.value);
    const next = getWorkflowContext(current);
    if (
      !active ||
      !previous ||
      !canHandleTask(current) ||
      next?.procInstId !== previous.procInstId ||
      next?.nodeTaskId !== previous.nodeTaskId ||
      next?.nodeKey !== previous.nodeKey
    )
      throw new Error('任务状态或节点已变化，请关闭窗口并刷新列表后重试');
    return previous;
  } catch (error) {
    failed.value =
      error instanceof Error ? error.message : '任务状态核验失败，请重试';
    throw error;
  }
}
async function submit(status: 1 | 2) {
  if (disabled.value) return;
  remarkError.value = !remark.value.trim()
    ? '请填写审核意见'
    : remark.value.length > 1000
      ? '审核意见最多 1000 字'
      : '';
  if (remarkError.value) return;
  try {
    if (attachments.value.length > 6) throw new Error('审核附件最多 6 张');
    validateWorkflowImages(attachments.value, 'temp');
  } catch (error) {
    message.warning((error as Error).message);
    return;
  }
  saving.value = status;
  try {
    const context = await verifyContext();
    const success = await auditFlowTaskApi({
      ...context,
      auditInfoVO: {
        auditStatus: status,
        contentText: remark.value.trim(),
        imageUrls: attachments.value,
      },
    });
    if (success !== true) {
      message.warning('审核未成功，请重试');
      return;
    }
    message.success(status === 1 ? '审核任务已通过' : '审核任务已驳回');
    emit('changed');
  } catch {
    // Shared request interceptor reports API errors; preserve the review and opinion.
  } finally {
    saving.value = undefined;
  }
}
watch(busy, (value) => emit('busy', value), { flush: 'sync' });
onUnmounted(() => {
  active = false;
  emit('busy', false);
});
void load();
</script>

<template>
  <Modal
    open
    title="AI搭配方案审核"
    :width="1100"
    :style="{ top: '24px', maxWidth: 'calc(100vw - 32px)' }"
    :body-style="{
      height: 'min(800px, calc(100dvh - 164px))',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      overflow: 'hidden',
      padding: '12px 24px',
    }"
    :closable="!busy && !previewScheme"
    :keyboard="!busy && !previewScheme"
    :mask-closable="false"
    @cancel="!busy && !previewScheme && emit('close')"
  >
    <p class="m-0 shrink-0 text-sm">
      任务款号：{{ loadedTask?.styleNo || task.styleNo }}
    </p>
    <Alert v-if="failed" :message="failed" type="error" class="shrink-0">
      <template v-if="!loadedTask" #action>
        <Button :disabled="loading" @click="load"><span>重试</span></Button>
      </template>
    </Alert>
    <Alert
      v-if="loadedTask && !editable"
      message="当前任务不可审核，仅可查看已提交的搭配方案。"
      type="info"
      class="shrink-0"
    />
    <div class="min-h-0 flex-1 overflow-y-auto" data-audit-materials>
      <p v-if="loading" class="text-muted-foreground py-8 text-center">
        正在加载审核材料…
      </p>
      <Empty
        v-else-if="!failed && !schemes.length"
        description="暂无已提交的搭配方案"
      />
      <Collapse
        v-if="schemes.length"
        accordion
        :default-active-key="['0']"
        size="small"
      >
        <CollapsePanel
          v-for="(scheme, index) in schemes"
          :key="String(index)"
          :header="`第${index + 1}款 · ${scheme.styleNo} · ${scheme.styleName}${scheme.hasOtherStyle ? '（合拍）' : ''}`"
        >
          <MatchingSchemeReview :scheme="scheme">
            <template #action>
              <div class="mt-auto flex justify-end">
                <Button :disabled="busy" @click="previewScheme = scheme">
                  整体搭配方案预览
                </Button>
              </div>
            </template>
          </MatchingSchemeReview>
        </CollapsePanel>
      </Collapse>
    </div>
    <Form
      v-if="editable"
      layout="vertical"
      class="shrink-0"
      :disabled="disabled"
    >
      <FormItem
        label="审核意见"
        required
        :validate-status="remarkError ? 'error' : undefined"
        :help="remarkError"
        class="mb-1!"
      >
        <Input.TextArea
          v-model:value="remark"
          aria-label="审核意见"
          placeholder="请输入审核意见"
          :rows="2"
          :maxlength="1000"
          show-count
          @change="remarkError = ''"
        />
      </FormItem>
      <details class="mt-2 text-xs">
        <summary class="cursor-pointer">审核附件（可选，最多 6 张）</summary>
        <div class="mt-2 max-h-36 overflow-y-auto">
          <WorkflowImages
            v-model="attachments"
            multiple
            :max-count="6"
            :disabled="disabled"
            @busy="pending += $event"
          />
        </div>
      </details>
    </Form>
    <template #footer>
      <Button :disabled="busy || Boolean(previewScheme)" @click="emit('close')">
        <span>取消</span>
      </Button>
      <Button
        v-if="editable"
        danger
        type="primary"
        :disabled="disabled"
        :loading="saving === 2"
        @click="submit(2)"
      >
        <span>驳回</span>
      </Button>
      <Button
        v-if="editable"
        type="primary"
        :disabled="disabled"
        :loading="saving === 1"
        @click="submit(1)"
      >
        <span>通过</span>
      </Button>
    </template>
    <MatchingSchemePreview
      v-if="previewScheme"
      :scheme="previewScheme"
      @close="previewScheme = undefined"
    />
  </Modal>
</template>
