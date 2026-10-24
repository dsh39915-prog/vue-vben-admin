<script setup lang="ts">
import type { LaunchTask, ProductStyle, WorkflowImage } from '#/api';

import { computed, onUnmounted, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Collapse,
  CollapsePanel,
  Empty,
  Form,
  FormItem,
  Image,
  Input,
  message,
  Modal,
} from 'ant-design-vue';

import { auditFlowTaskApi, getProductStylesApi } from '#/api';
import {
  getDrawingTaskPage,
  useDrawingAccess,
} from '#/features/drawing/access';

import {
  canHandleTask,
  getWorkflowContext,
  validateWorkflowImages,
} from '../workflow-helpers';
import WorkflowImages from './workflow-images.vue';

const props = withDefaults(
  defineProps<{
    task: LaunchTask;
    nodeKey?: 'pageProductionAudit' | 'retouchingAudit';
  }>(),
  { nodeKey: 'retouchingAudit' },
);
const emit = defineEmits<{ close: []; changed: []; busy: [boolean] }>();
const pageAudit = computed(() => props.nodeKey === 'pageProductionAudit');
const title = computed(() => (pageAudit.value ? '页面审核' : '修图审核'));
const materialLabel = computed(() =>
  pageAudit.value ? '页面制作图片' : '精修图片',
);
function imageGroups(style: ProductStyle) {
  return pageAudit.value
    ? [
        { key: 'main', label: '商品主图', images: style.productMainImageUrls },
        {
          key: 'detail',
          label: '详情页图',
          images: style.productDetailImageUrls,
        },
      ]
    : [
        {
          key: 'model',
          label: '精修模特图',
          images: style.retouchedModelImageUrls,
        },
        {
          key: 'action',
          label: '精修动作图',
          images: style.retouchedActionImageUrls,
        },
      ];
}
function imageLabel(group: string, index: number) {
  return group === 'main'
    ? (['主图1', '主图2', '面料3', '主图4', '搭配5'][index] ??
        `主图${index + 1}`)
    : `详情图${index + 1}`;
}
const access = useDrawingAccess();
const loadedTask = ref<LaunchTask>();
const styles = ref<ProductStyle[]>([]);
const loading = ref(false);
const failed = ref('');
const saving = ref<1 | 2>();
const pending = ref(0);
const remark = ref('');
const remarkError = ref('');
const attachments = ref<WorkflowImage[]>([]);
const busy = computed(() => saving.value !== undefined || pending.value > 0);
const editable = computed(() => canHandleTask(loadedTask.value));
const disabled = computed(
  () => loading.value || Boolean(failed.value) || !editable.value || busy.value,
);
let active = true;

async function scopedTask() {
  const scope = access.scopeFor(props.nodeKey);
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
  styles.value = [];
  try {
    // Verify node and assignee before requesting submitted materials.
    const current = await scopedTask();
    if (!active) return;
    const previous = getWorkflowContext(props.task);
    const next = getWorkflowContext(current);
    if (
      !previous ||
      next?.nodeTaskId !== previous.nodeTaskId ||
      next?.procInstId !== previous.procInstId ||
      next?.nodeKey !== previous.nodeKey
    )
      throw new Error('任务状态或节点已变化，请关闭窗口并刷新列表后重试');
    const data = await getProductStylesApi(current.id);
    if (!active) return;
    if (!Array.isArray(data)) throw new Error('款式列表格式不正确');
    styles.value = data;
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
  if (
    status === 1 &&
    !styles.value.some((style) =>
      imageGroups(style).some((group) => group.images?.length),
    )
  ) {
    message.warning(
      `暂未获取到上一步提交的${materialLabel.value}，请刷新后重试`,
    );
    return;
  }
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
    const context = await verifyContext().catch((error: unknown) => {
      message.warning(
        error instanceof Error ? error.message : '任务状态核验失败',
      );
      throw error;
    });
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
    message.success(`${title.value}${status === 1 ? '已通过' : '已驳回'}`);
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
    :title="title"
    :width="1100"
    :style="{ top: '24px', maxWidth: 'calc(100vw - 32px)' }"
    :body-style="{
      height: 'min(800px, calc(100dvh - 164px))',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      overflow: 'hidden',
      padding: '12px 24px',
    }"
    :closable="!busy"
    :keyboard="false"
    :mask-closable="false"
    @cancel="!busy && emit('close')"
  >
    <div class="flex shrink-0 items-center gap-3">
      <span>任务款号：{{ loadedTask?.styleNo || task.styleNo }}</span>
      <Image.PreviewGroup>
        <template v-for="style in styles" :key="style.id">
          <Image
            v-if="style.clothingProductUrl"
            :src="style.clothingProductUrl.thumbnailUrl"
            :preview="{ src: style.clothingProductUrl.originalUrl }"
            :alt="`${style.styleNo}服饰图`"
            :width="40"
            :height="48"
            class="rounded object-contain"
          />
        </template>
      </Image.PreviewGroup>
      <Button class="ml-auto" :disabled="loading || busy" @click="load">
        刷新材料
      </Button>
    </div>
    <Alert v-if="failed" :message="failed" type="error" class="shrink-0">
      <template #action>
        <Button :disabled="loading || busy" @click="load">
<span>重试</span>
</Button>
      </template>
    </Alert>
    <Alert
      v-if="loadedTask && !editable"
      :message="`当前任务不可审核，仅可查看已提交的${materialLabel}。`"
      type="info"
      class="shrink-0"
    />
    <div class="min-h-0 flex-1 overflow-y-auto" data-retouch-materials>
      <p v-if="loading" class="text-muted-foreground py-8 text-center">
        正在加载审核材料…
      </p>
      <Empty
        v-else-if="!failed && !styles.length"
        description="暂无已提交的款式"
      />
      <Collapse
        v-if="styles.length"
        accordion
        :default-active-key="[String(styles[0]?.id)]"
        size="small"
      >
        <CollapsePanel
          v-for="(style, index) in styles"
          :key="String(style.id)"
          :header="`第${index + 1}款 · ${style.styleNo} · ${style.styleName}`"
        >
          <div class="grid gap-4" :class="{ 'md:grid-cols-2': !pageAudit }">
            <section
              v-for="group in imageGroups(style)"
              :key="group.label"
              :data-retouch-group="group.label"
              :data-audit-image-group="group.label"
            >
              <h3 class="mb-3 text-sm font-medium">{{ group.label }}</h3>
              <Image.PreviewGroup v-if="group.images?.length">
                <div class="flex flex-wrap items-start gap-3">
                  <div
                    v-for="(image, imageIndex) in group.images"
                    :key="`${image.originalUrl}-${imageIndex}`"
                    class="flex flex-col gap-2"
                  >
                    <Image
                      :src="image.previewUrl"
                      :preview="{ src: image.originalUrl }"
                      :alt="`${style.styleNo}${group.label}${imageIndex + 1}`"
                      :width="144"
                      class="rounded"
                    />
                    <span
                      v-if="pageAudit"
                      class="text-center text-xs text-muted-foreground"
                    >
                      {{ imageLabel(group.key, imageIndex) }}
                    </span>
                  </div>
                </div>
              </Image.PreviewGroup>
              <p v-else class="text-muted-foreground py-8 text-center text-sm">
                {{
                  group.images === undefined
                    ? '暂未获取到上一步提交的图片，请刷新后重试'
                    : `未提交此类${materialLabel}`
                }}
              </p>
            </section>
          </div>
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
      <Button :disabled="busy" @click="emit('close')"><span>取消</span></Button>
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
  </Modal>
</template>
