import type { LibraryCategoryRecord, LibraryType } from '#/api';

import { computed, onUnmounted, ref, watch } from 'vue';

import { getLibraryCategoryTreeApi } from '#/api';

import { libraryTypeName } from './helpers';

export function useLibraryCategories(getType: () => LibraryType | undefined) {
  const categories = ref<LibraryCategoryRecord[]>([]);
  const loading = ref(false);
  let latestRequest = 0;
  const options = computed(() =>
    categories.value.map((item) => ({
      label:
        getType() === undefined
          ? `${libraryTypeName(item.libraryType)} / ${item.categoryName}`
          : item.categoryName,
      value: item.id,
    })),
  );
  async function load() {
    const request = ++latestRequest;
    const type = getType();
    loading.value = true;
    categories.value = [];
    try {
      const data =
        type === undefined
          ? (
              await Promise.all(
                ([0, 1, 2] as const).map(getLibraryCategoryTreeApi),
              )
            ).flat()
          : await getLibraryCategoryTreeApi(type);
      if (request === latestRequest) categories.value = data;
    } catch {
      // The request interceptor displays errors; stale categories stay unavailable.
    } finally {
      if (request === latestRequest) loading.value = false;
    }
  }
  watch(getType, load, { immediate: true });
  onUnmounted(() => {
    latestRequest += 1;
  });
  return { categories, load, loading, options };
}
