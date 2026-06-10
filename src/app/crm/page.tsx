import { Shell } from "@/components/dashboard/Shell";
import { CrmBoard } from "@/components/dashboard/CrmBoard";

export default function CrmPage() {
  return (
    <Shell>
      <h1 className="text-lg font-semibold tracking-tight mb-4">CRM</h1>
      <CrmBoard />
    </Shell>
  );
}
