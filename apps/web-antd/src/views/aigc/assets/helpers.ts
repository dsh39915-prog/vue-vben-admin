import type { LibraryType } from '#/api';

export const libraryTypeOptions = [
  { label: '道具库', value: 0 },
  { label: '模特库', value: 1 },
  { label: '场景库', value: 2 },
];
export const libraryStatusOptions = [
  { label: '启用', value: 1 },
  { label: '禁用', value: 0 },
];
export function libraryTypeName(type: LibraryType) {
  return (
    libraryTypeOptions.find((item) => item.value === type)?.label ??
    `类型 #${type}`
  );
}
