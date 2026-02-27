/**
 * Swasthya Sanchar - Type Definitions
 * Core TypeScript interfaces for the healthcare records system
 */

// ============================================================================
// Patient Types
// ============================================================================

/**
 * Registered patient on the blockchain
 */
export interface Patient {
    address: `0x${string}`;
    name: string;
    dateOfBirth: string;
    registeredAt: number;
    emergencyProfileHash: string;
}

/**
 * Patient registration input data
 */
export interface PatientRegistrationData {
    name: string;
    dateOfBirth: string;
    bloodType: BloodType;
    allergies: string[];
    conditions: string[];
    emergencyContact: EmergencyContact;
}

/**
 * Last-doctor seen entry — for "Old doctor" / "Frequent doctor" when patient selects hospital+department
 */
export interface LastDoctorSeen {
    doctorWallet: `0x${string}`;
    doctorName?: string;
    hospitalId?: string;
    departmentId?: string;
    lastSeenAt?: number;
}

/**
 * Family sharing preferences — what the patient allows family (linked patients) to see
 */
export interface FamilySharingPrefs {
    shareJourneyByDefault?: boolean;
    shareRecordsWithFamily?: boolean;
}

// ============================================================================
// Emergency Types
// ============================================================================

/**
 * Relation / relationship for emergency contact and first responder.
 * Emergency contact and first responder can be family (Spouse, Parent, etc.) or other.
 */
export type RelationType =
    | "Spouse"
    | "Parent"
    | "Child"
    | "Sibling"
    | "Guardian"
    | "Friend"
    | "Other family"
    | "Other";

/** All relation options for dropdowns (emergency contact, first responder). */
export const RELATION_OPTIONS: RelationType[] = [
    "Spouse", "Parent", "Child", "Sibling", "Guardian", "Friend", "Other family", "Other"
];

/**
 * Emergency contact information.
 * Can be family; use relation (or relationship) for display and consistency.
 */
export interface EmergencyContact {
    name: string;
    phone: string;
    /** Display label: e.g. Spouse, Parent. Prefer relation when available. */
    relationship: string;
    /** Standardised relation for UI (dropdown) and first-responder context. */
    relation?: RelationType;
}

/**
 * First responder: person(s) to notify when patient is in emergency (e.g. Unconscious Protocol).
 * Can be the same as emergency contact or additional (e.g. spouse + parent). Can be family.
 */
export interface FirstResponder {
    name: string;
    phone: string;
    relation: RelationType;
}

/**
 * Minimal emergency profile for QR-based access
 * This is visible to emergency responders without wallet
 */
export interface EmergencyProfile {
    name: string;
    bloodType: BloodType;
    allergies: string[];
    conditions: string[];
    emergencyContact: EmergencyContact;
    /** Optional: additional contacts to notify in emergency (e.g. when Unconscious Protocol triggers). If empty, emergency contact is the first responder. */
    firstResponders?: FirstResponder[];
}

/**
 * Blood type enumeration
 */
export type BloodType =
    | 'A+' | 'A-'
    | 'B+' | 'B-'
    | 'AB+' | 'AB-'
    | 'O+' | 'O-'
    | 'Unknown';

// ============================================================================
// Health Record Types
// ============================================================================

/**
 * Health record stored off-chain
 */
export interface HealthRecord {
    id: string;
    patientAddress: `0x${string}`;
    type: RecordType;
    title: string;
    description: string;
    data: string; // Could be base64, IPFS hash, or JSON
    createdAt: number;
    updatedAt: number;
}

/**
 * Types of health records
 */
export type RecordType =
    | 'prescription'
    | 'lab_result'
    | 'diagnosis'
    | 'imaging'
    | 'vaccination'
    | 'allergy'
    | 'procedure'
    | 'other';

// ============================================================================
// Access Control Types
// ============================================================================

/**
 * Access grant record
 */
export interface AccessGrant {
    patientAddress: `0x${string}`;
    doctorAddress: `0x${string}`;
    grantedAt: number;
    isActive: boolean;
}

/**
 * Doctor with access information
 */
