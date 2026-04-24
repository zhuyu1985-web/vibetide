// Topic-Compare v2 账号 seed（2026-04-21）
//
// 预置：
//   - 北京台案例 16 个自家账号（my_accounts）
//   - 对标抖音 25 账号（benchmark_accounts, 全局 preset）
//   - 对标微信公众号 17 账号
//   - 对标传统媒体 20 账号（央/省/市/行业）
//
// 注意：自家账号按 organizationId 绑定；对标账号 org_id = null 做全局 preset。
// 重复跑使用 onConflictDoNothing 保证幂等。

import { db } from "@/db";
import { myAccounts, benchmarkAccounts } from "@/db/schema";
import type { InferInsertModel } from "drizzle-orm";

type MyAccountInsert = InferInsertModel<typeof myAccounts>;
type BenchmarkAccountInsert = InferInsertModel<typeof benchmarkAccounts>;

// ============================================================================
// 北京台样板：我方账号
// ============================================================================

const BEIJING_TV_ACCOUNTS: Omit<MyAccountInsert, "organizationId">[] = [
  // 自家 APP / 网站
  { platform: "app", handle: "btime_app", name: "北京时间", accountUrl: "https://www.btime.com/", description: "北京广播电视台官方新闻客户端" },
  { platform: "app", handle: "tingting_fm", name: "听听 FM", accountUrl: "https://www.ttfm.cn/", description: "北京广播电视台音频客户端" },
  { platform: "website", handle: "btime_web", name: "北京时间网站", accountUrl: "https://www.btime.com/" },

  // 抖音
  { platform: "douyin", handle: "BRTV_news", name: "BRTV 新闻", accountUrl: "https://www.douyin.com/user/BRTV_news", description: "北京广播电视台新闻频道" },
  { platform: "douyin", handle: "btv_weishi", name: "北京卫视", accountUrl: "https://www.douyin.com/user/btv_weishi" },
  { platform: "douyin", handle: "btv_big_doctor", name: "北京卫视我是大医生" },
  { platform: "douyin", handle: "btv_yangshengtang", name: "北京卫视养生堂" },
  { platform: "douyin", handle: "brtv", name: "北京广播电视台" },

  // 微博
  { platform: "weibo", handle: "btime_weibo", name: "北京时间" },
  { platform: "weibo", handle: "btv_weishi_weibo", name: "北京卫视" },
  { platform: "weibo", handle: "btv_xiangqianyibu", name: "北京卫视向前一步" },
  { platform: "weibo", handle: "btv_wenyi", name: "北京文艺广播" },
  { platform: "weibo", handle: "tiantian_tiyu", name: "天天体育" },
  { platform: "weibo", handle: "jingjinji_1006", name: "京津冀之声 FM1006" },
  { platform: "weibo", handle: "bj_news_radio", name: "北京新闻广播" },
  { platform: "weibo", handle: "btv_yangshengtang_weibo", name: "北京卫视-养生堂" },
];

export async function seedBeijingTvAccounts(orgId: string): Promise<number> {
  let count = 0;
  for (const acc of BEIJING_TV_ACCOUNTS) {
    const result = await db
      .insert(myAccounts)
      .values({ ...acc, organizationId: orgId })
      .onConflictDoNothing({
        target: [myAccounts.organizationId, myAccounts.platform, myAccounts.handle],
      })
      .returning({ id: myAccounts.id });
    if (result.length > 0) count++;
  }
  return count;
}

// ============================================================================
// 对标账号池（全局 preset，org_id = null）
// ============================================================================

