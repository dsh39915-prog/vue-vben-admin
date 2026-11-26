import { configInfoRequestClient } from '#/api/request';

export type MobileCacheType =
  | 2
  | 6
  | 20
  | 21
  | 22
  | 25
  | 27
  | 28
  | 31
  | 34
  | 72
  | 83
  | 401;

export function reloadMobileCacheApi(type: MobileCacheType) {
  return configInfoRequestClient.get<unknown>(`/mobileCache/reload/${type}`);
}
