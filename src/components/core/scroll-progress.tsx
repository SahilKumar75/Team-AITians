'use client';

import { motion, useScroll, useSpring, type SpringOptions } from 'framer-motion';
import { type RefObject } from 'react';
import { cn } from '@/lib/utils';

interface ScrollProgressProps {
    className?: string;
    containerRef?: RefObject<HTMLElement>;
    springOptions?: SpringOptions;
}

export function ScrollProgress({
    className,
    containerRef,
    springOptions,
}: ScrollProgressProps) {
    const { scrollYProgress } = useScroll(
        containerRef ? { container: containerRef } : undefined
    );

    const scaleX = useSpring(scrollYProgress, springOptions);

    return (
        <motion.div
            className={cn('origin-left', className)}
            style={{
                scaleX,
            }}
        />
    );
}
