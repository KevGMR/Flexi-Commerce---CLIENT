// client/src/app/dashboard/page.js
import { redirect } from "next/navigation";

export default function DashboardIndex() {
  redirect("/dashboard/home");
}
