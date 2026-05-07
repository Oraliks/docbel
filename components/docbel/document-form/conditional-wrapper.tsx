"use client";

import { useWatch } from "react-hook-form";
import { DocumentField } from "@/lib/documents/types";

interface ConditionalWrapperProps {
  field: DocumentField;
  children: React.ReactNode;
}

export function ConditionalWrapper({ field, children }: ConditionalWrapperProps) {
  const dependencyId = field.visibleIf?.fieldId;
  const dependencyValue = useWatch({ name: dependencyId || "" });

  if (!field.visibleIf) return <>{children}</>;

  const expected = field.visibleIf.equals;
  let visible = false;

  if (typeof expected === "boolean") {
    visible = Boolean(dependencyValue) === expected;
  } else if (typeof expected === "number") {
    visible = Number(dependencyValue) === expected;
  } else {
    // string compare (le serveur reçoit aussi des strings via les inputs)
    visible = String(dependencyValue ?? "") === String(expected);
  }

  if (!visible) return null;
  return <>{children}</>;
}
