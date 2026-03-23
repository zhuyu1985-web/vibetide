export interface CalendarSeedEvent {
  name: string;
  category: string;
  eventType: "festival" | "competition" | "conference" | "exhibition" | "launch" | "memorial";
  startDate: string;
  endDate: string;
  recurrence: "once" | "yearly" | "custom";
}

export const calendarSeedEvents: CalendarSeedEvent[] = [
  // === 中国法定节假日 ===
  { name: "元旦", category: "要闻", eventType: "festival", startDate: "2026-01-01", endDate: "2026-01-03", recurrence: "yearly" },
  { name: "春节", category: "要闻", eventType: "festival", startDate: "2026-02-17", endDate: "2026-02-23", recurrence: "yearly" },
  { name: "清明节", category: "要闻", eventType: "festival", startDate: "2026-04-04", endDate: "2026-04-06", recurrence: "yearly" },
  { name: "劳动节", category: "要闻", eventType: "festival", startDate: "2026-05-01", endDate: "2026-05-05", recurrence: "yearly" },
  { name: "端午节", category: "要闻", eventType: "festival", startDate: "2026-06-19", endDate: "2026-06-21", recurrence: "yearly" },
  { name: "中秋节", category: "要闻", eventType: "festival", startDate: "2026-09-25", endDate: "2026-09-27", recurrence: "yearly" },
  { name: "国庆节", category: "要闻", eventType: "festival", startDate: "2026-10-01", endDate: "2026-10-07", recurrence: "yearly" },

  // === 二十四节气 (2026年) ===
  { name: "小寒", category: "社会", eventType: "festival", startDate: "2026-01-05", endDate: "2026-01-05", recurrence: "yearly" },
  { name: "大寒", category: "社会", eventType: "festival", startDate: "2026-01-20", endDate: "2026-01-20", recurrence: "yearly" },
  { name: "立春", category: "社会", eventType: "festival", startDate: "2026-02-04", endDate: "2026-02-04", recurrence: "yearly" },
  { name: "雨水", category: "社会", eventType: "festival", startDate: "2026-02-18", endDate: "2026-02-18", recurrence: "yearly" },
  { name: "惊蛰", category: "社会", eventType: "festival", startDate: "2026-03-05", endDate: "2026-03-05", recurrence: "yearly" },
  { name: "春分", category: "社会", eventType: "festival", startDate: "2026-03-20", endDate: "2026-03-20", recurrence: "yearly" },
  { name: "清明(节气)", category: "社会", eventType: "festival", startDate: "2026-04-05", endDate: "2026-04-05", recurrence: "yearly" },
  { name: "谷雨", category: "社会", eventType: "festival", startDate: "2026-04-20", endDate: "2026-04-20", recurrence: "yearly" },
  { name: "立夏", category: "社会", eventType: "festival", startDate: "2026-05-05", endDate: "2026-05-05", recurrence: "yearly" },
  { name: "小满", category: "社会", eventType: "festival", startDate: "2026-05-21", endDate: "2026-05-21", recurrence: "yearly" },
  { name: "芒种", category: "社会", eventType: "festival", startDate: "2026-06-05", endDate: "2026-06-05", recurrence: "yearly" },
  { name: "夏至", category: "社会", eventType: "festival", startDate: "2026-06-21", endDate: "2026-06-21", recurrence: "yearly" },
  { name: "小暑", category: "社会", eventType: "festival", startDate: "2026-07-07", endDate: "2026-07-07", recurrence: "yearly" },
  { name: "大暑", category: "社会", eventType: "festival", startDate: "2026-07-22", endDate: "2026-07-22", recurrence: "yearly" },
  { name: "立秋", category: "社会", eventType: "festival", startDate: "2026-08-07", endDate: "2026-08-07", recurrence: "yearly" },
  { name: "处暑", category: "社会", eventType: "festival", startDate: "2026-08-23", endDate: "2026-08-23", recurrence: "yearly" },
  { name: "白露", category: "社会", eventType: "festival", startDate: "2026-09-07", endDate: "2026-09-07", recurrence: "yearly" },
  { name: "秋分", category: "社会", eventType: "festival", startDate: "2026-09-23", endDate: "2026-09-23", recurrence: "yearly" },
  { name: "寒露", category: "社会", eventType: "festival", startDate: "2026-10-08", endDate: "2026-10-08", recurrence: "yearly" },
  { name: "霜降", category: "社会", eventType: "festival", startDate: "2026-10-23", endDate: "2026-10-23", recurrence: "yearly" },
  { name: "立冬", category: "社会", eventType: "festival", startDate: "2026-11-07", endDate: "2026-11-07", recurrence: "yearly" },
  { name: "小雪", category: "社会", eventType: "festival", startDate: "2026-11-22", endDate: "2026-11-22", recurrence: "yearly" },
  { name: "大雪", category: "社会", eventType: "festival", startDate: "2026-12-07", endDate: "2026-12-07", recurrence: "yearly" },
  { name: "冬至", category: "社会", eventType: "festival", startDate: "2026-12-22", endDate: "2026-12-22", recurrence: "yearly" },

  // === 国际日 / 纪念日 ===
  { name: "国际妇女节", category: "社会", eventType: "memorial", startDate: "2026-03-08", endDate: "2026-03-08", recurrence: "yearly" },
  { name: "世界消费者权益日", category: "财经", eventType: "memorial", startDate: "2026-03-15", endDate: "2026-03-15", recurrence: "yearly" },
  { name: "世界防治结核病日", category: "健康", eventType: "memorial", startDate: "2026-03-24", endDate: "2026-03-24", recurrence: "yearly" },
  { name: "世界地球日", category: "社会", eventType: "memorial", startDate: "2026-04-22", endDate: "2026-04-22", recurrence: "yearly" },
  { name: "世界读书日", category: "教育", eventType: "memorial", startDate: "2026-04-23", endDate: "2026-04-23", recurrence: "yearly" },
  { name: "世界知识产权日", category: "科技", eventType: "memorial", startDate: "2026-04-26", endDate: "2026-04-26", recurrence: "yearly" },
  { name: "国际儿童节", category: "教育", eventType: "memorial", startDate: "2026-06-01", endDate: "2026-06-01", recurrence: "yearly" },
  { name: "世界环境日", category: "社会", eventType: "memorial", startDate: "2026-06-05", endDate: "2026-06-05", recurrence: "yearly" },
  { name: "世界海洋日", category: "社会", eventType: "memorial", startDate: "2026-06-08", endDate: "2026-06-08", recurrence: "yearly" },
  { name: "世界人口日", category: "社会", eventType: "memorial", startDate: "2026-07-11", endDate: "2026-07-11", recurrence: "yearly" },
  { name: "世界卫生日", category: "健康", eventType: "memorial", startDate: "2026-04-07", endDate: "2026-04-07", recurrence: "yearly" },
  { name: "记者节", category: "要闻", eventType: "memorial", startDate: "2026-11-08", endDate: "2026-11-08", recurrence: "yearly" },
  { name: "世界艾滋病日", category: "健康", eventType: "memorial", startDate: "2026-12-01", endDate: "2026-12-01", recurrence: "yearly" },

  // === 重大体育赛事 ===
  { name: "北京冬奥会纪念日", category: "体育", eventType: "memorial", startDate: "2026-02-04", endDate: "2026-02-04", recurrence: "yearly" },
  { name: "2026 FIFA 世界杯", category: "体育", eventType: "competition", startDate: "2026-06-11", endDate: "2026-07-19", recurrence: "once" },
  { name: "2026 温网公开赛", category: "体育", eventType: "competition", startDate: "2026-06-29", endDate: "2026-07-12", recurrence: "yearly" },
  { name: "2026 环法自行车赛", category: "体育", eventType: "competition", startDate: "2026-07-04", endDate: "2026-07-26", recurrence: "yearly" },
  { name: "2026 亚洲运动会（名古屋）", category: "体育", eventType: "competition", startDate: "2026-09-19", endDate: "2026-10-04", recurrence: "once" },

  // === 科技展会与大会 ===
  { name: "CES 国际消费电子展", category: "科技", eventType: "exhibition", startDate: "2026-01-06", endDate: "2026-01-09", recurrence: "yearly" },
  { name: "MWC 世界移动通信大会", category: "科技", eventType: "exhibition", startDate: "2026-02-23", endDate: "2026-02-26", recurrence: "yearly" },
  { name: "苹果 WWDC 全球开发者大会", category: "科技", eventType: "conference", startDate: "2026-06-08", endDate: "2026-06-12", recurrence: "yearly" },
  { name: "Google I/O 开发者大会", category: "科技", eventType: "conference", startDate: "2026-05-12", endDate: "2026-05-14", recurrence: "yearly" },
  { name: "华为开发者大会", category: "科技", eventType: "conference", startDate: "2026-06-20", endDate: "2026-06-22", recurrence: "yearly" },
  { name: "世界人工智能大会（上海）", category: "科技", eventType: "conference", startDate: "2026-07-06", endDate: "2026-07-08", recurrence: "yearly" },
  { name: "世界互联网大会（乌镇）", category: "科技", eventType: "conference", startDate: "2026-11-15", endDate: "2026-11-17", recurrence: "yearly" },

  // === 财经与商贸 ===
  { name: "全国两会", category: "时政", eventType: "conference", startDate: "2026-03-03", endDate: "2026-03-15", recurrence: "yearly" },
  { name: "博鳌亚洲论坛", category: "财经", eventType: "conference", startDate: "2026-03-24", endDate: "2026-03-27", recurrence: "yearly" },
  { name: "广交会（春季）", category: "财经", eventType: "exhibition", startDate: "2026-04-15", endDate: "2026-05-05", recurrence: "yearly" },
  { name: "广交会（秋季）", category: "财经", eventType: "exhibition", startDate: "2026-10-15", endDate: "2026-11-04", recurrence: "yearly" },
  { name: "中国国际进口博览会", category: "财经", eventType: "exhibition", startDate: "2026-11-05", endDate: "2026-11-10", recurrence: "yearly" },
  { name: "双十一购物节", category: "财经", eventType: "festival", startDate: "2026-11-01", endDate: "2026-11-11", recurrence: "yearly" },
  { name: "618 年中购物节", category: "财经", eventType: "festival", startDate: "2026-06-01", endDate: "2026-06-18", recurrence: "yearly" },
];
