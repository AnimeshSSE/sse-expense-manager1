'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { translations, type Language } from '@/lib/i18n'

interface LanguageContextType {
  lang: Language
  t: typeof translations.en
  setLang: (lang: Language) => void
}

const LanguageContext = createContext<LanguageContextType | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>('en')
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const t = translations[lang] as typeof translations.en

  return (
    <LanguageContext.Provider value={{ lang, t, setLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
