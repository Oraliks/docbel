import { listAdminTrainings, getTrainingCounts } from "@/lib/formations/admin-queries";
import { FormationsOverviewClient } from "./overview-client";

export const dynamic = "force-dynamic";

export default async function FormationsOverviewPage() {
  const [rows, counts] = await Promise.all([
    listAdminTrainings(),
    getTrainingCounts(),
  ]);

  return <FormationsOverviewClient rows={rows} counts={counts} />;
}
