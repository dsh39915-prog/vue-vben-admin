<script setup lang="ts">
import { Button, Card } from 'ant-design-vue';

import { useAuthStore } from '#/store';

import PasswordSetting from '../profile/password-setting.vue';
const auth = useAuthStore();
</script>
<template>
  <Card title="修改登录密码">
    <PasswordSetting />
    <Button class="mt-4" type="link" @click="auth.logout(false)">
      退出登录
    </Button>
  </Card>
</template>
