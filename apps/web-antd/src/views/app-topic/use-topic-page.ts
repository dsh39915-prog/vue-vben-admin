import type { AppTopicPage } from '#/api';

import { usePagedList } from '#/composables/use-paged-list';

export function useTopicPage<T>(
  fetcher: (
    page: number,
    size: number,
    signal: AbortSignal,
  ) => Promise<AppTopicPage<T>>,
  blocked: () => boolean,
) {
  return usePagedList(fetcher, { blocked });
}
