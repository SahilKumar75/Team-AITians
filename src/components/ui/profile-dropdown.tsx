"use client"

import * as React from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter, usePathname } from "next/navigation"
import { useLanguage } from "@/contexts/LanguageContext"
import {
  User,
  Settings,
  CreditCard,
  HelpCircle,
  LogOut,
  Trash2,
  Moon,
  Sun,
  LayoutDashboard,
  ChevronDown,
  Stethoscope,
  Building2
} from "lucide-react"
import { clearAllAccountData } from "@/lib/clear-account-data"

interface ProfileDropdownProps {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
  role?: string
  theme?: "light" | "dark"
  onThemeToggle?: () => void
  openUpward?: boolean // New prop for mobile bottom nav
}

export function ProfileDropdown({ user, role, theme, onThemeToggle, openUpward = false }: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const dropdownRef = React.useRef<HTMLDivElement>(null)
  const { t } = useLanguage()
  const { logout } = useAuth()

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

  const displayName = (user.name || user.email?.split("@")[0] || "User").trim()
  const getInitials = (source: string) => {
    return source
      .split(/[\s.@_-]+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U"
  }

  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false)

  const handleLogout = () => {
    logout()
    router.push("/")
    router.refresh()
  }

  const handleDeleteAccount = async () => {
    setShowDeleteConfirm(false)
    await clearAllAccountData()
    logout()
    router.replace("/")
    router.refresh()
  }

  const menuItems = role === "doctor" ? [
    {
      label: t.nav.doctorPortal,
      icon: Stethoscope,
      onClick: () => {
        setIsOpen(false)
        router.push("/doctor/portal")
      },
    },
    {
      label: t.nav.settings,
      icon: Settings,
      onClick: () => {
        setIsOpen(false)
        router.push("/settings")
      },
    },
  ] : role === "hospital" ? [
    {
      label: t.nav.hospitalPortal,
      icon: Building2,
      onClick: () => {
        setIsOpen(false)
        router.push("/hospital/portal")
      },
    },
    {
      label: t.nav.settings,
      icon: Settings,
      onClick: () => {
        setIsOpen(false)
        router.push("/settings")
      },
    },
  ] : [
    {
      label: t.nav.patientPortal,
      icon: LayoutDashboard,
      onClick: () => {
        setIsOpen(false)
        router.push("/patient/portal")
      },
    },
    {
      label: t.nav.settings,
      icon: Settings,
      onClick: () => {
        setIsOpen(false)
        router.push("/settings")
      },
    },
  ]

  // Fill capsule only when dropdown is open (not when just on a matching route)
  const isFilled = isOpen;

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`group flex items-center gap-1.5 px-2.5 h-[36px] rounded-full transition-all border border-transparent ${isFilled
          ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md"
          : "bg-transparent text-neutral-600 dark:text-neutral-400 hover:bg-neutral-900 dark:hover:bg-white hover:text-white dark:hover:text-neutral-900 hover:shadow-md"
          }`}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-semibold text-xs">
          {user.image ? (
            <img
              src={user.image}
              alt={user.name || "User"}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            getInitials(displayName || user.email || "U")
          )}
        </div>
        <div className="hidden md:flex items-center max-w-[128px]">
          <span className={`text-sm font-medium transition-colors ${isFilled
            ? "text-white dark:text-neutral-900"
            : "text-neutral-900 dark:text-neutral-100 group-hover:text-white dark:group-hover:text-neutral-900"
            } truncate`}>
            {displayName}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 transition-all flex-shrink-0 ${isOpen ? "rotate-180" : ""
            } ${isFilled
              ? "text-white dark:text-neutral-900"
              : "text-neutral-600 dark:text-neutral-400 group-hover:text-white dark:group-hover:text-neutral-900"
            }`}
        />
      </button>

      {isOpen && (
        <div className={`absolute ${openUpward ? 'bottom-full mb-2' : 'top-full mt-2'} right-0 w-72 bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden z-50 animate-in fade-in ${openUpward ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2'} duration-200`}>
          {/* User Info Header */}
          <div className="px-4 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-semibold">
                {user.image ? (
                  <img
                    src={user.image}
                    alt={user.name || "User"}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-base">{getInitials(displayName || user.email || "U")}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                  {displayName}
                </p>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 truncate">
                  {user.email}
                </p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={item.onClick}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left group"
              >
                <item.icon className="w-4 h-4 text-neutral-600 dark:text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-neutral-100 transition-colors" />
                <span className="text-sm text-neutral-700 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-neutral-100 transition-colors">
                  {item.label}
                </span>
              </button>
            ))}

            {/* Help */}
            <button
              onClick={() => {
                setIsOpen(false)
                router.push('/help')
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left group"
            >
              <HelpCircle className="w-4 h-4 text-neutral-600 dark:text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-neutral-100 transition-colors" />
              <span className="text-sm text-neutral-700 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-neutral-100 transition-colors">
                {t.nav.helpSupport}
              </span>
            </button>
          </div>

          {/* Delete my account */}
          <div className="border-t border-neutral-200 dark:border-neutral-800 py-2">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors text-left group"
            >
              <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
              <span className="text-sm text-red-600 dark:text-red-400 font-medium">
                {t.nav.deleteAccount}
              </span>
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left group"
            >
              <LogOut className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
              <span className="text-sm text-neutral-700 dark:text-neutral-300 font-medium">
                {t.nav.logout}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Delete account confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-800 max-w-md w-full p-6 space-y-4">
            <p className="text-sm text-neutral-700 dark:text-neutral-300">
              {t.nav.deleteAccountConfirm}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                {t.common.cancel}
              </button>
              <button
                onClick={handleDeleteAccount}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                {t.common.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
