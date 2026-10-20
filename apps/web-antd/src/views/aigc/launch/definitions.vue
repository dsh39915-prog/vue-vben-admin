<script setup lang="ts">
import type { ProcessDefinitionNode, ProcessDeployment } from '#/api';

import { computed, onUnmounted, reactive, ref } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  Descriptions,
  DescriptionsItem,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Space,
  Table,
} from 'ant-design-vue';

import {
  deployProcessDefinitionApi,
  getProcessDefinitionNodesApi,
} from '#/api';

const queryKey = ref('');
const loadedKey = ref('');
const nodes = ref<ProcessDefinitionNode[]>([]);
const loading = ref(false);
const failed = ref(false);
const queried = ref(false);
const deployOpen = ref(false);
const deploying = ref(false);
const deployment = ref<ProcessDeployment>();
const form = reactive({ processKey: '', processName: '' });
let latest = 0;
const labels: Record<string, string> = {
  id: '节点 ID',
  key: '节点 Key',
  name: '节点名称',
  nodeId: '节点 ID',
  nodeKey: '节点 Key',
  nodeName: '节点名称',
  type: '节点类型',
  taskDefinitionKey: '任务定义 Key',
};
const columns = computed(() =>
  [...new Set(nodes.value.flatMap((node) => Object.keys(node)))].map((key) => ({
    title: labels[key] ?? key,
    key,
    dataIndex: key,
    ellipsis: true,
  })),
);
async function search(key = queryKey.value.trim()) {
  if (deploying.value) return;
  if (!key) {
    message.warning('请输入流程定义 Key');
    return;
  }
  const request = ++latest;
  loading.value = true;
  failed.value = false;
  nodes.value = [];
  loadedKey.value = key;
  queried.value = true;
  try {
    const data = await getProcessDefinitionNodesApi(key);
    if (request !== latest) return;
    if (
      !Array.isArray(data) ||
      data.some(
        (node) => !node || typeof node !== 'object' || Array.isArray(node),
      )
    )
      throw new Error('Invalid process definition nodes');
    nodes.value = data;
  } catch {
    if (request === latest) failed.value = true;
  } finally {
    if (request === latest) loading.value = false;
  }
}
function openDeploy() {
  form.processKey = queryKey.value.trim();
  form.processName = '';
  deployOpen.value = true;
}
async function deploy() {
  if (deploying.value) return;
  const data = {
    processKey: form.processKey.trim(),
    processName: form.processName.trim(),
  };
  if (!data.processKey || !data.processName) {
    message.warning('请填写流程 Key 和流程名称');
    return;
  }
  deploying.value = true;
  let succeeded = false;
  try {
    const result = await deployProcessDefinitionApi(data);
    if (!result?.id) {
      message.warning('部署接口未返回部署 ID，请核对部署结果后再操作');
      return;
    }
    deployment.value = result;
    deployOpen.value = false;
    queryKey.value = data.processKey;
    message.success('流程部署成功');
    succeeded = true;
  } catch {
    /* Keep the form for correction or retry; shared interceptor shows errors. */
  } finally {
    deploying.value = false;
  }
  if (succeeded) await search(data.processKey);
}
onBeforeRouteLeave(() => !deploying.value);
onUnmounted(() => {
  latest += 1;
});
</script>
<template>
  <Page title="流程定义" description="按流程定义 Key 查询节点及部署流程">
    <Card :bordered="false" class="mb-4!">
      <Form
        :model="{ processDefinitionKey: queryKey }"
        layout="inline"
        @finish="search()"
      >
        <FormItem label="流程定义 Key">
          <Input
            v-model:value="queryKey"
            placeholder="请输入流程定义 Key"
            allow-clear
            :disabled="deploying"
            style="width: 320px"
          />
        </FormItem>
        <FormItem>
          <Space wrap>
            <Button
              type="primary"
              html-type="submit"
              :loading="loading"
              :disabled="deploying"
            >
              <span>查询节点</span>
            </Button>
            <Button :disabled="deploying || loading" @click="openDeploy">
              <span>部署流程</span>
            </Button>
          </Space>
        </FormItem>
      </Form>
    </Card>
    <Card
      v-if="deployment"
      title="本次部署结果"
      :bordered="false"
      class="mb-4!"
    >
      <Descriptions bordered :column="2">
        <DescriptionsItem label="部署 ID">{{ deployment.id }}</DescriptionsItem>
        <DescriptionsItem label="名称">
          {{ deployment.name || '-' }}
        </DescriptionsItem>
        <DescriptionsItem label="Key">
          {{ deployment.key || '-' }}
        </DescriptionsItem>
        <DescriptionsItem label="部署时间">
          {{ deployment.deploymentTime || '-' }}
        </DescriptionsItem>
      </Descriptions>
    </Card>
    <Card v-if="queried" :title="loadedKey" :bordered="false">
      <Alert
        v-if="failed"
        type="error"
        message="流程定义节点加载失败，请重试"
        class="mb-4!"
      >
        <template #action>
          <Button :disabled="loading || deploying" @click="search(loadedKey)">
            <span>重试</span>
          </Button>
        </template>
      </Alert>
      <Table
        :columns="columns"
        :data-source="nodes"
        :loading="loading"
        :pagination="false"
        :scroll="{ x: 800 }"
        :row-key="(_node: ProcessDefinitionNode, index?: number) => index ?? 0"
      />
    </Card>
    <Modal
      v-model:open="deployOpen"
      title="部署流程"
      ok-text="确认部署"
      :confirm-loading="deploying"
      :closable="!deploying"
      :mask-closable="false"
      :keyboard="!deploying"
      :cancel-button-props="{ disabled: deploying }"
      @ok="deploy"
    >
      <Form :model="form" layout="vertical">
        <FormItem label="流程 Key" required>
          <Input
            v-model:value="form.processKey"
            :disabled="deploying"
            placeholder="请输入流程 Key"
          />
        </FormItem>
        <FormItem label="流程名称" required>
          <Input
            v-model:value="form.processName"
            :disabled="deploying"
            placeholder="请输入流程名称"
          />
        </FormItem>
      </Form>
    </Modal>
  </Page>
</template>
