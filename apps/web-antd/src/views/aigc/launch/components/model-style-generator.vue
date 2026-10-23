<script setup lang="ts">
import type {
  AiImageFormValues,
  MatchingScheme,
  ProductStyle,
  WorkflowImage,
} from '#/api';

import { computed, reactive, ref, watch } from 'vue';

import { Button, Card, Checkbox, Empty, Image, message } from 'ant-design-vue';

import BusinessResults from '../../generation/components/business-results.vue';
import ImageEditor from '../../generation/components/image-editor.vue';
import { imageUrl, schemeImageFields, schemeImages } from '../workflow-helpers';
import MatchingSchemePreview from './matching-scheme-preview.vue';

const props = withDefaults(
  defineProps<{
    style: ProductStyle;
    scheme?: MatchingScheme;
    modelValue: WorkflowImage[];
    disabled: boolean;
    generation?: Partial<AiImageFormValues>;
    historyBatchId?: 'all' | number;
    imageLabel?: '动作图' | '模特图';
  }>(),
  {
    imageLabel: '模特图',
    scheme: undefined,
    generation: undefined,
    historyBatchId: undefined,
  },
);
const emit = defineEmits<{
  'update:modelValue': [WorkflowImage[]];
  busy: [boolean];
  generationChange: [AiImageFormValues];
  batchChange: ['all' | number];
}>();
const editor = ref<InstanceType<typeof ImageEditor>>();
const results = ref<InstanceType<typeof BusinessResults>>();
const selected = ref<string[]>([]);
const previewOpen = ref(false);
const pending = reactive({ generation: false, results: false });
const busy = computed(() => pending.generation || pending.results);
const locked = computed(() => props.disabled || busy.value);
const materialGroups = computed(() => {
  const groups: { key: string; label: string; images: WorkflowImage[] }[] =
    schemeImageFields.map((field) => ({
      key: field.key,
      label: field.label,
      images: props.scheme ? schemeImages(props.scheme, field.key) : [],
    }));
  const clothing = groups.find((group) => group.key === 'clothingProductUrls')!;
  if (
    props.style.clothingProductUrl &&
    !clothing.images.some(
      (image) =>
        image.originalUrl === props.style.clothingProductUrl?.originalUrl,
    )
  ) {
    clothing.images = [props.style.clothingProductUrl, ...clothing.images];
  }
  if (props.imageLabel === '动作图' && props.style.aiModelImageUrls?.length) {
    groups.unshift({
      key: 'submittedModelImages',
      label: '已提交模特图',
      images: props.style.aiModelImageUrls,
    });
  }
  return groups.filter((group) => group.images.length);
});
const materialImages = computed(() =>
  materialGroups.value.flatMap((group) =>
    group.images.map((image, index) => ({
      key: `${group.key}:${index}`,
      image,
    })),
  ),
);
const selectedUrls = computed(() =>
  props.modelValue.map((image) => image.originalUrl),
);
const materialSections = computed(() => {
  const references = materialGroups.value.filter((group) =>
    group.key.startsWith('mainReference'),
  );
  const sections = materialGroups.value
    .filter((group) => !group.key.startsWith('mainReference'))
    .map((group) => ({
      key: String(group.key),
      label: String(group.label),
      groups: [group],
    }));
  if (references.length)
    sections.splice(1, 0, {
      key: 'references',
      label: '主参考图',
      groups: references,
    });
  return sections;
});
function transfer(target: 'original' | 'reference') {
  if (locked.value) return;
  const images = materialImages.value
    .filter((item) => selected.value.includes(item.key))
    .map((item) => item.image);
  if (!images.length) {
    message.warning(
      `请先选择要加入${target === 'original' ? '原图' : '参考图'}的素材`,
    );
    return;
  }
  if (images.length && editor.value?.addImages(target, images))
    selected.value = [];
}
function clearSelection() {
  if (locked.value) return;
  if (!selected.value.length) {
    message.info('当前没有选中的素材');
    return;
  }
  selected.value = [];
}
function toggleResult(image: WorkflowImage) {
  if (locked.value) return;
  emit(
    'update:modelValue',
    selectedUrls.value.includes(image.originalUrl)
      ? props.modelValue.filter(
          (item) => item.originalUrl !== image.originalUrl,
        )
      : [...props.modelValue, image],
  );
}
watch(busy, (value) => emit('busy', value), { flush: 'sync' });
</script>

