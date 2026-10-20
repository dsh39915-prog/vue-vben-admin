<script setup lang="ts">
import type { LaunchTaskFilters } from '#/api';

import { computed, ref, watch } from 'vue';

import {
  Alert,
  Button,
  DatePicker,
  Form,
  FormItem,
  Input,
  Select,
  Space,
} from 'ant-design-vue';

import { getSimpleUserListApi } from '#/api';

import {
  flowNodeOptions,
  flowStatusOptions,
  overdueOptions,
  rangeFields,
  visualLevelOptions,
} from '../helpers';
const props = defineProps<{
  modelValue: LaunchTaskFilters;
  node?: boolean;
  manager?: boolean;
  loading?: boolean;
}>();
const emit = defineEmits<{
  'update:modelValue': [LaunchTaskFilters];
  search: [];
  reset: [];
}>();
const expanded = ref(false);
const users = ref<{ label: string; value: string }[]>([]);
const usersLoading = ref(false);
const usersFailed = ref(false);
const usersLoaded = ref(false);
const textFields = [
  { key: 'styleNo', label: '款号' },
  { key: 'productSeason', label: '开发年份季节' },
  { key: 'category', label: '品类' },
  { key: 'mainPlatform', label: '主推平台' },
] as const;
const statuses = computed(() =>
  props.node
    ? flowStatusOptions.filter((item) => [1, 2, 4].includes(item.value))
    : flowStatusOptions,
);
const ranges = computed(() =>
  props.node
    ? rangeFields.filter((item) =>
        ['flowNodePlanEndTimes', 'launchTimes'].includes(item.key),
      )
    : rangeFields,
);
const timeOverdueOptions = overdueOptions.map((item) => ({
  ...item,
  value: String(item.value),
}));
const userOptions = computed(() => {
  const value = props.modelValue.currentAssigneeId;
  return value && !users.value.some((item) => item.value === value)
    ? [...users.value, { label: `用户 #${value}`, value }]
    : users.value;
});
function update(key: keyof LaunchTaskFilters, value: unknown) {
  emit('update:modelValue', { ...props.modelValue, [key]: value });
}
function updateRange(key: keyof LaunchTaskFilters, value: unknown) {
  update(key, Array.isArray(value) && value.length === 2 ? value : undefined);
}
async function loadUsers() {
  if (usersLoading.value) return;
  usersLoading.value = true;
  usersFailed.value = false;
  try {
    const data = await getSimpleUserListApi();
    users.value = data.map((user) => ({
      value: String(user.id),
      label: `${user.nickname || user.username} (${user.username})`,
    }));
    usersLoaded.value = true;
  } catch {
    usersFailed.value = true;
  } finally {
    usersLoading.value = false;
  }
}
watch(
  () => expanded.value && props.manager,
  (value) => {
    if (value && !usersLoaded.value) void loadUsers();
  },
);
</script>
<template>
  <Form :model="modelValue" layout="inline" @finish="emit('search')">
    <FormItem v-for="field in textFields" :key="field.key" :label="field.label">
      <Input
        :value="modelValue[field.key]"
        allow-clear
        :placeholder="`请输入${field.label}`"
        class="w-44!"
        @update:value="update(field.key, $event)"
      />
    </FormItem>
    <FormItem label="视觉重要层级">
      <Select
        :value="modelValue.visualLevel"
        :options="visualLevelOptions"
        allow-clear
        placeholder="全部层级"
        class="w-36!"
        @update:value="update('visualLevel', $event)"
      />
    </FormItem>
    <FormItem :label="node ? '节点状态' : '流程状态'">
      <Select
        :value="modelValue.flowStatus"
        :options="statuses"
        allow-clear
        placeholder="全部状态"
        class="w-36!"
        @update:value="update('flowStatus', $event)"
      />
    </FormItem>
    <template v-if="expanded">
      <FormItem v-if="!node" label="当前节点">
        <Select
          :value="modelValue.flowNodeKey"
          :options="flowNodeOptions"
          allow-clear
          show-search
          option-filter-prop="label"
          placeholder="全部节点"
          class="w-60!"
          @update:value="update('flowNodeKey', $event)"
        />
      </FormItem>
      <FormItem v-if="manager" label="当前处理人">
        <Select
          :value="modelValue.currentAssigneeId"
          :options="userOptions"
          :loading="usersLoading"
          allow-clear
          show-search
          option-filter-prop="label"
          placeholder="全部处理人"
          class="w-48!"
          @update:value="update('currentAssigneeId', $event)"
        />
      </FormItem>
      <FormItem label="日期逾期情况">
        <Select
          :value="modelValue.dateOverdueStatus"
          :options="overdueOptions"
          allow-clear
          placeholder="全部"
          class="w-36!"
          @update:value="update('dateOverdueStatus', $event)"
        />
      </FormItem>
      <FormItem label="耗时逾期情况">
        <Select
          :value="modelValue.timeOverdueStatus"
          :options="timeOverdueOptions"
          allow-clear
          placeholder="全部"
          class="w-36!"
          @update:value="update('timeOverdueStatus', $event)"
        />
      </FormItem>
      <FormItem v-for="field in ranges" :key="field.key" :label="field.label">
        <DatePicker.RangePicker
          :value="modelValue[field.key]"
          show-time
          value-format="YYYY-MM-DD HH:mm:ss"
          @update:value="updateRange(field.key, $event)"
        />
      </FormItem>
    </template>
    <FormItem>
      <Space>
        <Button type="primary" html-type="submit" :loading="loading">
          <span>查询</span>
        </Button>
        <Button @click="emit('reset')"><span>重置</span></Button>
        <Button type="link" @click="expanded = !expanded">
          <span>{{ expanded ? '收起筛选' : '展开筛选' }}</span>
        </Button>
      </Space>
    </FormItem>
  </Form>
  <Alert
    v-if="expanded && manager && usersFailed"
    class="mt-3"
    type="warning"
    message="处理人列表加载失败"
  >
    <template #action>
      <Button size="small" :loading="usersLoading" @click="loadUsers">
        <span>重试</span>
      </Button>
    </template>
  </Alert>
</template>
