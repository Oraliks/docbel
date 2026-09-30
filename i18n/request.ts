import { getRequestConfig } from "next-intl/server";
import { getUserLocale } from "./locale";
import { loadMessages } from "./messages";

export default getRequestConfig(async () => {
  const locale = await getUserLocale();
  return { locale, messages: await loadMessages(locale) };
});
