<script setup lang="ts">
import type {
  LaunchTask,
  ProductStyle,
  StyleImageField,
  StyleImageItem,
  WorkflowContext,
  WorkflowImage,
} from '#/api';

import { computed, onUnmounted, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Card,
  Checkbox,
  Empty,
  Form,
  FormItem,
  Image,
  Input,
  message,
  Popconfirm,
  Space,
  Spin,
} from 'ant-design-vue';

import {
  downloadStyleMaterialsApi,
  getProductStylesApi,
  saveStyleImagesApi,
} from '#/api';

import {
  MaterialDownloadError,
  saveStyleMaterialFile,
} from '../material-download';
import {
  imageUrl,
  styleFieldsByNode,
  validateWorkflowImages,
} from '../workflow-helpers';
import MainImageSlots from './main-image-slots.vue';
import WorkflowImages from './workflow-images.vue';
const props = defineProps<{
  task: LaunchTask;
  context?: WorkflowContext;
  editable: boolean;
}>();
const emit = defineEmits<{ changed: []; busy: [boolean] }>();
const styles = ref<ProductStyle[]>([]);
const loading = ref(false);
const failed = ref(false);
const saving = ref(false);
const pending = ref(0);
const selected = ref<string[]>([]);
const images = ref<
  Record<string, Partial<Record<StyleImageField, WorkflowImage[]>>>
>({});
const mainSlots = ref<Record<string, (undefined | WorkflowImage)[]>>({});
const errors = ref<Record<string, string>>({});
const remark = ref('');
const attachments = ref<WorkflowImage[]>([]);
const fields = computed(
  () => styleFieldsByNode[props.context?.nodeKey ?? ''] ?? [],
);
const locked = computed(() => loading.value || failed.value || saving.value);
let latest = 0;
async function load() {
  const request = ++latest;
  loading.value = true;
  failed.value = false;
  styles.value = [];
  try {
    const data = await getProductStylesApi(props.task.id);
    if (request !== latest) return;
    if (!Array.isArray(data)) throw new Error('Invalid styles');
    styles.value = data;
    selected.value = [];
    mainSlots.value = {};
    errors.value = {};
    images.value = Object.fromEntries(data.map((s) => [String(s.id), {}]));
  } catch {
    if (request === latest) failed.value = true;
  } finally {
    if (request === latest) loading.value = false;
  }
}
async function submit() {
  if (!props.editable || locked.value || pending.value || !props.context)
    return;
  if (!selected.value.length) {
    message.warning('请先选择款式');
    return;
  }
  const items: StyleImageItem[] = [];
  try {
    for (const id of selected.value) {
      const style = styles.value.find((s) => String(s.id) === id)!;
      const item: StyleImageItem = { styleId: style.id };
      let count = 0;
      for (const field of fields.value) {
        let values = images.value[id]?.[field.key] ?? [];
        if (field.key === 'productMainImageUrls') {
          const slots = mainSlots.value[id] ?? [];
          if (
            Array.from({ length: 5 }, (_, i) => slots[i]).some((img) => !img)
          ) {
            errors.value[id + '.' + field.key] =
              '请按顺序上传全部 5 张商品主图';
            throw new Error(
              style.styleName + '：请按顺序上传全部 5 张商品主图',
            );
          }
          values = slots.filter((img): img is WorkflowImage => Boolean(img));
        }
        validateWorkflowImages(values, field.kind);
        if (values.length) {
          item[field.key] = values;
          count += values.length;
        }
      }
      if (!count) throw new Error('请为所选款式上传本次提交图片');
      items.push(item);
    }
    if (remark.value.length > 1000) throw new Error('图片备注最多 1000 字');
    if (attachments.value.length > 6) throw new Error('备注附件最多 6 张');
    validateWorkflowImages(attachments.value, 'temp');
  } catch (error) {
    message.warning((error as Error).message);
    return;
  }
  saving.value = true;
  try {
    const payload = {
      ...props.context,
      items,
      remarkInfoVO: {
        contentText: remark.value.trim(),
        imageUrls: attachments.value,
      },
    };
    const completed = await saveStyleImagesApi(payload);
    if (completed !== true) {
      message.warning('款式图片未保存，请重试');
      return;
    }
    message.success('款式图片已保存');
    emit('changed');
  } catch {
    /* Shared interceptor. */
  } finally {
    saving.value = false;
  }
}
async function download() {
  if (locked.value || pending.value || !props.context) return;
  saving.value = true;
  try {
    const result = await downloadStyleMaterialsApi({ ...props.context });
    await saveStyleMaterialFile(result, `${props.task.styleNo}-素材`);
  } catch (error) {
    if (error instanceof MaterialDownloadError) message.error(error.message);
  } finally {
    saving.value = false;
  }
}

