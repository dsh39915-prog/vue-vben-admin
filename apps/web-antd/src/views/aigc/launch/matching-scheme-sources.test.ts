import type { MatchingScheme, ProductStyle, WorkflowImage } from '#/api';

import { describe, expect, it } from 'vitest';

import { readMatchingSchemeDraft } from './matching-scheme-draft';
import {
  createJointMatchingScheme,
  sourceMatchingSchemes,
} from './matching-scheme-sources';
import { decodeScheme } from './workflow-helpers';

const image = (name: string): WorkflowImage => ({
  originalUrl: `https://example.test/${name}.png`,
  previewUrl: `https://example.test/${name}-preview.png`,
  thumbnailUrl: `https://example.test/${name}-thumb.png`,
});
const style: ProductStyle = {
  id: '9007199254740993123',
  styleNo: 'MAIN',
  styleName: '红色',
  clothingProductUrl: image('main'),
};
const saved = (values: Partial<MatchingScheme> = {}): MatchingScheme => ({
  id: 'scheme-1',
  styleNo: style.styleNo,
  styleName: style.styleName,
  hasOtherStyle: false,
  clothingProductUrls: [],
  ...values,
});

describe('matching scheme source identity', () => {
  it('associates the source and each main image with its exact style ID', () => {
    const companion = {
      ...image('companion'),
      styleNo: 'COMPANION',
      isMain: 0,
      coordStyleId: '9007199254740993124',
    };
    const { schemes } = sourceMatchingSchemes(
      [style],
      [saved({ clothingProductUrls: [companion] })],
    );
    expect(schemes[0]).toMatchObject({
      styleId: style.id,
      clothingProductUrls: [
        { ...style.clothingProductUrl, coordStyleId: style.id, isMain: 1 },
        companion,
      ],
    });
  });

  it('restores a renamed or incomplete joint style draft by source ID', () => {
    for (const styleName of ['红蓝合拍', '']) {
      const { schemes, origins } = sourceMatchingSchemes(
        [style],
        [saved({ styleId: style.id, hasOtherStyle: true, styleName })],
      );
      expect(schemes[0]?.styleName).toBe(style.styleName);
      expect(schemes[1]?.styleName).toBe(styleName);
      expect(origins.map((origin) => origin.manuallyAdded)).toEqual([
        false,
        true,
      ]);
    }
  });

  it('restores a joint scheme response without styleId using its main clothing ID', () => {
    const { schemes } = sourceMatchingSchemes(
      [style],
      [
        saved({
          hasOtherStyle: true,
          styleName: '红蓝合拍',
          clothingProductUrls: [
            { ...image('old-main'), isMain: 1, coordStyleId: style.id },
          ],
        }),
      ],
    );
    expect(schemes[1]).toMatchObject({
      id: 'scheme-1',
      styleName: '红蓝合拍',
    });
  });

  it('keeps same-number source styles separate when their joint names are identical', () => {
    const other = { ...style, id: 'other-style', styleName: '蓝色' };
    const { schemes } = sourceMatchingSchemes(
      [style, other],
      [other, style].map((source) =>
        saved({
          id: `scheme-${source.id}`,
          styleId: source.id,
          hasOtherStyle: true,
          styleName: '合拍款',
        }),
      ),
    );
    expect(schemes.map((scheme) => scheme.id)).toEqual([
      undefined,
      `scheme-${style.id}`,
      undefined,
      `scheme-${other.id}`,
    ]);
  });

  it('reads legacy schemes by number and color and rejects stale or duplicate source IDs', () => {
    expect(sourceMatchingSchemes([style], [saved()]).schemes[0]?.id).toBe(
      'scheme-1',
    );
    expect(() =>
      sourceMatchingSchemes([style], [saved({ styleId: 'stale' })]),
    ).toThrow('已有方案与表格款式不一致');
    expect(() => sourceMatchingSchemes([style], [saved(), saved()])).toThrow(
      '同款号和颜色存在多个原始方案',
    );
  });

  it('creates independent joint materials with only the selected main and companion clothing', () => {
    const companion = {
      ...style,
      id: '9007199254740993124',
      styleNo: 'COMPANION',
      styleName: '蓝色',
      clothingProductUrl: image('companion'),
    };
    const source = saved({
      styleId: style.id,
      aiMatchingImageUrl: image('matching'),
      sceneImageUrls: [image('scene')],
      clothingProductUrls: [image('old-companion')],
    });
    const joint = createJointMatchingScheme(source, style, companion);
    expect(joint).toMatchObject({
      styleNo: style.styleNo,
      styleName: '红色+蓝色',
      hasOtherStyle: true,
      aiMatchingImageUrl: source.aiMatchingImageUrl,
      sceneImageUrls: source.sceneImageUrls,
      clothingProductUrls: [
        { ...style.clothingProductUrl, isMain: 1, coordStyleId: style.id },
        {
          ...companion.clothingProductUrl,
          isMain: 0,
          coordStyleId: companion.id,
        },
      ],
    });
    expect(joint.id).toBeUndefined();
    expect(joint.styleId).toBeUndefined();
    joint.sceneImageUrls![0]!.originalUrl = 'changed';
    expect(source.sceneImageUrls![0]!.originalUrl).toBe(
      image('scene').originalUrl,
    );
    expect(() => createJointMatchingScheme(source, style, style)).toThrow(
      '不同',
    );
    expect(() =>
      createJointMatchingScheme(source, style, {
        ...companion,
        clothingProductUrl: undefined,
      }),
    ).toThrow('暂无服饰图');
  });

  it('preserves manual identity through drafts even with duplicate names or an unchecked switch', () => {
    const original = saved({ styleId: style.id, hasOtherStyle: true });
    const joint = saved({ id: undefined, styleName: style.styleName });
    const origins = [
      { key: 'source', sourceStyleId: style.id, manuallyAdded: false },
      { key: 'manual:1', sourceStyleId: style.id, manuallyAdded: true },
    ];
    const draft = readMatchingSchemeDraft(
      JSON.stringify({
        version: 1,
        formType: 'aiMatchingOutput',
        schemes: [original, joint],
        origins,
        remarkInfoVO: {},
      }),
    )!;
    const restored = sourceMatchingSchemes(
      [style],
      draft.schemes,
      draft.origins,
    );
    expect(restored.origins).toEqual(origins);
    expect(restored.schemes).toHaveLength(2);
    expect(restored.schemes[1]?.hasOtherStyle).toBe(false);
    expect(() =>
      readMatchingSchemeDraft(
        JSON.stringify({ ...draft, origins: origins.slice(1) }),
      ),
    ).toThrow('草稿数据格式不正确');
  });

  it('normalizes numeric and boolean joint style flags without losing clothing IDs', () => {
    for (const flag of [false, true, 0, 1] as const) {
      const scheme = decodeScheme({
        ...saved(),
        hasOtherStyle: flag,
        clothingProductUrls: JSON.stringify([
          { ...image('main'), isMain: 1, coordStyleId: style.id },
        ]),
      });
      expect(scheme.hasOtherStyle).toBe(flag === true || flag === 1);
      expect(scheme.clothingProductUrls[0]?.coordStyleId).toBe(style.id);
    }
  });
});
