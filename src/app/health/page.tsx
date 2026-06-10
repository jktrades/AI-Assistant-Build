import { Shell } from "@/components/dashboard/Shell";
import { HealthTable } from "@/components/dashboard/HealthTable";

export default function HealthPage() {
  return (
    <Shell>
      <h1 className="text-lg font-semibold tracking-tight mb-4">Health</h1>
      <HealthTable />
    </Shell>
  );
}
