<script setup lang="ts">
import type { SchemeImageKey } from '../workflow-helpers';

import type { MatchingScheme, WorkflowImage } from '#/api';

import { computed } from 'vue';

import { Image } from 'ant-design-vue';

import ImageThumbnail from '../../common/image-thumbnail.vue';
import { imageUrl, schemeImageFields, schemeImages } from '../workflow-helpers';

interface Material {
  key: string;
  label: string;
  required: boolean;
  items: { image?: WorkflowImage; caption?: string }[];
}
const props = defineProps<{ scheme: MatchingScheme }>();
function material(key: SchemeImageKey): Material {
  const field = schemeImageFields.find((item) => item.key === key)!;
  return {
    key,
    label: key === 'aiMatchingImageUrl' ? 'AI搭配方案图' : field.label,
    required: 'required' in field && field.required,
    items: schemeImages(props.scheme, key).map((image) => ({
      image,
      caption:
        key === 'clothingProductUrls'
          ? image.isMain === 1
            ? '主服饰'
            : '搭配服饰'
          : undefined,
    })),
  };
}
const columns = computed(() => {
  const mainReferences: Material = {
    key: 'mainReferences',
    label: '主参考图',
    required: true,
    items: (
      [
        ['mainReferenceFrontUrl', '正面'],
        ['mainReferenceSideUrl', '侧面'],
        ['mainReferenceBackUrl', '背面'],
        ['mainReferenceVisionUrl', '展现力'],
      ] as const
    ).flatMap(([key, caption]) => {
      const image = schemeImages(props.scheme, key)[0];
      return image || key !== 'mainReferenceVisionUrl'
        ? [{ image, caption }]
        : [];
    }),
  };
  return [
    (
      [
        'aiMatchingImageUrl',
        'clothingProductUrls',
        'propImageUrls',
        'otherReferenceUrls',
        'aiGeneratedImageUrls',
      ] as const
    ).map(material),
    [
      material('modelImageUrls'),
      material('sceneImageUrls'),
      mainReferences,
      material('fullBodyReferenceUrls'),
      material('lightReferenceUrl'),
      material('versionReferenceUrl'),
    ],
  ].map((column) =>
    column.filter((item) => item.required || item.items.length),
  );
});
</script>

<template>
  <Image.PreviewGroup>
    <div
      class="matching-review grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2"
    >
      <div
        v-for="(column, index) in columns"
        :key="index"
        class="matching-review-column min-w-0"
      >
        <section
          v-for="group in column"
          :key="group.key"
          :data-material="group.key"
        >
          <div class="mb-1 text-xs font-medium">
            {{ group.label }}
            <span v-if="group.required" class="text-destructive">*</span>
          </div>
          <div class="flex flex-wrap gap-2">
            <span
              v-if="!group.items.length"
              class="text-muted-foreground text-xs"
            >
              未提供
            </span>
            <figure
              v-for="(item, i) in group.items"
              :key="i"
              class="m-0"
              :style="{ width: 'var(--audit-thumbnail-size)' }"
            >
              <ImageThumbnail
                v-if="item.image"
                :src="imageUrl(item.image)"
                :preview="{
                  src: item.image.previewUrl || item.image.originalUrl,
                }"
                :alt="`${group.label}${item.caption ? ` · ${item.caption}` : ''}`"
                :title="item.image.styleNo"
              />
              <div
                v-else
                class="text-muted-foreground flex items-center justify-center rounded bg-muted text-xs"
                :style="{ height: 'var(--audit-thumbnail-size)' }"
              >
                未提供
              </div>
              <figcaption
                v-if="item.caption"
                class="mt-0.5 text-center text-xs"
              >
                {{ item.caption }}
              </figcaption>
            </figure>
          </div>
        </section>
        <slot v-if="index === 1" name="action"></slot>
      </div>
    </div>
  </Image.PreviewGroup>
</template>

<style scoped>
.matching-review {
  --audit-thumbnail-size: 120px;
}

.matching-review-column {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

@media (max-height: 800px) {
  .matching-review-column {
    gap: 6px;
  }
}
</style>
