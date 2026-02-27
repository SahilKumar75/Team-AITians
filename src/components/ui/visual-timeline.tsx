"use client";

import React from "react";
import { motion } from "framer-motion";
import { UserPlus, FileText, QrCode, AlertCircle } from "lucide-react";

interface VisualTimelineEntry {
    title: string;
    content: React.ReactNode;
    icon: React.ReactNode;
    color: string;
    gradient: string;
}

const iconMap = {
    userPlus: UserPlus,
    fileText: FileText,
    qrCode: QrCode,
    alertCircle: AlertCircle,
};

export const VisualTimeline = ({ data }: { data: { title: string; content: React.ReactNode }[] }) => {
    // Enhanced data with visual elements
    const visualData: VisualTimelineEntry[] = data.map((item, index) => {
        const colors = [
            {
                color: "from-emerald-500 to-teal-600",
                bg: "bg-emerald-500/10",
                border: "border-emerald-500/20",
                icon: "emerald",
                iconComponent: UserPlus,
            },
            {
                color: "from-blue-500 to-indigo-600",
                bg: "bg-blue-500/10",
                border: "border-blue-500/20",
                icon: "blue",
                iconComponent: FileText,
            },
            {
                color: "from-violet-500 to-purple-600",
                bg: "bg-violet-500/10",
                border: "border-violet-500/20",
                icon: "violet",
                iconComponent: QrCode,
            },
            {
                color: "from-rose-500 to-pink-600",
                bg: "bg-rose-500/10",
                border: "border-rose-500/20",
                icon: "rose",
                iconComponent: AlertCircle,
            },
        ];

        const colorScheme = colors[index % colors.length];
        const IconComponent = colorScheme.iconComponent;

        return {
            ...item,
            icon: <IconComponent className="w-8 h-8" />,
            color: colorScheme.icon,
            gradient: colorScheme.color,
        };
    });

    return (
        <div className="w-full py-12 px-6 md:px-12 lg:px-20">
            <div className="max-w-7xl mx-auto">
                {/* Desktop View - Horizontal Flow */}
                <div className="hidden lg:block">
                    <div className="relative">
                        {/* Connection Line */}
                        <div className="absolute top-24 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-blue-500 via-violet-500 to-rose-500 opacity-20" />

                        <div className="grid grid-cols-4 gap-8">
                            {visualData.map((item, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, y: 50 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: index * 0.2, duration: 0.6 }}
                                    className="relative"
                                >
                                    {/* Step Number & Icon */}
                                    <div className="flex flex-col items-center mb-6">
                                        <motion.div
                                            whileHover={{ scale: 1.1, rotate: 5 }}
                                            className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${item.gradient} flex items-center justify-center text-white shadow-lg mb-4 relative z-10`}
                                        >
                                            {item.icon}
                                        </motion.div>

                                        {/* Connecting Dot */}
                                        <div className={`w-4 h-4 rounded-full bg-gradient-to-br ${item.gradient} shadow-md`} />
                                    </div>

                                    {/* Content Card */}
                                    <motion.div
                                        whileHover={{ y: -8, boxShadow: "0 20px 40px rgba(0,0,0,0.1)" }}
                                        className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-xl transition-all duration-300"
                                    >
                                        <h3 className={`text-xl font-bold mb-3 bg-gradient-to-r ${item.gradient} bg-clip-text text-transparent`}>
                                            {item.title}
                                        </h3>
                                        <div className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed">
                                            {item.content}
                                        </div>
                                    </motion.div>

                                    {/* Arrow Connector (except last item) */}
                                    {index < visualData.length - 1 && (
                                        <div className="absolute top-24 -right-4 transform translate-x-1/2 z-20">
                                            <motion.svg
                                                initial={{ opacity: 0, x: -10 }}
                                                whileInView={{ opacity: 1, x: 0 }}
                                                viewport={{ once: true }}
                                                transition={{ delay: index * 0.2 + 0.3 }}
                                                width="24"
                                                height="24"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                className="text-neutral-400 dark:text-neutral-600"
                                            >
                                                <path
                                                    d="M5 12h14m0 0l-6-6m6 6l-6 6"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </motion.svg>
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Mobile/Tablet View - Vertical Flow */}
                <div className="lg:hidden space-y-8">
                    {visualData.map((item, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -50 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.15, duration: 0.5 }}
                            className="relative"
                        >
                            <div className="flex gap-6">
                                {/* Left Side - Icon & Connector */}
                                <div className="flex flex-col items-center">
                                    <motion.div
                                        whileHover={{ scale: 1.1, rotate: 5 }}
                                        className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${item.gradient} flex items-center justify-center text-white shadow-lg flex-shrink-0`}
                                    >
                                        {item.icon}
                                    </motion.div>

                                    {/* Vertical Line */}
                                    {index < visualData.length - 1 && (
                                        <div className={`w-1 flex-1 mt-4 bg-gradient-to-b ${item.gradient} opacity-20 min-h-[60px]`} />
                                    )}
                                </div>

                                {/* Right Side - Content */}
                                <motion.div
                                    whileHover={{ x: 8 }}
                                    className="flex-1 bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800 shadow-sm"
                                >
                                    <h3 className={`text-lg font-bold mb-3 bg-gradient-to-r ${item.gradient} bg-clip-text text-transparent`}>
                                        {item.title}
                                    </h3>
                                    <div className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed">
                                        {item.content}
                                    </div>
                                </motion.div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
};