<template>
  <div class="model-generation-columns">
    <Card
      title="AI方案素材池"
      size="small"
      :bordered="false"
      class="material-pool"
    >
      <template #extra>
        <Button v-if="scheme" size="small" @click="previewOpen = true">
          <span>整体方案预览</span>
        </Button>
      </template>
      <div class="material-actions">
        <div class="text-muted-foreground text-xs">
          已选 {{ selected.length }} 张
        </div>
        <Button size="small" :disabled="locked" @click="transfer('original')">
          <span>加入原图</span>
        </Button>
        <Button size="small" :disabled="locked" @click="transfer('reference')">
          <span>加入参考图</span>
        </Button>
        <Button size="small" :disabled="locked" @click="clearSelection">
          <span>清空选择</span>
        </Button>
      </div>
      <Empty
        v-if="!materialGroups.length"
        description="暂无搭配方案素材，可在右侧上传图片"
      />
      <Image.PreviewGroup>
        <div class="material-sections">
          <section
            v-for="section in materialSections"
            :key="section.key"
            :class="{ 'reference-section': section.key === 'references' }"
          >
            <h4 class="mb-2 text-sm font-medium">{{ section.label }}</h4>
            <div class="flex flex-wrap gap-3">
              <div v-for="group in section.groups" :key="group.key">
                <div
                  v-if="section.groups.length > 1"
                  class="mb-2 text-xs text-muted-foreground"
                >
                  {{ group.label.replace('主参考图', '') }}
                </div>
                <div class="flex flex-wrap gap-3">
                  <div
                    v-for="(image, index) in group.images"
                    :key="`${group.key}:${index}`"
                    class="material-image"
                  >
                    <Image
                      :src="imageUrl(image)"
                      :preview="{ src: image.previewUrl || image.originalUrl }"
                      :width="96"
                      :height="112"
                      class="object-contain"
                    />
                    <Checkbox
                      :checked="selected.includes(`${group.key}:${index}`)"
                      :disabled="locked"
                      :aria-label="`选择素材 ${group.label} ${index + 1}`"
                      @change="
                        selected = $event.target.checked
                          ? [...selected, `${group.key}:${index}`]
                          : selected.filter(
                              (key) => key !== `${group.key}:${index}`,
                            )
                      "
                    >
                      <span>{{
                        group.key === 'clothingProductUrls'
                          ? image.isMain === 1 ||
                            image.originalUrl ===
                              style.clothingProductUrl?.originalUrl
                            ? '主服饰'
                            : '搭配服饰'
                          : `选择 ${index + 1}`
                      }}</span>
                    </Checkbox>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </Image.PreviewGroup>
    </Card>
    <Card title="AI 图片生成" size="small" :bordered="false" class="min-w-0">
      <ImageEditor
        ref="editor"
        open
        embedded
        :generation-label="imageLabel"
        :draft-value="generation"
        :style-id="String(style.id)"
        :style-no="style.styleNo"
        :disabled="disabled || pending.results"
        @busy="pending.generation = $event"
        @saved="results?.refresh()"
        @draft-change="emit('generationChange', $event)"
      />
    </Card>
  </div>
  <p class="my-3 text-xs text-muted-foreground">
    下方展示「{{ style.styleName }}」的全部生图批次，可跨批次选择本款{{
      imageLabel
    }}。
  </p>
  <BusinessResults
    ref="results"
    :style-id="String(style.id)"
    :source-page="imageLabel === '动作图' ? 6 : 5"
    embedded
    selectable
    :initial-batch-id="historyBatchId"
    :read-only="disabled"
    :disabled="disabled || pending.generation"
    :selected-urls="selectedUrls"
    @busy="pending.results = $event"
    @select="toggleResult"
    @batch-change="emit('batchChange', $event)"
  />
  <MatchingSchemePreview
    v-if="previewOpen && scheme"
    :scheme="scheme"
    @close="previewOpen = false"
  />
</template>

<style scoped>
.model-generation-columns {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}
.material-pool {
  min-width: 0;
}
.material-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}
.material-sections {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px 12px;
}
.reference-section {
  grid-column: 1 / -1;
}
.material-image {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 108px;
}
@media (max-width: 1100px) {
  .model-generation-columns {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
