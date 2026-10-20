<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import {
  Alert,
  Button,
  Form,
  FormItem,
  Input,
  message,
  Select,
} from 'ant-design-vue';

import {
  getSocialAuthRedirectApi,
  registerApi,
  resetPasswordApi,
  sendSmsCodeApi,
  smsLoginApi,
} from '#/api';
import { useAuthStore } from '#/store';

import CaptchaDialog from './captcha-dialog.vue';
const props = defineProps<{ mode: 'login' | 'register' | 'reset' | 'sms' }>();
const auth = useAuthStore();
const router = useRouter();
const form = reactive({
  username: '',
  nickname: '',
  password: '',
  confirmPassword: '',
  mobile: '',
  code: '',
});
const captcha = ref<InstanceType<typeof CaptchaDialog>>();
const busy = ref(false);
const sending = ref(false);
const countdown = ref(0);
const error = ref('');
const provider = ref<number>(20);
const title = computed(
  () =>
    ({
      login: '账号登录',
      register: '注册账号',
      sms: '短信登录',
      reset: '重置密码',
    })[props.mode],
);
let timer: ReturnType<typeof setInterval> | undefined;
const smsScene = { login: 21, reset: 23 } as const;
async function sendCode() {
  if (sending.value || countdown.value) return;
  if (!/^1\d{10}$/.test(form.mobile)) {
    message.warning('请输入 11 位手机号');
    return;
  }
  sending.value = true;
  error.value = '';
  const mobile = form.mobile;
  try {
    const verification = await captcha.value?.verify();
    if (!verification) return;
    const ok = await sendSmsCodeApi({
      mobile,
      scene: props.mode === 'reset' ? smsScene.reset : smsScene.login,
      captchaVerification: verification,
    });
    if (!ok) {
      error.value = '验证码发送失败，请重试';
      return;
    }
    message.success('验证码已发送');
    countdown.value = 60;
    timer = setInterval(() => {
      countdown.value--;
      if (!countdown.value) clearInterval(timer);
    }, 1000);
  } catch {
    error.value = '验证码发送失败，请查看接口提示后重试';
  } finally {
    sending.value = false;
  }
}
async function submit() {
  if (busy.value || sending.value) return;
  busy.value = true;
  error.value = '';
  const data = { ...form };
  try {
    if (props.mode === 'reset') {
      if (
        !(await resetPasswordApi({
          mobile: data.mobile,
          code: data.code,
          password: data.password,
        }))
      ) {
        error.value = '密码重置失败，请重试';
        return;
      }
      message.success('密码已重置，请登录');
      await router.replace('/auth/login');
      return;
    }
    let verification: string | undefined;
    if (props.mode !== 'sms') {
      verification = await captcha.value?.verify();
      if (!verification) return;
    }
    const authenticate =
      props.mode === 'sms'
        ? () => smsLoginApi({ mobile: data.mobile, code: data.code })
        : props.mode === 'register'
          ? () =>
              registerApi({
                username: data.username,
                nickname: data.nickname,
                password: data.password,
                captchaVerification: verification,
              })
          : undefined;
    await auth.authLogin(
      {
        username: data.username,
        password: data.password,
        captchaVerification: verification,
      },
      undefined,
      authenticate,
    );
  } catch {
    error.value = '操作未完成，请查看接口提示后重试';
  } finally {
    busy.value = false;
  }
}
async function social() {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    const redirectUri = new URL(
      router.resolve('/auth/social-callback').href,
      location.origin,
    ).href;
    const address = await getSocialAuthRedirectApi(provider.value, redirectUri);
    const url = new URL(address);
    const state = url.searchParams.get('state');
    if (!['http:', 'https:'].includes(url.protocol) || !state)
      throw new Error('授权地址无效或缺少 state，请检查后端第三方登录配置');
    sessionStorage.setItem(
      'social-login',
      JSON.stringify({ type: provider.value, state, createdAt: Date.now() }),
    );
    location.assign(url.href);
  } catch (e) {
    error.value =
      e instanceof Error ? e.message : '无法获取授权地址，请查看接口提示';
    busy.value = false;
  }
}
onBeforeUnmount(() => clearInterval(timer));
</script>
<template>
  <div>
    <h2 class="mb-6 text-2xl font-bold">{{ title }}</h2>
    <Alert v-if="error" class="mb-4!" type="error" :message="error" show-icon />
    <Form
      :model="form"
      layout="vertical"
      :disabled="busy || sending"
      @finish="submit"
    >
      <FormItem
        v-if="mode === 'login' || mode === 'register'"
        label="账号"
        name="username"
        :rules="
          mode === 'register'
            ? [
                { required: true, message: '请输入账号' },
                {
                  pattern: /^[a-zA-Z0-9]{4,30}$/,
                  message: '账号为 4–30 位字母或数字',
                },
              ]
            : [{ required: true, message: '请输入账号' }]
        "
      >
        <Input v-model:value="form.username" autocomplete="username" />
      </FormItem>
      <FormItem
        v-if="mode === 'register'"
        label="昵称"
        name="nickname"
        :rules="[
          { required: true, message: '请输入昵称' },
          { max: 30, message: '昵称最多 30 个字符' },
        ]"
      >
        <Input v-model:value="form.nickname" />
      </FormItem>
      <FormItem
        v-if="mode === 'sms' || mode === 'reset'"
        label="手机号"
        name="mobile"
        :rules="[
          { required: true, message: '请输入手机号' },
          { pattern: /^1\d{10}$/, message: '请输入 11 位手机号' },
        ]"
      >
        <Input v-model:value="form.mobile" autocomplete="tel" />
      </FormItem>
      <FormItem
        v-if="mode === 'sms' || mode === 'reset'"
        label="短信验证码"
        name="code"
        :rules="[{ required: true, message: '请输入验证码' }]"
      >
        <div class="flex gap-2">
          <Input v-model:value="form.code" autocomplete="one-time-code" />
          <Button
            :disabled="busy || sending || countdown > 0"
            :loading="sending"
            @click="sendCode"
          >
            <span>{{
              countdown > 0 ? `${countdown} 秒后重发` : '发送验证码'
            }}</span>
          </Button>
        </div>
      </FormItem>
      <FormItem
        v-if="mode !== 'sms'"
        :label="mode === 'reset' ? '新密码' : '密码'"
        name="password"
        :rules="[{ required: true, message: '请输入密码' }]"
      >
        <Input.Password
          v-model:value="form.password"
          :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
        />
      </FormItem>
      <FormItem
        v-if="mode === 'register' || mode === 'reset'"
        label="确认密码"
        name="confirmPassword"
        :dependencies="['password']"
        :rules="[
          { required: true, message: '请确认密码' },
          {
            validator: async (_r: unknown, v: string) => {
              if (v !== form.password) throw new Error('两次密码不一致');
            },
          },
        ]"
      >
        <Input.Password
          v-model:value="form.confirmPassword"
          autocomplete="new-password"
        />
      </FormItem>
      <Button type="primary" html-type="submit" block :loading="busy">
        <span>{{ title }}</span>
      </Button>
    </Form>
    <div class="mt-4 flex flex-wrap gap-4">
      <RouterLink v-if="mode !== 'login'" to="/auth/login">
        返回账号登录
      </RouterLink>
      <template v-else>
        <RouterLink to="/auth/code-login">短信登录</RouterLink>
        <RouterLink to="/auth/forget-password">忘记密码</RouterLink>
        <RouterLink to="/auth/register">注册账号</RouterLink>
      </template>
    </div>
    <div v-if="mode === 'login'" class="mt-6 flex gap-2">
      <Select
        v-model:value="provider"
        aria-label="第三方登录平台"
        class="min-w-40"
        :disabled="busy"
        :options="[
          { label: '钉钉', value: 20 },
          { label: '企业微信', value: 30 },
          { label: '微信开放平台', value: 32 },
          { label: '微信公众平台', value: 31 },
          { label: 'Gitee', value: 10 },
        ]"
      />
      <Button :disabled="busy" @click="social">
        <span>第三方登录</span>
      </Button>
    </div>
    <CaptchaDialog ref="captcha" />
  </div>
</template>
