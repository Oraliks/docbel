import {
  listOrientationQuestions,
  listOrientationBranches,
} from "@/lib/formations/admin-queries";
import { BoussoleClient } from "./boussole-client";

export const dynamic = "force-dynamic";

export default async function BoussolePage() {
  const [questions, branches] = await Promise.all([
    listOrientationQuestions(),
    listOrientationBranches(),
  ]);

  return <BoussoleClient questions={questions} branches={branches} />;
}
