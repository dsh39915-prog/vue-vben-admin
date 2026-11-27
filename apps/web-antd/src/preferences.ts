import { defineOverridesPreferences } from '@vben/preferences';

export const overridesPreferences = defineOverridesPreferences({
  app: {
    accessMode: 'backend',
    defaultHomePath: '/access-empty',
    defaultAvatar: `${import.meta.env.BASE_URL}avatar.webp`,
    name: import.meta.env.VITE_APP_TITLE,
    layout: 'mixed-nav',
  },
  logo: { source: `${import.meta.env.BASE_URL}logo.webp` },
  widget: { notification: false, refresh: false },
});
