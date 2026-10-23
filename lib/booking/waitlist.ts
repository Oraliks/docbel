// V1 publique sans nouvelles réservations : les notifications de place libre
// mèneraient vers /book fermé. Suspension autorisée par le chef le23/10/2026,
// avant lecture/mutation/email. Les inscrits restent conservés dans leur état.
// Le contrat reste disponible aux annulations, reports, actions privées et cron ;
// les autres notifications et les règles de rétention ne changent pas.
export async function notifyNextWaiter(
  locationId: string,
  date: string,
  startTime: string,
): Promise<boolean> {
  void locationId;
  void date;
  void startTime;
  return false;
}
