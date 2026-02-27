"use client";

import { useState } from "react";
import { X, AlertCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface MedicalDataPromptProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: {
        allergies: string;
        chronicConditions: string;
        currentMedications: string;
    }) => Promise<void>;
    missingFields: string[];
}

export default function MedicalDataPrompt({
    isOpen,
    onClose,
    onSave,
    missingFields
}: MedicalDataPromptProps) {
    const { t, tx } = useLanguage();
    const [allergies, setAllergies] = useState("");
    const [chronicConditions, setChronicConditions] = useState("");
    const [currentMedications, setCurrentMedications] = useState("");
    const [noAllergies, setNoAllergies] = useState(false);
    const [noConditions, setNoConditions] = useState(false);
    const [noMedications, setNoMedications] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        // Validate at least one field is filled
        const finalAllergies = noAllergies ? "None" : allergies.trim();
        const finalConditions = noConditions ? "None" : chronicConditions.trim();
        const finalMedications = noMedications ? "None" : currentMedications.trim();

        if (!finalAllergies && missingFields.includes('allergies')) {
            setError(tx("Please provide allergies or check 'No known allergies'"));
            return;
        }
        if (!finalConditions && missingFields.includes('chronic_conditions')) {
            setError(tx("Please provide chronic conditions or check 'None'"));
            return;
        }
        if (!finalMedications && missingFields.includes('current_medications')) {
            setError(tx("Please provide current medications or check 'None'"));
            return;
        }

        setLoading(true);
        try {
            await onSave({
                allergies: finalAllergies,
                chronicConditions: finalConditions,
                currentMedications: finalMedications
            });
            onClose();
        } catch (err) {
            setError(tx("Failed to save medical data. Please try again."));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 p-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
                            {t.portal.patientHome.completeMedicalProfile}
                        </h2>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                            {t.portal.patientHome.completeMedicalProfileDesc}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition"
                    >
                        <X className="w-6 h-6 text-neutral-600 dark:text-neutral-400" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                        </div>
                    )}

                    {/* Allergies */}
                    {missingFields.includes('allergies') && (
                        <div>
                            <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-50 mb-2">
                                {t.patientReg.allergies}
                            </label>
                            <input
                                type="text"
                                value={allergies}
                                onChange={(e) => setAllergies(e.target.value)}
                                disabled={noAllergies}
                                placeholder={tx("e.g., Penicillin, Peanuts, Latex")}
                                className="w-full px-4 py-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50 placeholder-neutral-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <label className="flex items-center gap-2 mt-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={noAllergies}
                                    onChange={(e) => {
                                        setNoAllergies(e.target.checked);
                                        if (e.target.checked) setAllergies("");
                                    }}
                                    className="w-4 h-4 rounded border-neutral-300 text-purple-600 focus:ring-purple-500"
                                />
                                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                                    {tx("No known allergies")}
                                </span>
                            </label>
                        </div>
                    )}

                    {/* Chronic Conditions */}
                    {missingFields.includes('chronic_conditions') && (
                        <div>
                            <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-50 mb-2">
                                {t.patientReg.conditions}
                            </label>
                            <input
                                type="text"
                                value={chronicConditions}
                                onChange={(e) => setChronicConditions(e.target.value)}
                                disabled={noConditions}
                                placeholder={tx("e.g., Type-2 Diabetes, Hypertension, Asthma")}
                                className="w-full px-4 py-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50 placeholder-neutral-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <label className="flex items-center gap-2 mt-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={noConditions}
                                    onChange={(e) => {
                                        setNoConditions(e.target.checked);
                                        if (e.target.checked) setChronicConditions("");
                                    }}
                                    className="w-4 h-4 rounded border-neutral-300 text-purple-600 focus:ring-purple-500"
                                />
                                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                                    {tx("No chronic conditions")}
                                </span>
                            </label>
                        </div>
                    )}

                    {/* Current Medications */}
                    {missingFields.includes('current_medications') && (
                        <div>
                            <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-50 mb-2">
                                {t.patientReg.medications}
                            </label>
                            <textarea
                                value={currentMedications}
                                onChange={(e) => setCurrentMedications(e.target.value)}
                                disabled={noMedications}
                                placeholder={tx("e.g., Metformin 500mg (2x daily), Aspirin 75mg (1x daily)")}
                                rows={3}
                                className="w-full px-4 py-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50 placeholder-neutral-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-none"
                            />
                            <label className="flex items-center gap-2 mt-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={noMedications}
                                    onChange={(e) => {
                                        setNoMedications(e.target.checked);
                                        if (e.target.checked) setCurrentMedications("");
                                    }}
                                    className="w-4 h-4 rounded border-neutral-300 text-purple-600 focus:ring-purple-500"
                                />
                                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                                    {tx("Not taking any medications")}
                                </span>
                            </label>
                        </div>
                    )}

                    {/* Submit Button */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3 rounded-lg border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition"
                        >
                            {t.common.cancel}
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-6 py-3 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? tx("Saving...") : tx("Save & Generate Insights")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
