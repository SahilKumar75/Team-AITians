
"use client";
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export default function RegisterPage() {
    const { register, loading } = useAuth();

    const [formData, setFormData] = useState({
        identifier: '', // Email or Phone
        password: '',
        confirmPassword: '',
        role: 'patient',
        license: ''
    });

    const [error, setError] = useState('');
    const [status, setStatus] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setStatus('Generating secure identity...');

        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        if (formData.password.length < 8) {
            setError("Password must be at least 8 characters");
            return;
        }

        if (formData.role !== 'patient' && !formData.license) {
            setError("License number is required for medical professionals");
            return;
        }

        try {
            setStatus('Encrypting keys & registering on blockchain...');
            await register(formData.identifier, formData.password, formData.role, formData.license);
            setStatus('Success! Redirecting...');
            // AuthContext handles redirect? No, we should do it here or in context.
            // Context sets user, we can redirect or show success.
            window.location.href = formData.role === 'patient' ? '/patient/register' : '/doctor/register';
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Registration failed");
            setStatus('');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
            <div className="max-w-md w-full bg-gray-800 p-8 rounded-lg shadow-xl">
                <h2 className="text-3xl font-bold mb-6 text-center text-green-400">Create Identity</h2>

                {error && (
                    <div className="bg-red-500/20 border border-red-500 text-red-200 p-3 rounded mb-4">
                        {error}
                    </div>
                )}

                {status && (
                    <div className="bg-blue-500/20 border border-blue-500 text-blue-200 p-3 rounded mb-4 animate-pulse">
                        {status}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Email or Phone</label>
                        <input
                            type="text"
                            name="identifier"
                            value={formData.identifier}
                            onChange={handleChange}
                            className="w-full bg-gray-700 border border-gray-600 rounded p-2 focus:ring-2 focus:ring-green-500 outline-none"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Password</label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            className="w-full bg-gray-700 border border-gray-600 rounded p-2 focus:ring-2 focus:ring-green-500 outline-none"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Confirm Password</label>
                        <input
                            type="password"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            className="w-full bg-gray-700 border border-gray-600 rounded p-2 focus:ring-2 focus:ring-green-500 outline-none"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">I am a...</label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="role"
                                    value="patient"
                                    checked={formData.role === 'patient'}
                                    onChange={handleChange}
                                    className="text-green-500 focus:ring-green-500"
                                />
                                Patient
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="role"
                                    value="doctor"
                                    checked={formData.role === 'doctor'}
                                    onChange={handleChange}
                                    className="text-green-500 focus:ring-green-500"
                                />
                                Doctor
                            </label>
                        </div>
                    </div>

                    {formData.role !== 'patient' && (
                        <div className="animate-fade-in-down">
                            <label className="block text-sm font-medium mb-1">Medical License Number</label>
                            <input
                                type="text"
                                name="license"
                                value={formData.license}
                                onChange={handleChange}
                                className="w-full bg-gray-700 border border-gray-600 rounded p-2 focus:ring-2 focus:ring-green-500 outline-none"
                                required
                            />
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !!status}
                        className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Processing...' : 'Register'}
                    </button>
                </form>

                <p className="mt-4 text-center text-sm text-gray-400">
                    Already have an identity?{' '}
                    <Link href="/auth/login" className="text-green-400 hover:underline">
                        Login here
                    </Link>
                </p>
            </div>
        </div>
    );
}
