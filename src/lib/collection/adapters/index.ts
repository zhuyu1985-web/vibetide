import { registerAdapter } from "../registry";
import { tophubAdapter } from "./tophub";
import { tavilyAdapter } from "./tavily";
import { jinaUrlAdapter } from "./jina-url";

// Phase 0: 3 个基础 Adapter
registerAdapter(tophubAdapter);
registerAdapter(tavilyAdapter);
registerAdapter(jinaUrlAdapter);

export { tophubAdapter, tavilyAdapter, jinaUrlAdapter };
