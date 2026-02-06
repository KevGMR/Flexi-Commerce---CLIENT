import { Placeholder } from "@/components/Placeholder";

export default function DraftOrdersPage() {
  return (
    <Placeholder
      title="Draft Orders"
      description="Manage saved drafts for orders not yet completed. Use GET /sales?status=draft endpoint."
    >
      <p className="text-sm text-zinc-700">Add filtering and bulk actions when APIs are ready.</p>
    </Placeholder>
  );
}
