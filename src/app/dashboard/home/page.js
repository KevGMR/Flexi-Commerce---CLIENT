import { Placeholder } from "@/components/Placeholder";

export default function HomePage() {
  return (
    <Placeholder
      title="Dashboard Home"
      description="Overview space for KPIs and shortcuts. Hook up summary endpoints later."
    >
      <p className="text-sm text-zinc-700">
        Add cards for sales summary, inventory alerts, and Shopify sync status when APIs are wired.
      </p>
    </Placeholder>
  );
}
