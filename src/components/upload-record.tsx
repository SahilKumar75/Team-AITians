'use client';

import { useState, useEffect } from 'react';
import { uploadToIPFS } from '@/lib/ipfs';
import { writeContract as writeContractHelper, type WalletConnection } from '@/lib/web3';
import { HEALTH_RECORDS_ABI, HEALTH_RECORDS_ADDRESS } from '@/lib/contracts';

interface UploadRecordProps {
    patientAddress: string;
    connection: WalletConnection; // Accept connection as prop
    onSuccess?: () => void;
}

export default function UploadRecord({ patientAddress, connection, onSuccess }: UploadRecordProps) {
    const [file, setFile] = useState<File | null>(null);
    const [recordType, setRecordType] = useState('');
    const [notes, setNotes] = useState('');
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            validateAndSetFile(droppedFile);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            validateAndSetFile(selectedFile);
        }
    };

    const validateAndSetFile = (selectedFile: File) => {
        setError('');

        // Validate file type
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
        if (!allowedTypes.includes(selectedFile.type)) {
            setError('Only PDF, JPG, and PNG files are allowed');
            return;
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024;
        if (selectedFile.size > maxSize) {
            setError(`File size exceeds 10MB. Got ${(selectedFile.size / 1024 / 1024).toFixed(2)}MB`);
            return;
        }

        setFile(selectedFile);
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!file) {
            setError('Please select a file');
            return;
        }

        if (!recordType) {
            setError('Please select a record type');
            return;
        }

        setUploading(true);
        setError('');
        setSuccess('');
        setProgress(0);

        try {
            // Step 1: Upload to IPFS (33% progress)
            setProgress(33);
            const ipfsHash = await uploadToIPFS(file);
            console.log('File uploaded to IPFS:', ipfsHash);

            // Step 2: Store on blockchain (66% progress)
            setProgress(66);

            if (!connection) {
                throw new Error('Wallet not connected');
            }

            await writeContractHelper(
                connection,
                'createRecord',
                [patientAddress as `0x${string}`, ipfsHash]
            );

            setProgress(100);

            setSuccess(`Medical record uploaded successfully! IPFS Hash: ${ipfsHash.slice(0, 10)}...`);

            // Reset form
            setFile(null);
            setRecordType('');
            setNotes('');
            setProgress(0);

            // Call success callback
            if (onSuccess) {
                onSuccess();
            }
        } catch (err: any) {
            console.error('Upload error:', err);

            if (err.message?.includes('Not authorized by patient')) {
                setError('You are not authorized to create records for this patient');
            } else if (err.message?.includes('IPFS') || err.message?.includes('not configured')) {
                setError('IPFS not configured. Set IPFS_API_URL on the server for your node.');
            } else if (err.message?.includes('User rejected')) {
                setError('Transaction rejected');
            } else {
                setError(err.message || 'Failed to upload record. Please try again.');
            }
            setProgress(0);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Upload Medical Record</h2>

            {/* Alerts */}
            {error && (
                <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded mb-4 text-sm">
                    {error}
                </div>
            )}
            {success && (
                <div className="bg-green-500/10 border border-green-500 text-green-500 px-4 py-3 rounded mb-4 text-sm">
                    {success}
                </div>
            )}

            <form onSubmit={handleUpload} className="space-y-4">
                {/* File Upload Area */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Medical Document
                    </label>
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging
                            ? 'border-white bg-zinc-800'
                            : 'border-zinc-700 hover:border-zinc-600'
                            }`}
                    >
                        {file ? (
                            <div className="space-y-2">
                                <div className="text-green-500 text-4xl">✓</div>
                                <p className="font-medium">{file.name}</p>
                                <p className="text-sm text-gray-400">
                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setFile(null)}
                                    className="text-sm text-red-500 hover:text-red-400"
                                >
                                    Remove file
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className="text-gray-400 text-4xl">📄</div>
                                <p className="text-gray-300">
                                    Drag and drop your file here, or{' '}
                                    <label className="text-white cursor-pointer hover:underline">
                                        browse
                                        <input
                                            type="file"
                                            onChange={handleFileChange}
                                            accept=".pdf,.jpg,.jpeg,.png"
                                            className="hidden"
                                            disabled={uploading}
                                        />
                                    </label>
                                </p>
                                <p className="text-xs text-gray-500">
                                    Supported formats: PDF, JPG, PNG (max 10MB)
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Record Type */}
                <div>
                    <label htmlFor="recordType" className="block text-sm font-medium text-gray-300 mb-2">
                        Record Type
                    </label>
                    <select
                        id="recordType"
                        value={recordType}
                        onChange={(e) => setRecordType(e.target.value)}
                        className="w-full bg-black border border-zinc-700 rounded px-4 py-2 text-white focus:outline-none focus:border-zinc-500"
                        disabled={uploading}
                    >
                        <option value="">Select type...</option>
                        <option value="prescription">Prescription</option>
                        <option value="lab_result">Lab Result</option>
                        <option value="imaging">Medical Imaging</option>
                        <option value="diagnosis">Diagnosis Report</option>
                        <option value="discharge_summary">Discharge Summary</option>
                        <option value="other">Other</option>
                    </select>
                </div>

                {/* Notes */}
                <div>
                    <label htmlFor="notes" className="block text-sm font-medium text-gray-300 mb-2">
                        Notes (Optional)
                    </label>
                    <textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        placeholder="Add any additional notes about this record..."
                        className="w-full bg-black border border-zinc-700 rounded px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-zinc-500"
                        disabled={uploading}
                    />
                </div>

                {/* Progress Bar */}
                {uploading && (
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm text-gray-400">
                            <span>Uploading...</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-zinc-800 rounded-full h-2">
                            <div
                                className="bg-white h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-xs text-gray-500">
                            {progress < 33 && 'Preparing file...'}
                            {progress >= 33 && progress < 66 && 'Uploading to IPFS...'}
                            {progress >= 66 && progress < 100 && 'Storing on blockchain...'}
                            {progress === 100 && 'Complete!'}
                        </p>
                    </div>
                )}

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={uploading || !file || !recordType}
                    className="w-full bg-white text-black font-semibold py-3 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {uploading ? 'Uploading...' : 'Upload Record'}
                </button>
            </form>
        </div>
    );
}
