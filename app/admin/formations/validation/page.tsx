import { listPendingReviewTrainings } from "@/lib/formations/admin-queries";
import { ValidationClient } from "./validation-client";

export const dynamic = "force-dynamic";

export default async function ValidationPage() {
  const rows = await listPendingReviewTrainings();
  return <ValidationClient rows={rows} />;
}
