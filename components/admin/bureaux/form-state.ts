import type { SerializedBureau, BureauTypeCode } from "@/lib/bureaus/types";

// État du formulaire de bureau : tout est string côté UI pour simplifier
// les Inputs contrôlés, on convertit côté payload uniquement.
export type FormState = {
  organismeId: string;
  type: BureauTypeCode;
  name: string;
  nameNl: string;
  nameDe: string;
  street: string;
  streetNum: string;
  postalCode: string;
  city: string;
  lat: string;
  lng: string;
  communeId: string;
  phone: string;
  email: string;
  website: string;
  appointmentUrl: string;
  hours: ReturnType<typeof emptyHours>;
  hoursNotes: string;
  services: string[];
  active: boolean;
  notes: string;
};

export function emptyHours() {
  return [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day,
    slots: [] as { open: string; close: string }[],
  }));
}

export const EMPTY_FORM: FormState = {
  organismeId: "",
  type: "CPAS",
  name: "",
  nameNl: "",
  nameDe: "",
  street: "",
  streetNum: "",
  postalCode: "",
  city: "",
  lat: "",
  lng: "",
  communeId: "",
  phone: "",
  email: "",
  website: "",
  appointmentUrl: "",
  hours: emptyHours(),
  hoursNotes: "",
  services: [],
  active: true,
  notes: "",
};

export function bureauToForm(b: SerializedBureau): FormState {
  // Merge hours seedés avec les 7 jours pour rendre l'édition exhaustive
  const hours = emptyHours();
  for (const h of b.hours) {
    const idx = hours.findIndex((x) => x.day === h.day);
    if (idx >= 0) hours[idx] = { day: h.day, slots: h.slots };
  }
  return {
    organismeId: b.organismeId,
    type: b.type,
    name: b.name,
    nameNl: b.nameNl ?? "",
    nameDe: b.nameDe ?? "",
    street: b.street,
    streetNum: b.streetNum ?? "",
    postalCode: b.postalCode,
    city: b.city,
    lat: b.lat !== null ? String(b.lat) : "",
    lng: b.lng !== null ? String(b.lng) : "",
    communeId: b.communeId ?? "",
    phone: b.phone ?? "",
    email: b.email ?? "",
    website: b.website ?? "",
    appointmentUrl: b.appointmentUrl ?? "",
    hours,
    hoursNotes: b.hoursNotes ?? "",
    services: b.services,
    active: b.active,
    notes: b.notes ?? "",
  };
}

export function formToPayload(form: FormState) {
  return {
    organismeId: form.organismeId,
    type: form.type,
    name: form.name.trim(),
    nameNl: form.nameNl.trim() || null,
    nameDe: form.nameDe.trim() || null,
    street: form.street.trim(),
    streetNum: form.streetNum.trim() || null,
    postalCode: form.postalCode.trim(),
    city: form.city.trim(),
    lat: form.lat.trim() ? Number(form.lat) : null,
    lng: form.lng.trim() ? Number(form.lng) : null,
    communeId: form.communeId || null,
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    website: form.website.trim() || null,
    appointmentUrl: form.appointmentUrl.trim() || null,
    hours: form.hours,
    hoursNotes: form.hoursNotes.trim() || null,
    services: form.services,
    active: form.active,
    notes: form.notes.trim() || null,
  };
}
