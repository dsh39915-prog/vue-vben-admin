<script setup lang="ts">
import type {
  FlowAssignParams,
  LaunchTask,
  ProductStyle,
  WorkflowImage,
} from '#/api';

import { computed, onMounted, ref } from 'vue';

import {
  Alert,
  Button,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Radio,
  RadioGroup,
  Select,
  Spin,
} from 'ant-design-vue';

import {
  assignFlowTaskApi,
  auditFlowTaskApi,
  freezeFlowNodeApi,
  getProductStylesApi,
  getSimpleUserListApi,
  unfreezeFlowNodeApi,
} from '#/api';

import {
  getWorkflowContext,
  validateWorkflowImages,
} from '../workflow-helpers';
import WorkflowImages from './workflow-images.vue';
const props = defineProps<{
  task: LaunchTask;
  operation: 'assign' | 'audit' | 'freeze' | 'unfreeze';
}>();
const emit = defineEmits<{ close: []; changed: [] }>();
const title = computed(
  () =>
    ({
      assign: '分配任务',
      audit: '审核任务',
      freeze: '冻结节点',
      unfreeze: '解冻节点',
    })[props.operation],
);
const saving = ref(false);
const loading = ref(false);
const failed = ref(false);
const pending = ref(0);
const remark = ref('');
const remarkError = ref('');
const canSplit = computed(
  () => props.task.currentNodeKey !== 'launchTaskDispatch',
);
const remarkRequired = computed(() =>
  ['assign', 'audit'].includes(props.operation),
);
const attachments = ref<WorkflowImage[]>([]);
const auditStatus = ref<1 | 2>(1);
const mode = ref<'style_split' | 'unified'>('unified');
const unified = ref<string>();
const users = ref<{ value: string; label: string; name: string }[]>([]);
const styles = ref<ProductStyle[]>([]);
const assignees = ref<Record<string, string>>({});
async function load() {
  if (props.operation !== 'assign') return;
  loading.value = true;
  failed.value = false;
  const results = await Promise.allSettled([
    getSimpleUserListApi(),
    getProductStylesApi(props.task.id),
  ]);
  if (results[0].status === 'fulfilled' && Array.isArray(results[0].value))
    users.value = results[0].value
      .filter((u) => u.id !== undefined)
      .map((u) => ({
        value: String(u.id),
        name: u.nickname || u.username,
        label: (u.nickname || u.username) + ' (#' + u.id + ')',
      }));
  else failed.value = true;
  if (results[1].status === 'fulfilled' && Array.isArray(results[1].value))
    styles.value = results[1].value;
  else failed.value = true;
  loading.value = false;
}
async function submit() {
  if (saving.value || pending.value || loading.value || failed.value) return;
  const context = getWorkflowContext(props.task);
  try {
    if (!context) throw new Error('节点任务信息不完整，请刷新任务');
    validateWorkflowImages(attachments.value, 'temp');
    remarkError.value =
      remarkRequired.value && !remark.value.trim()
        ? props.operation === 'audit'
          ? '请填写审核意见'
          : '请填写分配备注'
        : remark.value.length > 1000
          ? '备注最多 1000 字'
          : '';
    if (remarkError.value) throw new Error(remarkError.value);
    if (attachments.value.length > 6) throw new Error('图片附件最多 6 张');
    if (!canSplit.value && mode.value !== 'unified')
      throw new Error('上新任务仅支持统一分配');
    if (props.operation === 'assign') {
      if (
        mode.value === 'unified' &&
        !users.value.some((u) => u.value === unified.value)
      )
        throw new Error('请选择处理人');
      if (
        mode.value === 'style_split' &&
        (!styles.value.length ||
          styles.value.some(
            (s) =>
              !users.value.some(
                (u) => u.value === assignees.value[String(s.id)],
              ),
          ))
      )
        throw new Error('请为每个款式选择处理人');
    }
  } catch (error) {
    message.warning((error as Error).message);
    return;
  }
  saving.value = true;
  try {
    const remarkInfoVO = {
      contentText: remark.value.trim(),
      imageUrls: attachments.value,
    };
    let completed = false;
    if (props.operation === 'assign') {
      const data: FlowAssignParams = {
        ...context!,
        assignMode: mode.value,
        remarkInfoVO,
      };
      if (mode.value === 'unified') {
        const user = users.value.find((u) => u.value === unified.value)!;
        data.unifiedAssigneeId = user.value;
        data.unifiedAssigneeName = user.name;
      } else
        data.styleAssignList = styles.value.map((s) => {
          const u = users.value.find(
            (u) => u.value === assignees.value[String(s.id)],
          )!;
          return { styleId: s.id, assigneeId: u.value, assigneeName: u.name };
        });
      completed = await assignFlowTaskApi(data);
    } else if (props.operation === 'audit') {
      completed = await auditFlowTaskApi({
        ...context!,
        auditInfoVO: { ...remarkInfoVO, auditStatus: auditStatus.value },
      });
    } else
      completed = await (
        props.operation === 'freeze' ? freezeFlowNodeApi : unfreezeFlowNodeApi
      )({ ...context!, remarkInfoVO });
    if (completed !== true) throw new Error(title.value + '未成功，请重试');
    message.success(title.value + '成功');
    emit('changed');
    emit('close');
  } catch (error) {
    if (error instanceof Error) message.error(error.message);
  } finally {
    saving.value = false;
  }
}
onMounted(load);
</script>
<template>
  <Modal
    open
    :title="title"
    :width="720"
    :confirm-loading="saving"
    :ok-button-props="{ disabled: loading || failed || pending > 0 }"
    :closable="!saving && pending === 0"
    :keyboard="!saving && pending === 0"
    :cancel-button-props="{ disabled: saving || pending > 0 }"
    :mask-closable="false"
    ok-text="确认执行"
    cancel-text="取消"
    @ok="submit"
    @cancel="emit('close')"
  >
    <Alert
      v-if="failed"
      type="error"
      message="分配数据加载失败，请重试"
      class="mb-4!"
    >
      <template #action>
        <Button @click="load">
          <span>重试</span>
        </Button>
      </template>
    </Alert>
    <Spin :spinning="loading">
      <Form layout="vertical" :disabled="saving || loading || failed">
        <p class="mb-4">
          {{ task.styleNo }} · {{ task.currentNodeName || task.currentNodeKey }}
        </p>
        <template v-if="operation === 'assign'">
          <FormItem label="分配方式">
            <RadioGroup v-model:value="mode">
              <Radio value="unified">统一分配</Radio>
              <Radio v-if="canSplit" value="style_split">按款式分配</Radio>
            </RadioGroup>
          </FormItem>
          <FormItem v-if="mode === 'unified'" label="处理人" required>
            <Select
              v-model:value="unified"
              :options="users"
              show-search
              option-filter-prop="label"
              placeholder="请选择处理人"
            />
          </FormItem>
          <template v-else>
            <Alert
              v-if="!styles.length"
              message="当前任务暂无可分配款式"
              type="info"
            />
            <FormItem
              v-for="style in styles"
              :key="String(style.id)"
              :label="`${style.styleNo} · ${style.styleName}`"
              required
            >
              <Select
                v-model:value="assignees[String(style.id)]"
                :options="users"
                show-search
                option-filter-prop="label"
                placeholder="请选择款式处理人"
              />
            </FormItem>
          </template>
        </template>
        <FormItem v-if="operation === 'audit'" label="审核结果" required>
          <RadioGroup v-model:value="auditStatus">
            <Radio :value="1">通过</Radio>
            <Radio :value="2">驳回</Radio>
          </RadioGroup>
        </FormItem>
        <FormItem
          :label="
            operation === 'audit'
              ? '审核意见'
              : operation === 'assign'
                ? '分配备注'
                : '操作备注'
          "
          :required="remarkRequired"
          :validate-status="remarkError ? 'error' : undefined"
          :help="remarkError"
        >
          <Input.TextArea
            v-model:value="remark"
            :rows="3"
            :maxlength="1000"
            show-count
            @change="remarkError = ''"
          />
        </FormItem>
        <FormItem label="图片附件">
          <WorkflowImages
            v-model="attachments"
            :max-count="6"
            multiple
            :disabled="saving || loading || failed"
            @busy="pending += $event"
          />
        </FormItem>
      </Form>
    </Spin>
  </Modal>
</template>
