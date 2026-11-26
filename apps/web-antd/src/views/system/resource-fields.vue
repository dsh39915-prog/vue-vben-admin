<script setup lang="ts">
import type { ResourceField } from './resource-config';
import type { ResourceForm } from './resource-types';

import {
  Col,
  FormItem,
  Input,
  InputNumber,
  Row,
  Select,
  Switch,
} from 'ant-design-vue';

defineProps<{
  fields: ResourceField[];
  optionsFor: (
    field: ResourceField,
  ) => { label: string; value: number | string }[];
  relationDisabled: (field: ResourceField) => boolean;
  rulesFor: (field: ResourceField) => object[];
}>();
const form = defineModel<ResourceForm>({ required: true });
function numberValue(key: string) {
  const value = form.value[key];
  return typeof value === 'number' ? value : undefined;
}
function selectionValue(key: string) {
  const value = form.value[key];
  return typeof value === 'number' ||
    typeof value === 'string' ||
    Array.isArray(value)
    ? value
    : undefined;
}
function updateSelection(key: string, value: unknown) {
  if (typeof value === 'number' || typeof value === 'string')
    form.value[key] = value;
  else if (Array.isArray(value))
    form.value[key] = value.filter(
      (item): item is number | string =>
        typeof item === 'number' || typeof item === 'string',
    );
  else form.value[key] = undefined;
}
</script>

<template>
  <Row :gutter="16">
    <Col
      v-for="field in fields"
      :key="field.key"
      :xs="24"
      :sm="field.type === 'textarea' ? 24 : 12"
    >
      <FormItem :label="field.label" :name="field.key" :rules="rulesFor(field)">
        <Switch
          v-if="field.type === 'boolean'"
          :checked="form[field.key] === true"
          @update:checked="form[field.key] = $event"
        />
        <InputNumber
          v-else-if="field.type === 'number'"
          :value="numberValue(field.key)"
          :min="field.min ?? 0"
          :max="2147483647"
          :precision="0"
          class="w-full"
          @update:value="form[field.key] = $event"
        />
        <Input.Password
          v-else-if="field.type === 'password'"
          :value="String(form[field.key] ?? '')"
          autocomplete="new-password"
          @update:value="form[field.key] = $event"
        />
        <Input.TextArea
          v-else-if="field.type === 'textarea'"
          :value="String(form[field.key] ?? '')"
          :maxlength="field.max"
          :rows="3"
          @update:value="form[field.key] = $event"
        />
        <Select
          v-else-if="field.type === 'select' || field.type === 'multi'"
          :value="selectionValue(field.key)"
          :mode="field.type === 'multi' ? 'multiple' : undefined"
          :options="optionsFor(field)"
          :disabled="relationDisabled(field) ? true : undefined"
          max-tag-count="responsive"
          :allow-clear="!field.required"
          show-search
          option-filter-prop="label"
          @update:value="updateSelection(field.key, $event)"
        />
        <Input
          v-else
          :value="String(form[field.key] ?? '')"
          :maxlength="field.max"
          :placeholder="field.key === 'path' ? '请输入页面组件标识' : undefined"
          @update:value="form[field.key] = $event"
        />
      </FormItem>
    </Col>
  </Row>
</template>
