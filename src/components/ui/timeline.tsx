"use client";
import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface TimelineEntry {
    title: string;
    content: React.ReactNode;
}

export const Timeline = ({ data }: { data: TimelineEntry[] }) => {
    const [width, setWidth] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current) {
            // Calculate total width of one set of items
            // This is a simplified estimation, in a real scenario we might measure children
            setWidth(containerRef.current.scrollWidth / 2);
        }
    }, [data]);

    return (
        <div className="w-full font-sans overflow-hidden relative">
            <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-10 text-center">
                {/* Optional header if needed within the component, otherwise passed from parent */}
            </div>

            <div className="flex relative overflow-hidden mask-linear-gradient">
                {/* We duplicate the data to create the infinite loop effect */}
                <motion.div
                    className="flex gap-8 md:gap-16 px-4"
                    animate={{
                        x: ["0%", "-50%"],
                    }}
                    transition={{
                        x: {
                            repeat: Infinity,
                            repeatType: "loop",
                            duration: 20, // Adjust speed
                            ease: "linear",
                        },
                    }}
                    style={{
                        width: "fit-content",
                    }}
                >
                    {[...data, ...data].map((item, index) => (
                        <div key={index} className="flex flex-col gap-4 min-w-[300px] md:min-w-[400px] max-w-[400px] min-h-[280px] p-8 rounded-2xl bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 flex-shrink-0">
                            <h3 className="text-xl md:text-2xl font-bold text-neutral-800 dark:text-neutral-100">
                                {item.title}
                            </h3>
                            <div className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
                                {item.content}
                            </div>
                        </div>
                    ))}
                </motion.div>
            </div>

            {/* Gradient masks for smooth fade edges */}
            <div className="absolute top-0 left-0 h-full w-20 bg-gradient-to-r from-white dark:from-neutral-950 to-transparent pointer-events-none z-10" />
            <div className="absolute top-0 right-0 h-full w-20 bg-gradient-to-l from-white dark:from-neutral-950 to-transparent pointer-events-none z-10" />
        </div>
    );
};
