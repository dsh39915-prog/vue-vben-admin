<script setup lang="ts">
import type { Recordable } from '@vben/types';

import type { VbenFormSchema } from '#/adapter/form';

import { computed, onMounted, ref } from 'vue';

import { ProfileBaseSetting } from '@vben/common-ui';

import {
  getUserProfileApi,
  updateUserProfileApi,
} from '#/api';

import { message } from 'ant-design-vue';

const profileBaseSettingRef = ref();

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      fieldName: 'nickname',
      component: 'Input',
      label: '用户昵称',
    },
    {
      fieldName: 'username',
      component: 'Input',
      componentProps: { disabled: true },
      label: '用户名',
    },
    {
      fieldName: 'email',
      component: 'Input',
      label: '邮箱',
    },
    {
      fieldName: 'mobile',
      component: 'Input',
      label: '手机号',
    },
    {
      fieldName: 'sex',
      component: 'Select',
      componentProps: {
        options: [
          { label: '未知', value: 0 },
          { label: '男', value: 1 },
          { label: '女', value: 2 },
        ],
      },
      label: '性别',
    },
    {
      fieldName: 'deptName',
      component: 'Input',
      componentProps: { disabled: true },
      label: '所属部门',
    },
    {
      fieldName: 'rolesText',
      component: 'Input',
      componentProps: { disabled: true },
      label: '角色',
    },
    {
      fieldName: 'postsText',
      component: 'Input',
      componentProps: { disabled: true },
      label: '岗位',
    },
  ];
});

onMounted(async () => {
  const profile = await getUserProfileApi();
  profileBaseSettingRef.value.getFormApi().setValues({
    ...profile,
    deptName: profile.dept?.name || '',
    postsText: profile.posts.map((item) => item.name).join('、'),
    rolesText: profile.roles.map((item) => item.name).join('、'),
  });
});

async function handleSubmit(values: Recordable<any>) {
  await updateUserProfileApi({
    email: values.email,
    mobile: values.mobile,
    nickname: values.nickname,
    sex: values.sex,
  });
  message.success('个人信息更新成功');
}
</script>
<template>
  <ProfileBaseSetting
    ref="profileBaseSettingRef"
    :form-schema="formSchema"
    @submit="handleSubmit"
  />
</template>
