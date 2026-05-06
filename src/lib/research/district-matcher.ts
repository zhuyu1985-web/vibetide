// src/lib/research/district-matcher.ts
// A3 Phase 3: district keyword matching with 40-district variants dictionary

export interface DistrictWithName {
  id: string;
  name: string;
}

export interface DistrictMatchResult {
  districtId: string;
  matchedKeyword: string;
}

// V1 内置变体字典（含历史称谓、简称）— 重庆市 40 个区县（含 38 区县 + 两江新区 + 高新区）
export const DISTRICT_VARIANTS: Record<string, string[]> = {
  "涪陵区": ["涪陵区", "涪陵县", "涪陵"],
  "渝中区": ["渝中区", "渝中"],
  "两江新区": ["两江新区"],
  "九龙坡区": ["九龙坡区", "九龙坡"],
  "云阳县": ["云阳县", "云阳"],
  "巴南区": ["巴南区", "巴南"],
  "巫山县": ["巫山县", "巫山"],
  "奉节县": ["奉节县", "奉节"],
  "江津区": ["江津区", "江津"],
  "梁平区": ["梁平区", "梁平县", "梁平"],
  "忠县": ["忠县"],
  "长寿区": ["长寿区", "长寿"],
  "开州区": ["开州区", "开县", "开州"],
  "黔江区": ["黔江区", "黔江"],
  "南岸区": ["南岸区", "南岸"],
  "南川区": ["南川区", "南川县", "南川"],
  "大渡口区": ["大渡口区", "大渡口"],
  "永川区": ["永川区", "永川"],
  "沙坪坝区": ["沙坪坝区", "沙坪坝"],
  "璧山区": ["璧山区", "璧山县", "璧山"],
  "万州区": ["万州区", "万州"],
  "秀山县": ["秀山县", "秀山"],
  "江北区": ["江北区", "江北"],
  "丰都县": ["丰都县", "丰都"],
  "铜梁区": ["铜梁区", "铜梁县", "铜梁"],
  "万盛经开区": ["万盛经开区", "万盛区", "万盛"],
  "合川区": ["合川区", "合川市", "合川"],
  "潼南区": ["潼南区", "潼南县", "潼南"],
  "西部科学城重庆高新区": ["西部科学城重庆高新区", "重庆高新区", "高新区"],
  "城口县": ["城口县", "城口"],
  "彭水县": ["彭水县", "彭水苗族土家族自治县", "彭水"],
  "武隆区": ["武隆区", "武隆县", "武隆"],
  "垫江县": ["垫江县", "垫江"],
  "綦江区": ["綦江区", "綦江县", "綦江"],
  "荣昌区": ["荣昌区", "荣昌县", "荣昌"],
  "酉阳县": ["酉阳县", "酉阳土家族苗族自治县", "酉阳"],
  "大足区": ["大足区", "大足县", "大足"],
  "石柱县": ["石柱县", "石柱土家族自治县", "石柱"],
  "巫溪县": ["巫溪县", "巫溪"],
  "渝北区": ["渝北区", "渝北"],
};

/**
 * 对一条文本进行区县匹配，返回命中的区县列表。
 * 优先使用 DISTRICT_VARIANTS 字典；字典中无记录时 fallback 到 district.name 精确匹配。
 */
export function matchDistrictsForItem(
  text: string,
  districts: DistrictWithName[],
): DistrictMatchResult[] {
  const matches: DistrictMatchResult[] = [];
  if (!text) return matches;
  const lowerText = text.toLowerCase();

  for (const district of districts) {
    const variants = DISTRICT_VARIANTS[district.name] ?? [district.name];
    for (const variant of variants) {
      if (lowerText.includes(variant.toLowerCase())) {
        matches.push({ districtId: district.id, matchedKeyword: variant });
        break; // 每个区县最多命中一次
      }
    }
  }

  return matches;
}

// 仅供测试使用的内部 export
export const _DISTRICT_VARIANTS_FOR_TEST = DISTRICT_VARIANTS;
