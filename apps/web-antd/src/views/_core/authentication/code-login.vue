<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { Recordable } from '@vben/types';

import { computed, ref } from 'vue';

import { AuthenticationCodeLogin, z } from '@vben/common-ui';
import { getText } from '@vben/texts';

defineOptions({ name: 'CodeLogin' });

const loading = ref(false);
const CODE_LENGTH = 6;

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: getText('authentication.mobile'),
      },
      fieldName: 'phoneNumber',
      label: getText('authentication.mobile'),
      rules: z
        .string()
        .min(1, { message: getText('authentication.mobileTip') })
        .refine((v) => /^\d{11}$/.test(v), {
          message: getText('authentication.mobileErrortip'),
        }),
    },
    {
      component: 'VbenPinInput',
      componentProps: {
        codeLength: CODE_LENGTH,
        createText: (countdown: number) => {
          const text =
            countdown > 0
              ? getText('authentication.sendText', [countdown])
              : getText('authentication.sendCode');
          return text;
        },
        placeholder: getText('authentication.code'),
      },
      fieldName: 'code',
      label: getText('authentication.code'),
      rules: z.string().length(CODE_LENGTH, {
        message: getText('authentication.codeTip', [CODE_LENGTH]),
      }),
    },
  ];
});
/**
 * 异步处理登录操作
 * Asynchronously handle the login process
 * @param values 登录表单数据
 */
async function handleLogin(values: Recordable<any>) {
  void values;
}
</script>

<template>
  <AuthenticationCodeLogin
    :form-schema="formSchema"
    :loading="loading"
    @submit="handleLogin"
  />
</template>
