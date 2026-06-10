import { Shell } from "@/components/dashboard/Shell";
import { Journal } from "@/components/dashboard/Journal";

export default function JournalPage() {
  return (
    <Shell>
      <h1 className="text-lg font-semibold tracking-tight mb-4">Journal</h1>
      <Journal />
    </Shell>
  );
}
