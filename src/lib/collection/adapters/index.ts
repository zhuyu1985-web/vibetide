import { registerAdapter } from "../registry";
import { tophubAdapter } from "./tophub";
import { tavilyAdapter } from "./tavily";
import { bochaAdapter } from "./bocha";
import { jinaUrlAdapter } from "./jina-url";
import { listScraperAdapter } from "./list-scraper";
import { siteScraperAdapter } from "./site-scraper";
import { rssAdapter } from "./rss";
import { tikhubAdapter } from "./tikhub";

// Phase 0: 3 个基础 Adapter
registerAdapter(tophubAdapter);
registerAdapter(tavilyAdapter);
registerAdapter(jinaUrlAdapter);
// Phase 3: 2 个新增 Adapter
registerAdapter(listScraperAdapter);
registerAdapter(rssAdapter);
// Phase A2: tikhub 社媒搜索 Adapter（抖音/微博/小红书/微信视频号/知乎）
registerAdapter(tikhubAdapter);
// 博查搜索 Adapter（国内可直连，与 tavilyAdapter 并列）
registerAdapter(bochaAdapter);
// 2026-05-14: 整站采集
registerAdapter(siteScraperAdapter);

export {
  tophubAdapter,
  tavilyAdapter,
  bochaAdapter,
  jinaUrlAdapter,
  listScraperAdapter,
  siteScraperAdapter,
  rssAdapter,
  tikhubAdapter,
};
