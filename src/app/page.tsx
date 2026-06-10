import { Shell } from "@/components/dashboard/Shell";
import { OperatorCard } from "@/components/dashboard/OperatorCard";
import { SessionCard } from "@/components/dashboard/SessionCard";
import { FinancePulseCard } from "@/components/dashboard/FinancePulseCard";
import { KeyBlockersCard } from "@/components/dashboard/KeyBlockersCard";
import { HabitTrackerCard } from "@/components/dashboard/HabitTrackerCard";
import { PrioritiesCard } from "@/components/dashboard/PrioritiesCard";
import { NutritionCard } from "@/components/dashboard/NutritionCard";
import { CalendarCard } from "@/components/dashboard/CalendarCard";
import { GoalsCard } from "@/components/dashboard/GoalsCard";

// Home dashboard — 3-column grid (left narrow, centre wide, right narrow),
// per the Part 2 design.
export default function HomePage() {
  return (
    <Shell>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left rail */}
        <div className="lg:col-span-3 space-y-3">
          <OperatorCard />
          <FinancePulseCard />
          <KeyBlockersCard />
        </div>

        {/* Centre */}
        <div className="lg:col-span-6 space-y-3">
          <SessionCard />
          <HabitTrackerCard />
          <PrioritiesCard />
          <CalendarCard />
        </div>

        {/* Right rail */}
        <div className="lg:col-span-3 space-y-3">
          <NutritionCard />
          <GoalsCard />
        </div>
      </div>
    </Shell>
  );
}
