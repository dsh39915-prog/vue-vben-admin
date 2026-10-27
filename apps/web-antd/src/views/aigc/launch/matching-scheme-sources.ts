import type {
  MatchingScheme,
  ProductStyle,
  WorkflowId,
  WorkflowImage,
} from '#/api';

export interface MatchingSchemeOrigin {
  key: string;
  sourceStyleId: WorkflowId;
  manuallyAdded: boolean;
}

const styleKey = (style: Pick<ProductStyle, 'styleName' | 'styleNo'>) =>
  JSON.stringify([style.styleNo?.trim(), style.styleName?.trim()]);

export function mainClothingImage(
  style: ProductStyle,
): undefined | WorkflowImage {
  return style.clothingProductUrl
    ? {
        ...style.clothingProductUrl,
        styleNo: style.styleNo,
        isMain: 1,
        coordStyleId: style.id,
      }
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
  storedOrigins?: MatchingSchemeOrigin[],
) {
  const sourceKeys = new Set<string>();
  for (const style of styles) {
    if (!style.styleNo?.trim() || !style.styleName?.trim())
      throw new Error('表格款式缺少款号或颜色，请核对来源数据');
    const key = styleKey(style);
    if (sourceKeys.has(key))
      throw new Error('表格存在重复款号和颜色，无法确定对应搭配方案');
    sourceKeys.add(key);
  }
  const savedByKey = new Map<
    string,
    { scheme: MatchingScheme; origin?: MatchingSchemeOrigin }[]
  >();
  for (const [index, scheme] of saved.entries()) {
    const origin = storedOrigins?.[index];
    const main = scheme.clothingProductUrls.find((image) => image.isMain === 1);
    const sourceId =
      origin?.sourceStyleId ?? main?.coordStyleId ?? scheme.styleId;
    const exact = styles.find((style) => styleKey(style) === styleKey(scheme));
    const matches = styles.filter((style) =>
      sourceId !== undefined
        ? String(style.id) === String(sourceId)
        : exact
          ? style === exact
          : scheme.hasOtherStyle &&
            main &&
            style.styleNo === scheme.styleNo &&
            style.clothingProductUrl?.originalUrl === main.originalUrl,
    );
    if (matches.length !== 1)
      throw new Error('已有方案与表格款式不一致，请核对来源数据后重新加载');
    const key = styleKey(matches[0]!);
    const entries = savedByKey.get(key) ?? [];
    entries.push({ scheme, origin });
    savedByKey.set(key, entries);
  }
  const mainImages: (undefined | WorkflowImage)[] = [];
  const schemes: MatchingScheme[] = [];
  const origins: MatchingSchemeOrigin[] = [];
  for (const style of styles) {
    const key = styleKey(style);
    const entries = savedByKey.get(key) ?? [];
    const originals = entries.filter(({ scheme, origin }) =>
      origin
        ? !origin.manuallyAdded
        : !scheme.hasOtherStyle || scheme.styleName === style.styleName,
    );
    if (originals.length > 1)
      throw new Error('同款号和颜色存在多个原始方案，请核对方案数据');
    const original = originals[0];
    const previous = original?.scheme;
    const main = mainClothingImage(style);
    mainImages.push(main);
    schemes.push({
      ...previous,
      styleId: style.id,
      styleNo: style.styleNo,
      styleName: style.styleName,
      hasOtherStyle: previous?.hasOtherStyle ?? false,
      clothingProductUrls: withMainClothing(
        main,
        previous?.clothingProductUrls ?? [],
      ),
    });
    origins.push({
      key: original?.origin?.key ?? `source:${style.id}`,
      sourceStyleId: style.id,
      manuallyAdded: false,
    });
    for (const [index, entry] of entries.entries()) {
      if (entry === original) continue;
      schemes.push({
        ...entry.scheme,
        styleNo: style.styleNo,
        clothingProductUrls: withMainClothing(
          main,
          entry.scheme.clothingProductUrls,
        ),
      });
      mainImages.push(main);
      origins.push({
        key:
          entry.origin?.key ?? `joint:${style.id}:${entry.scheme.id ?? index}`,
        sourceStyleId: style.id,
        manuallyAdded: true,
      });
    }
  }
  return { schemes, mainImages, origins };
}

export function createJointMatchingScheme(
  source: MatchingScheme,
  mainStyle: ProductStyle,
  companion: ProductStyle,
): MatchingScheme {
  const main = mainClothingImage(mainStyle);
  if (!main) throw new Error('主款缺少服饰图，请补齐来源数据');
  if (String(mainStyle.id) === String(companion.id))
    throw new Error('请选择与主服装不同的搭配款式');
  if (!companion.clothingProductUrl)
    throw new Error('所选搭配款式暂无服饰图，请选择其他款式');
  const scheme = JSON.parse(JSON.stringify(source)) as MatchingScheme;
  delete scheme.id;
  delete scheme.styleId;
  return {
    ...scheme,
    styleNo: mainStyle.styleNo,
    styleName: `${mainStyle.styleName}+${companion.styleName}`,
    hasOtherStyle: true,
    clothingProductUrls: [
      main,
      {
        ...companion.clothingProductUrl,
        styleNo: companion.styleNo,
        isMain: 0,
        coordStyleId: companion.id,
      },
    ],
  };
}
