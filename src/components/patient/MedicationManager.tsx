import { useState } from 'react';
import { Plus, X, Pill } from 'lucide-react';

interface Medication {
    id: string;
    name: string;
    dosage: string;
    unit: string;
    frequency: string;
}

interface MedicationManagerProps {
    medications: Medication[];
    onChange: (medications: Medication[]) => void;
    isEditing: boolean;
}

const UNITS = ['mg', 'ml', 'g', 'mcg', 'IU', 'pill(s)', 'tablet(s)', 'capsule(s)', 'drop(s)', 'puff(s)'];

export default function MedicationManager({ medications, onChange, isEditing }: MedicationManagerProps) {
    const [showAddForm, setShowAddForm] = useState(false);
    const [newMed, setNewMed] = useState({ name: '', dosage: '', unit: 'mg', frequency: '' });

    const addMedication = () => {
        if (!newMed.name || !newMed.dosage || !newMed.frequency) {
            alert('Please fill all fields');
            return;
        }

        const medication: Medication = {
            id: Date.now().toString(),
            ...newMed
        };

        onChange([...medications, medication]);
        setNewMed({ name: '', dosage: '', unit: 'mg', frequency: '' });
        setShowAddForm(false);
    };

    const removeMedication = (id: string) => {
        onChange(medications.filter(m => m.id !== id));
    };

    const updateMedication = (id: string, field: keyof Medication, value: string) => {
        onChange(medications.map(m => m.id === id ? { ...m, [field]: value } : m));
    };

    if (!isEditing) {
        return (
            <div className="space-y-2">
                {medications.length === 0 ? (
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">None</p>
                ) : (
                    medications.map((med) => (
                        <div key={med.id} className="bg-white dark:bg-neutral-700/50 rounded-lg p-3 border border-neutral-200 dark:border-neutral-600">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <p className="font-semibold text-neutral-900 dark:text-neutral-100">{med.name}</p>
                                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                                        {med.dosage} {med.unit} • {med.frequency}
                                    </p>
                                </div>
                                <Pill className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" />
                            </div>
                        </div>
                    ))
                )}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {medications.map((med) => (
                <div key={med.id} className="bg-white dark:bg-neutral-700/50 rounded-lg p-3 border border-neutral-300 dark:border-neutral-600">
                    <div className="grid grid-cols-12 gap-2 items-start">
                        <input
                            type="text"
                            value={med.name}
                            onChange={(e) => updateMedication(med.id, 'name', e.target.value)}
                            placeholder="Medication name"
                            className="col-span-12 sm:col-span-5 px-2 py-1.5 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm"
                        />
                        <input
                            type="text"
                            value={med.dosage}
                            onChange={(e) => updateMedication(med.id, 'dosage', e.target.value)}
                            placeholder="Dosage"
                            className="col-span-6 sm:col-span-2 px-2 py-1.5 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm"
                        />
                        <select
                            value={med.unit}
                            onChange={(e) => updateMedication(med.id, 'unit', e.target.value)}
                            className="col-span-6 sm:col-span-2 px-2 py-1.5 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm"
                        >
                            {UNITS.map(unit => (
                                <option key={unit} value={unit}>{unit}</option>
                            ))}
                        </select>
                        <input
                            type="text"
                            value={med.frequency}
                            onChange={(e) => updateMedication(med.id, 'frequency', e.target.value)}
                            placeholder="Frequency"
                            className="col-span-10 sm:col-span-2 px-2 py-1.5 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm"
                        />
                        <button
                            onClick={() => removeMedication(med.id)}
                            className="col-span-2 sm:col-span-1 p-1.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition"
                            title="Remove"
                        >
                            <X className="w-4 h-4 mx-auto" />
                        </button>
                    </div>
                </div>
            ))}

            {showAddForm ? (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border-2 border-blue-300 dark:border-blue-700">
                    <div className="grid grid-cols-12 gap-2 items-start mb-2">
                        <input
                            type="text"
                            value={newMed.name}
                            onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
                            placeholder="Medication name"
                            className="col-span-12 sm:col-span-5 px-2 py-1.5 rounded border border-blue-300 dark:border-blue-600 bg-white dark:bg-blue-900/30 text-neutral-900 dark:text-neutral-100 text-sm"
                        />
                        <input
                            type="text"
                            value={newMed.dosage}
                            onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })}
                            placeholder="Dosage"
                            className="col-span-6 sm:col-span-2 px-2 py-1.5 rounded border border-blue-300 dark:border-blue-600 bg-white dark:bg-blue-900/30 text-neutral-900 dark:text-neutral-100 text-sm"
                        />
                        <select
                            value={newMed.unit}
                            onChange={(e) => setNewMed({ ...newMed, unit: e.target.value })}
                            className="col-span-6 sm:col-span-2 px-2 py-1.5 rounded border border-blue-300 dark:border-blue-600 bg-white dark:bg-blue-900/30 text-neutral-900 dark:text-neutral-100 text-sm"
                        >
                            {UNITS.map(unit => (
                                <option key={unit} value={unit}>{unit}</option>
                            ))}
                        </select>
                        <input
                            type="text"
                            value={newMed.frequency}
                            onChange={(e) => setNewMed({ ...newMed, frequency: e.target.value })}
                            placeholder="e.g., Daily, Twice daily"
                            className="col-span-12 sm:col-span-3 px-2 py-1.5 rounded border border-blue-300 dark:border-blue-600 bg-white dark:bg-blue-900/30 text-neutral-900 dark:text-neutral-100 text-sm"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={addMedication}
                            className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm font-medium"
                        >
                            Add Medication
                        </button>
                        <button
                            onClick={() => {
                                setShowAddForm(false);
                                setNewMed({ name: '', dosage: '', unit: 'mg', frequency: '' });
                            }}
                            className="px-3 py-1.5 bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 rounded hover:bg-neutral-300 dark:hover:bg-neutral-600 transition text-sm font-medium"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => setShowAddForm(true)}
                    className="w-full px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition flex items-center justify-center gap-2 text-sm font-medium border-2 border-dashed border-blue-300 dark:border-blue-700"
                >
                    <Plus className="w-4 h-4" />
                    Add Medication
                </button>
            )}
        </div>
    );
}
