"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Home, LogIn } from "lucide-react";
import { Suspense } from "react";

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const errorMessages: Record<string, { title: string; description: string }> = {
    Configuration: {
      title: "Configuration Error",
      description: "There is a problem with the server configuration. Please contact support.",
    },
    AccessDenied: {
      title: "Access Denied",
      description: "You do not have permission to access this resource.",
    },
    Verification: {
      title: "Verification Error",
      description: "The verification token has expired or has already been used.",
    },
    Default: {
      title: "Authentication Error",
      description: "An error occurred during authentication. Please try again.",
    },
  };

  const errorInfo = error && errorMessages[error] ? errorMessages[error] : errorMessages.Default;

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl p-8 border border-neutral-200 dark:border-neutral-700">
          {/* Error Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
          </div>

          {/* Error Title */}
          <h1 className="text-2xl font-bold text-center text-neutral-900 dark:text-neutral-50 mb-3">
            {errorInfo.title}
          </h1>

          {/* Error Description */}
          <p className="text-center text-neutral-600 dark:text-neutral-400 mb-8">
            {errorInfo.description}
          </p>

          {/* Error Code */}
          {error && (
            <div className="bg-neutral-100 dark:bg-neutral-700 rounded-lg p-3 mb-6">
              <p className="text-sm text-center text-neutral-600 dark:text-neutral-400">
                Error Code: <span className="font-mono font-semibold">{error}</span>
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <Link
              href="/auth/login"
              className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
            >
              <LogIn className="w-4 h-4" />
              Try Login Again
            </Link>

            <Link
              href="/"
              className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-900 dark:text-neutral-50 rounded-lg transition font-medium"
            >
              <Home className="w-4 h-4" />
              Back to Home
            </Link>
          </div>

          {/* Help Text */}
          <p className="text-xs text-center text-neutral-500 dark:text-neutral-400 mt-6">
            If this problem persists, please contact support
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800 flex items-center justify-center">
          <div className="text-center">Loading...</div>
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  );
}
