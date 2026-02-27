"use client"

import * as React from "react"
import { Languages, Check } from "lucide-react"
import { useLanguage } from "@/contexts/LanguageContext"
import { Language, languageNames } from "@/lib/i18n/translations"

export function LanguageSelector() {
  const [isOpen, setIsOpen] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)
  const { language, setLanguage, t } = useLanguage()

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  // Close on escape key
  React.useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      return () => document.removeEventListener("keydown", handleEscape)
    }
  }, [isOpen])

  const languages: Language[] = ['en', 'hi', 'mr', 'bh']

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-all hover:bg-neutral-100 dark:hover:bg-neutral-700"
        title={t.common.selectLanguage}
      >
        <Languages className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 hidden md:inline">
          {languageNames[language]}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="py-2">
            {languages.map((lang) => {
              const isSelected = lang === language
              return (
                <button
                  key={lang}
                  onClick={() => {
                    setLanguage(lang)
                    setIsOpen(false)
                  }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 transition-colors text-left ${
                    isSelected
                      ? "bg-neutral-100 dark:bg-neutral-800"
                      : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                  }`}
                >
                  <span className={`text-sm ${
                    isSelected
                      ? "text-neutral-900 dark:text-neutral-100 font-medium"
                      : "text-neutral-700 dark:text-neutral-300"
                  }`}>
                    {languageNames[lang]}
                  </span>
                  {isSelected && (
                    <Check className="w-4 h-4 text-neutral-900 dark:text-neutral-100" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
