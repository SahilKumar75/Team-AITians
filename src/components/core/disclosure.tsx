"use client"
import * as React from "react"
import { motion, MotionProps, AnimatePresence } from "framer-motion"
import { createContext, useContext } from "react"
import { cn } from "@/lib/utils"

interface DisclosureContextType {
    open: boolean
    onOpenChange: (open: boolean) => void
}

const DisclosureContext = createContext<DisclosureContextType | undefined>(undefined)

interface DisclosureProps extends Omit<MotionProps, "children"> {
    open: boolean
    onOpenChange: (open: boolean) => void
    children: React.ReactNode
    className?: string
}

export function Disclosure({
    open,
    onOpenChange,
    children,
    className,
    ...props
}: DisclosureProps) {
    return (
        <DisclosureContext.Provider value={{ open, onOpenChange }}>
            <motion.div
                initial="collapsed"
                animate={open ? "expanded" : "collapsed"}
                className={className}
                {...props}
            >
                {children}
            </motion.div>
        </DisclosureContext.Provider>
    )
}

export function DisclosureTrigger({
    children,
    className,
}: {
    children: React.ReactNode
    className?: string
}) {
    return <div className={className}>{children}</div>
}

export function DisclosureContent({
    children,
    className,
}: {
    children: React.ReactNode
    className?: string
}) {
    return (
        <div className={cn("overflow-hidden", className)}>
            <AnimatePresence>
                {children}
            </AnimatePresence>
        </div>
    )
}
