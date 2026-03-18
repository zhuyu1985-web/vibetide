import { Inngest, EventSchemas } from "inngest";
import type { InngestEvents } from "./events";

export const inngest = new Inngest({
  id: "vibetide",
  schemas: new EventSchemas().fromRecord<InngestEvents>(),
});
