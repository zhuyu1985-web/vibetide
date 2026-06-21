/**
 * 领域一等维度 · 默认领域字典（P2）。
 *
 * seedDefaultDomainsForOrg 用它幂等播种到 org。财经/体育/时政带初始口径包
 * （promptGuidance 注入 Layer 4.5；authoritySources 喂 web_search includeDomains），
 * 其余先给名称，运营在 /settings/domains 补口径包。
 */
export interface DomainSeed {
  slug: string;
  name: string;
  description?: string;
  promptGuidance?: string;
  authoritySources?: string[];
  sortOrder: number;
}

export const DEFAULT_DOMAINS: DomainSeed[] = [
  {
    slug: "finance",
    name: "财经",
    description: "财经/金融/产业经济报道",
    promptGuidance:
      "不作任何投资建议、不荐股；财务与市场数据以证监会、交易所、央行等官方披露为准；严格区分「预测/观点」与「已发生的事实」，引用数据须标来源与时点。",
    authoritySources: [
      "csrc.gov.cn",
      "sse.com.cn",
      "szse.cn",
      "pbc.gov.cn",
      "stats.gov.cn",
    ],
    sortOrder: 10,
  },
  {
    slug: "sports",
    name: "体育",
    description: "赛事/体育产业报道",
    promptGuidance:
      "比分、赛程、转会以赛事官方/俱乐部官方发布为准；不传播未经证实的转会与伤病传闻；运动员称谓规范、不带主观贬损。",
    authoritySources: ["fifa.com", "olympics.com", "the-afc.com"],
    sortOrder: 20,
  },
  {
    slug: "politics",
    name: "时政",
    description: "时政/政务报道",
    promptGuidance:
      "严守称谓与职务排序规范；政策表述以权威发布原文为准，不演绎、不简化关键定性；涉敏感议题保持中性、不臆测。",
    authoritySources: ["gov.cn", "xinhuanet.com", "people.com.cn"],
    sortOrder: 30,
  },
  { slug: "society", name: "社会", description: "社会民生新闻", sortOrder: 40 },
  { slug: "livelihood", name: "民生", description: "民生服务/消费", sortOrder: 50 },
  { slug: "law", name: "法治", description: "法治/司法报道", sortOrder: 60 },
  { slug: "tech", name: "科技", description: "科技/互联网/AI", sortOrder: 70 },
  { slug: "entertainment", name: "文娱", description: "文化/娱乐/影视", sortOrder: 80 },
];
