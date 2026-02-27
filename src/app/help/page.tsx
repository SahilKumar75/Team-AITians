"use client";

import { Navbar } from "@/components/Navbar";
import { useAuthSession } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
    HelpCircle, MessageCircle, FileQuestion, AlertCircle
} from "lucide-react";

export default function HelpSupportPage() {
    const { data: session } = useAuthSession();
    const { tx } = useLanguage();

    const faqItems = [
        {
            question: "How do I access my medical records?",
            answer: "Navigate to the Medical Records section from your patient portal. You can view, download, and share your records securely."
        },
        {
            question: "How does the emergency QR code work?",
            answer: "Your emergency QR code contains your critical medical information. First responders can scan it to access your blood type, allergies, medications, and emergency contacts instantly."
        },
        {
            question: "How do I grant access to a doctor?",
            answer: "Go to Doctor Access in your patient portal, enter the doctor's email address, and click Grant Access. You can revoke access at any time."
        },
        {
            question: "Is my medical data secure?",
            answer: "Yes! Your data is encrypted and stored securely. We use industry-standard security practices to protect your information."
        },
        {
            question: "Can I update my emergency information?",
            answer: "Yes, you can update your emergency information anytime from your patient portal settings."
        }
    ];

    return (
        <div className="min-h-screen bg-white dark:bg-neutral-900">
            <Navbar />

            <main className="max-w-7xl mx-auto px-6 lg:px-12 py-12 pt-24">
                {/* Header */}
                <div className="text-center mb-16">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-6">
                        <HelpCircle className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h1 className="text-5xl font-bold text-neutral-900 dark:text-neutral-50 mb-4">
                        {tx("Help & Support")}
                    </h1>
                    <p className="text-xl text-neutral-600 dark:text-neutral-400">
                        {tx("We're here to help you get the most out of Swasthya Sanchar")}
                    </p>
                </div>

                {/* Contact Section */}
                <section
                    id="contact"
                    className="max-w-3xl mx-auto bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 p-8 shadow-sm"
                >
                    <h2 className="text-3xl font-semibold text-neutral-900 dark:text-neutral-50 mb-4 text-center">
                        {tx("Need more help?")}
                    </h2>
                    <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-6 text-center">
                        {tx("If you're facing an issue that isn't covered here, reach out and we'll do our best to assist.")}
                    </p>

                    <div className="space-y-4 text-sm text-neutral-700 dark:text-neutral-300">
                        <div className="flex items-start gap-3">
                            <MessageCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                            <div>
                                <p className="font-semibold">{tx("Support email")}</p>
                                <p className="text-neutral-600 dark:text-neutral-400">
                                    {tx("Contact our support team at")}{" "}
                                    <a
                                        href="mailto:support@swasthyasanchar.com"
                                        className="text-blue-600 dark:text-blue-400 hover:underline"
                                    >
                                        support@swasthyasanchar.com
                                    </a>
                                    .
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <FileQuestion className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                            <div>
                                <p className="font-semibold">{tx("Feature or bug reports")}</p>
                                <p className="text-neutral-600 dark:text-neutral-400">
                                    {tx("Share issues, suggestions, or feedback so we can continue improving the platform.")}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                            <div>
                                <p className="font-semibold">{tx("Emergency")}</p>
                                <p className="text-neutral-600 dark:text-neutral-400">
                                    {tx("For medical emergencies, please contact your local emergency services immediately. This platform is not a substitute for professional medical care.")}
                                </p>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
