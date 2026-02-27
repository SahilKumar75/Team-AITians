import { useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface CustomAIInputModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (customData: CustomHealthData) => void;
    currentData: {
        age: number;
        bloodGroup: string;
        bmi: number;
        allergies: string;
        chronicConditions: string;
        currentMedications: string;
    };
}

export interface CustomHealthData {
    age: number;
    bloodGroup: string;
    bmi: number;
    allergies: string;
    chronicConditions: string;
    currentMedications: string;
}

export default function CustomAIInputModal({ isOpen, onClose, onGenerate, currentData }: CustomAIInputModalProps) {
    const { t, tx } = useLanguage();
    const [formData, setFormData] = useState<CustomHealthData>(currentData);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onGenerate(formData);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-neutral-200 dark:border-neutral-800">
                {/* Header */}
                <div className="sticky top-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                                <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">{t.portal.patientHome.customizeHealthData}</h2>
                                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                                    {t.portal.patientHome.customizeHealthDataDesc}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition"
                        >
                            <X className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
                        </button>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Age & Blood Group */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                                {t.portal.patientHome.ageLabel}
                            </label>
                            <input
                                type="number"
                                value={formData.age}
                                onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) || 0 })}
                                min="1"
                                max="120"
                                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                                {t.portal.patientHome.bloodGroup}
                            </label>
                            <select
                                value={formData.bloodGroup}
                                onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition text-sm"
                            >
                                <option value="">{tx("Select")}</option>
                                <option value="A+">A+</option>
                                <option value="A-">A-</option>
                                <option value="B+">B+</option>
                                <option value="B-">B-</option>
                                <option value="AB+">AB+</option>
                                <option value="AB-">AB-</option>
                                <option value="O+">O+</option>
                                <option value="O-">O-</option>
                            </select>
                        </div>
                    </div>

                    {/* BMI */}
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                            BMI
                        </label>
                        <input
                            type="number"
                            step="0.1"
                            value={formData.bmi}
                            onChange={(e) => setFormData({ ...formData, bmi: parseFloat(e.target.value) || 0 })}
                            min="10"
                            max="60"
                            className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition text-sm"
                            placeholder={tx("e.g., 22.5")}
                        />
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5">
                            {tx("Normal range: 18.5 - 24.9")}
                        </p>
                    </div>

                    {/* Allergies */}
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                            {t.patientReg.allergies}
                        </label>
                        <textarea
                            value={formData.allergies}
                            onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                            rows={2}
                            className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition resize-none text-sm"
                            placeholder={tx("e.g., Penicillin, Peanuts")}
                        />
                    </div>

                    {/* Chronic Conditions */}
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                            {t.patientReg.conditions}
                        </label>
                        <textarea
                            value={formData.chronicConditions}
                            onChange={(e) => setFormData({ ...formData, chronicConditions: e.target.value })}
                            rows={2}
                            className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition resize-none text-sm"
                            placeholder={tx("e.g., Diabetes, Hypertension")}
                        />
                    </div>

                    {/* Current Medications */}
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                            {t.patientReg.medications}
                        </label>
                        <textarea
                            value={formData.currentMedications}
                            onChange={(e) => setFormData({ ...formData, currentMedications: e.target.value })}
                            rows={2}
                            className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition resize-none text-sm"
                            placeholder={tx("e.g., Aspirin 100mg daily")}
                        />
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                        <button
                            type="button"
                            onClick={() => setFormData(currentData)}
                            className="flex-1 px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition font-medium text-sm"
                        >
                            {tx("Reset")}
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition font-medium text-sm flex items-center justify-center gap-2"
                        >
                            <Sparkles className="w-4 h-4" />
                            {t.portal.patientHome.generateInsights}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
