import authentication from './messages/authentication.json';
import common from './messages/common.json';
import preferences from './messages/preferences.json';
import profile from './messages/profile.json';
import ui from './messages/ui.json';

interface TextMessages {
  [key: string]: string | TextMessages;
}

const texts = new Map<string, string>();

/** 注册固定中文文案，保留动态菜单和组件使用的文案键。 */
function registerTexts(messages: TextMessages, prefix = ''): void {
  for (const [key, value] of Object.entries(messages)) {
    const textKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      texts.set(textKey, value);
    } else {
      registerTexts(value, textKey);
    }
  }
}

registerTexts({ authentication, common, preferences, profile, ui });

/** 读取中文文案，未注册的服务端菜单标题直接显示原文。 */
function getText(
  key: string,
  values?: Readonly<Record<string, unknown>> | readonly unknown[],
): string {
  const text = texts.get(key) ?? key;
  if (!values) {
    return text;
  }
  return text.replaceAll(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = Array.isArray(values)
      ? values[Number(name)]
      : (values as Readonly<Record<string, unknown>>)[name];
    return value === undefined ? placeholder : String(value);
  });
}

export { getText, registerTexts };
