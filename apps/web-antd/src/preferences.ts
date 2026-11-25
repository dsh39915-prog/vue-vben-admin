import { defineOverridesPreferences } from '@vben/preferences';

export const overridesPreferences = defineOverridesPreferences({
  app: {
    accessMode: 'backend',
    defaultHomePath: '/access-empty',
    name: import.meta.env.VITE_APP_TITLE,
    layout: 'mixed-nav',
  },
  widget: { notification: false },
});
