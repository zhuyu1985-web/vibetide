export type InngestEvents = {
  "workflow/started": {
    data: {
      workflowInstanceId: string;
      teamId: string;
      organizationId: string;
      topicTitle: string;
      scenario: string;
    };
  };
  "workflow/step-approved": {
    data: {
      workflowInstanceId: string;
      stepId: string;
      approved: boolean;
      feedback?: string;
      approvedBy: string;
    };
  };
  "workflow/cancelled": {
    data: {
      workflowInstanceId: string;
      cancelledBy: string;
    };
  };

  // Module 3: Omnichannel Distribution Events

  // F3.1.08-12: Review completed
  "publishing/review-completed": {
    data: {
      organizationId: string;
      reviewId: string;
      contentId: string;
      status: "approved" | "rejected" | "escalated";
      score: number | null;
      reviewerEmployeeId: string;
    };
  };

  // F3.1.04: Publishing completed/failed
  "publishing/plan-status-changed": {
    data: {
      organizationId: string;
      planId: string;
      title: string;
      channelName: string;
      status: "published" | "failed";
    };
  };

  // F3.1.16: Scheduled analytics report (cron trigger)
  "analytics/generate-report": {
    data: {
      organizationId?: string;
      period: "daily" | "weekly" | "monthly";
    };
  };

  // F4.A.02: Hot topic reaches threshold — auto-trigger workflow
  "hotTopic/threshold-reached": {
    data: {
      organizationId: string;
      hotTopicId: string;
      topicTitle: string;
      heatScore: number;
      teamId: string;
    };
  };

  // M4: Employee learning trigger
  "employee/learn": {
    data: {
      employeeId: string;
      organizationId: string;
      trigger: "workflow_completion" | "manual" | "cron";
    };
  };

  // F3.1.17: Anomaly detected
  "analytics/anomaly-detected": {
    data: {
      organizationId: string;
      channel: string;
      metric: string;
      severity: "critical" | "warning";
      message: string;
      changePercent: number;
    };
  };
};