// --- 抖音 25+ ---
const DOUYIN_BENCHMARK: Omit<BenchmarkAccountInsert, "isPreset">[] = [
  { platform: "douyin", level: "central", handle: "xinhua", name: "新华社", description: "国家通讯社" },
  { platform: "douyin", level: "central", handle: "rmrb", name: "人民日报" },
  { platform: "douyin", level: "central", handle: "rmw", name: "人民网" },
  { platform: "douyin", level: "central", handle: "cctvnews", name: "央视新闻" },
  { platform: "douyin", level: "central", handle: "cctv_shipin", name: "央视频" },
  { platform: "douyin", level: "central", handle: "gmw_douyin", name: "光明日报" },
  { platform: "douyin", level: "central", handle: "china_daily", name: "中国日报" },
  { platform: "douyin", level: "central", handle: "chinanews_dy", name: "中国新闻网" },
  { platform: "douyin", level: "central", handle: "zgqnb", name: "中国青年报" },
  { platform: "douyin", level: "central", handle: "xinhuawang", name: "新华网" },
  { platform: "douyin", level: "provincial", handle: "hinews", name: "海南日报" },
  { platform: "douyin", level: "provincial", handle: "daxiang_news", name: "大象新闻", region: "河南" },
  { platform: "douyin", level: "provincial", handle: "bjqingnianbao", name: "北京青年报", region: "北京" },
  { platform: "douyin", level: "provincial", handle: "thepaper_dy", name: "澎湃新闻", region: "上海" },
  { platform: "douyin", level: "provincial", handle: "dzxw", name: "大众新闻", region: "山东" },
  { platform: "douyin", level: "provincial", handle: "btime_bench", name: "北京时间", region: "北京" },
  { platform: "douyin", level: "provincial", handle: "shandian_news", name: "闪电新闻", region: "山东" },
  { platform: "douyin", level: "industry", handle: "knews", name: "看新闻 Knews" },
  { platform: "douyin", level: "self_media", handle: "xiaoqiang_kuaiping", name: "小强快评" },
  { platform: "douyin", level: "self_media", handle: "xiaoqiang_shuo", name: "小强说" },
  { platform: "douyin", level: "self_media", handle: "zhubochi_azhe", name: "主持人阿喆" },
  { platform: "douyin", level: "self_media", handle: "zhinan_caijing", name: "直男财经" },
  { platform: "douyin", level: "self_media", handle: "li_jizhe", name: "李记者的日常" },
  { platform: "douyin", level: "self_media", handle: "xiaoji_yangwei", name: "小记杨威" },
  { platform: "douyin", level: "self_media", handle: "xinwenjie", name: "新闻姐" },
];

// --- 微信公众号 17+ ---
const WECHAT_BENCHMARK: Omit<BenchmarkAccountInsert, "isPreset">[] = [
  { platform: "wechat", level: "central", handle: "cmg_guancha", name: "CMG 观察", description: "中央广播电视总台" },
  { platform: "wechat", level: "central", handle: "guangdian_shiping", name: "广电时评", description: "国家广电总局" },
  { platform: "wechat", level: "central", handle: "zongtai_zhisheng", name: "总台之声" },
  { platform: "wechat", level: "central", handle: "guojia_guangdian", name: "国家广播电视总局" },
  { platform: "wechat", level: "central", handle: "guojia_zhiku", name: "国家广电智库" },
  { platform: "wechat", level: "central", handle: "dianshi_yishu", name: "电视艺术" },
  { platform: "wechat", level: "central", handle: "zongtai_jingliri", name: "中央广电总台总经理室" },
  { platform: "wechat", level: "provincial", handle: "hnbangongshi", name: "湖南广播电视台办公室", region: "湖南" },
  { platform: "wechat", level: "provincial", handle: "hnws_wechat", name: "湖南卫视", region: "湖南" },
  { platform: "wechat", level: "provincial", handle: "hnws_ads", name: "湖南卫视广告部", region: "湖南" },
  { platform: "wechat", level: "provincial", handle: "smg_fabu", name: "SMG 发布", region: "上海" },
  { platform: "wechat", level: "provincial", handle: "dongfang_weishi", name: "东方卫视", region: "上海" },
  { platform: "wechat", level: "provincial", handle: "jiangsu_weishi", name: "江苏卫视", region: "江苏" },
  { platform: "wechat", level: "provincial", handle: "jsgd_shuadapai", name: "江苏广电耍大牌", region: "江苏" },
  { platform: "wechat", level: "provincial", handle: "zhejiang_weishi", name: "浙江卫视", region: "浙江" },
  { platform: "wechat", level: "provincial", handle: "zhejiang_xuanchuan", name: "浙江宣传", region: "浙江" },
  { platform: "wechat", level: "industry", handle: "wenjing_jujiao", name: "温静聚焦" },
];

