import { OnboardingWizard } from "@/components/booking/onboarding-wizard";

export const dynamic = "force-dynamic";

// Assistant de création guidé d'un guichet (accès admin via app/admin/layout.tsx).
export default function NewBookingTenantPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nouveau guichet — assistant</h1>
        <p className="text-muted-foreground mt-1">
          Créez un guichet opérationnel en quelques étapes : organisation,
          antenne, créneaux.
        </p>
      </div>
      <OnboardingWizard />
    </div>
  );
}
