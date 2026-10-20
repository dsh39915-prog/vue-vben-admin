export const drawingNodes = [
  { key: 'aiMatchingOutput', title: 'AI搭配方案输出' },
  { key: 'aiMatchingAudit', title: 'AI搭配方案审核' },
  { key: 'aiImageTaskDispatch', title: 'AI图片生成任务分配' },
  { key: 'aiImageModelTask', title: 'AI图片生成（模特图）' },
  { key: 'aiImageModelAudit', title: 'AI图片审核（模特图）' },
  { key: 'aiImageActionTask', title: 'AI图片生成（动作图）' },
  { key: 'aiImageActionAudit', title: 'AI图片审核（动作图）' },
  { key: 'retouchTaskDispatch', title: '修图任务分配' },
  { key: 'retouching', title: '修图制作' },
  { key: 'retouchingAudit', title: '修图审核' },
  { key: 'pageTaskDispatch', title: '页面制作任务分配' },
  { key: 'pageProduction', title: '页面制作' },
  { key: 'pageProductionAudit', title: '页面审核' },
  { key: 'launchTaskDispatch', title: '上新任务分配' },
  { key: 'launchAudit', title: '上新审核' },
] as const;
export type DrawingNodeKey = (typeof drawingNodes)[number]['key'];
export const drawingManagePermission = 'flycowerp:drawing:manage';
export const drawingPermission = (key: DrawingNodeKey) =>
  'flycowerp:drawing:' + key;
export const drawingPath = (key: DrawingNodeKey) => '/drawing/' + key;
export function getDrawingNode(key: unknown) {
  return drawingNodes.find((node) => node.key === key);
}
/** Recognize the backend super administrator only within the drawing workflow. */
export function resolveDrawingAccessCodes(
  permissions: string[],
  roles: string[],
) {
  return roles.includes('super_admin') &&
    !permissions.includes('*:*:*') &&
    !permissions.includes(drawingManagePermission)
    ? [...permissions, drawingManagePermission]
    : [...permissions];
}
export function isDrawingManager(codes: string[]) {
  return codes.includes('*:*:*') || codes.includes(drawingManagePermission);
}
export function canAccessDrawingNode(codes: string[], key: DrawingNodeKey) {
  return isDrawingManager(codes) || codes.includes(drawingPermission(key));
}
export function drawingHomePath(codes: string[]) {
  if (isDrawingManager(codes)) return;
  const node = drawingNodes.find((item) =>
    canAccessDrawingNode(codes, item.key),
  );
  return node ? drawingPath(node.key) : undefined;
}
export function canConfigureDrawing(codes: string[]) {
  return (
    isDrawingManager(codes) &&
    (codes.includes('*:*:*') ||
      codes.includes('system:permission:assign-role-menu') ||
      codes.includes('system:permission:assign-user-role'))
  );
}
export function canAccessDrawingPath(path: string, codes: string[]) {
  if (path === '/launch/duties') return canConfigureDrawing(codes);
  if (path === '/launch' || path.startsWith('/launch/'))
    return isDrawingManager(codes);
  if (path === '/drawing')
    return drawingNodes.some((node) => canAccessDrawingNode(codes, node.key));
  if (path.startsWith('/drawing/')) {
    const node = getDrawingNode(path.slice('/drawing/'.length));
    return Boolean(node && canAccessDrawingNode(codes, node.key));
  }
  return true;
}
