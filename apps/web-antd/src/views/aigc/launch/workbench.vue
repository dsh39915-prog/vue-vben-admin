<script setup lang="ts">
import type { DrawingNodeKey } from '#/features/drawing/nodes';

import { computed, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { ArrowLeft } from '@vben/icons';

import {
  Alert,
  Button,
  Card,
  Empty,
  Space,
  Spin,
  TabPane,
  Tabs,
} from 'ant-design-vue';

import {
  matchesDrawingScope,
  useDrawingAccess,
} from '#/features/drawing/access';
import { drawingPath, getDrawingNode } from '#/features/drawing/nodes';

import FlowAction from './components/flow-action.vue';
import MatchingAuditModal from './components/matching-audit-modal.vue';
import MatchingSchemes from './components/matching-schemes.vue';
import ModelAuditWorkspace from './components/model-audit-workspace.vue';
import ModelGenerationWorkspace from './components/model-generation-workspace.vue';
import ProductStyles from './components/product-styles.vue';
import StyleImageAuditModal from './components/style-image-audit-modal.vue';
import TaskFlowDetails from './components/task-flow-details.vue';
import TaskStyleResults from './components/task-style-results.vue';
import TaskSummary from './components/task-summary.vue';
import { useLaunchTask } from './use-launch-task';
import {
  assignNodeKeys,
  auditNodeKeys,
  canHandleTask,
} from './workflow-helpers';
const props = defineProps<{ nodeKey?: DrawingNodeKey; readOnly?: boolean }>();
const drawing = useDrawingAccess();
const activeTab = ref(
  props.nodeKey &&
    !['aiMatchingAudit', 'aiMatchingOutput'].includes(props.nodeKey)
    ? 'styles'
    : 'schemes',
);
const scoped = computed(() => Boolean(props.nodeKey));
const node = computed(() => getDrawingNode(props.nodeKey));
const allowed = computed(() =>
  props.nodeKey
    ? drawing.canVisit(props.nodeKey) &&
      (drawing.manager.value || Boolean(drawing.userId.value))
    : drawing.manager.value,
);
const taskScope = computed(() =>
  props.nodeKey && allowed.value ? drawing.scopeFor(props.nodeKey) : undefined,
);
const pending = ref({ results: false, schemes: false, styles: false });
const operation = ref<'assign' | 'audit' | 'freeze' | 'unfreeze'>();
const busy = computed(
  () =>
    pending.value.schemes ||
    pending.value.styles ||
    pending.value.results ||
    operation.value !== undefined,
);
const {
  task,
  context,
  loading,
  failed,
  metadataFailed,
  load,
  router,
} = useLaunchTask(
  () => busy.value,
  props.nodeKey ? () => drawing.scopeFor(props.nodeKey!) : undefined,
);
const showMatchingSchemes = computed(
  () =>
    !['pageProduction', 'retouching'].includes(
      props.nodeKey ?? context.value?.nodeKey ?? '',
    ),
);
watch(
  showMatchingSchemes,
  (visible) => {
    if (!visible && activeTab.value === 'schemes') activeTab.value = 'styles';
  },
  { immediate: true },
);
const editable = computed(
  () =>
    !props.readOnly &&
    !loading.value &&
    allowed.value &&
    canHandleTask(task.value) &&
    (!taskScope.value ||
      Boolean(task.value && matchesDrawingScope(task.value, taskScope.value))),
);
const frozen = computed(
  () =>
    !props.readOnly &&
    drawing.manager.value &&
    ![3, 5].includes(task.value?.flowStatus ?? 5) &&
    (task.value?.flowStatus === 4 || task.value?.currentNodeStatus === 4),
);
function refresh() {
  void load();
}
</script>
<template>
  <Page
    :title="node?.title || '人工任务工作台'"
    :description="
      readOnly
        ? '查看任务信息、节点明细与流转记录'
        : scoped
          ? '处理当前环节的制图任务'
          : '查看搭配方案与商品款式，处理当前流程节点'
    "
  >
    <Button
      type="link"
      class="mb-4! inline-flex! items-center gap-2 px-0!"
      :disabled="busy"
      @click="router.push(node ? drawingPath(node.key) : '/launch/tasks')"
    >
      <template #icon><ArrowLeft class="size-4" /></template>
      <span>返回{{ node?.title || '任务列表' }}</span>
    </Button>
    <Alert v-if="failed" :message="failed" type="error" class="mb-4!">
      <template #action>
        <Button @click="refresh">
          <span>重试</span>
        </Button>
      </template>
    </Alert>
    <Spin :spinning="loading">
      <Empty v-if="!task && !loading && !failed" description="请选择上新任务" />
      <template v-if="task">
        <TaskSummary :task="task">
          <Alert
            v-if="metadataFailed || !context"
            message="当前节点信息不完整，暂不能执行节点操作，请刷新任务。"
            type="warning"
            class="mb-4!"
          />
          <Space wrap>
            <Button
              v-if="
                editable &&
                !['aiImageModelAudit', 'aiImageActionAudit'].includes(
                  context?.nodeKey ?? '',
                ) &&
                auditNodeKeys.includes(context?.nodeKey ?? '')
              "
              type="primary"
              :disabled="busy"
              @click="operation = 'audit'"
            >
              <span>审核任务</span>
            </Button>
            <Button
              v-if="editable && assignNodeKeys.includes(context?.nodeKey ?? '')"
              type="primary"
              :disabled="busy"
              @click="operation = 'assign'"
            >
              <span>分配任务</span>
            </Button>
            <Button
              v-if="editable && drawing.manager.value"
              :disabled="busy"
              @click="operation = 'freeze'"
            >
              <span>冻结节点</span>
            </Button>
            <Button
              v-if="frozen && task.procInstId && task.currentNodeKey"
              :disabled="busy || loading"
              @click="operation = 'unfreeze'"
            >
              <span>解冻节点</span>
            </Button>
          </Space>
        </TaskSummary>
        <TaskFlowDetails v-if="readOnly" :task="task" />
        <ModelGenerationWorkspace
          v-if="
            !readOnly &&
            ['aiImageModelTask', 'aiImageActionTask'].includes(
              context?.nodeKey ?? '',
            )
          "
          :key="task.id"
          :task="task"
          :context="context"
          :editable="editable"
          @busy="pending.styles = $event"
          @changed="refresh"
          @cancel="router.push(node ? drawingPath(node.key) : '/launch/tasks')"
          @rejected="
            router.push(node ? drawingPath(node.key) : '/launch/tasks')
          "
        />
        <ModelAuditWorkspace
          v-else-if="
            !readOnly &&
            context &&
            ['aiImageModelAudit', 'aiImageActionAudit'].includes(
              context.nodeKey,
            )
          "
          :key="task.id"
          :task="task"
          :context="context"
          :editable="editable"
          @busy="pending.styles = $event"
          @changed="router.push(node ? drawingPath(node.key) : '/launch/tasks')"
          @cancel="router.push(node ? drawingPath(node.key) : '/launch/tasks')"
        />
        <Card v-else-if="!readOnly" :bordered="false">
          <Tabs
            v-model:active-key="activeTab"
            :destroy-inactive-tab-pane="false"
          >
            <TabPane v-if="showMatchingSchemes" key="schemes" tab="AI 搭配方案">
              <MatchingSchemes
                :key="task.id"
                :task="task"
                :context="context"
                :editable="editable && context?.nodeKey === 'aiMatchingOutput'"
                @changed="refresh"
                @busy="pending.schemes = $event"
              />
            </TabPane>
            <TabPane key="styles" tab="商品款式">
              <ProductStyles
                :key="task.id"
                :task="task"
                :context="context"
                :editable="editable"
                @changed="refresh"
                @busy="pending.styles = $event"
                @rejected="
                  router.push(node ? drawingPath(node.key) : '/launch/tasks')
                "
              />
            </TabPane>
            <TabPane
              v-if="
                ['aiImageModelTask', 'aiImageActionTask'].includes(
                  context?.nodeKey ?? '',
                )
              "
              key="batches"
              tab="生成结果与历史"
            >
              <TaskStyleResults
                :key="task.id"
                :task-id="task.id"
                :read-only="!editable"
                @busy="pending.results = $event"
              />
            </TabPane>
          </Tabs>
        </Card>
      </template>
    </Spin>
    <MatchingAuditModal
      v-if="
        operation === 'audit' && task && context?.nodeKey === 'aiMatchingAudit'
      "
      :task="task"
      @close="operation = undefined"
      @changed="
        operation = undefined;
        refresh();
      "
    />
    <StyleImageAuditModal
      v-else-if="
        operation === 'audit' &&
        task &&
        (context?.nodeKey === 'retouchingAudit' ||
          context?.nodeKey === 'pageProductionAudit')
      "
      :task="task"
      :node-key="
        context?.nodeKey === 'pageProductionAudit'
          ? 'pageProductionAudit'
          : 'retouchingAudit'
      "
      @close="operation = undefined"
      @changed="
        operation = undefined;
        refresh();
      "
    />
    <FlowAction
      v-else-if="operation && task"
      :task="task"
      :operation="operation"
      @close="operation = undefined"
      @changed="refresh"
    />
  </Page>
</template>
