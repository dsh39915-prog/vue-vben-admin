<script setup lang="ts">
import type { UserProfile } from '#/api';

import { onMounted, reactive, ref } from 'vue';

import { useUserStore } from '@vben/stores';

import {
  Alert,
  Button,
  Form,
  FormItem,
  Input,
  message,
  Select,
  Spin,
} from 'ant-design-vue';

import { getUserProfileApi, updateUserProfileApi } from '#/api';
const userStore = useUserStore();
const profile = ref<UserProfile>();
const editor = reactive({
  nickname: '',
  email: '',
  mobile: '',
  avatar: '',
  sex: 0,
});
const loading = ref(false);
const saving = ref(false);
const failed = ref(false);
async function load() {
  loading.value = true;
  failed.value = false;
  try {
    const data = await getUserProfileApi();
    profile.value = data;
    Object.assign(editor, {
      nickname: data.nickname,
      email: data.email || '',
      mobile: data.mobile || '',
      avatar: data.avatar || '',
      sex: data.sex ?? 0,
    });
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}
async function save() {
  if (saving.value || !profile.value) return;
  saving.value = true;
  try {
    if ((await updateUserProfileApi({ ...editor })) === false) {
      message.error('保存失败，请重试');
      return;
    }
    if (userStore.userInfo)
      userStore.setUserInfo({
        ...userStore.userInfo,
        realName: editor.nickname,
        avatar: editor.avatar,
      });
    message.success('个人信息更新成功');
  } catch {
    /* Keep values available for retry. */
  } finally {
    saving.value = false;
  }
}
onMounted(load);
</script>
<template>
  <Spin :spinning="loading">
    <Alert v-if="failed" type="error" message="个人信息加载失败" class="mb-4!">
      <template #action>
        <Button @click="load">
          <span>重试</span>
        </Button>
      </template>
    </Alert>
    <Form
      v-if="profile && !failed"
      :model="editor"
      layout="vertical"
      class="max-w-xl"
      :disabled="saving"
      @finish="save"
    >
      <FormItem label="用户名">
        <Input :value="profile.username" disabled />
      </FormItem>
      <FormItem
        label="用户昵称"
        name="nickname"
        :rules="[
          { required: true, message: '请输入昵称' },
          { max: 30, message: '昵称最多 30 个字符' },
        ]"
      >
        <Input v-model:value="editor.nickname" />
      </FormItem>
      <FormItem
        label="头像地址"
        name="avatar"
        :rules="[{ type: 'url', message: '请输入有效图片地址' }]"
      >
        <Input v-model:value="editor.avatar" placeholder="https://..." />
      </FormItem>
      <FormItem
        label="邮箱"
        name="email"
        :rules="[
          { type: 'email', message: '请输入有效邮箱' },
          { max: 50, message: '邮箱最多 50 个字符' },
        ]"
      >
        <Input v-model:value="editor.email" />
      </FormItem>
      <FormItem
        label="手机号"
        name="mobile"
        :rules="[{ pattern: /^1\d{10}$/, message: '请输入 11 位手机号' }]"
      >
        <Input v-model:value="editor.mobile" />
      </FormItem>
      <FormItem label="性别">
        <Select
          v-model:value="editor.sex"
          :options="[
            { label: '未知', value: 0 },
            { label: '男', value: 1 },
            { label: '女', value: 2 },
          ]"
        />
      </FormItem>
      <FormItem label="所属部门">
        <Input :value="profile.dept?.name || '—'" disabled />
      </FormItem>
      <FormItem label="角色">
        <Input
          :value="(profile.roles || []).map((r) => r.name).join('、') || '—'"
          disabled
        />
      </FormItem>
      <FormItem label="岗位">
        <Input
          :value="(profile.posts || []).map((r) => r.name).join('、') || '—'"
          disabled
        />
      </FormItem>
      <FormItem label="最后登录">
        <Input
          :value="
            [profile.loginDate, profile.loginIp].filter(Boolean).join(' / ')
          "
          disabled
        />
      </FormItem>
      <Button type="primary" html-type="submit" :loading="saving">
        <span>保存个人信息</span>
      </Button>
    </Form>
  </Spin>
</template>
