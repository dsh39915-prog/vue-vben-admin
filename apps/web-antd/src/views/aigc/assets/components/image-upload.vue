<script setup lang="ts">
import type { FormInstance, UploadFile, UploadProps } from 'ant-design-vue';

import type { LibraryType } from '#/api';

import { reactive, ref, watch } from 'vue';

import {
  Button,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Select,
  Upload,
} from 'ant-design-vue';

import { uploadLibraryImageApi } from '#/api';

import { libraryTypeOptions } from '../helpers';
import { useLibraryCategories } from '../use-library-categories';

const props = defineProps<{ libraryType?: LibraryType }>();
const emit = defineEmits<{ saved: []; close: [] }>();
const saving = ref(false);
const formRef = ref<FormInstance>();
const fileList = ref<UploadFile[]>([]);
const editor = reactive({
  libraryType: props.libraryType ?? 0,
  categoryId: undefined as number | undefined,
  imageName: '',
  file: undefined as File | undefined,
});
const {
  loading: categoriesLoading,
  options: categoryOptions,
  load: loadCategories,
} = useLibraryCategories(() => editor.libraryType);
watch(
  () => editor.libraryType,
  () => {
    editor.categoryId = undefined;
    formRef.value?.clearValidate('categoryId');
  },
);
watch(fileList, (files) => {
  editor.file = files[0]?.originFileObj;
  if (editor.file) formRef.value?.clearValidate('file');
});
const beforeUpload: UploadProps['beforeUpload'] = (file) => {
  if (!file.type.startsWith('image/')) {
    message.error('请选择图片文件');
    return Upload.LIST_IGNORE;
  }
  if (!editor.imageName.trim()) editor.imageName = file.name;
  return false;
};
async function save() {
  if (saving.value) return;
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  if (!editor.file || editor.categoryId === undefined) return;
  if (!categoryOptions.value.some((item) => item.value === editor.categoryId)) {
    message.warning('所选分类已失效，请重新选择');
    return;
  }
  saving.value = true;
  try {
    await uploadLibraryImageApi(editor.file, {
      libraryType: editor.libraryType,
      categoryId: editor.categoryId,
      imageName: editor.imageName.trim(),
    });
    message.success('上传成功');
    emit('saved');
    emit('close');
  } catch {
    // Keep the selected file and metadata available for retry.
  } finally {
    saving.value = false;
  }
}
</script>
<template>
  <Modal
    open
    title="上传图库图片"
    :confirm-loading="saving"
    :ok-button-props="{ disabled: categoriesLoading }"
    :closable="!saving"
    :mask-closable="false"
    :keyboard="!saving"
    :cancel-button-props="{ disabled: saving }"
    ok-text="上传"
    cancel-text="取消"
    @ok="save"
    @cancel="emit('close')"
  >
    <Form ref="formRef" :model="editor" :disabled="saving" layout="vertical">
      <FormItem
        label="库类型"
        name="libraryType"
        :rules="[{ required: true, message: '请选择库类型' }]"
      >
        <Select
          v-model:value="editor.libraryType"
          :options="libraryTypeOptions"
        />
      </FormItem>
      <FormItem
        label="分类"
        name="categoryId"
        :rules="[{ required: true, message: '请选择分类' }]"
      >
        <Select
          v-model:value="editor.categoryId"
          :options="categoryOptions"
          :loading="categoriesLoading"
          :disabled="saving"
          show-search
          option-filter-prop="label"
          placeholder="请选择分类，可在分类管理中新增"
          @dropdown-visible-change="(open) => open && loadCategories()"
        />
      </FormItem>
      <FormItem
        label="图片名称"
        name="imageName"
        :rules="[
          { required: true, whitespace: true, message: '请输入图片名称' },
        ]"
      >
        <Input v-model:value="editor.imageName" placeholder="请输入图片名称" />
      </FormItem>
      <FormItem
        label="图片文件"
        name="file"
        :rules="[{ required: true, message: '请选择图片文件' }]"
      >
        <Upload
          v-model:file-list="fileList"
          :before-upload="beforeUpload"
          :max-count="1"
          accept="image/*"
          :disabled="saving"
        >
          <Button :disabled="saving"><span>选择图片</span></Button>
        </Upload>
      </FormItem>
    </Form>
  </Modal>
</template>
