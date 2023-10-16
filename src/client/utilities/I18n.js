import fr from '../locales/fr.json'
import en from '../locales/en.json'
import { createI18n } from "vue-i18n";

export const i18n = createI18n({
  locale: (localStorage.getItem('locale')) || "fr",
  fallbackLocale: "en",
  messages: { fr, en },
});
