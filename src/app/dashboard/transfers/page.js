import { Placeholder } from "@/components/Placeholder";

export default function TransfersPage() {
  return (
    <Placeholder
      title="Transfers"
      description="Move inventory between locations. Use GET /transfers and POST /transfers for creation."
    >
      <p className="text-sm text-zinc-700">Add multi-location support and tracking when APIs are wired.</p>
    </Placeholder>
  );
}
