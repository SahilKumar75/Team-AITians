"use client";

import { useEffect, useMemo, useState, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MatrixTextProps {
    children: ReactNode;
    className?: string;
    speed?: number;
}

export function MatrixText({ children, className, speed = 50 }: MatrixTextProps) {
    const [displayText, setDisplayText] = useState<string[]>([]);
    const chars = "01";

    const text = typeof children === "string" ? children : String(children ?? "");

    // Use grapheme clusters to avoid breaking Indic scripts into combining marks.
    const graphemes = useMemo(() => {
        if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
            const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
            return Array.from(segmenter.segment(text), (item) => item.segment);
        }
        return Array.from(text.normalize("NFC"));
    }, [text]);

    useEffect(() => {
        let iteration = 0;
        const interval = setInterval(() => {
            setDisplayText(
                graphemes.map((char, index) => {
                        const isWhitespace = char.trim().length === 0;
                        if (isWhitespace) return char;
                        if (index < iteration) {
                            return graphemes[index];
                        }
                        return chars[Math.floor(Math.random() * chars.length)];
                    })
            );

            if (iteration >= graphemes.length) {
                clearInterval(interval);
            }

            iteration += 1 / 3;
        }, speed);

        return () => clearInterval(interval);
    }, [graphemes, speed]);

    return (
        <span className={cn("inline", className)} style={{ whiteSpace: 'pre-wrap' }}>
            {displayText.map((char, index) => {
                const isDecoded = graphemes[index] === char;
                const isWhitespace = char.trim().length === 0;

                return (
                    <span
                        key={index}
                        className={cn(
                            "inline",
                            !isDecoded && !isWhitespace && "text-green-500 font-mono"
                        )}
                    >
                        {char}
                    </span>
                );
            })}
        </span>
    );
}
