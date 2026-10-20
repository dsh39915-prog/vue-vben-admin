import { describe, expect, it } from 'vitest';

import {
  canAccessDrawingNode,
  canAccessDrawingPath,
  canConfigureDrawing,
  drawingHomePath,
  drawingManagePermission,
  drawingNodes,
  drawingPermission,
  isDrawingManager,
  resolveDrawingAccessCodes,
} from './nodes';

describe('drawing duties access policy', () => {
  it('denies unconfigured accounts, including direct node and management URLs', () => {
    for (const path of [
      '/drawing',
      '/drawing/aiMatchingOutput',
      '/launch/workbench',
      '/launch/tasks',
      '/launch/duties',
    ])
      expect(canAccessDrawingPath(path, [])).toBe(false);
    expect(drawingHomePath([])).toBeUndefined();
  });
  it('combines explicitly granted duties without inheriting other stages or management access', () => {
    const codes = [
      drawingPermission('aiMatchingOutput'),
      drawingPermission('retouchingAudit'),
    ];
    expect(canAccessDrawingNode(codes, 'aiMatchingOutput')).toBe(true);
    expect(canAccessDrawingNode(codes, 'retouchingAudit')).toBe(true);
    expect(canAccessDrawingNode(codes, 'aiMatchingAudit')).toBe(false);
    expect(canAccessDrawingPath('/drawing/aiMatchingAudit', codes)).toBe(false);
    expect(canAccessDrawingPath('/launch/workbench', codes)).toBe(false);
    expect(canAccessDrawingPath('/launch/process', codes)).toBe(false);
    expect(drawingHomePath(codes)).toBe('/drawing/aiMatchingOutput');
  });
  it('does not treat management privileges as permission to change role grants', () => {
    expect(
      canAccessDrawingNode([drawingManagePermission], 'retouchingAudit'),
    ).toBe(true);
    expect(
      canAccessDrawingPath('/launch/tasks', [drawingManagePermission]),
    ).toBe(true);
    expect(
      canAccessDrawingPath('/launch/duties', [drawingManagePermission]),
    ).toBe(false);
    expect(canConfigureDrawing(['system:permission:assign-role-menu'])).toBe(
      false,
    );
    expect(
      canConfigureDrawing([
        drawingManagePermission,
        'system:permission:assign-role-menu',
      ]),
    ).toBe(true);
  });
  it('allows the backend superuser wildcard but rejects invented node paths', () => {
    expect(canAccessDrawingPath('/drawing/launchAudit', ['*:*:*'])).toBe(true);
    expect(canConfigureDrawing(['*:*:*'])).toBe(true);
    expect(canAccessDrawingPath('/drawing/not-a-node', ['*:*:*'])).toBe(false);
  });
  it('leaves unrelated application routes to their existing access policy', () => {
    expect(canAccessDrawingPath('/account/profile', [])).toBe(true);
  });
});

describe('backend super administrator drawing access', () => {
  it('restores workflow access without granting a global wildcard or system permissions', () => {
    const permissions = ['system:permission:assign-role-menu'];
    const codes = resolveDrawingAccessCodes(permissions, [
      'common',
      'super_admin',
    ]);
    expect(codes).toEqual([...permissions, drawingManagePermission]);
    expect(permissions).toEqual(['system:permission:assign-role-menu']);
    expect(codes).not.toContain('*:*:*');
    expect(codes).not.toContain('system:role:query');
    for (const node of drawingNodes)
      expect(canAccessDrawingNode(codes, node.key)).toBe(true);
    for (const path of [
      '/launch/tasks',
      '/launch/workbench',
      '/launch/process',
      '/launch/definitions',
      '/launch/duties',
    ])
      expect(canAccessDrawingPath(path, codes)).toBe(true);
    expect(canAccessDrawingPath('/drawing/unknown', codes)).toBe(false);
    expect(drawingHomePath(codes)).toBeUndefined();
    expect(
      canConfigureDrawing(resolveDrawingAccessCodes([], ['super_admin'])),
    ).toBe(false);
  });
  it('preserves employee node scope and does not infer access from generic role names', () => {
    const permissions = [drawingPermission('retouching')];
    for (const roles of [
      [],
      ['common'],
      ['admin'],
      ['super'],
      ['super_admin_assistant'],
    ]) {
      const codes = resolveDrawingAccessCodes(permissions, roles);
      expect(codes).toEqual(permissions);
      expect(isDrawingManager(codes)).toBe(false);
      expect(canAccessDrawingPath('/launch/tasks', codes)).toBe(false);
      expect(canAccessDrawingNode(codes, 'retouching')).toBe(true);
      expect(canAccessDrawingNode(codes, 'retouchingAudit')).toBe(false);
      expect(drawingHomePath(codes)).toBe('/drawing/retouching');
    }
  });
  it('does not duplicate existing workflow or wildcard permissions', () => {
    for (const permissions of [[drawingManagePermission], ['*:*:*']])
      expect(resolveDrawingAccessCodes(permissions, ['super_admin'])).toEqual(
        permissions,
      );
  });
});
