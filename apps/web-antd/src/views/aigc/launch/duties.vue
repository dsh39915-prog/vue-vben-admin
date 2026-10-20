<script setup lang="ts">
import type { RoleRecord, UserRecord } from '#/api';

import { computed, onMounted, ref } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';

import { Page } from '@vben/common-ui';
import { useAccessStore } from '@vben/stores';

import {
  Alert,
  Button,
  Card,
  Checkbox,
  Form,
  FormItem,
  message,
  Select,
  Space,
  Spin,
  TabPane,
  Tabs,
} from 'ant-design-vue';

import {
  assignUserRolesApi,
  getAllSimpleRoleListApi,
  getMenuListApi,
  getRoleMenuIdsApi,
  getSimpleUserListApi,
  getUserRoleIdsApi,
} from '#/api';
import {
  drawingDutyOptions,
  roleDrawingDuties,
  saveRoleDrawingDuties,
} from '#/features/drawing/permissions';

const access = useAccessStore();
const has = (code: string) =>
  access.accessCodes.includes('*:*:*') || access.accessCodes.includes(code);
const canRoles = computed(() => has('system:permission:assign-role-menu'));
const canUsers = computed(() => has('system:permission:assign-user-role'));
const roles = ref<RoleRecord[]>([]);
const users = ref<UserRecord[]>([]);
const roleId = ref<number>();
const userId = ref<number>();
const duties = ref<string[]>([]);
const roleIds = ref<number[]>([]);
const saving = ref(false);
const loading = ref(false);
const roleLoading = ref(false);
const userLoading = ref(false);
const failed = ref('');
const roleFailed = ref('');
const userFailed = ref('');
const roleLoaded = ref(false);
const userLoaded = ref(false);
const tab = ref(canRoles.value ? 'roles' : 'users');
let roleRequest = 0;
let userRequest = 0;
const roleOptions = computed(() =>
  roles.value
    .filter((item) => item.id)
    .map((item) => ({ label: item.name, value: item.id! })),
);
const userOptions = computed(() =>
  users.value
    .filter((item) => item.id)
    .map((item) => ({
      label: (item.nickname || item.username) + ' (' + item.username + ')',
      value: item.id!,
    })),
);
const userRoleOptions = computed(() => [
  ...roleOptions.value,
  ...roleIds.value
    .filter((id) => !roles.value.some((role) => role.id === id))
    .map((id) => ({ label: '已分配角色 #' + id, value: id })),
]);
async function loadOptions() {
  loading.value = true;
  failed.value = '';
  try {
    const [roleList, userList] = await Promise.all([
      getAllSimpleRoleListApi(),
      canUsers.value ? getSimpleUserListApi() : Promise.resolve([]),
    ]);
    if (!Array.isArray(roleList) || !Array.isArray(userList))
      throw new Error('角色或员工列表格式不正确');
    roles.value = roleList;
    users.value = userList;
  } catch {
    failed.value = '角色或员工列表加载失败，请重试';
  } finally {
    loading.value = false;
  }
}
async function loadRole() {
  const request = ++roleRequest;
  roleLoaded.value = false;
  duties.value = [];
  roleFailed.value = '';
  if (!roleId.value) return;
  roleLoading.value = true;
  try {
    const [menus, ids] = await Promise.all([
      getMenuListApi(),
      getRoleMenuIdsApi(roleId.value),
    ]);
    if (request !== roleRequest) return;
    if (!Array.isArray(menus) || !Array.isArray(ids))
      throw new Error('Invalid role permissions');
    duties.value = roleDrawingDuties(menus, ids);
    roleLoaded.value = true;
  } catch {
    if (request === roleRequest) roleFailed.value = '角色职责加载失败，请重试';
  } finally {
    if (request === roleRequest) roleLoading.value = false;
  }
}
async function loadUser() {
  const request = ++userRequest;
  userLoaded.value = false;
  roleIds.value = [];
  userFailed.value = '';
  if (!userId.value) return;
  userLoading.value = true;
  try {
    const ids = await getUserRoleIdsApi(userId.value);
    if (request !== userRequest) return;
    if (!Array.isArray(ids)) throw new Error('Invalid user roles');
    roleIds.value = ids;
    userLoaded.value = true;
  } catch {
    if (request === userRequest) userFailed.value = '员工角色加载失败，请重试';
  } finally {
    if (request === userRequest) userLoading.value = false;
  }
}
async function saveDuties() {
  if (
    !canRoles.value ||
    saving.value ||
    roleLoading.value ||
    !roleLoaded.value ||
    !roleId.value
  )
    return;
  saving.value = true;
  try {
    await saveRoleDrawingDuties(
      roleId.value,
      duties.value,
      has('system:menu:create'),
    );
    message.success('职责已保存，员工重新登录后生效');
  } catch (error) {
    if (error instanceof Error) message.error(error.message);
  } finally {
    saving.value = false;
  }
}
async function saveUser() {
  if (
    !canUsers.value ||
    saving.value ||
    userLoading.value ||
    !userLoaded.value ||
    !userId.value
  )
    return;
  saving.value = true;
  try {
    const saved = await assignUserRolesApi(userId.value, roleIds.value);
    if (saved !== true) throw new Error('员工角色未保存，请重试');
    message.success('角色已保存，员工重新登录后生效');
  } catch (error) {
    if (error instanceof Error) message.error(error.message);
  } finally {
    saving.value = false;
  }
}
onBeforeRouteLeave(() => !saving.value);
onMounted(loadOptions);
</script>
<template>
  <Page
    title="制图职责"
    description="先为角色勾选制图职责，再将角色分配给员工；多个角色的职责合并生效"
  >
    <Alert
      v-if="!canRoles && !canUsers"
      type="error"
      message="当前账号没有职责授权权限"
    />
    <Card v-else :bordered="false">
      <Alert v-if="failed" :message="failed" type="error" class="mb-4!">
        <template #action>
          <Button :disabled="saving" @click="loadOptions">
            <span>重试</span>
          </Button>
        </template>
      </Alert>
      <Spin :spinning="loading">
        <Tabs
          v-model:active-key="tab"
          :tab-bar-style="{ pointerEvents: saving ? 'none' : undefined }"
        >
          <TabPane v-if="canRoles" key="roles" tab="角色职责">
            <Form layout="vertical">
              <FormItem label="角色">
                <Select
                  v-model:value="roleId"
                  :options="roleOptions"
                  placeholder="请选择角色"
                  show-search
                  option-filter-prop="label"
                  :disabled="saving || loading"
                  style="width: 360px"
                  @change="loadRole"
                />
              </FormItem>
              <Alert
                v-if="roleFailed"
                :message="roleFailed"
                type="error"
                class="mb-4!"
              >
                <template #action>
                  <Button @click="loadRole">
                    <span>重试</span>
                  </Button>
                </template>
              </Alert>
              <Spin :spinning="roleLoading">
                <FormItem v-if="roleLoaded" label="可访问的制图环节">
                  <Checkbox.Group
                    v-model:value="duties"
                    :disabled="saving"
                    class="grid gap-4 md:grid-cols-2"
                  >
                    <Checkbox
                      v-for="option in drawingDutyOptions"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </Checkbox>
                  </Checkbox.Group>
                </FormItem>
              </Spin>
              <Space>
                <Button
                  type="primary"
                  :loading="saving"
                  :disabled="!roleLoaded || roleLoading"
                  @click="saveDuties"
                >
                  <span>保存职责</span>
                </Button>
                <Button :disabled="saving" @click="loadRole">
                  <span>重新加载职责</span>
                </Button>
              </Space>
            </Form>
          </TabPane>
          <TabPane v-if="canUsers" key="users" tab="员工角色">
            <Form layout="vertical">
              <FormItem label="员工">
                <Select
                  v-model:value="userId"
                  :options="userOptions"
                  placeholder="请选择员工"
                  show-search
                  option-filter-prop="label"
                  :disabled="saving || loading"
                  style="width: 360px"
                  @change="loadUser"
                />
              </FormItem>
              <Alert
                v-if="userFailed"
                :message="userFailed"
                type="error"
                class="mb-4!"
              >
                <template #action>
                  <Button @click="loadUser">
                    <span>重试</span>
                  </Button>
                </template>
              </Alert>
              <Spin :spinning="userLoading">
                <FormItem v-if="userLoaded" label="员工拥有的角色">
                  <Select
                    v-model:value="roleIds"
                    mode="multiple"
                    :options="userRoleOptions"
                    :disabled="saving"
                    style="width: 100%"
                    placeholder="请选择角色"
                    option-filter-prop="label"
                  />
                </FormItem>
              </Spin>
              <Space>
                <Button
                  type="primary"
                  :loading="saving"
                  :disabled="!userLoaded || userLoading"
                  @click="saveUser"
                >
                  <span>保存员工角色</span>
                </Button>
                <Button :disabled="saving" @click="loadUser">
                  <span>重新加载角色</span>
                </Button>
              </Space>
            </Form>
          </TabPane>
        </Tabs>
      </Spin>
    </Card>
  </Page>
</template>
