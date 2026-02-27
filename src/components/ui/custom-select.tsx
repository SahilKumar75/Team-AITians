"use client"

import * as React from "react"
import { ChevronDown, Check } from "lucide-react"

interface SelectOption {
  value: string
  label: string
}

interface CustomSelectProps {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  className = "",
  disabled = false,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

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

  const selectedOption = options.find(opt => opt.value === value)

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 focus:border-transparent text-neutral-900 dark:text-neutral-100 transition-all text-left flex items-center justify-between ${
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-neutral-400 dark:hover:border-neutral-600"
        }`}
      >
        <span className={selectedOption ? "text-neutral-900 dark:text-neutral-100" : "text-neutral-500 dark:text-neutral-400"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-neutral-600 dark:text-neutral-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200 max-h-64 overflow-y-auto">
          {options.map((option) => {
            const isSelected = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value)
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
                  {option.label}
                </span>
                {isSelected && (
                  <Check className="w-4 h-4 text-neutral-900 dark:text-neutral-100" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
