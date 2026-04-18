import { registerAdapter } from "../registry";
import { tophubAdapter } from "./tophub";
import { tavilyAdapter } from "./tavily";
import { jinaUrlAdapter } from "./jina-url";
import { listScraperAdapter } from "./list-scraper";
import { rssAdapter } from "./rss";

// Phase 0: 3 个基础 Adapter
registerAdapter(tophubAdapter);
registerAdapter(tavilyAdapter);
registerAdapter(jinaUrlAdapter);
// Phase 3: 2 个新增 Adapter
registerAdapter(listScraperAdapter);
registerAdapter(rssAdapter);

export {
  tophubAdapter,
  tavilyAdapter,
  jinaUrlAdapter,
  listScraperAdapter,
  rssAdapter,
};
