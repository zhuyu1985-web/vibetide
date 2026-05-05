import { registerAdapter } from "../registry";
import { tophubAdapter } from "./tophub";
import { tavilyAdapter } from "./tavily";
import { jinaUrlAdapter } from "./jina-url";
import { listScraperAdapter } from "./list-scraper";
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

export {
  tophubAdapter,
  tavilyAdapter,
  jinaUrlAdapter,
  listScraperAdapter,
  rssAdapter,
  tikhubAdapter,
};
