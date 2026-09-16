import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export default function LeakageQueuePage() {
  return (
    <ModulePlaceholder
      title="Needs a look"
      description="A simple list of things that might lose a customer: wrong hours, slow replies, or a bad review waiting."
      fase="E1 · S6"
      bullets={[
        "Deterministic rules first (visibility drop, weak intent, review SLA, data health)",
        "Priority score 0–100",
        "Never auto-action from BLOCKED/stale data",
      ]}
    />
  );
}
