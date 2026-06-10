import { Shell } from "@/components/dashboard/Shell";
import { BrainSearch } from "@/components/dashboard/BrainSearch";

export default function BrainPage() {
  return (
    <Shell>
      <h1 className="text-lg font-semibold tracking-tight mb-4">Brain</h1>
      <BrainSearch />
    </Shell>
  );
}
