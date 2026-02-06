import { Placeholder } from "@/components/Placeholder";

export default function OrdersPage() {
  return (
    <Placeholder
      title="Orders"
      description="List customer orders. Use GET /sales with filters for status, payment method, and date range."
    >
      <p className="text-sm text-zinc-700">Implement pagination and filters when wiring to the API.</p>
    </Placeholder>
  );
}
