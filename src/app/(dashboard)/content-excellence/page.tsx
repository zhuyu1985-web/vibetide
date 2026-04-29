import {
  getHitPredictions,
  getCompetitorHits,
} from "@/lib/dal/content-excellence";
import ContentExcellenceClient from "./content-excellence-client";

function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 5000): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export default async function ContentExcellencePage() {
  const [hitPredictions, competitorHits] = await Promise.all([
    withTimeout(getHitPredictions(), []),
    withTimeout(getCompetitorHits(), []),
  ]);

  return (
    <ContentExcellenceClient
      hitPredictions={hitPredictions}
      competitorHits={competitorHits}
    />
  );
}
