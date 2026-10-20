<script setup lang="ts">
import type { FormInstance } from 'ant-design-vue';

import { reactive, ref } from 'vue';

import { Button, Form, FormItem, Input, message } from 'ant-design-vue';

import { updateUserProfilePasswordApi } from '#/api';
const editor = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
});
const saving = ref(false);
const form = ref<FormInstance>();
async function save() {
  if (saving.value) return;
  saving.value = true;
  try {
    if (
      (await updateUserProfilePasswordApi(
        editor.oldPassword,
        editor.newPassword,
      )) === false
    ) {
      message.error('密码修改失败，请重试');
      return;
    }
    form.value?.resetFields();
    message.success('密码修改成功');
  } catch {
    /* Keep values available for retry. */
  } finally {
    saving.value = false;
  }
}
</script>
<template>
  <Form
    ref="form"
    :model="editor"
    layout="vertical"
    class="max-w-xl"
    :disabled="saving"
    @finish="save"
  >
    <FormItem
      label="旧密码"
      name="oldPassword"
      :rules="[{ required: true, message: '请输入旧密码' }]"
    >
      <Input.Password
        v-model:value="editor.oldPassword"
        autocomplete="current-password"
      />
    </FormItem>
    <FormItem
      label="新密码"
      name="newPassword"
      :rules="[{ required: true, message: '请输入新密码' }]"
    >
      <Input.Password
        v-model:value="editor.newPassword"
        autocomplete="new-password"
      />
    </FormItem>
    <FormItem
      label="确认密码"
      name="confirmPassword"
      :dependencies="['newPassword']"
      :rules="[
        { required: true, message: '请确认新密码' },
        {
          validator: async (_rule: unknown, value: string) => {
            if (value !== editor.newPassword) throw new Error('两次密码不一致');
          },
        },
      ]"
    >
      <Input.Password
        v-model:value="editor.confirmPassword"
        autocomplete="new-password"
      />
    </FormItem>
    <Button type="primary" html-type="submit" :loading="saving">
      <span>修改密码</span>
    </Button>
  </Form>
</template>
