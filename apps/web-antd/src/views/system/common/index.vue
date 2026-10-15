<script lang="ts" setup>
import { computed, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';
import {
  Button,
  Card,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

interface SystemRow {
  code: string;
  id: number;
  name: string;
  remark: string;
  status: '停用' | '正常';
  updatedAt: string;
}

interface ModuleConfig {
  description: string;
  itemName: string;
  readOnly?: boolean;
}

const route = useRoute();
const loading = ref(false);
const editorOpen = ref(false);
const editingId = ref<number>();
const query = reactive({ keyword: '', status: undefined as string | undefined });
const editor = reactive({ code: '', name: '', remark: '', status: '正常' });

const moduleConfigs: Record<string, ModuleConfig> = {
  SystemAiModel: { description: '维护模型供应商、模型能力、调用参数和启停状态', itemName: '模型' },
  SystemCacheList: { description: '查看 Redis 缓存键、TTL 与缓存内容', itemName: '缓存', readOnly: true },
  SystemCacheMonitor: { description: '查看 Redis 命中率、内存和连接信息', itemName: '缓存指标', readOnly: true },
  SystemConfig: { description: '维护系统运行参数与业务配置项', itemName: '参数' },
  SystemDataMonitor: { description: '查看数据库连接池与 SQL 执行监控', itemName: '数据源', readOnly: true },
  SystemDept: { description: '维护组织部门树及部门负责人', itemName: '部门' },
  SystemDict: { description: '维护字典类型及其字典数据', itemName: '字典' },
  SystemJob: { description: '维护定时任务、执行策略与运行日志', itemName: '任务' },
  SystemLoginLog: { description: '查询用户登录结果、地址和客户端信息', itemName: '登录日志', readOnly: true },
  SystemMenu: { description: '维护菜单路由、按钮权限和显示顺序', itemName: '菜单' },
  SystemNotice: { description: '维护平台通知和公告内容', itemName: '公告' },
  SystemOnlineUser: { description: '查看在线会话并支持强制下线', itemName: '在线会话', readOnly: true },
  SystemOperateLog: { description: '查询后台操作记录和异常详情', itemName: '操作日志', readOnly: true },
  SystemPost: { description: '维护组织岗位及岗位状态', itemName: '岗位' },
  SystemRole: { description: '维护角色、菜单权限和数据权限', itemName: '角色' },
  SystemServerMonitor: { description: '查看服务器 CPU、内存、磁盘和 JVM 状态', itemName: '服务指标', readOnly: true },
  SystemTenant: { description: '维护租户、有效期与租户套餐', itemName: '租户' },
  SystemTenantPackage: { description: '维护租户可使用的菜单与功能套餐', itemName: '租户套餐' },
  SystemUser: { description: '维护后台用户、部门、岗位和角色', itemName: '用户' },
};

const fallbackConfig: ModuleConfig = {
  description: '系统基础能力管理',
  itemName: '数据',
};

const currentConfig = computed(
  () => moduleConfigs[String(route.name)] || fallbackConfig,
);
const title = computed(() => String(route.meta.title || '系统管理'));

const sourceRows = ref<SystemRow[]>([
  {
    id: 1,
    name: '系统默认',
    code: 'SYSTEM_DEFAULT',
    status: '正常',
    remark: '系统初始化数据',
    updatedAt: '2026-09-02 10:30',
  },
  {
    id: 2,
    name: 'AIGC 运营',
    code: 'AIGC_OPERATION',
    status: '正常',
    remark: 'AIGC 业务管理数据',
    updatedAt: '2026-09-02 09:12',
  },
  {
    id: 3,
    name: '历史配置',
    code: 'LEGACY_CONFIG',
    status: '停用',
    remark: '演示停用状态',
    updatedAt: '2026-09-01 16:20',
  },
]);

const filteredRows = computed(() => {
  const keyword = query.keyword.trim().toLowerCase();
  return sourceRows.value.filter((item) => {
    const matchesKeyword =
      !keyword ||
      item.name.toLowerCase().includes(keyword) ||
      item.code.toLowerCase().includes(keyword);
    const matchesStatus = !query.status || item.status === query.status;
    return matchesKeyword && matchesStatus;
  });
});

const columns = [
  { dataIndex: 'id', key: 'id', title: '编号', width: 90 },
  { dataIndex: 'name', key: 'name', title: '名称' },
  { dataIndex: 'code', key: 'code', title: '编码', width: 190 },
  { dataIndex: 'status', key: 'status', title: '状态', width: 100 },
  { dataIndex: 'remark', key: 'remark', title: '备注' },
  { dataIndex: 'updatedAt', key: 'updatedAt', title: '更新时间', width: 170 },
  { fixed: 'right' as const, key: 'action', title: '操作', width: 170 },
];

function search() {
  loading.value = true;
  window.setTimeout(() => {
    loading.value = false;
  }, 200);
}

function reset() {
  query.keyword = '';
  query.status = undefined;
  search();
}

function openEditor(record?: Partial<SystemRow>) {
  editingId.value = record?.id;
  editor.name = record?.name || '';
  editor.code = record?.code || '';
  editor.status = record?.status || '正常';
  editor.remark = record?.remark || '';
  editorOpen.value = true;
}

function save() {
  if (!editor.name.trim() || !editor.code.trim()) {
    message.warning('请填写名称和编码');
    return;
  }
  if (editingId.value) {
    const row = sourceRows.value.find((item) => item.id === editingId.value);
    if (row) Object.assign(row, editor, { updatedAt: '2026-09-02 11:00' });
  } else {
    sourceRows.value.unshift({
      id: Math.max(...sourceRows.value.map((item) => item.id), 0) + 1,
      ...editor,
      status: editor.status as SystemRow['status'],
      updatedAt: '2026-09-02 11:00',
    });
  }
  editorOpen.value = false;
  message.success('保存成功');
}

function remove(id: number) {
  sourceRows.value = sourceRows.value.filter((item) => item.id !== id);
  message.success('删除成功');
}
</script>

<template>
  <Page :description="currentConfig.description" :title="title">
    <Card class="mb-4!" :bordered="false">
      <Form layout="inline">
        <FormItem label="关键词">
          <Input
            v-model:value="query.keyword"
            allow-clear
            placeholder="名称 / 编码"
            style="width: 240px"
            @press-enter="search"
          />
        </FormItem>
        <FormItem label="状态">
          <Select
            v-model:value="query.status"
            allow-clear
            placeholder="全部状态"
            style="width: 140px"
          >
            <Select.Option value="正常">正常</Select.Option>
            <Select.Option value="停用">停用</Select.Option>
          </Select>
        </FormItem>
        <FormItem>
          <Space>
            <Button type="primary" @click="search">查询</Button>
            <Button @click="reset">重置</Button>
          </Space>
        </FormItem>
      </Form>
    </Card>

    <Card :bordered="false">
      <template #title>{{ title }}列表</template>
      <template v-if="!currentConfig.readOnly" #extra>
        <Button type="primary" @click="openEditor()">
          新增{{ currentConfig.itemName }}
        </Button>
      </template>
      <Table
        :columns="columns"
        :data-source="filteredRows"
        :loading="loading"
        :pagination="{ pageSize: 10, showSizeChanger: true }"
        row-key="id"
        :scroll="{ x: 1050 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <Tag :color="record.status === '正常' ? 'success' : 'default'">
              {{ record.status }}
            </Tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <Button
              v-if="currentConfig.readOnly"
              size="small"
              type="link"
              @click="message.info(`查看 ${record.name}`)"
            >
              查看详情
            </Button>
            <Space v-else>
              <Button size="small" type="link" @click="openEditor(record)">编辑</Button>
              <Popconfirm title="确认删除这条数据吗？" @confirm="remove(record.id)">
                <Button danger size="small" type="link">删除</Button>
              </Popconfirm>
            </Space>
          </template>
        </template>
      </Table>
    </Card>

    <Modal
      v-model:open="editorOpen"
      :title="`${editingId ? '编辑' : '新增'}${currentConfig.itemName}`"
      @ok="save"
    >
      <Form class="pt-4" :label-col="{ span: 5 }" :wrapper-col="{ span: 17 }">
        <FormItem label="名称" required>
          <Input v-model:value="editor.name" placeholder="请输入名称" />
        </FormItem>
        <FormItem label="编码" required>
          <Input v-model:value="editor.code" placeholder="请输入唯一编码" />
        </FormItem>
        <FormItem label="状态">
          <Select v-model:value="editor.status">
            <Select.Option value="正常">正常</Select.Option>
            <Select.Option value="停用">停用</Select.Option>
          </Select>
        </FormItem>
        <FormItem label="备注">
          <Input.TextArea v-model:value="editor.remark" :rows="3" placeholder="请输入备注" />
        </FormItem>
      </Form>
    </Modal>
  </Page>
</template>
