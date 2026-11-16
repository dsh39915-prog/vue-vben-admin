const messages: Record<string, string> = {
  cancel: '取消',
  collapse: '收起',
  confirm: '确认',
  expand: '展开',
  prompt: '提示',
  reset: '重置',
  submit: '提交',
};

export function useTexts() {
  return { getText: (key: string) => messages[key] ?? key };
}
