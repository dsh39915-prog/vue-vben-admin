import { describe, expect, it } from 'vitest';

import { buildSystemTree, validateSystemIds } from './tree';

describe('system menu hierarchy', () => {
  it('retains filtered orphans and orders siblings without modifying source records', () => {
    const items = [
      { id: 3, name: 'child', parentId: 1, sort: 2 },
      { id: 2, name: 'first', parentId: 1, sort: 1 },
      { id: 1, name: 'root', parentId: 0 },
      { id: 4, name: 'filtered match', parentId: 99 },
    ];
    const tree = buildSystemTree(items);
    expect(tree.map((node) => node.id)).toEqual([1, 4]);
    expect(tree[0]?.children?.map((node) => node.id)).toEqual([2, 3]);
    expect(items[2]).not.toHaveProperty('children');
  });
  it('rejects cycles, duplicates and unsafe IDs before rendering an editable tree', () => {
    expect(() =>
      buildSystemTree([
        { id: 1, name: 'one', parentId: 2 },
        { id: 2, name: 'two', parentId: 1 },
      ]),
    ).toThrow();
    expect(() =>
      buildSystemTree([
        { id: 1, name: 'one' },
        { id: 1, name: 'duplicate' },
      ]),
    ).toThrow();
    expect(() =>
      buildSystemTree([{ id: Number.MAX_SAFE_INTEGER + 1, name: 'unsafe' }]),
    ).toThrow();
  });
  it('accepts an explicitly empty grant list and rejects malformed grants', () => {
    expect(() => validateSystemIds([])).not.toThrow();
    for (const data of [null, {}, ['1'], [0], [-1], [1.5]])
      expect(() => validateSystemIds(data)).toThrow();
  });
});
