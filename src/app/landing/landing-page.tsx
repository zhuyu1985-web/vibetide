"use client";

import { Navbar } from "./components/navbar";
import { HeroSection } from "./sections/hero-section";
import { TeamSection } from "./sections/team-section";
import { CapabilitiesSection } from "./sections/capabilities-section";
import { WorkflowSection } from "./sections/workflow-section";
import { StatsSection } from "./sections/stats-section";
import { ScenariosSection } from "./sections/scenarios-section";
import { CtaSection } from "./sections/cta-section";

export function LandingPage() {
  return (
    <div className="min-h-screen scroll-smooth bg-white dark:bg-[#080d19]">
      <Navbar />
      <section id="hero">
        <HeroSection />
      </section>
      <section id="team" className="bg-slate-50/80 dark:bg-[#0c1222]">
        <TeamSection />
      </section>
      <section id="capabilities">
        <CapabilitiesSection />
      </section>
      <section id="workflow" className="bg-slate-50/80 dark:bg-[#0c1222]">
        <WorkflowSection />
      </section>
      <StatsSection />
      <section id="scenarios" className="bg-slate-50/80 dark:bg-[#0c1222]">
        <ScenariosSection />
      </section>
      <section id="cta">
        <CtaSection />
      </section>
    </div>
  );
}
