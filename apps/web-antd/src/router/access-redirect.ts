import type { Router } from 'vue-router';

/** 登录回跳只接受当前接口菜单中仍存在的页面；临时无权限页不能覆盖真实首页。 */
export function authenticatedDestination(
  router: Router,
  requested: unknown,
  homePath: string,
) {
  if (typeof requested !== 'string' || !requested) return homePath;
  try {
    const path = decodeURIComponent(requested);
    if (!path.startsWith('/') || path.startsWith('//')) return homePath;
    if (path.split(/[?#]/, 1)[0] === '/access-empty') return homePath;
    const resolved = router.resolve(path);
    return resolved.matched.some((record) =>
      String(record.name).startsWith('menu:'),
    )
      ? resolved.fullPath
      : homePath;
  } catch {
    return homePath;
  }
}
