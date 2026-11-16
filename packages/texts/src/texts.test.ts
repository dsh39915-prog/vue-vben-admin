import { describe, expect, it } from 'vitest';

import { getText, registerTexts } from './texts';

describe('chinese text', () => {
  it('resolves shared Chinese messages', () => {
    expect(getText('common.confirm')).toBe('确认');
  });

  it('interpolates form labels and numeric values', () => {
    expect(getText('ui.formRules.minLength', ['密码', 6])).toBe(
      '密码至少6个字符',
    );
  });

  it('preserves plain server menu titles and unknown keys', () => {
    expect(getText('系统管理')).toBe('系统管理');
    expect(getText('missing.title')).toBe('missing.title');
  });

  it('registers application text with named placeholders', () => {
    registerTexts({ test: { greeting: '你好，{name}' } });
    expect(getText('test.greeting', { name: '管理员' })).toBe('你好，管理员');
  });

  it('preserves placeholders when a parameter is missing', () => {
    expect(getText('ui.formRules.minLength', ['密码'])).toBe(
      '密码至少{1}个字符',
    );
  });
});
