"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface HowItWorksEntry {
    title: string;
    content: React.ReactNode;
    icon?: string;
    detailedContent?: React.ReactNode;
}

export const ExpandableHowItWorks = ({ data }: { data: HowItWorksEntry[] }) => {
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
    const expandedCardRef = useRef<HTMLDivElement>(null);

    const handleCardClick = (index: number) => {
        setExpandedIndex(index);
    };

    const handleNext = () => {
        if (expandedIndex !== null && expandedIndex < data.length - 1) {
            setExpandedIndex(expandedIndex + 1);
        }
    };

    const handlePrev = () => {
        if (expandedIndex !== null && expandedIndex > 0) {
            setExpandedIndex(expandedIndex - 1);
        }
    };

    // Handle click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (expandedCardRef.current && !expandedCardRef.current.contains(event.target as Node)) {
                setExpandedIndex(null);
            }
        };

        if (expandedIndex !== null) {
            // Add a small delay to prevent immediate closing
            setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside);
            }, 100);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [expandedIndex]);

    return (
        <div className="w-full py-12 px-6 md:px-12 lg:px-20">
            <div className="max-w-7xl mx-auto">
                <AnimatePresence mode="wait">
                    {expandedIndex === null ? (
                        // Grid Layout - Default State
                        <motion.div
                            key="grid"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
                        >
                            {data.map((item, index) => (
                                <motion.div
                                    key={index}
                                    onClick={() => handleCardClick(index)}
                                    className="cursor-pointer group"
                                    whileHover={{ y: -8 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800 group-hover:border-neutral-400 dark:group-hover:border-neutral-600 group-hover:shadow-lg transition-all duration-300 h-full">
                                        {/* Step Number Badge */}
                                        <div className="w-10 h-10 rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 flex items-center justify-center font-bold text-sm mb-4">
                                            {index + 1}
                                        </div>

                                        {/* Title - Remove numbering from title text */}
                                        <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-3">
                                            {item.title.replace(/^\d+\.\s*/, '')}
                                        </h3>

                                        {/* Preview Content */}
                                        <div className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-3">
                                            {item.content}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>
                    ) : (
                        // Expanded Slide View - Carousel Size
                        <motion.div
                            key="expanded"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                            className="relative"
                        >
                            {/* Expanded Card as Slide - Compact Size */}
                            <div
                                ref={expandedCardRef}
                                className="bg-white dark:bg-neutral-900 rounded-3xl p-8 md:p-10 border border-neutral-200 dark:border-neutral-800 shadow-2xl relative max-w-4xl mx-auto"
                            >
                                {/* Navigation Arrows */}
                                {expandedIndex > 0 && (
                                    <button
                                        onClick={handlePrev}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center justify-center transition-colors shadow-lg z-10"
                                    >
                                        <ChevronLeft className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                                    </button>
                                )}

                                {expandedIndex < data.length - 1 && (
                                    <button
                                        onClick={handleNext}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center justify-center transition-colors shadow-lg z-10"
                                    >
                                        <ChevronRight className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                                    </button>
                                )}

                                {/* Content */}
                                <div className="px-8">
                                    {/* Number and Title on Same Line */}
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-12 h-12 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 flex items-center justify-center font-bold text-xl flex-shrink-0">
                                            {expandedIndex + 1}
                                        </div>
                                        <h2 className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-neutral-100">
                                            {data[expandedIndex].title.replace(/^\d+\.\s*/, '')}
                                        </h2>
                                    </div>

                                    {/* Detailed Content */}
                                    <div className="text-base text-neutral-600 dark:text-neutral-400 leading-relaxed space-y-4">
                                        {data[expandedIndex].detailedContent || data[expandedIndex].content}
                                    </div>

                                    {/* Progress Indicator */}
                                    <div className="flex justify-center gap-2 mt-8">
                                        {data.map((_, index) => (
                                            <button
                                                key={index}
                                                onClick={() => setExpandedIndex(index)}
                                                className={`h-2 rounded-full transition-all ${index === expandedIndex
                                                        ? "w-8 bg-neutral-900 dark:bg-neutral-100"
                                                        : "w-2 bg-neutral-300 dark:bg-neutral-700 hover:bg-neutral-400 dark:hover:bg-neutral-600"
                                                    }`}
                                            />
                                        ))}
                                    </div>

                                    {/* Close hint */}
                                    <div className="text-center mt-4 text-xs text-neutral-400 dark:text-neutral-600">
                                        Click outside to close
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};