export interface Doctor {
    address: `0x${string}`;
    name?: string;
    specialty?: string;
    /** Link to hospital (id from hospital list / Helia). Enables doctor list per hospital+department. */
    hospitalId?: string;
    /** Department ids at that hospital. Enables "doctors in this department" and "my patients in queue". */
    departmentIds?: string[];
    /** Optional: "Available today", "On leave" — for patient doctor selection. */
    availability?: string;
    /** Optional: current queue length for this doctor (can be computed from journey payloads). */
    currentQueue?: number;
    /** Optional: display title (e.g. Surgeon, Nurse) for hospital roles. */
    title?: ClinicianTitle;
}

/**
 * Hospital staff / clinician title for display and Unconscious Protocol co-sign (e.g. Doctor, Surgeon, Nurse).
 * IdentityRegistry can store optional title; used when 2 staff co-sign so we know role (e.g. doctor + nurse).
 */
export type ClinicianTitle =
    | "Doctor"
    | "Surgeon"
    | "Nurse"
    | "Consultant"
    | "Resident"
    | "Other";

/** All clinician title options for dropdowns (doctor/hospital profile). */
export const CLINICIAN_TITLE_OPTIONS: ClinicianTitle[] = [
    "Doctor", "Surgeon", "Nurse", "Consultant", "Resident", "Other"
];

// ============================================================================
// Hospital & Department Types
// ============================================================================

/**
 * OPD schedule: which days the department is open (0 = Sunday, 6 = Saturday)
 */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Department at a hospital — used by journey start, hospital admin, queue
 */
export interface Department {
    id: string;
    name: string;
    code?: string;
    type: string;
    floor: number;
    wing?: string;
    avgServiceTime: number;
    currentQueue: number;
    maxCapacity: number;
    /** Doctor wallet addresses in this department at this hospital. Enables "all doctors of this department". */
    doctorIds?: string[];
    /** Days department is open (e.g. [1,2,3,4,5] = Mon–Fri). So patient sees "Closed on Mondays" etc. */
    openDays?: DayOfWeek[];
    /** Optional opening/closing time per day. */
    schedule?: { open: string; close: string };
}

/**
 * Hospital — used by journey start, hospital admin, api/hospitals
 */
export interface Hospital {
    id: string;
    name: string;
    code: string;
    city: string;
    state?: string;
    type?: string;
    address?: string;
    departments?: Department[];
}

/**
 * Hospital registration / profile data (collected at registration, shown in portal)
 */
export interface HospitalProfileData {
    name: string;
    code: string;
    city: string;
    state: string;
    type?: string;
    address?: string;
    departments: Array<{
        name: string;
        type: string;
        floor: number;
        openDays?: DayOfWeek[];
        schedule?: { open: string; close: string };
    }>;
}

// ============================================================================
// Session / Visit / Order (multi-visit episode, tests, report upload)
// ============================================================================

/**
 * Order (test) — doctor orders e.g. blood, urine, MRI; patient sees when result available, queue for test
 */
export interface Order {
    orderId: string;
    testType: string;
    departmentId: string;
    expectedReadyAt?: number;
    queueToken?: number;
    status: 'pending' | 'done';
    doneAt?: string;
    recordId?: string;
}

/**
 * Visit — one trip to hospital; when they went, which department, which doctor, what doctor said, tests ordered
 */
export interface Visit {
    visitId: string;
    sessionId: string;
    hospitalId: string;
    visitedAt: number;
    departmentIds: string[];
    allottedDoctorWallet?: `0x${string}`;
    consultationNotes?: string;
    orders: Order[];
    tokenNumber?: string;
    checkpoints?: { departmentId: string; status: string }[];
    status: string;
}

/**
 * Session — episode of care spanning multiple visits and days (e.g. "Thyroid checkup Jan 2025")
 */
export interface Session {
    sessionId: string;
    patientWallet: `0x${string}`;
    hospitalId: string;
    reason?: string;
    title?: string;
    visits: Visit[];
    startedAt: number;
    status: 'active' | 'completed';
}

// ============================================================================
// UI/App Types
// ============================================================================

/**
 * User roles in the application
 */
export type UserRole = 'patient' | 'doctor' | 'hospital' | 'emergency';

/**
 * Wallet connection state
 */
export interface WalletState {
    isConnected: boolean;
    address: `0x${string}` | null;
    chainId: number | null;
    isConnecting: boolean;
    error: string | null;
}

/**
 * Transaction status for UI feedback
 */
export interface TransactionStatus {
    isPending: boolean;
    isSuccess: boolean;
    isError: boolean;
    hash: `0x${string}` | null;
    error: string | null;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
    total: number;
    page: number;
    pageSize: number;
}