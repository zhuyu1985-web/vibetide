import type { Metadata } from "next";
import { ShowcasePage } from "./showcase-page";

export const metadata: Metadata = {
  title: "技术架构方案 | Vibe Media 智媒体",
  description: "多智能体协同内容生产引擎的架构设计、核心机制与设计哲学",
};

export default function Page() {
  return <ShowcasePage />;
}
