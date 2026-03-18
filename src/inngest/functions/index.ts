import { executeWorkflow } from "./execute-workflow";
import { weeklyAnalyticsReport } from "./analytics-report";
import { hotTopicAutoTrigger } from "./hot-topic-auto-trigger";
import { dailyPerformanceSnapshot } from "./daily-performance-snapshot";
import { learningEngine } from "./learning-engine";
import {
  onReviewCompleted,
  onPlanStatusChanged,
  onAnomalyDetected,
} from "./publishing-events";

export const functions = [
  executeWorkflow,
  weeklyAnalyticsReport,
  hotTopicAutoTrigger,
  dailyPerformanceSnapshot,
  learningEngine,
  onReviewCompleted,
  onPlanStatusChanged,
  onAnomalyDetected,
];
