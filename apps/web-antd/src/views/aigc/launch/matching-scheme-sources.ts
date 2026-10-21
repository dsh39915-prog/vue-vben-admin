import type { MatchingScheme, ProductStyle, WorkflowImage } from '#/api';

const styleKey = (style: Pick<ProductStyle, 'styleName' | 'styleNo'>) =>
  JSON.stringify([style.styleNo?.trim(), style.styleName?.trim()]);

export function mainClothingImage(
  style: ProductStyle,
): undefined | WorkflowImage {
  return style.clothingProductUrl
    ? { ...style.clothingProductUrl, styleNo: style.styleNo, isMain: 1 }
    : undefined;
}

export function withMainClothing(
  main: undefined | WorkflowImage,
  images: WorkflowImage[],
) {
  return [
    ...(main ? [{ ...main, isMain: 1 }] : []),
    ...images
      .filter((image) => image.originalUrl !== main?.originalUrl)
      .map((image) => ({ ...image, isMain: 0 })),
  ];
}

export function sourceMatchingSchemes(
  styles: ProductStyle[],
  saved: MatchingScheme[],
) {
  const sourceKeys = new Set<string>();
  const savedByKey = new Map<string, MatchingScheme>();
  for (const scheme of saved) {
    const key = styleKey(scheme);
    if (savedByKey.has(key))
      throw new Error('同款号和颜色存在多个方案，请核对方案数据');
    savedByKey.set(key, scheme);
  }
  const mainImages: (undefined | WorkflowImage)[] = [];
  const schemes = styles.map((style) => {
    if (!style.styleNo?.trim() || !style.styleName?.trim())
      throw new Error('表格款式缺少款号或颜色，请核对来源数据');
    const key = styleKey(style);
    if (sourceKeys.has(key))
      throw new Error('表格存在重复款号和颜色，无法确定对应搭配方案');
    sourceKeys.add(key);
    const previous = savedByKey.get(key);
    const main = mainClothingImage(style);
    mainImages.push(main);
    return {
      ...previous,
      styleNo: style.styleNo,
      styleName: style.styleName,
      hasOtherStyle: previous?.hasOtherStyle ?? false,
      clothingProductUrls: withMainClothing(
        main,
        previous?.clothingProductUrls ?? [],
      ),
    } satisfies MatchingScheme;
  });
  if (saved.some((scheme) => !sourceKeys.has(styleKey(scheme))))
    throw new Error('已有方案与表格款式不一致，请核对来源数据后重新加载');
  return { schemes, mainImages };
}
