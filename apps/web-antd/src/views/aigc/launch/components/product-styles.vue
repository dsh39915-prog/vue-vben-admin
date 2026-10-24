<script setup lang="ts">
import type { PageProductionDraft } from '../page-production-draft';
import type { RetouchingDraft } from '../retouching-draft';

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
  auditFlowTaskApi,
  downloadStyleMaterialsApi,
  getFlowDraftApi,
  getProductStylesApi,
  saveFlowDraftApi,
  saveStyleImagesApi,
} from '#/api';
import {
  getDrawingTaskPage,
  useDrawingAccess,
} from '#/features/drawing/access';

import {
  MaterialDownloadError,
  saveStyleMaterialFile,
} from '../material-download';
import { readPageProductionDraft } from '../page-production-draft';
import { readRetouchingDraft } from '../retouching-draft';
import {
  canHandleTask,
  getWorkflowContext,
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
const emit = defineEmits<{ changed: []; busy: [boolean]; rejected: [] }>();
const access = useDrawingAccess();
const styles = ref<ProductStyle[]>([]);
const loading = ref(false);
const failed = ref(false);
const loadError = ref('');
const saving = ref(false);
const operation = ref<'draft' | 'reject' | 'submit'>();
const submitConfirmOpen = ref(false);
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
const retouching = computed(() => props.context?.nodeKey === 'retouching');
const pageProduction = computed(
  () => props.context?.nodeKey === 'pageProduction',
);
const production = computed(() => retouching.value || pageProduction.value);
const productionLabel = computed(() =>
  pageProduction.value ? '页面制作' : '修图',
);
const requiresSelection = computed(() => !production.value);
const locked = computed(() => loading.value || failed.value || saving.value);
let latest = 0;
async function load() {
  const request = ++latest;
  loading.value = true;
  failed.value = false;
  loadError.value = '';
  styles.value = [];
  try {
    const [data, rawDraft] = await Promise.all([
      getProductStylesApi(props.task.id),
      production.value && props.editable && props.context
        ? getFlowDraftApi({
            procInstId: props.context.procInstId,
            nodeKey: props.context.nodeKey,
          })
        : Promise.resolve(null),
    ]);
    if (request !== latest) return;
    if (!Array.isArray(data)) throw new Error('Invalid styles');
    const draft = retouching.value ? readRetouchingDraft(rawDraft) : undefined;
    const pageDraft = pageProduction.value
      ? readPageProductionDraft(rawDraft)
      : undefined;
    const saved = new Map(draft?.styles.map((style) => [style.styleId, style]));
    const savedPages = new Map(
      pageDraft?.styles.map((style) => [style.styleId, style]),
    );
    styles.value = data;
    selected.value = [];
    mainSlots.value = Object.fromEntries(
      data.map((style) => [
        String(style.id),
        savedPages
          .get(String(style.id))
          ?.mainImageSlots.map((image) => image ?? undefined) ??
          (pageProduction.value ? (style.productMainImageUrls ?? []) : []),
      ]),
    );
    errors.value = {};
    images.value = Object.fromEntries(
      data.map((style) => {
        const entry = saved.get(String(style.id));
        const pageEntry = savedPages.get(String(style.id));
        return [
          String(style.id),
          entry
            ? {
                retouchedModelImageUrls: entry.retouchedModelImageUrls,
                retouchedActionImageUrls: entry.retouchedActionImageUrls,
              }
            : pageProduction.value
              ? {
                  productDetailImageUrls:
                    pageEntry?.productDetailImageUrls ??
                    style.productDetailImageUrls ??
                    [],
                }
              : {},
        ];
      }),
    );
    const savedRemark = (draft ?? pageDraft)?.remarkInfoVO;
    remark.value = savedRemark?.contentText ?? '';
    attachments.value = savedRemark?.imageUrls ?? [];
  } catch (error) {
    if (request === latest) {
      failed.value = true;
      loadError.value =
        error instanceof Error && error.message.startsWith('草稿数据')
          ? error.message
          : '款式或草稿加载失败，请重试';
    }
  } finally {
    if (request === latest) loading.value = false;
  }
}
function validateSubmission(): StyleImageItem[] | undefined {
  if (requiresSelection.value && !selected.value.length) {
    message.warning('请先选择款式');
    return;
  }
  const items: StyleImageItem[] = [];
  try {
    const ids = requiresSelection.value
      ? selected.value
      : styles.value.map((style) => String(style.id));
    for (const id of ids) {
      const style = styles.value.find((s) => String(s.id) === id)!;
      if (
        pageProduction.value &&
        !mainSlots.value[id]?.some(Boolean) &&
        !images.value[id]?.productDetailImageUrls?.length
      )
        continue;
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
      if (!count) {
        if (!requiresSelection.value) continue;
        throw new Error('请为所选款式上传本次提交图片');
      }
      items.push(item);
    }
    if (!items.length)
      throw new Error(`请先上传本次提交的${productionLabel.value}图片`);
    if (production.value && !remark.value.trim())
      throw new Error('请填写备注说明');
    if (remark.value.length > 1000) throw new Error('图片备注最多 1000 字');
    if (attachments.value.length > 6) throw new Error('备注附件最多 6 张');
    validateWorkflowImages(attachments.value, 'temp');
  } catch (error) {
    message.warning((error as Error).message);
    return;
  }
  return items;
}
function changeSubmitConfirmation(open: boolean) {
  if (!open) {
    submitConfirmOpen.value = false;
    return;
  }
  if (!props.editable || locked.value || pending.value) return;
  submitConfirmOpen.value = Boolean(validateSubmission());
}
async function verifyProductionContext(): Promise<WorkflowContext> {
  if (!props.editable || !production.value || !props.context)
    throw new Error('当前任务不可操作，请刷新任务后重试');
  const context = { ...props.context };
  const scope = access.scopeFor(context.nodeKey);
  let current: LaunchTask | undefined;
  for (let pageNo = 1; ; pageNo++) {
    const page = await getDrawingTaskPage({ pageNo, pageSize: 200 }, scope);
    current = page.list.find((row) => row.id === props.task.id);
    if (current || !page.list.length || pageNo * 200 >= page.total) break;
  }
  const next = getWorkflowContext(current);
  if (
    !current ||
    !canHandleTask(current) ||
    !props.editable ||
    next?.procInstId !== context.procInstId ||
    next?.nodeTaskId !== context.nodeTaskId ||
    next?.nodeKey !== context.nodeKey ||
    props.context?.nodeTaskId !== context.nodeTaskId
  )
    throw new Error('任务状态或节点已变化，请刷新任务后重试');
  return context;
}
async function saveDraft() {
  if (!props.editable || locked.value || pending.value || !production.value)
    return;
  const draft: PageProductionDraft | RetouchingDraft = pageProduction.value
    ? {
        version: 1,
        formType: 'pageProduction',
        styles: styles.value.map((style) => ({
          styleId: String(style.id),
          mainImageSlots: Array.from(
            { length: 5 },
            (_, index) => mainSlots.value[String(style.id)]?.[index] ?? null,
          ),
          productDetailImageUrls:
            images.value[String(style.id)]?.productDetailImageUrls ?? [],
        })),
        remarkInfoVO: {
          contentText: remark.value,
          imageUrls: attachments.value,
        },
      }
    : {
        version: 1,
        formType: 'retouching',
        styles: styles.value.map((style) => ({
          styleId: String(style.id),
          retouchedModelImageUrls:
            images.value[String(style.id)]?.retouchedModelImageUrls ?? [],
          retouchedActionImageUrls:
            images.value[String(style.id)]?.retouchedActionImageUrls ?? [],
        })),
        remarkInfoVO: {
          contentText: remark.value,
          imageUrls: attachments.value,
        },
      };
  saving.value = true;
  operation.value = 'draft';
  try {
    const context = await verifyProductionContext();
    await saveFlowDraftApi({ ...context, formDataJson: JSON.stringify(draft) });
    message.success(`${productionLabel.value}草稿已保存`);
  } catch (error) {
    if (error instanceof Error) message.warning(error.message);
  } finally {
    saving.value = false;
    operation.value = undefined;
  }
}
async function reject() {
  if (!props.editable || locked.value || pending.value || !production.value)
    return;
  try {
    if (!remark.value.trim()) throw new Error('请填写驳回原因');
    if (remark.value.length > 1000) throw new Error('图片备注最多 1000 字');
    if (attachments.value.length > 6) throw new Error('备注附件最多 6 张');
    validateWorkflowImages(attachments.value, 'temp');
  } catch (error) {
    message.warning((error as Error).message);
    return;
  }
  saving.value = true;
  operation.value = 'reject';
  let rejected = false;
  try {
    const context = await verifyProductionContext();
    const completed = await auditFlowTaskApi({
      ...context,
      auditInfoVO: {
        auditStatus: 2,
        contentText: remark.value.trim(),
        imageUrls: attachments.value,
      },
    });
    if (completed !== true) {
      message.warning('驳回未成功，请重试');
      return;
    }
    message.success('已驳回到上一节点');
    rejected = true;
  } catch (error) {
    if (error instanceof Error) message.warning(error.message);
  } finally {
    saving.value = false;
    operation.value = undefined;
  }
  if (rejected) emit('rejected');
}
async function submit() {
  submitConfirmOpen.value = false;
  if (!props.editable || locked.value || pending.value || !props.context)
    return;
  const items = validateSubmission();
  if (!items) return;
  saving.value = true;
  operation.value = 'submit';
  try {
    const context = production.value
      ? await verifyProductionContext()
      : props.context;
    const payload = {
      ...context,
      items,
      remarkInfoVO: {
        contentText: remark.value.trim(),
        imageUrls: attachments.value,
      },
    };
    const completed = await saveStyleImagesApi(payload);
    if (completed !== true) {
      message.warning(
        production.value
          ? `${productionLabel.value}未提交成功，请重试`
          : '款式图片未保存，请重试',
      );
      return;
    }
    message.success(
      production.value ? `${productionLabel.value}已提交` : '款式图片已保存',
    );
    emit('changed');
  } catch (error) {
    if (production.value && error instanceof Error)
      message.warning(error.message);
  } finally {
    saving.value = false;
    operation.value = undefined;
  }
}
async function download() {
  if (locked.value || pending.value || !props.context) return;
  saving.value = true;
  try {
    const result = await downloadStyleMaterialsApi({ ...props.context });
    await saveStyleMaterialFile(result);
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
    <Alert v-if="failed" :message="loadError" type="error" class="mb-4!">
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
          <Checkbox
            v-if="editable && fields.length && requiresSelection"
            :value="String(style.id)"
          >
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
            :placeholder="
              production ? '填写备注说明（提交或驳回时必填）' : undefined
            "
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
        <template v-if="editable && production">
          <Popconfirm
            title="确认驳回到上一节点？"
            ok-text="确认驳回"
            :ok-button-props="{ danger: true }"
            :disabled="locked || pending > 0"
            @confirm="reject"
          >
            <Button
              danger
              :disabled="locked || pending > 0"
              :loading="saving && operation === 'reject'"
            >
              <span>驳回</span>
            </Button>
          </Popconfirm>
          <Button
            :disabled="locked || pending > 0"
            :loading="saving && operation === 'draft'"
            @click="saveDraft"
          >
            <span>{{ pageProduction ? '保存' : '保存款式图片' }}</span>
          </Button>
          <Popconfirm
            :title="`确认将${productionLabel}提交到下一节点？`"
            :open="submitConfirmOpen"
            :disabled="locked || pending > 0"
            @open-change="changeSubmitConfirmation"
            @confirm="submit"
          >
            <Button
              type="primary"
              :disabled="locked || pending > 0"
              :loading="saving && operation === 'submit'"
            >
              <span>提交</span>
            </Button>
          </Popconfirm>
        </template>
        <Popconfirm
          v-else-if="editable && fields.length"
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
