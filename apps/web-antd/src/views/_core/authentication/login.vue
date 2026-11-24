<script setup lang="ts">
import type { AuthApi } from '#/api';

import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';

import {
  Alert,
  Button,
  Checkbox,
  Form,
  FormItem,
  Input,
  Space,
} from 'ant-design-vue';

import { getCaptchaConfigApi, resendLoginSmsApi } from '#/api';
import { useAuthStore } from '#/store';

import AliyunCaptcha from './aliyun-captcha.vue';

defineOptions({ name: 'Login' });
const auth = useAuthStore();
const rememberKey = 'i4-admin-remembered-username';
const remembered = localStorage.getItem(rememberKey) || '';
const remember = ref(Boolean(remembered));
const form = reactive({
  username: remembered,
  password: '',
  captchaVerifyParam: '',
});
const sms = reactive({ code: '' });
const challenge = ref<AuthApi.LoginResult>();
const captchaConfig = ref<AuthApi.CaptchaConfig>();
const configLoading = ref(true);
const configFailed = ref(false);
const captchaRef = ref<InstanceType<typeof AliyunCaptcha>>();
const resending = ref(false);
const countdown = ref(0);
let timer: ReturnType<typeof setInterval> | undefined;
function startCountdown() {
  countdown.value = 60;
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0 && timer) clearInterval(timer);
  }, 1000);
}
async function loadConfig() {
  configLoading.value = true;
  configFailed.value = false;
  try {
    captchaConfig.value = await getCaptchaConfigApi();
  } catch {
    configFailed.value = true;
  } finally {
    configLoading.value = false;
  }
}
async function submit() {
  if (auth.loginLoading || configLoading.value || configFailed.value) return;
  try {
    const result = await auth.authLogin({
      username: form.username.trim(),
      password: form.password,
      ...(captchaConfig.value?.enabled
        ? { captchaVerifyParam: form.captchaVerifyParam }
        : {}),
    });
    localStorage.setItem(
      rememberKey,
      remember.value ? form.username.trim() : '',
    );
    if (result.status === 'MFA_REQUIRED') {
      if (!result.challengeId) throw new Error('登录响应缺少短信挑战凭证');
      challenge.value = result;
      form.password = '';
      sms.code = '';
      startCountdown();
    }
  } catch {
    captchaRef.value?.reset();
  }
}
async function verifySms() {
  if (!challenge.value?.challengeId || auth.loginLoading) return;
  try {
    await auth.authVerifySms(challenge.value.challengeId, sms.code);
  } catch {
    /* 保留验证码表单，错误由接口统一展示。 */
  }
}
async function resendSms() {
  if (!challenge.value?.challengeId || countdown.value > 0 || resending.value)
    return;
  resending.value = true;
  try {
    await resendLoginSmsApi(challenge.value.challengeId);
    startCountdown();
  } catch {
    /* 接口统一展示错误。 */
  } finally {
    resending.value = false;
  }
}
function back() {
  challenge.value = undefined;
  sms.code = '';
  captchaRef.value?.reset();
}
onMounted(loadConfig);
onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});
</script>
<template>
  <div class="w-full">
    <h1 class="mb-2 text-2xl font-semibold">登录 I4 Admin</h1>
    <p class="text-muted-foreground mb-6">
      {{
        challenge
          ? `请输入发送至 ${challenge.maskedMobile || '绑定手机'} 的验证码`
          : '使用管理账号登录'
      }}
    </p>
    <Alert
      v-if="configFailed"
      class="mb-4"
      message="登录配置加载失败，请重试"
      type="error"
      show-icon
    >
      <template #action>
        <Button size="small" @click="loadConfig">重试</Button>
      </template>
    </Alert>
    <Form
      v-if="!challenge"
      name="system-login"
      :model="form"
      layout="vertical"
      @finish="submit"
    >
      <FormItem
        label="登录名"
        name="username"
        :rules="[
          {
            required: true,
            pattern: /^[a-zA-Z0-9_.@-]{3,64}$/,
            message: '请输入有效的登录名',
          },
        ]"
      >
        <Input
          v-model:value="form.username"
          autocomplete="username"
          :maxlength="64"
        />
      </FormItem>
      <FormItem
        label="密码"
        name="password"
        :rules="[{ required: true, message: '请输入密码' }]"
      >
        <Input.Password
          v-model:value="form.password"
          autocomplete="current-password"
          :maxlength="256"
        />
      </FormItem>
      <FormItem
        v-if="captchaConfig?.enabled"
        label="滑块验证"
        name="captchaVerifyParam"
        :rules="[{ required: true, message: '请先完成滑块验证' }]"
      >
        <AliyunCaptcha
          ref="captchaRef"
          v-model:value="form.captchaVerifyParam"
          :config="captchaConfig"
        />
      </FormItem>
      <div class="mb-4">
        <Checkbox v-model:checked="remember">记住登录名</Checkbox>
      </div>
      <Button
        class="w-full"
        type="primary"
        html-type="submit"
        :loading="auth.loginLoading || configLoading"
        :disabled="configFailed"
      >
        登录
      </Button>
    </Form>
    <Form
      v-else
      name="system-sms"
      :model="sms"
      layout="vertical"
      @finish="verifySms"
    >
      <FormItem
        label="短信验证码"
        name="code"
        :rules="[
          {
            required: true,
            pattern: /^[0-9]{6}$/,
            message: '请输入六位短信验证码',
          },
        ]"
      >
        <Input
          v-model:value="sms.code"
          autocomplete="one-time-code"
          inputmode="numeric"
          :maxlength="6"
        />
      </FormItem>
      <Space class="mb-4">
        <Button
          :disabled="countdown > 0"
          :loading="resending"
          @click="resendSms"
        >
          {{ countdown > 0 ? `${countdown} 秒后重发` : '重新发送' }}
        </Button>
        <Button :disabled="auth.loginLoading" @click="back">
          返回账号登录
        </Button>
      </Space>
      <Button
        class="w-full"
        type="primary"
        html-type="submit"
        :loading="auth.loginLoading"
      >
        验证并登录
      </Button>
    </Form>
  </div>
</template>
