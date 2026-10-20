<script setup lang="ts">
import { Alert } from 'ant-design-vue';
</script>
<template>
  <div>
    <Alert type="info" message="请从第三方登录入口进入平台授权" />
    <RouterLink to="/auth/login"> 返回登录页 </RouterLink>
  </div>
</template>
