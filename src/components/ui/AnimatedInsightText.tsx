"use client";

import { useAnimatedText } from "@/components/ui/animated-text";

interface AnimatedInsightTextProps {
    text: string;
    speed?: "slow" | "medium" | "fast";
}

export function AnimatedInsightText({ text, speed = "medium" }: AnimatedInsightTextProps) {
    // Determine delimiter based on speed
    // " " = word by word (fast)
    // "" = character by character (slow)
    const delimiter = speed === "fast" ? " " : speed === "slow" ? "" : " ";

    const animatedText = useAnimatedText(text, delimiter);

    return <>{animatedText}</>;
}
