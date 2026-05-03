"use client";

import { ContactPage } from "@/components/docbel/contact-page";
import { DARK_COLORS, LIGHT_COLORS } from "@/lib/colors";
import { useAppState } from "@/lib/app-state-context";

export default function ContactRoute() {
  const { dark } = useAppState();

  const colors = dark ? DARK_COLORS : LIGHT_COLORS;
  const accent = "#C8102E";

  return (
    <div style={{ padding: "32px 36px 40px" }}>
      <ContactPage colors={colors} accent={accent} />
    </div>
  );
}
