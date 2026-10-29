<script setup lang="ts">
import type {
  LaunchTask,
  MatchingScheme,
  ProductStyle,
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
  getMatchingSchemesApi,
  getProductStylesApi,
  queryMatchStylesApi,
} from '#/api';
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
import ModelAuditStyle from './model-audit-style.vue';
import WorkflowImages from './workflow-images.vue';

const props = defineProps<{
  task: LaunchTask;
  context: WorkflowContext;
  editable: boolean;
}>();
const emit = defineEmits<{ busy: [boolean]; changed: []; cancel: [] }>();
const access = useDrawingAccess();
const auditNode = computed(() => {
  const key = props.context.nodeKey;
  return key === 'aiImageModelAudit' || key === 'aiImageActionAudit'
    ? key
    : undefined;
});
const imageLabel = computed(() =>
  auditNode.value === 'aiImageActionAudit' ? '动作图' : '模特图',
);
const imageField = computed(() =>
  auditNode.value === 'aiImageActionAudit'
    ? 'aiActionImageUrls'
    : 'aiModelImageUrls',
);
const styles = ref<ProductStyle[]>([]);
const schemes = ref<MatchingScheme[]>([]);
const checks = ref<Record<string, boolean>>({});
const activeStyle = ref<string>();
const loading = ref(false);
const failure = ref('');
const saving = ref<1 | 2>();
const pending = ref(0);
const remark = ref('');
const remarkError = ref('');
const attachments = ref<WorkflowImage[]>([]);
const busy = computed(
  () => loading.value || saving.value !== undefined || pending.value > 0,
);
const disabled = computed(
  () =>
    !props.editable ||
    Boolean(failure.value) ||
    busy.value ||
    !styles.value.length,
);
let requestId = 0;
async function load() {
  if (busy.value) return;
  const request = ++requestId;
  loading.value = true;
  failure.value = '';
  try {
    const [sourceStyles, sourceSchemes] = await Promise.all([
      getProductStylesApi(props.task.id),
      getMatchingSchemesApi(props.task.id),
    ]);
    const styleNos = [...new Set(sourceStyles.map((style) => style.styleNo))];
    const candidates = (
      await Promise.all(styleNos.map((styleNo) => queryMatchStylesApi(styleNo)))
    ).flat();
    if (request !== requestId) return;
    if (!Array.isArray(sourceSchemes))
      throw new Error('搭配方案列表格式不正确');
    const decodedSchemes = sourceSchemes.map(decodeScheme);
    const resolvedStyles = sourceStyles.map((style) => {
      const saved = candidates.find(
        (candidate) =>
          String(candidate.id) === String(style.id) &&
          candidate.styleNo === style.styleNo,
      );
      return {
        ...style,
        aiModelImageUrls:
          saved?.aiModelImageUrls ?? style.aiModelImageUrls ?? [],
        aiActionImageUrls:
          saved?.aiActionImageUrls ?? style.aiActionImageUrls ?? [],
      };
    });
    styles.value = resolvedStyles;
    schemes.value = decodedSchemes;
    checks.value = {};
    if (!sourceStyles.some((style) => String(style.id) === activeStyle.value))
      activeStyle.value = sourceStyles[0]
        ? String(sourceStyles[0].id)
        : undefined;
  } catch (error) {
    if (request === requestId)
      failure.value =
        error instanceof Error ? error.message : '审核材料加载失败，请重试';
  } finally {
    if (request === requestId) loading.value = false;
  }
}
function schemeFor(style: ProductStyle) {
  return schemes.value.find(
    (scheme) =>
      scheme.styleNo === style.styleNo && scheme.styleName === style.styleName,
  );
}
async function verifyContext(context: WorkflowContext) {
  if (!auditNode.value) throw new Error('当前节点不支持图片审核');
  const scope = access.scopeFor(auditNode.value);
  for (let pageNo = 1; ; pageNo++) {
    const page = await getDrawingTaskPage({ pageNo, pageSize: 200 }, scope);
    const current = page.list.find((row) => row.id === props.task.id);
    if (current) {
      const next = getWorkflowContext(current);
      if (
        canHandleTask(current) &&
        next?.procInstId === context.procInstId &&
        next?.nodeKey === context.nodeKey &&
        next?.nodeTaskId === context.nodeTaskId
      )
        return;
      break;
    }
    if (!page.list.length || pageNo * 200 >= page.total) break;
  }
  failure.value = '任务状态或节点已变化，请返回任务列表刷新后重试';
  throw new Error(failure.value);
}
async function submit(status: 1 | 2) {
  if (disabled.value || !auditNode.value) return;
  remarkError.value = !remark.value.trim()
    ? '请填写审核意见'
    : remark.value.length > 1000
      ? '审核意见最多 1000 字'
      : '';
  if (remarkError.value) return;
  try {
    if (status === 1) {
      const unchecked = styles.value.find(
        (style) =>
          !style[imageField.value]?.length ||
          !style.clothingProductUrl ||
          !checks.value[String(style.id)],
      );
      if (unchecked) {
        activeStyle.value = String(unchecked.id);
        throw new Error(
          `请完成 ${unchecked.styleNo} · ${unchecked.styleName} 的${imageLabel.value}细节校验后再通过`,
        );
      }
    }
    if (attachments.value.length > 6) throw new Error('审核附件最多 6 张');
    validateWorkflowImages(attachments.value, 'temp');
  } catch (error) {
    message.warning((error as Error).message);
    return;
  }
  const context = { ...props.context };
  saving.value = status;
  let completed = false;
  try {
    try {
      await verifyContext(context);
    } catch (error) {
      if (error instanceof Error) message.warning(error.message);
      return;
    }
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
    completed = true;
  } catch {
    // Preserve the opinion, attachments and checks when the request fails.
  } finally {
    saving.value = undefined;
  }
  if (completed) emit('changed');
}
watch(busy, (value) => emit('busy', value), { flush: 'sync' });
onUnmounted(() => {
  requestId += 1;
  emit('busy', false);
});
void load();
</script>

