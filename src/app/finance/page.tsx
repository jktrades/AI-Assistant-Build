import { Shell } from "@/components/dashboard/Shell";
import { FinancePulseCard } from "@/components/dashboard/FinancePulseCard";

export default function FinancePage() {
  return (
    <Shell>
      <h1 className="text-lg font-semibold tracking-tight mb-4">Finance</h1>
      <div className="max-w-md">
        <FinancePulseCard />
      </div>
      <p className="text-ink-3 text-sm mt-4 max-w-md">
        Page loads read the latest snapshot only. The ↻ button re-runs the AI
        extraction over your Google Sheet; a daily Vercel cron refreshes it at
        5am UTC automatically.
      </p>
    </Shell>
  );
}
