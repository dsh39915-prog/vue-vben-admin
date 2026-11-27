import { icons as lucideIcons } from '@iconify-json/lucide';
import { addCollection } from '@iconify/vue';

// 菜单图标名称由后端提供，内置完整图标集以避免运行时访问外部图标服务。
addCollection(lucideIcons);

export * from './create-icon';

export * from './lucide';

export type { IconifyIcon as IconifyIconStructure } from '@iconify/vue';
export {
  addCollection,
  addIcon,
  Icon as IconifyIcon,
  listIcons,
} from '@iconify/vue';
