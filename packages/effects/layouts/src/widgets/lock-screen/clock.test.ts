import { describe, expect, it } from 'vitest';

import { formatLockScreenClock } from './clock';

describe('锁屏时区', () => {
  it('按配置的时区生成日期和时钟，不受设备时区影响', () => {
    const time = new Date('2026-11-27T00:00:00Z');
    expect(formatLockScreenClock(time, 'Asia/Shanghai')).toEqual({
      date: '2026-11-27 星期五',
      hour: '08',
      minute: '00',
      meridiem: 'AM',
    });
    expect(formatLockScreenClock(time, 'America/New_York')).toEqual({
      date: '2026-11-26 星期四',
      hour: '19',
      minute: '00',
      meridiem: 'PM',
    });
  });
  it('上海午夜显示 00 点，日期随上海时区跨日', () => {
    expect(
      formatLockScreenClock(new Date('2026-11-26T16:01:00Z'), 'Asia/Shanghai'),
    ).toEqual({
      date: '2026-11-27 星期五',
      hour: '00',
      minute: '01',
      meridiem: 'AM',
    });
  });
});
