"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface MorphingDialogContextValue {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
}

const MorphingDialogContext = React.createContext<MorphingDialogContextValue | undefined>(undefined);

function useMorphingDialog() {
    const context = React.useContext(MorphingDialogContext);
    if (!context) {
        throw new Error("MorphingDialog components must be used within MorphingDialog");
    }
    return context;
}

interface MorphingDialogProps {
    children: React.ReactNode;
    transition?: any;
}

export function MorphingDialog({ children, transition }: MorphingDialogProps) {
    const [isOpen, setIsOpen] = React.useState(false);

    return (
        <MorphingDialogContext.Provider value={{ isOpen, setIsOpen }}>
            {children}
        </MorphingDialogContext.Provider>
    );
}

export function MorphingDialogTrigger({
    children,
    className,
    style,
}: {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}) {
    const { setIsOpen } = useMorphingDialog();

    return (
        <div
            onClick={() => setIsOpen(true)}
            className={className}
            style={style}
        >
            {children}
        </div>
    );
}

export function MorphingDialogContainer({ children }: { children: React.ReactNode }) {
    const { isOpen } = useMorphingDialog();

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export function MorphingDialogContent({
    children,
    className,
    style,
}: {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}) {
    return (
        <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", bounce: 0.05, duration: 0.25 }}
            className={className}
            style={style}
            onClick={(e) => e.stopPropagation()}
        >
            {children}
        </motion.div>
    );
}

export function MorphingDialogImage({
    src,
    alt,
    className,
}: {
    src: string;
    alt: string;
    className?: string;
}) {
    return <img src={src} alt={alt} className={className} />;
}

export function MorphingDialogTitle({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return <h2 className={className}>{children}</h2>;
}

export function MorphingDialogSubtitle({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return <p className={className}>{children}</p>;
}

export function MorphingDialogDescription({
    children,
    className,
    disableLayoutAnimation,
    variants,
}: {
    children: React.ReactNode;
    className?: string;
    disableLayoutAnimation?: boolean;
    variants?: any;
}) {
    return (
        <motion.div
            initial={variants?.initial}
            animate={variants?.animate}
            exit={variants?.exit}
            transition={{ type: "spring", bounce: 0.05, duration: 0.3 }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

export function MorphingDialogClose({ className }: { className?: string }) {
    const { setIsOpen } = useMorphingDialog();

    return (
        <button
            onClick={() => setIsOpen(false)}
            className={`absolute top-4 right-4 p-2 rounded-full bg-black/20 hover:bg-black/40 transition-colors ${className}`}
            aria-label="Close dialog"
        >
            <X size={20} />
        </button>
    );
}
