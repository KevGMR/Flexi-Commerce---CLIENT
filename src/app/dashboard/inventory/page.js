import { Placeholder } from "@/components/Placeholder";

export default function InventoryPage() {
  return (
    <Placeholder
      title="Inventory"
      description="Track stock levels across locations. Use GET /inventory and PATCH /inventory for updates."
    >
      <p className="text-sm text-zinc-700">Add low stock alerts and transfer workflows when APIs are ready.</p>
    </Placeholder>
  );
}
