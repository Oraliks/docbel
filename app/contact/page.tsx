"use client";

import { ContactPage } from "@/components/docbel/contact-page";

export default function ContactRoute() {
  const accent = "#C8102E";

  return (
    <div style={{ padding: "32px 36px 40px" }}>
      <ContactPage accent={accent} />
    </div>
  );
}
