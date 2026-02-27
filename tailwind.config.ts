import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: "class",
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            keyframes: {
                fadeSlideIn: {
                    from: { opacity: "0", transform: "translateY(20px)", filter: "blur(10px)" },
                    to: { opacity: "1", transform: "translateY(0)", filter: "blur(0)" },
                },
                slideRightIn: {
                    from: { opacity: "0", transform: "translateX(-20px)", filter: "blur(10px)" },
                    to: { opacity: "1", transform: "translateX(0)", filter: "blur(0)" },
                },
                testimonialIn: {
                    from: { opacity: "0", transform: "translateY(20px) scale(0.95)", filter: "blur(10px)" },
                    to: { opacity: "1", transform: "translateY(0) scale(1)", filter: "blur(0)" },
                },
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
                "pulse-subtle": {
                    "0%, 100%": { opacity: "1" },
                    "50%": { opacity: "0.95" },
                },
            },
            animation: {
                element: "fadeSlideIn 0.8s ease-out forwards",
                "slide-right": "slideRightIn 0.8s ease-out forwards",
                testimonial: "testimonialIn 0.8s ease-out forwards",
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                "pulse-subtle": "pulse-subtle 3s ease-in-out infinite",
            },
        },
    },
    plugins: [],
};

export default config;
