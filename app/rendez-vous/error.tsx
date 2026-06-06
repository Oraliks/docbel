"use client";

import { useEffect } from "react";
import { BookingUnavailable } from "@/components/booking/booking-unavailable";

export default function RdvError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[booking] erreur stepper/gestion:", error);
  }, [error]);

  return <BookingUnavailable variant="error" onRetry={reset} />;
}
