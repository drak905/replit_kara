import { useState, useCallback } from 'react';
import { type Language, getTranslation } from './translations';

const LANGUAGE_KEY = 'karaoke-language';

function getStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'vi';
  const stored = localStorage.getItem(LANGUAGE_KEY);
  return (stored === 'en' || stored === 'vi') ? stored : 'vi';
}

export function useLanguage() {
  const [language, setLanguageState] = useState<Language>(getStoredLanguage);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(LANGUAGE_KEY, lang);
  }, []);

  const toggleLanguage = useCallback(() => {
    const newLang = language === 'vi' ? 'en' : 'vi';
    setLanguage(newLang);
  }, [language, setLanguage]);

  const t = getTranslation(language);

  return { language, setLanguage, toggleLanguage, t };
}
