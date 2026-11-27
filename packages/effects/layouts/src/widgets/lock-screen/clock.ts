/** 使用应用时区生成锁屏时间，避免依赖浏览器所在时区。 */
export function formatLockScreenClock(time: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(time);
  const fields = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return {
    date: `${fields.year}-${fields.month}-${fields.day} ${fields.weekday}`,
    hour: fields.hour,
    minute: fields.minute,
    meridiem: Number(fields.hour) < 12 ? 'AM' : 'PM',
  };
}
