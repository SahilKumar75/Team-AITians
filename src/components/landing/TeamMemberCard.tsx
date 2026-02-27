"use client";

import { motion } from 'framer-motion';
import {
    MorphingDialog,
    MorphingDialogTrigger,
    MorphingDialogContent,
    MorphingDialogTitle,
    MorphingDialogImage,
    MorphingDialogSubtitle,
    MorphingDialogClose,
    MorphingDialogDescription,
    MorphingDialogContainer,
} from '@/components/core/morphing-dialog';
import { PlusIcon } from 'lucide-react';
import { useLanguage } from "@/contexts/LanguageContext";

interface TeamMemberProps {
    name: string;
    role: string;
    image: string;
    bio: string;
}

export function TeamMemberCard({ name, role, image, bio }: TeamMemberProps) {
    const { t } = useLanguage();

    return (
        <MorphingDialog
            transition={{
                type: 'spring',
                bounce: 0.05,
                duration: 0.25,
            }}
        >
            {/* Hover card - existing functionality */}
            <div className='group relative h-[350px] w-full sm:w-[290px] overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800 shadow-md hover:shadow-xl transition-shadow duration-300'>
                <MorphingDialogTrigger
                    style={{
                        borderRadius: '12px',
                    }}
                    className='w-full h-full'
                >
                    <motion.img
                        src={image}
                        alt={name}
                        className='h-full w-full object-cover pointer-events-none select-none transition-all duration-300 group-hover:scale-110 group-hover:blur-sm'
                    />

                    {/* Info overlay - shows on hover */}
                    <div className='absolute bottom-0 left-0 right-0 rounded-xl bg-neutral-900/90 dark:bg-neutral-100/90 backdrop-blur-md px-4 pt-2 pb-4 m-2 translate-y-full opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300'>
                        <div className='flex grow flex-row items-end justify-between'>
                            <div className='w-full pb-2 text-left text-[16px] font-bold text-white dark:text-neutral-900'>
                                {name}
                                <span className="block text-xs font-normal opacity-80 mt-0.5">{role}</span>
                            </div>
                            <button
                                type='button'
                                className='relative ml-1 flex h-6 w-6 shrink-0 scale-100 select-none appearance-none items-center justify-center rounded-lg border border-zinc-950/10 text-white dark:text-neutral-900 transition-colors hover:bg-white/20 dark:hover:bg-black/20 focus-visible:ring-2 active:scale-[0.98]'
                                aria-label={t.footer.learnMore}
                            >
                                <PlusIcon size={12} />
                            </button>
                        </div>
                    </div>
                </MorphingDialogTrigger>
            </div>

            {/* Morphing Dialog - expanded view */}
            <MorphingDialogContainer>
                <MorphingDialogContent
                    style={{
                        borderRadius: '24px',
                    }}
                    className='pointer-events-auto relative flex h-auto w-full flex-col overflow-hidden border border-zinc-950/10 bg-white dark:border-zinc-50/10 dark:bg-zinc-900 sm:w-[500px]'
                >
                    <MorphingDialogImage
                        src={image}
                        alt={name}
                        className='h-full w-full max-h-[300px] object-cover'
                    />
                    <div className='p-6'>
                        <MorphingDialogTitle className='text-2xl text-zinc-950 dark:text-zinc-50'>
                            {name}
                        </MorphingDialogTitle>
                        <MorphingDialogSubtitle className='text-zinc-700 dark:text-zinc-400'>
                            {role}
                        </MorphingDialogSubtitle>
                        <MorphingDialogDescription
                            disableLayoutAnimation
                            variants={{
                                initial: { opacity: 0, scale: 0.8, y: 100 },
                                animate: { opacity: 1, scale: 1, y: 0 },
                                exit: { opacity: 0, scale: 0.8, y: 100 },
                            }}
                        >
                            <p className='mt-2 text-zinc-500 dark:text-zinc-400 leading-relaxed'>
                                {bio}
                            </p>
                        </MorphingDialogDescription>
                    </div>
                    <MorphingDialogClose className='text-zinc-50' />
                </MorphingDialogContent>
            </MorphingDialogContainer>
        </MorphingDialog>
    );
}
