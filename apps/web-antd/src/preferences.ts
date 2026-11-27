import { defineOverridesPreferences } from '@vben/preferences';

export const overridesPreferences = defineOverridesPreferences({
  app: {
    accessMode: 'backend',
    defaultHomePath: '/access-empty',
    defaultAvatar: `${import.meta.env.BASE_URL}avatar.svg`,
    name: import.meta.env.VITE_APP_TITLE,
    layout: 'mixed-nav',
  },
  copyright: {
    enable: false,
    settingShow: false,
    companyName: '',
    companySiteLink: '',
  },
  logo: {
    source: `${import.meta.env.BASE_URL}logo.png`,
    sourceDark: '',
  },
  widget: { notification: false, refresh: false },
});
