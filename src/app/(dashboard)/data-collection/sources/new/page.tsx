import { listAdapterMetas } from "@/lib/collection/adapter-meta";
import { NewSourceWizardClient } from "./new-source-wizard-client";

export default function NewSourcePage() {
  const adapterMetas = listAdapterMetas();
  return <NewSourceWizardClient adapterMetas={adapterMetas} />;
}
