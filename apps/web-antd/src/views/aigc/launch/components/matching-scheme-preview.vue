<script setup lang="ts">
import type { SchemeImageKey } from '../workflow-helpers';

import type { MatchingScheme } from '#/api';

import { computed, onMounted, onUnmounted, ref } from 'vue';

import { Image, Modal } from 'ant-design-vue';

import { schemeImages } from '../workflow-helpers';
import MatchingPreviewImages from './matching-preview-images.vue';

const props = defineProps<{ scheme: MatchingScheme }>();
const emit = defineEmits<{ close: [] }>();
const zoomed = ref(false);
function closeTopLayer(event: KeyboardEvent) {
  if (event.key !== 'Escape' || zoomed.value) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (event.repeat) return;
  emit('close');
}
onMounted(() => window.addEventListener('keydown', closeTopLayer, true));
onUnmounted(() => window.removeEventListener('keydown', closeTopLayer, true));
function items(key: SchemeImageKey, label: string) {
  const images = schemeImages(props.scheme, key);
  return images.map((image, index) => ({
    image,
    label: `${label}${images.length > 1 ? index + 1 : ''}`,
  }));
}
const clothing = computed(() => {
  const images = schemeImages(props.scheme, 'clothingProductUrls');
  const main = images.filter((image) => image.isMain === 1);
  const companions = images.filter((image) => image.isMain !== 1);
  return [
    ...main.map((image) => ({
      image,
      label: '主服饰',
    })),
    ...companions.map((image, index) => ({
      image,
      label: `搭配服饰${index + 1}${image.styleNo ? ` · ${image.styleNo}` : ''}`,
    })),
  ];
});
const references = computed(() =>
  (
    [
      ['mainReferenceFrontUrl', '正面'],
      ['mainReferenceSideUrl', '侧面'],
      ['mainReferenceBackUrl', '背面'],
      ['mainReferenceVisionUrl', '展现力'],
    ] as const
  ).flatMap(([key, label]) => items(key, label)),
);
const otherReferences = computed(() =>
  (
    [
      { key: 'fullBodyReferenceUrls', label: '全身参考图' },
      { key: 'lightReferenceUrl', label: '光线参考图' },
      { key: 'versionReferenceUrl', label: '版型参考图' },
      { key: 'otherReferenceUrls', label: '其他参考图' },
    ] as const
  ).filter((field) => schemeImages(props.scheme, field.key).length),
);
const companionStyles = computed(() => [
  ...new Set(
    schemeImages(props.scheme, 'clothingProductUrls')
      .filter((image) => image.isMain !== 1 && image.styleNo)
      .map((image) => image.styleNo),
  ),
]);
</script>

<template>
  <Modal
    open
    title="整体搭配方案预览"
    :width="1280"
    :style="{ top: '24px', maxWidth: 'calc(100vw - 32px)' }"
    :body-style="{ maxHeight: 'calc(100dvh - 140px)', overflowY: 'auto' }"
    :footer="null"
    :mask-closable="false"
    :keyboard="false"
    @cancel="emit('close')"
  >
    <p class="mb-4 text-sm">
      {{ scheme.styleNo }} · {{ scheme.styleName }}
      <span v-if="scheme.hasOtherStyle">（合拍）</span>
    </p>
    <Image.PreviewGroup
      :preview="{
        onVisibleChange: (visible: boolean) => (zoomed = visible),
      }"
    >
      <div class="scheme-preview-board grid grid-cols-1 gap-5 md:grid-cols-2">
        <div class="min-w-0 space-y-4" data-preview-column="left">
          <section
            v-if="
              clothing.length || schemeImages(scheme, 'propImageUrls').length
            "
            aria-label="服饰与道具"
            class="preview-section"
          >
            <div class="grid grid-cols-2 gap-5">
              <div v-if="clothing.length">
                <h3 class="preview-heading">服饰</h3>
                <MatchingPreviewImages :items="clothing" :columns="1" />
              </div>
              <div v-if="schemeImages(scheme, 'propImageUrls').length">
                <h3 class="preview-heading">道具</h3>
                <MatchingPreviewImages
                  :items="items('propImageUrls', '道具图')"
                  :columns="1"
                />
              </div>
            </div>
          </section>
          <section aria-label="款式信息" class="preview-section text-sm">
            <p class="mb-1">
              主款式：{{ scheme.styleNo }} · {{ scheme.styleName }}
            </p>
            <p v-if="companionStyles.length" class="m-0">
              搭配款式：{{ companionStyles.join('、') }}
            </p>
          </section>
          <section
            v-if="
              schemeImages(scheme, 'sceneImageUrls').length ||
              schemeImages(scheme, 'modelImageUrls').length
            "
            aria-label="场景与模特"
            class="preview-section"
          >
            <h3 class="preview-heading">场景与模特</h3>
            <div
              class="grid grid-cols-2 items-start gap-5"
              data-preview-environment
            >
              <MatchingPreviewImages
                :items="items('sceneImageUrls', '场景图')"
                :columns="1"
              />
              <MatchingPreviewImages
                :items="items('modelImageUrls', '模特图')"
                :columns="1"
              />
            </div>
          </section>
          <details
            v-if="
              schemeImages(scheme, 'aiMatchingImageUrl').length ||
              schemeImages(scheme, 'aiGeneratedImageUrls').length
            "
            class="preview-section"
          >
            <summary class="cursor-pointer text-sm font-medium">
              方案成图
            </summary>
            <div class="mt-3">
              <MatchingPreviewImages
                :items="[
                  ...items('aiMatchingImageUrl', 'AI搭配方案图'),
                  ...schemeImages(scheme, 'aiGeneratedImageUrls').map(
                    (image, index) => ({
                      image,
                      label: `AI生成图片${index + 1}`,
                    }),
                  ),
                ]"
              />
            </div>
          </details>
        </div>
        <div
          class="preview-reference-column min-w-0 space-y-4"
          data-preview-column="right"
        >
          <section
            v-if="references.length"
            aria-label="主参考图"
            class="preview-section"
          >
            <h3 class="preview-heading">参考图</h3>
            <MatchingPreviewImages :items="references" />
          </section>
          <section
            v-if="otherReferences.length"
            aria-label="其他参考图"
            class="preview-section"
          >
            <h3 class="preview-heading">其他参考图</h3>
            <div class="space-y-3">
              <MatchingPreviewImages
                v-for="field in otherReferences"
                :key="field.key"
                :items="items(field.key, field.label)"
              />
            </div>
          </section>
        </div>
      </div>
    </Image.PreviewGroup>
  </Modal>
</template>

<style scoped>
.preview-section {
  padding: 12px;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.preview-heading {
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 500;
}

@media (min-width: 768px) {
  .preview-reference-column {
    padding-left: 20px;
    border-left: 1px solid hsl(var(--border));
  }
}
</style>
