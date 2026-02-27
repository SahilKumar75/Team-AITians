"use client";

import { useState } from "react";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

interface FeatureItem {
    id: number;
    title: string;
    image: string;
    description: string;
}

interface BlockchainFeatureSectionProps {
    features: FeatureItem[];
    title?: string;
    description?: string;
}

const defaultFeatures: FeatureItem[] = [
    // Defaults kept for fallback, though we will pass props
    {
        id: 1,
        title: "Ready-to-Use UI Blocks",
        image: "/images/block/placeholder-1.svg",
        description: "Browse through our extensive collection...",
    },
];

const BlockchainFeatureSection = ({ features = defaultFeatures, title, description }: BlockchainFeatureSectionProps) => {
    const [activeTabId, setActiveTabId] = useState<number | null>(1);
    const [activeImage, setActiveImage] = useState(features[0]?.image || "");

    // Ensure active image is updated if features change or on init
    if (!activeImage && features.length > 0) {
        setActiveImage(features[0].image);
    }

    return (
        <section className="py-20 md:py-28 w-full">
            <div className="w-full px-6 md:px-12 lg:px-20">
                {/* Optional Header from props if we want to include it inside, 
            but the design has it outside usually. 
            We'll follow the user's provided structure mostly but allow passing custom headers if needed.
        */}
                {(title || description) && (
                    <div className="mb-12">
                        {title && <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-neutral-50 mb-4">{title}</h2>}
                        {description && <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-2xl">{description}</p>}
                    </div>
                )}

                <div className="flex w-full items-start justify-between gap-12 flex-col md:flex-row">
                    <div className="w-full md:w-1/2">
                        <Accordion type="single" className="w-full" defaultValue={`item-${features[0]?.id}`}>
                            {features.map((tab) => (
                                <AccordionItem key={tab.id} value={`item-${tab.id}`}>
                                    <AccordionTrigger
                                        onClick={() => {
                                            setActiveImage(tab.image);
                                            setActiveTabId(tab.id);
                                        }}
                                        className="cursor-pointer py-5 !no-underline transition"
                                    >
                                        <h6
                                            className={cn(
                                                "text-xl font-semibold text-left",
                                                tab.id === activeTabId ? "text-neutral-900 dark:text-neutral-50" : "text-neutral-500 dark:text-neutral-400"
                                            )}
                                        >
                                            {tab.title}
                                        </h6>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <p className="mt-3 text-neutral-600 dark:text-neutral-400 leading-relaxed">
                                            {tab.description}
                                        </p>
                                        <div className="mt-4 md:hidden">
                                            <img
                                                src={tab.image}
                                                alt={tab.title}
                                                className="h-full max-h-80 w-full rounded-xl object-cover"
                                            />
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </div>
                    <div className="relative m-auto hidden w-full md:w-1/2 overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800 md:block h-[500px]">
                        <img
                            src={activeImage}
                            alt="Feature preview"
                            className="h-full w-full object-cover transition-opacity duration-500"
                        />
                    </div>
                </div>
            </div>
        </section>
    );
};

export { BlockchainFeatureSection };
