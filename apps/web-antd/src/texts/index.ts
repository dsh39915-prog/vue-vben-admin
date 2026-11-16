import { getText, registerTexts } from '@vben/texts';

import dayjs from 'dayjs';

import demos from './messages/demos.json';
import page from './messages/page.json';

import 'dayjs/locale/zh-cn';

registerTexts({ demos, page });
dayjs.locale('zh-cn');

export { getText };

export { default as antdLocale } from 'ant-design-vue/es/locale/zh_CN';
