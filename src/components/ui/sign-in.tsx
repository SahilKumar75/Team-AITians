import React from 'react';
import { Eye, EyeOff } from 'lucide-react';

// --- TYPE DEFINITIONS ---

export interface Testimonial {
    avatarSrc: string;
    name: string;
    handle: string;
    text: string;
}

interface AuthenticationLayoutProps {
    title?: React.ReactNode;
    description?: React.ReactNode;
    heroImageSrc?: string;
    testimonials?: Testimonial[];
    children: React.ReactNode;
}

// --- SUB-COMPONENTS ---

export const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm transition-colors focus-within:border-blue-500/70 focus-within:bg-blue-500/10 dark:focus-within:border-blue-500/70 dark:focus-within:bg-blue-500/10">
        {children}
    </div>
);

const TestimonialCard = ({ testimonial, delay }: { testimonial: Testimonial, delay: string }) => (
    <div className={`animate-testimonial ${delay as string} flex items-start gap-3 rounded-3xl bg-white/80 dark:bg-neutral-800/80 backdrop-blur-xl border border-neutral-200/50 dark:border-neutral-700/50 p-5 w-64 shadow-sm`}>
        <img src={testimonial.avatarSrc} className="h-10 w-10 object-cover rounded-2xl" alt="avatar" />
        <div className="text-sm leading-snug">
            <p className="flex items-center gap-1 font-medium text-neutral-900 dark:text-neutral-100">{testimonial.name}</p>
            <p className="text-neutral-500 dark:text-neutral-400 text-xs">{testimonial.handle}</p>
            <p className="mt-1 text-neutral-700 dark:text-neutral-300">{testimonial.text}</p>
        </div>
    </div>
);

// --- MAIN COMPONENT ---

export const AuthenticationLayout: React.FC<AuthenticationLayoutProps> = ({
    title,
    description,
    heroImageSrc,
    testimonials = [],
    children,
}) => {
    return (
        <div className="h-[100dvh] flex flex-col md:flex-row font-sans w-[100dvw] bg-white dark:bg-neutral-900">
            {/* Left column: sign-in form */}
            <section className="flex-1 flex items-center justify-center p-8 relative z-10">
                <div className="w-full max-w-md">
                    <div className="flex flex-col gap-6">
                        <div className="space-y-2">
                            <div className="animate-element animate-delay-100 text-3xl md:text-5xl font-bold leading-tight text-neutral-900 dark:text-neutral-50 tracking-tight">
                                {title}
                            </div>
                            <p className="animate-element animate-delay-200 text-neutral-600 dark:text-neutral-400">
                                {description}
                            </p>
                        </div>

                        {children}
                    </div>
                </div>
            </section>

            {/* Right column: hero image + testimonials */}
            {heroImageSrc && (
                <section className="hidden md:block flex-1 relative p-4">
                    <div
                        className="animate-slide-right animate-delay-300 absolute inset-4 rounded-3xl bg-cover bg-center shadow-2xl overflow-hidden"
                        style={{ backgroundImage: `url(${heroImageSrc})` }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-tr from-black/40 via-transparent to-transparent" />

                        {testimonials.length > 0 && (
                            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 px-8 w-full justify-center z-20">
                                <TestimonialCard testimonial={testimonials[0]} delay="delay-[100ms] duration-700" />
                                {testimonials[1] && <div className="hidden xl:flex"><TestimonialCard testimonial={testimonials[1]} delay="delay-[300ms] duration-700" /></div>}
                            </div>
                        )}
                    </div>
                </section>
            )}
        </div>
    );
};
