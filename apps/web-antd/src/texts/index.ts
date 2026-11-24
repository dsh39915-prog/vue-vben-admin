import { getText, registerTexts } from '@vben/texts';

import dayjs from 'dayjs';

import page from './messages/page.json';

import 'dayjs/locale/zh-cn';

registerTexts({ page });
dayjs.locale('zh-cn');

export { getText };

export { default as antdLocale } from 'ant-design-vue/es/locale/zh_CN';