function setImages(id: string, key: StyleImageField, value: WorkflowImage[]) {
  images.value[id] ??= {};
  images.value[id][key] = value;
}
watch(
  () => props.task.id,
  () => {
    pending.value = 0;
    remark.value = '';
    attachments.value = [];
    void load();
  },
  { immediate: true },
);
watch(
  () => saving.value || pending.value > 0,
  (value) => emit('busy', value),
  { immediate: true },
);
onUnmounted(() => {
  latest += 1;
  emit('busy', false);
});
</script>
<template>
  <Spin :spinning="loading">
    <Alert
      v-if="failed"
      message="款式列表加载失败，请重试"
      type="error"
      class="mb-4!"
    >
      <template #action>
        <Button @click="load">
          <span>重新加载</span>
        </Button>
      </template>
    </Alert>
    <Empty
      v-if="!loading && !failed && !styles.length"
      description="暂无商品款式"
    />
    <Checkbox.Group
      v-model:value="selected"
      class="block!"
      :disabled="locked || !editable || !fields.length"
    >
      <Card v-for="style in styles" :key="String(style.id)" class="mb-4!">
        <template #title>
          <Checkbox v-if="editable && fields.length" :value="String(style.id)">
            {{ style.styleNo }} · {{ style.styleName }}
          </Checkbox>
          <span v-else>{{ style.styleNo }} · {{ style.styleName }}</span>
        </template>
        <div class="mb-4 flex items-center gap-4">
          <Image
            v-if="style.clothingProductUrl"
            :src="imageUrl(style.clothingProductUrl)"
            :preview="{
              src:
                style.clothingProductUrl.previewUrl ||
                style.clothingProductUrl.originalUrl,
            }"
            :width="100"
            :height="100"
          />
          <span>服装商品图</span>
        </div>
        <Form v-if="editable && fields.length" layout="vertical">
          <FormItem
            v-for="field in fields"
            :key="field.key"
            :label="`${field.label}（本次提交）`"
            :required="field.key === 'productMainImageUrls'"
            :validate-status="
              errors[`${String(style.id)}.${field.key}`] ? 'error' : undefined
            "
            :help="errors[`${String(style.id)}.${field.key}`]"
          >
            <MainImageSlots
              v-if="field.key === 'productMainImageUrls'"
              :model-value="mainSlots[String(style.id)] ?? []"
              :disabled="locked"
              @update:model-value="
                mainSlots[String(style.id)] = $event;
                delete errors[`${String(style.id)}.${field.key}`];
              "
              @busy="pending += $event"
            />
            <WorkflowImages
              v-else
              :model-value="images[String(style.id)]?.[field.key] ?? []"
              :kind="field.kind"
              multiple
              :disabled="locked"
              @update:model-value="
                setImages(String(style.id), field.key, $event)
              "
              @busy="pending += $event"
            />
          </FormItem>
        </Form>
      </Card>
    </Checkbox.Group>
    <template v-if="styles.length">
      <Form v-if="editable && fields.length" layout="vertical">
        <FormItem label="图片备注">
          <Input.TextArea
            v-model:value="remark"
            :disabled="locked"
            :rows="2"
            :maxlength="1000"
            show-count
          />
        </FormItem>
        <FormItem label="备注附件">
          <WorkflowImages
            v-model="attachments"
            :max-count="6"
            multiple
            :disabled="locked"
            @busy="pending += $event"
          />
        </FormItem>
      </Form>
      <Space wrap>
        <Popconfirm
          v-if="editable && fields.length"
          title="确定保存所选款式的本次图片？"
          :disabled="locked || pending > 0"
          @confirm="submit()"
        >
          <Button type="primary" :disabled="locked || pending > 0">
            <span>保存款式图片</span>
          </Button>
        </Popconfirm>
        <Button
          :disabled="locked || pending > 0 || !context"
          :loading="saving"
          @click="download"
        >
          <span>下载素材</span>
        </Button>
      </Space>
    </template>
  </Spin>
</template>
