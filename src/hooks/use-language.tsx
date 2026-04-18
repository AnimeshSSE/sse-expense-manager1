'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { type Language, t as translate } from '@/lib/i18n'

interface LanguageContextValue {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: () => {},
  t: (key: string) => translate(key, 'en'),
})

function getInitialLanguage(): Language {
  if (typeof window === 'undefined') return 'en'
  const saved = localStorage.getItem('preferred-language') as Language | null
  if (saved && (saved === 'en' || saved === 'hi')) {
    return saved
  }
  return 'en'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage)

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('preferred-language', lang)
  }, [])

  const t = (key: string) => translate(key, language)

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
