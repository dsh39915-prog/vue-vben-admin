<script setup lang="ts">
import type { SchemeImageKey } from '../workflow-helpers';

import type { MatchingScheme, ProductStyle, WorkflowImage } from '#/api';

import { computed, ref } from 'vue';

import { Button, Checkbox, Empty, Image } from 'ant-design-vue';

import { imageUrl, schemeImages } from '../workflow-helpers';
import MatchingSchemePreview from './matching-scheme-preview.vue';

const props = defineProps<{
  productStyle: ProductStyle;
  scheme?: MatchingScheme;
  images: WorkflowImage[];
  checked: boolean;
  disabled: boolean;
}>();
const emit = defineEmits<{ 'update:checked': [boolean] }>();
const previewOpen = ref(false);
function imagesFor(key: SchemeImageKey) {
  return props.scheme ? schemeImages(props.scheme, key) : [];
}
const clothing = computed(() => {
  const images = imagesFor('clothingProductUrls');
  const main = props.productStyle.clothingProductUrl;
  return main && !images.some((image) => image.originalUrl === main.originalUrl)
    ? [main, ...images]
    : images;
});
const columns = computed(() => {
  const group = (key: SchemeImageKey, label: string) => ({
    key,
    label,
    images: imagesFor(key).map((image) => ({ image, caption: image.styleNo })),
  });
  const references = {
    key: 'references',
    label: '主参考图',
    images: (
      [
        ['mainReferenceFrontUrl', '正面'],
        ['mainReferenceSideUrl', '侧面'],
        ['mainReferenceBackUrl', '背面'],
        ['mainReferenceVisionUrl', '展现力'],
      ] as const
    ).flatMap(([key, caption]) =>
      imagesFor(key).map((image) => ({ image, caption })),
    ),
  };
  return [
    [
      group('modelImageUrls', '模特图'),
      group('sceneImageUrls', '场景图'),
      references,
      group('lightReferenceUrl', '光线参考图'),
      group('otherReferenceUrls', '其他参考图'),
      group('aiGeneratedImageUrls', 'AI方案图'),
    ],
    [
      {
        key: 'clothing',
        label: '服装商品图（主服饰及搭配服饰）',
        images: clothing.value.map((image) => ({
          image,
          caption: image.styleNo || props.productStyle.styleNo,
        })),
      },
      group('propImageUrls', '道具图'),
      group('fullBodyReferenceUrls', '全身参考图'),
      group('versionReferenceUrl', '版型参考图'),
    ],
  ].map((column) => column.filter((group) => group.images.length));
});
</script>

<template>
  <Image.PreviewGroup>
    <div class="model-audit-columns">
      <section class="model-audit-materials" aria-label="AI方案素材池">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 class="m-0 text-sm font-medium">AI方案素材池</h3>
          <Button v-if="scheme" size="small" @click="previewOpen = true">
            <span>整体方案预览</span>
          </Button>
        </div>
        <div class="model-audit-material-grid">
          <section v-if="scheme?.aiMatchingImageUrl">
            <h4 class="mb-2 text-xs">AI搭配方案图</h4>
            <Image
              :src="imageUrl(scheme.aiMatchingImageUrl)"
              :preview="{
                src:
                  scheme.aiMatchingImageUrl.previewUrl ||
                  scheme.aiMatchingImageUrl.originalUrl,
              }"
              :width="100"
              alt="AI搭配方案图"
            />
          </section>
          <div
            v-for="(column, index) in columns"
            :key="index"
            class="space-y-5 min-w-0"
          >
            <section
              v-for="group in column"
              :key="group.key"
              :data-audit-material="group.key"
            >
              <h4 class="mb-2 text-xs">{{ group.label }}</h4>
              <div class="flex flex-wrap gap-3">
                <figure
                  v-for="(item, imageIndex) in group.images"
                  :key="imageIndex"
                  class="m-0 w-20"
                >
                  <Image
                    :src="imageUrl(item.image)"
                    :preview="{
                      src: item.image.previewUrl || item.image.originalUrl,
                    }"
                    :width="80"
                    :alt="`${group.label} ${imageIndex + 1}`"
                  />
                  <figcaption
                    v-if="item.caption"
                    class="mt-1 break-all text-center text-xs text-muted-foreground"
                  >
                    {{ item.caption }}
                  </figcaption>
                </figure>
              </div>
            </section>
          </div>
        </div>
        <Empty
          v-if="!scheme && !clothing.length"
          description="暂无搭配方案素材"
        />
      </section>
      <section class="model-audit-results" aria-label="模特图审核结果">
        <h3 class="mb-4 text-sm font-medium">AI生成结果（模特图）</h3>
        <div
          v-if="images.length"
          class="flex flex-wrap items-start gap-3"
          data-submitted-models
        >
          <Image
            v-for="(image, index) in images"
            :key="index"
            :src="imageUrl(image)"
            :preview="{ src: image.previewUrl || image.originalUrl }"
            :width="120"
            :alt="`已提交模特图 ${index + 1}`"
          />
        </div>
        <Empty v-else description="暂无已提交模特图" />
        <section class="mt-8" aria-label="细节校验">
          <h3 class="mb-3 text-sm font-medium">细节校验</h3>
          <Image
            v-if="productStyle.clothingProductUrl"
            :src="imageUrl(productStyle.clothingProductUrl)"
            :preview="{
              src:
                productStyle.clothingProductUrl.previewUrl ||
                productStyle.clothingProductUrl.originalUrl,
            }"
            :width="100"
            alt="服装细节对照图"
          />
          <p v-else class="text-xs text-muted-foreground">暂无服装细节对照图</p>
          <div class="mt-3">
            <Checkbox
              :checked="checked"
              :disabled="
                disabled || !images.length || !productStyle.clothingProductUrl
              "
              @change="emit('update:checked', Boolean($event.target.checked))"
            >
              <span>AI模特图与服装商品图衣服细节一致</span>
            </Checkbox>
          </div>
        </section>
      </section>
    </div>
  </Image.PreviewGroup>
  <MatchingSchemePreview
    v-if="previewOpen && scheme"
    :scheme="scheme"
    @close="previewOpen = false"
  />
</template>

<style scoped>
.model-audit-columns {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  gap: 24px;
  align-items: stretch;
}
.model-audit-materials,
.model-audit-results {
  min-width: 0;
}
.model-audit-results {
  padding-left: 24px;
  border-left: 1px solid hsl(var(--border));
}
.model-audit-material-grid {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}
.model-audit-material-grid > div:first-child {
  grid-column: 2;
}
@media (max-width: 1100px) {
  .model-audit-columns {
    grid-template-columns: minmax(0, 1fr);
  }
  .model-audit-results {
    padding-top: 20px;
    padding-left: 0;
    border-top: 1px solid hsl(var(--border));
    border-left: 0;
  }
}
@media (max-width: 600px) {
  .model-audit-material-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .model-audit-material-grid > div:first-child {
    grid-column: auto;
  }
}
</style>