<template>
  <Spin :spinning="loading">
    <Alert v-if="failure" :message="failure" type="error" class="mb-4!">
      <template #action>
        <Button :disabled="busy" @click="load">
          <span>重新加载</span>
        </Button>
      </template>
    </Alert>
    <Empty
      v-if="!loading && !failure && !styles.length"
      description="暂无商品款式"
    />
    <Collapse
      v-if="!failure && styles.length"
      v-model:active-key="activeStyle"
      accordion
    >
      <CollapsePanel
        v-for="(style, index) in styles"
        :key="String(style.id)"
        :header="`款式${index + 1} · ${style.styleNo} · ${style.styleName}`"
      >
        <ModelAuditStyle
          :product-style="style"
          :scheme="schemeFor(style)"
          :images="style[imageField] ?? []"
          :image-label="imageLabel"
          :checked="checks[String(style.id)] ?? false"
          :disabled="disabled"
          @update:checked="checks[String(style.id)] = $event"
        />
      </CollapsePanel>
    </Collapse>
    <Card
      v-if="!failure && styles.length"
      title="审核意见"
      class="mt-4!"
      :bordered="false"
    >
      <Form layout="vertical" :disabled="disabled">
        <FormItem
          label="审核意见"
          required
          :validate-status="remarkError ? 'error' : undefined"
          :help="remarkError"
        >
          <Input.TextArea
            v-model:value="remark"
            aria-label="审核意见"
            :rows="3"
            :maxlength="1000"
            show-count
            placeholder="请输入审核意见"
            @change="remarkError = ''"
          />
        </FormItem>
        <FormItem label="审核附件（最多 6 张）">
          <WorkflowImages
            v-model="attachments"
            multiple
            kind="temp"
            :max-count="6"
            :disabled="disabled"
            @busy="pending += $event"
          />
        </FormItem>
      </Form>
      <div class="flex flex-wrap justify-end gap-3">
        <Button :disabled="busy" @click="emit('cancel')">
          <span>取消</span>
        </Button>
        <Popconfirm
          v-if="editable"
          :title="`确认驳回${imageLabel}？`"
          :disabled="disabled"
          @confirm="submit(2)"
        >
          <Button
            danger
            type="primary"
            aria-label="驳回"
            :disabled="disabled"
            :loading="saving === 2"
          >
            <span>驳回</span>
          </Button>
        </Popconfirm>
        <Popconfirm
          v-if="editable"
          :title="`确认通过${imageLabel}审核？`"
          :disabled="disabled"
          @confirm="submit(1)"
        >
          <Button
            type="primary"
            aria-label="通过"
            :disabled="disabled"
            :loading="saving === 1"
          >
            <span>通过</span>
          </Button>
        </Popconfirm>
      </div>
    </Card>
  </Spin>
</template>
