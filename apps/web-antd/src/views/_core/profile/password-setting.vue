<script setup lang="ts">
import type { FormInstance } from 'ant-design-vue';

import { reactive, ref } from 'vue';

import { Alert, Button, Form, FormItem, Input, message } from 'ant-design-vue';

import { changeCurrentPasswordApi } from '#/api';
import { useAuthStore } from '#/store';
import { passwordRules } from '#/views/system/resource-config';

const auth = useAuthStore();
const formRef = ref<FormInstance>();
const saving = ref(false);
const form = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
});
async function save() {
  if (saving.value) return;
  saving.value = true;
  try {
    await formRef.value?.validate();
  } catch {
    saving.value = false;
    return;
  }
  try {
    await changeCurrentPasswordApi({
      oldPassword: form.oldPassword,
      newPassword: form.newPassword,
    });
    message.success('密码已修改，请使用新密码重新登录');
    Object.assign(form, {
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    await auth.logout(false, false);
  } catch {
    /* 保留表单供重试。 */
  } finally {
    saving.value = false;
  }
}
</script>
<template>
  <div class="w-full max-w-xl">
    <Alert
      class="mb-4"
      :message="
        auth.passwordResetRequired
          ? '首次登录或密码重置后，需要先修改密码才能使用系统'
          : '修改密码后会撤销全部会话，需要重新登录'
      "
      type="info"
      show-icon
    />
    <Form
      ref="formRef"
      name="change-password"
      :model="form"
      :disabled="saving"
      layout="vertical"
      @finish="save"
    >
      <FormItem
        label="当前密码"
        name="oldPassword"
        :rules="[{ required: true, message: '请输入当前密码' }]"
      >
        <Input.Password
          v-model:value="form.oldPassword"
          autocomplete="current-password"
          :maxlength="256"
        />
      </FormItem>
      <FormItem label="新密码" name="newPassword" :rules="passwordRules">
        <Input.Password
          v-model:value="form.newPassword"
          autocomplete="new-password"
        />
      </FormItem>
      <FormItem
        label="确认新密码"
        name="confirmPassword"
        :rules="[
          { required: true, message: '请再次输入新密码' },
          {
            validator: async (_rule: unknown, value: string) => {
              if (value !== form.newPassword)
                throw new Error('两次输入的密码不一致');
            },
          },
        ]"
      >
        <Input.Password
          v-model:value="form.confirmPassword"
          autocomplete="new-password"
        />
      </FormItem>
      <Button type="primary" html-type="submit" :loading="saving">
        修改密码
      </Button>
    </Form>
  </div>
</template>
