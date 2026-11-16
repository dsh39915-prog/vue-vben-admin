<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { Recordable } from '@vben/types';

import { computed, h, ref } from 'vue';

import { AuthenticationRegister, z } from '@vben/common-ui';
import { getText } from '@vben/texts';

defineOptions({ name: 'Register' });

const loading = ref(false);

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: getText('authentication.usernameTip'),
      },
      fieldName: 'username',
      label: getText('authentication.username'),
      rules: z
        .string()
        .min(1, { message: getText('authentication.usernameTip') }),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        passwordStrength: true,
        placeholder: getText('authentication.password'),
      },
      fieldName: 'password',
      label: getText('authentication.password'),
      renderComponentContent() {
        return {
          strengthText: () => getText('authentication.passwordStrength'),
        };
      },
      rules: z
        .string()
        .min(1, { message: getText('authentication.passwordTip') }),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        placeholder: getText('authentication.confirmPassword'),
      },
      dependencies: {
        rules(values) {
          const { password } = values;
          return z
            .string({ required_error: getText('authentication.passwordTip') })
            .min(1, { message: getText('authentication.passwordTip') })
            .refine((value) => value === password, {
              message: getText('authentication.confirmPasswordTip'),
            });
        },
        triggerFields: ['password'],
      },
      fieldName: 'confirmPassword',
      label: getText('authentication.confirmPassword'),
    },
    {
      component: 'VbenCheckbox',
      fieldName: 'agreePolicy',
      renderComponentContent: () => ({
        default: () =>
          h('span', [
            getText('authentication.agree'),
            h(
              'a',
              {
                class: 'vben-link ml-1 ',
                href: '',
              },
              `${getText('authentication.privacyPolicy')} & ${getText('authentication.terms')}`,
            ),
          ]),
      }),
      rules: z.boolean().refine((value) => !!value, {
        message: getText('authentication.agreeTip'),
      }),
    },
  ];
});

function handleSubmit(value: Recordable<any>) {
  void value;
}
</script>

<template>
  <AuthenticationRegister
    :form-schema="formSchema"
    :loading="loading"
    @submit="handleSubmit"
  />
</template>
