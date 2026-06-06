"use client";

import { useEffect } from "react";
import { BookingUnavailable } from "@/components/booking/booking-unavailable";

export default function BookingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[booking] erreur page publique:", error);
  }, [error]);

  return <BookingUnavailable variant="error" onRetry={reset} />;
}
