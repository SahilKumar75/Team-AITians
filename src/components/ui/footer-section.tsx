"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Facebook, Instagram, Linkedin, Moon, Send, Sun, Twitter } from "lucide-react"
import { StarOfLife } from "@/components/icons/StarOfLife"
import Link from "next/link"
import { useLanguage } from "@/contexts/LanguageContext"

function FooterSection() {
  const { t } = useLanguage()
  const [isDarkMode, setIsDarkMode] = React.useState(true)

  React.useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [isDarkMode])

  return (
    <footer className="relative border-t bg-background text-foreground transition-colors duration-300">
      <div className="container mx-auto px-4 py-12 md:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand + Newsletter */}
          <div className="relative">
            <div className="flex items-center gap-2 mb-4">
              <StarOfLife className="w-8 h-8 text-red-600 dark:text-red-500 flex-shrink-0" />
              <span
                className="text-xl text-neutral-900 dark:text-neutral-100 tracking-wide"
                style={{ fontFamily: "Helvetica, Arial, sans-serif", fontWeight: "bold" }}
              >
                Swasthya Sanchar
              </span>
            </div>
            <p className="mb-6 text-neutral-600 dark:text-neutral-400">
              {t.footer.brandDescription}
            </p>
            <form className="relative mb-4">
              <Input
                type="email"
                placeholder={t.footer.emailPlaceholder}
                className="pr-12 backdrop-blur-sm"
              />
              <Button
                type="submit"
                size="icon"
                className="absolute right-1 top-1 h-8 w-8 rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
              >
                <Send className="h-4 w-4" />
                <span className="sr-only">{t.footer.subscribe}</span>
              </Button>
            </form>
            <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Project Morpheus Hackathon 2026
            </p>
            <div className="absolute -right-4 top-0 h-24 w-24 rounded-full bg-blue-600/10 blur-2xl" />
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="mb-4 text-lg font-semibold">{t.footer.quickLinks}</h3>
            <nav className="space-y-2 text-sm">
              <Link href="/" className="block transition-colors hover:text-primary">
                {t.footer.home}
              </Link>
              <Link href="/help" className="block transition-colors hover:text-primary">
                {t.footer.help}
              </Link>
              <Link href="/patient/home" className="block transition-colors hover:text-primary">
                {t.footer.patientPortal}
              </Link>
              <Link href="/doctor/home" className="block transition-colors hover:text-primary">
                {t.footer.doctorPortal}
              </Link>
              <Link href="/hospital/home" className="block transition-colors hover:text-primary">
                {t.footer.hospitalPortal}
              </Link>
            </nav>
          </div>

          {/* Contact */}
          <div>
            <h3 className="mb-4 text-lg font-semibold">{t.footer.contactUs}</h3>
            <address className="space-y-2 text-sm not-italic text-neutral-700 dark:text-neutral-300">
              <p>{t.footer.country}</p>
              <p>{t.footer.teamName}</p>
              <p>{t.patientReg.email}: support@swathya-sanchaar.local</p>
            </address>
          </div>

          {/* Social + Theme */}
          <div>
            <h3 className="mb-4 text-lg font-semibold">{t.footer.followUs}</h3>
            <div className="mb-6 flex space-x-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" className="rounded-full">
                      <Facebook className="h-4 w-4" />
                      <span className="sr-only">Facebook</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t.footer.followOnFacebook}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" className="rounded-full">
                      <Twitter className="h-4 w-4" />
                      <span className="sr-only">Twitter</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t.footer.followOnTwitter}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" className="rounded-full">
                      <Instagram className="h-4 w-4" />
                      <span className="sr-only">Instagram</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t.footer.followOnInstagram}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" className="rounded-full">
                      <Linkedin className="h-4 w-4" />
                      <span className="sr-only">LinkedIn</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t.footer.connectOnLinkedIn}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-center space-x-2">
              <Sun className="h-4 w-4" />
              <Switch
                id="dark-mode-footer"
                checked={isDarkMode}
                onCheckedChange={setIsDarkMode}
              />
              <Moon className="h-4 w-4" />
              <Label htmlFor="dark-mode-footer" className="sr-only">
                {t.footer.toggleDarkMode}
              </Label>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-neutral-200 dark:border-neutral-800 pt-8 text-center md:flex-row">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            © {new Date().getFullYear()} {t.footer.allRightsReserved}
          </p>
          <nav className="flex gap-4 text-sm">
            <Link href="#" className="transition-colors hover:text-blue-600 dark:hover:text-blue-400">
              {t.footer.privacyPolicy}
            </Link>
            <Link href="#" className="transition-colors hover:text-blue-600 dark:hover:text-blue-400">
              {t.footer.termsOfService}
            </Link>
            <Link href="#" className="transition-colors hover:text-blue-600 dark:hover:text-blue-400">
              {t.footer.healthcareCompliance}
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}

export { FooterSection }
