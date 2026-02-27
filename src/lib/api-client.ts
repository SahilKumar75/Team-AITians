// API Client for Backend Blockchain Operations
// This replaces direct MetaMask/Web3 calls with backend API calls

/**
 * Register patient on blockchain (no MetaMask needed!)
 */
export async function registerPatient(data: {
    dateOfBirth: string;
    emergencyData: any;
}) {
    const response = await fetch('/api/patient/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to register patient');
    }

    return await response.json();
}

/**
 * Grant doctor access (no MetaMask needed!)
 */
export async function grantDoctorAccess(doctorAddress: string) {
    const response = await fetch('/api/patient/grant-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorAddress }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to grant access');
    }

    return await response.json();
}

/**
 * Revoke doctor access (no MetaMask needed!)
 */
export async function revokeDoctorAccess(doctorAddress: string) {
    const response = await fetch('/api/patient/revoke-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorAddress }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to revoke access');
    }

    return await response.json();
}

/**
 * Upload medical record (no MetaMask needed!)
 */
export async function uploadMedicalRecord(
    file: File,
    patientAddress: string
) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('patientAddress', patientAddress);

    const response = await fetch('/api/doctor/upload-record', {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload record');
    }

    return await response.json();
}

/**
 * Get patient records (read-only, no auth needed)
 */
export async function getPatientRecords(patientAddress: string) {
    const response = await fetch(
        `/api/records/get?patientAddress=${patientAddress}`
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch records');
    }

    return await response.json();
}
