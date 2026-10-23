import type { MatchingScheme, WorkflowImage } from '#/api';

import { describe, expect, it } from 'vitest';

import {
  applyStyleAiImages,
  fillEmptySchemeImages,
} from './matching-scheme-apply';

const image = (name: string): WorkflowImage => ({
  originalUrl: `https://example.test/${name}.png`,
  previewUrl: `https://example.test/${name}-preview.png`,
  thumbnailUrl: `https://example.test/${name}-thumb.png`,
  imageId: `temp-${name}`,
});
const scheme = (): MatchingScheme => ({
  id: 'current-scheme',
  styleNo: 'CURRENT',
  styleName: '红色',
  hasOtherStyle: false,
  clothingProductUrls: [
    { ...image('main'), styleNo: 'CURRENT', isMain: 1 },
    { ...image('companion'), styleNo: 'PREVIOUS', isMain: 0 },
  ],
});

describe('reuse matching scheme images', () => {
  it('combines model and action images once, preserving URLs and source clothing metadata', () => {
    const target = scheme();
    const before = structuredClone(target);
    const model = image('model');
    const action = image('action');
    expect(
      applyStyleAiImages(target, {
        id: 'previous-style',
        styleNo: 'PREVIOUS',
        styleName: '蓝色',
        aiModelImageUrls: [model],
        aiActionImageUrls: [model, action],
      }),
    ).toBe(1);
    expect(target).toEqual({
      ...before,
      aiGeneratedImageUrls: [model, action].map(
        ({ originalUrl, previewUrl, thumbnailUrl }) => ({
          originalUrl,
          previewUrl,
          thumbnailUrl,
          styleNo: 'PREVIOUS',
          isMain: 0,
        }),
      ),
    });
    expect(target.aiGeneratedImageUrls?.[0]).not.toBe(model);
    const applied = structuredClone(target);
    expect(
      applyStyleAiImages(target, {
        id: 'another',
        styleNo: 'OTHER',
        styleName: '黑色',
        aiActionImageUrls: [image('other')],
      }),
    ).toBe(0);
    expect(target).toEqual(applied);
  });

  it('does not change the scheme when both AI output fields are empty', () => {
    const target = scheme();
    const before = structuredClone(target);
    expect(
      applyStyleAiImages(target, {
        id: 'empty',
        styleNo: 'EMPTY',
        styleName: '黑色',
      }),
    ).toBe(0);
    expect(target).toEqual(before);
  });

  it('fills empty single and multiple image fields without copying identity or clothing', () => {
    const target = scheme();
    const clothing = structuredClone(target.clothingProductUrls);
    const source: MatchingScheme = {
      ...scheme(),
      id: 'previous-scheme',
      styleNo: 'PREVIOUS',
      styleName: '蓝色',
      hasOtherStyle: true,
      clothingProductUrls: [image('previous-main')],
      mainReferenceFrontUrl: image('front'),
      modelImageUrls: image('model'),
      sceneImageUrls: [image('scene-1'), image('scene-2')],
    };
    expect(fillEmptySchemeImages(target, source)).toBe(3);
    expect(target).toMatchObject({
      id: 'current-scheme',
      styleNo: 'CURRENT',
      styleName: '红色',
      hasOtherStyle: false,
    });
    expect(target.clothingProductUrls).toEqual(clothing);
    expect(target.mainReferenceFrontUrl).toEqual(source.mainReferenceFrontUrl);
    expect(target.sceneImageUrls).toEqual(source.sceneImageUrls);
    expect(target.sceneImageUrls).not.toBe(source.sceneImageUrls);
    expect(target.mainReferenceFrontUrl).not.toBe(source.mainReferenceFrontUrl);
    expect(fillEmptySchemeImages(target, source)).toBe(0);
  });

  it('preserves occupied image fields, including partially filled multiple-image fields', () => {
    const target = {
      ...scheme(),
      mainReferenceFrontUrl: image('existing-front'),
      sceneImageUrls: [image('existing-scene')],
    };
    const before = structuredClone(target);
    expect(
      fillEmptySchemeImages(target, {
        ...scheme(),
        mainReferenceFrontUrl: image('new-front'),
        sceneImageUrls: [image('new-scene-1'), image('new-scene-2')],
      }),
    ).toBe(0);
    expect(target).toEqual(before);
  });

  it('does not remove existing images when the previous scheme has no usable fields', () => {
    const target = { ...scheme(), propImageUrls: image('existing-prop') };
    const before = structuredClone(target);
    expect(fillEmptySchemeImages(target, scheme())).toBe(0);
    expect(target).toEqual(before);
  });
});