// --- 传统官媒（报纸 / 网站）20+ ---
const TRADITIONAL_BENCHMARK: Omit<BenchmarkAccountInsert, "isPreset">[] = [
  // 央级
  { platform: "website", level: "central", handle: "xinhuanet.com", name: "新华网", accountUrl: "https://www.xinhuanet.com/" },
  { platform: "website", level: "central", handle: "people.com.cn", name: "人民网", accountUrl: "https://www.people.com.cn/" },
  { platform: "website", level: "central", handle: "cctv.com", name: "央视网", accountUrl: "https://www.cctv.com/" },
  { platform: "website", level: "central", handle: "gmw.cn", name: "光明网", accountUrl: "https://www.gmw.cn/" },
  { platform: "website", level: "central", handle: "chinadaily.com.cn", name: "中国日报", accountUrl: "https://www.chinadaily.com.cn/" },
  { platform: "website", level: "central", handle: "chinanews.com", name: "中国新闻网", accountUrl: "https://www.chinanews.com/" },
  // 省级
  { platform: "website", level: "provincial", handle: "thepaper.cn", name: "澎湃新闻", region: "上海", accountUrl: "https://www.thepaper.cn/" },
  { platform: "website", level: "provincial", handle: "bjd.com.cn", name: "北京日报", region: "北京", accountUrl: "https://www.bjd.com.cn/" },
  { platform: "website", level: "provincial", handle: "jfdaily.com", name: "解放日报", region: "上海", accountUrl: "https://www.jfdaily.com/" },
  { platform: "website", level: "provincial", handle: "xkb.com.cn", name: "新快报", region: "广东", accountUrl: "https://www.xkb.com.cn/" },
  { platform: "website", level: "provincial", handle: "scol.com.cn", name: "四川在线", region: "四川", accountUrl: "https://www.scol.com.cn/" },
  // 地市 / 行业
  { platform: "website", level: "city", handle: "beijingtimes.com.cn", name: "北京晚报", region: "北京" },
  { platform: "website", level: "city", handle: "ynet.com", name: "北青网", region: "北京" },
  { platform: "website", level: "city", handle: "shobserver.com", name: "上观新闻", region: "上海" },
  { platform: "website", level: "city", handle: "cdsb.com", name: "红星新闻", region: "四川" },
  { platform: "website", level: "industry", handle: "caixin.com", name: "财新" },
  { platform: "website", level: "industry", handle: "yicai.com", name: "第一财经" },
  { platform: "website", level: "industry", handle: "36kr.com", name: "36氪" },
  { platform: "website", level: "industry", handle: "huxiu.com", name: "虎嗅" },
  { platform: "website", level: "industry", handle: "jiemian.com", name: "界面新闻" },
];

export async function seedBenchmarkAccounts(): Promise<number> {
  let count = 0;
  const allBenchmarks = [
    ...DOUYIN_BENCHMARK,
    ...WECHAT_BENCHMARK,
    ...TRADITIONAL_BENCHMARK,
  ];
  for (const acc of allBenchmarks) {
    const result = await db
      .insert(benchmarkAccounts)
      .values({ ...acc, isPreset: true, organizationId: null as unknown as string })
      .onConflictDoNothing({
        target: [
          benchmarkAccounts.platform,
          benchmarkAccounts.handle,
          benchmarkAccounts.organizationId,
        ],
      })
      .returning({ id: benchmarkAccounts.id });
    if (result.length > 0) count++;
  }
  return count;
}

// ============================================================================
// 主入口
// ============================================================================

export async function seedTopicCompareAccounts(orgId: string): Promise<{
  myAccounts: number;
  benchmarkAccounts: number;
}> {
  const my = await seedBeijingTvAccounts(orgId);
  const bm = await seedBenchmarkAccounts();
  console.log(`   Topic-compare v2: my_accounts +${my}, benchmark_accounts +${bm}`);
  return { myAccounts: my, benchmarkAccounts: bm };
}
