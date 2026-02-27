"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import clsx from "clsx";

interface FeatureStep {
  step: number;
  title: string;
  description: string;
  details: string[];
  highlight: string;
  emoji: string;
}

const featureSteps: FeatureStep[] = [
  {
    step: 1,
    title: "Patient Registration",
    description: "Connect your wallet and create your blockchain health identity",
    details: [
      "Connect MetaMask wallet securely",
      "Register with name and date of birth",
      "Data stored on blockchain - you own it",
      "No intermediaries, complete control",
    ],
    highlight: "Your data, your control",
    emoji: "👤",
  },
  {
    step: 2,
    title: "Emergency QR Generation",
    description: "Create your life-saving QR code for first responders",
    details: [
      "Generate unique QR code instantly",
      "Print on ID card or save to phone",
      "Links to your blockchain address",
      "No wallet needed to access",
    ],
    highlight: "Instant emergency access",
    emoji: "📱",
  },
  {
    step: 3,
    title: "First Responder Access",
    description: "Scan QR code to instantly view critical medical information",
    details: [
      "No wallet or login required",
      "View blood type, allergies instantly",
      "Access current medications",
      "See emergency contact details",
    ],
    highlight: "Seconds save lives",
    emoji: "🚑",
  },
  {
    step: 4,
    title: "Doctor Portal Access",
    description: "Healthcare providers access records with patient consent",
    details: [
      "Authorized doctor verification",
      "Consent-based access control",
      "View complete medical history",
      "Transparent, auditable access",
    ],
    highlight: "Secure, consent-based",
    emoji: "👨‍⚕️",
  },
];

export function FeatureShowcase() {
  const [activeStep, setActiveStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % featureSteps.length);
    }, 6000);
    
    return () => clearInterval(interval);
  }, [isPaused]);

  const currentFeature = featureSteps[activeStep];

  return (
    <div className="relative">
      {/* Main Feature Display */}
      <div 
        className="relative overflow-hidden rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="relative"
          >
            {/* Content */}
            <div className="grid md:grid-cols-2 gap-8 p-8 md:p-10">
              {/* Left Side - Info */}
              <div className="space-y-5">
                {/* Step Badge */}
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="inline-flex items-center gap-2"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-md bg-neutral-900 dark:bg-neutral-100 text-neutral-50 dark:text-neutral-900 font-semibold text-sm">
                    {currentFeature.step}
                  </div>
                  <span className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Step {currentFeature.step} of 4
                  </span>
                </motion.div>

                {/* Title */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <h3 className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-neutral-50 mb-2">
                    {currentFeature.title}
                  </h3>
                  <p className="text-base text-neutral-600 dark:text-neutral-400">
                    {currentFeature.description}
                  </p>
                </motion.div>

                {/* Feature List */}
                <motion.ul
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="space-y-2.5"
                >
                  {currentFeature.details.map((detail, index) => (
                    <motion.li
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + index * 0.05 }}
                      className="flex items-start gap-2.5"
                    >
                      <div className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center mt-0.5 bg-neutral-200 dark:bg-neutral-700">
                        <svg className="w-3 h-3 text-neutral-700 dark:text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-sm text-neutral-700 dark:text-neutral-300">{detail}</span>
                    </motion.li>
                  ))}
                </motion.ul>

                {/* Highlight Badge */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-neutral-200 dark:bg-neutral-700 font-medium text-sm text-neutral-900 dark:text-neutral-50"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  {currentFeature.highlight}
                </motion.div>
              </div>

              {/* Right Side - Visual */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="relative hidden md:flex items-center justify-center"
              >
                <div className="w-full aspect-square rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex items-center justify-center text-7xl">
                  {currentFeature.emoji}
                </div>
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-200 dark:bg-neutral-700">
          <motion.div
            key={`progress-${activeStep}`}
            initial={{ width: "0%" }}
            animate={{ width: isPaused ? "0%" : "100%" }}
            transition={{ duration: isPaused ? 0 : 6, ease: "linear" }}
            className="h-full bg-neutral-900 dark:bg-neutral-100"
          />
        </div>
      </div>

      {/* Step Navigation */}
      <div className="flex justify-center items-center gap-2 mt-6">
        {featureSteps.map((feature, index) => (
          <button
            key={index}
            onClick={() => {
              setActiveStep(index);
              setIsPaused(true);
              setTimeout(() => setIsPaused(false), 3000);
            }}
            className={clsx(
              "relative transition-all duration-200",
              index === activeStep ? "scale-105" : "hover:scale-105"
            )}
            aria-label={`View ${feature.title}`}
          >
            <div
              className={clsx(
                "flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-200 border",
                index === activeStep
                  ? "bg-neutral-900 dark:bg-neutral-100 text-neutral-50 dark:text-neutral-900 border-neutral-900 dark:border-neutral-100"
                  : "bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600"
              )}
            >
              <div className={clsx(
                "w-6 h-6 rounded flex items-center justify-center font-semibold text-xs",
                index === activeStep ? "bg-neutral-50/20 dark:bg-neutral-900/20" : "bg-neutral-100 dark:bg-neutral-700"
              )}>
                {feature.step}
              </div>
              <span className="hidden sm:inline font-medium text-xs">
                {feature.title.split(' ')[0]}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Flow Indicator */}
      <div className="flex justify-center items-center gap-1.5 mt-4">
        {featureSteps.map((_, index) => (
          <div key={index} className="flex items-center">
            <div
              className={clsx(
                "rounded-full transition-all duration-300",
                index === activeStep 
                  ? "w-2 h-2 bg-neutral-900 dark:bg-neutral-100" 
                  : "w-1.5 h-1.5 bg-neutral-300 dark:bg-neutral-600"
              )}
            />
            {index < featureSteps.length - 1 && (
              <div className="w-6 h-px bg-neutral-200 dark:bg-neutral-700 mx-0.5" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
