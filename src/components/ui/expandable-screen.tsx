"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"

interface ExpandableScreenContextValue {
  isExpanded: boolean
  expand: () => void
  collapse: () => void
  layoutId: string
  triggerRadius: string
  contentRadius: string
  animationDuration: number
}

const ExpandableScreenContext = React.createContext<
  ExpandableScreenContextValue | undefined
>(undefined)

export function useExpandableScreen() {
  const context = React.useContext(ExpandableScreenContext)
  if (!context) {
    throw new Error(
      "useExpandableScreen must be used within an ExpandableScreen"
    )
  }
  return context
}

interface ExpandableScreenProps {
  children: React.ReactNode
  layoutId?: string
  triggerRadius?: string
  contentRadius?: string
  animationDuration?: number
  defaultExpanded?: boolean
  expanded?: boolean
  onExpandChange?: (expanded: boolean) => void
  lockScroll?: boolean
}

export function ExpandableScreen({
  children,
  layoutId = "expandable-card",
  triggerRadius = "100px",
  contentRadius = "24px",
  animationDuration = 0.3,
  defaultExpanded = false,
  expanded,
  onExpandChange,
  lockScroll = true,
}: ExpandableScreenProps) {
  const [internalExpanded, setInternalExpanded] = React.useState(defaultExpanded)

  const isExpanded = expanded !== undefined ? expanded : internalExpanded

  React.useEffect(() => {
    if (lockScroll) {
      if (isExpanded) {
        document.body.style.overflow = "hidden"
      } else {
        document.body.style.overflow = ""
      }
    }

    return () => {
      if (lockScroll) {
        document.body.style.overflow = ""
      }
    }
  }, [isExpanded, lockScroll])

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isExpanded) {
        collapse()
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [isExpanded])

  const expand = React.useCallback(() => {
    setInternalExpanded(true)
    onExpandChange?.(true)
  }, [onExpandChange])

  const collapse = React.useCallback(() => {
    setInternalExpanded(false)
    onExpandChange?.(false)
  }, [onExpandChange])

  const value = React.useMemo(
    () => ({
      isExpanded,
      expand,
      collapse,
      layoutId,
      triggerRadius,
      contentRadius,
      animationDuration,
    }),
    [isExpanded, expand, collapse, layoutId, triggerRadius, contentRadius, animationDuration]
  )

  return (
    <ExpandableScreenContext.Provider value={value}>
      {children}
    </ExpandableScreenContext.Provider>
  )
}

interface ExpandableScreenTriggerProps {
  children: React.ReactNode
  className?: string
}

export function ExpandableScreenTrigger({
  children,
  className,
}: ExpandableScreenTriggerProps) {
  const { isExpanded, expand, layoutId, triggerRadius, animationDuration } =
    useExpandableScreen()

  return (
    <AnimatePresence>
      {!isExpanded && (
        <motion.div
          layoutId={layoutId}
          onClick={expand}
          className={className}
          style={{
            borderRadius: triggerRadius,
            cursor: 'pointer',
          }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 30,
            duration: animationDuration,
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

interface ExpandableScreenContentProps {
  children: React.ReactNode
  className?: string
  showCloseButton?: boolean
  closeButtonClassName?: string
}

export function ExpandableScreenContent({
  children,
  className,
  showCloseButton = true,
  closeButtonClassName,
}: ExpandableScreenContentProps) {
  const { isExpanded, collapse, layoutId, contentRadius, animationDuration } =
    useExpandableScreen()

  return (
    <AnimatePresence>
      {isExpanded && (
        <motion.div
          layoutId={layoutId}
          className={`fixed inset-0 z-50 overflow-auto ${className || ""}`}
          style={{
            borderRadius: contentRadius,
          }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 30,
            duration: animationDuration,
          }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            className="relative h-full w-full"
          >
            {showCloseButton && (
              <button
                onClick={collapse}
                className={`fixed top-4 left-4 z-[60] p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-colors ${closeButtonClassName || ""
                  }`}
                aria-label="Close"
              >
                <X className="w-6 h-6 text-neutral-900 dark:text-white" />
              </button>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

interface ExpandableScreenBackgroundProps {
  trigger?: React.ReactNode
  content?: React.ReactNode
  className?: string
}

export function ExpandableScreenBackground({
  trigger,
  content,
  className,
}: ExpandableScreenBackgroundProps) {
  const { isExpanded } = useExpandableScreen()

  return (
    <AnimatePresence mode="wait">
      {isExpanded ? (
        <motion.div
          key="content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={className}
        >
          {content}
        </motion.div>
      ) : (
        <motion.div
          key="trigger"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={className}
        >
          {trigger}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
