/**
 * Zero-Net QR Protocol for Swasthya Sanchar
 * 
 * This module enables emergency medical data to be embedded directly
 * in QR codes, allowing them to work 100% offline - critical for
 * rural India where internet connectivity is unreliable.
 * 
 * Protocol: SS1 (Swasthya Sanchar v1)
 * Format: SS1:{base64url-encoded-msgpack-compressed-data}
 * 
 * Data fits in ~400 bytes, compatible with standard QR codes.
 */

import { encode as msgpackEncode, decode as msgpackDecode } from '@msgpack/msgpack';
import pako from 'pako';
import { createHmac } from 'crypto';

// ============================================
// TYPES
// ============================================

export interface EmergencyProfile {
  v: number;           // Version (1)
  n: string;           // Name (max 30 chars)
  d: string;           // DOB (YYYY-MM-DD)
  g: string;           // Gender (M/F/O)
  b: string;           // Blood group
  a: string[];         // Allergies (max 5 items)
  m: string[];         // Current medications (max 5 items)
  c: string[];         // Chronic conditions (max 5 items)
  e: {                 // Emergency contact
    n: string;         // Name
    r: string;         // Relation
    p: string;         // Phone
  };
  w: string;           // Wallet address (for full records lookup)
  t: number;           // Timestamp (Unix seconds)
  s?: string;          // Signature (for verification)
}

export interface PatientData {
  fullName?: string | null;
  dateOfBirth?: Date | string | null;
  gender?: string | null;
  bloodGroup?: string | null;
  allergies?: string | null;
  currentMedications?: string | null;
  chronicConditions?: string | null;
  emergencyName?: string | null;
  emergencyRelation?: string | null;
  emergencyPhone?: string | null;
  walletAddress?: string;
}

export interface DecodedQRResult {
  profile: EmergencyProfile;
  isVerified: boolean;
  dataAge: number;  // seconds since QR was generated
  formattedAge: string;
}

// ============================================
// CONSTANTS
// ============================================

const PROTOCOL_VERSION = 1;
const PROTOCOL_PREFIX = 'SS1:';
const MAX_QR_BYTES = 2953;  // QR Code version 40, binary mode
const MAX_ITEMS = 5;        // Max items per array field
const MAX_NAME_LENGTH = 30;
const MAX_RELATION_LENGTH = 15;

// Use environment variable or fallback for development
const getSigningKey = (): string => {
  if (typeof process !== 'undefined' && process.env?.QR_SIGNING_KEY) {
    return process.env.QR_SIGNING_KEY;
  }
  // Fallback for client-side (verification only)
  return 'swasthya-sanchar-emergency-qr-key-2024';
};

// ============================================
// ENCODING FUNCTIONS
// ============================================

/**
 * Encode patient data into a Zero-Net QR string
 * This string can be embedded in a QR code and works offline
 */
export function encodeEmergencyProfile(patientData: PatientData): string {
  // Parse date of birth
  let dobString = '';
  if (patientData.dateOfBirth) {
    const dob = patientData.dateOfBirth instanceof Date 
      ? patientData.dateOfBirth 
      : new Date(patientData.dateOfBirth);
    dobString = dob.toISOString().split('T')[0];
  }

  // Build compact profile
  const profile: EmergencyProfile = {
    v: PROTOCOL_VERSION,
    n: truncate(patientData.fullName || '', MAX_NAME_LENGTH),
    d: dobString,
    g: mapGender(patientData.gender),
    b: patientData.bloodGroup || 'Unknown',
    a: parseList(patientData.allergies).slice(0, MAX_ITEMS),
    m: parseList(patientData.currentMedications).slice(0, MAX_ITEMS),
    c: parseList(patientData.chronicConditions).slice(0, MAX_ITEMS),
    e: {
      n: truncate(patientData.emergencyName || '', MAX_NAME_LENGTH),
      r: truncate(patientData.emergencyRelation || '', MAX_RELATION_LENGTH),
      p: patientData.emergencyPhone || ''
    },
    w: patientData.walletAddress || '',
    t: Math.floor(Date.now() / 1000)
  };

  // Create signature (without 's' field)
  const dataToSign = JSON.stringify(profile);
  const signature = createHmac('sha256', getSigningKey())
    .update(dataToSign)
    .digest('hex')
    .substring(0, 16);  // Truncate for space efficiency
  
  profile.s = signature;

  // Encode: Object → MessagePack → Gzip → Base64URL
  const msgpacked = msgpackEncode(profile);
  const compressed = pako.gzip(msgpacked);
  const base64 = bufferToBase64Url(compressed);

  const result = `${PROTOCOL_PREFIX}${base64}`;

  // Verify size
  if (result.length > MAX_QR_BYTES) {
    console.warn(`QR data size: ${result.length} bytes (max: ${MAX_QR_BYTES})`);
    // Try to reduce by trimming arrays
    return encodeEmergencyProfileMinimal(patientData);
  }

  return result;
}

/**
 * Minimal encoding for very large data sets
 */
function encodeEmergencyProfileMinimal(patientData: PatientData): string {
  let dobString = '';
  if (patientData.dateOfBirth) {
    const dob = patientData.dateOfBirth instanceof Date 
      ? patientData.dateOfBirth 
      : new Date(patientData.dateOfBirth);
    dobString = dob.toISOString().split('T')[0];
  }

  // Minimal profile with only critical data
  const profile: EmergencyProfile = {
    v: PROTOCOL_VERSION,
    n: truncate(patientData.fullName || '', 20),
    d: dobString,
    g: mapGender(patientData.gender),
    b: patientData.bloodGroup || '?',
    a: parseList(patientData.allergies).slice(0, 3).map(a => truncate(a, 15)),
    m: parseList(patientData.currentMedications).slice(0, 2).map(m => truncate(m, 20)),
    c: parseList(patientData.chronicConditions).slice(0, 2).map(c => truncate(c, 15)),
    e: {
      n: truncate(patientData.emergencyName || '', 15),
      r: truncate(patientData.emergencyRelation || '', 10),
      p: patientData.emergencyPhone || ''
    },
    w: patientData.walletAddress?.substring(0, 20) || '',
    t: Math.floor(Date.now() / 1000)
  };

  const dataToSign = JSON.stringify(profile);
  const signature = createHmac('sha256', getSigningKey())
    .update(dataToSign)
    .digest('hex')
    .substring(0, 16);
  
  profile.s = signature;

  const msgpacked = msgpackEncode(profile);
  const compressed = pako.gzip(msgpacked);
  const base64 = bufferToBase64Url(compressed);

  return `${PROTOCOL_PREFIX}${base64}`;
}

// ============================================
// DECODING FUNCTIONS
// ============================================

/**
 * Check if a string is a Zero-Net QR code
 */
export function isZeroNetQR(data: string): boolean {
  return data.startsWith(PROTOCOL_PREFIX);
}

/**
 * Decode a Zero-Net QR string back to emergency profile
 * Works completely offline - no server calls needed
 */
export function decodeEmergencyProfile(encoded: string): DecodedQRResult | null {
  try {
    // Check prefix
    if (!encoded.startsWith(PROTOCOL_PREFIX)) {
      return null;
    }

    const base64 = encoded.substring(PROTOCOL_PREFIX.length);
    const compressed = base64UrlToBuffer(base64);
    const decompressed = pako.ungzip(compressed);
    const profile = msgpackDecode(decompressed) as EmergencyProfile;

    // Verify signature
    const receivedSig = profile.s;
    const profileWithoutSig = { ...profile };
    delete profileWithoutSig.s;
    
    const expectedSig = createHmac('sha256', getSigningKey())
      .update(JSON.stringify(profileWithoutSig))
      .digest('hex')
      .substring(0, 16);

    const isVerified = receivedSig === expectedSig;
    
    // Calculate data age
    const dataAge = Math.floor(Date.now() / 1000) - profile.t;

    return {
      profile,
      isVerified,
      dataAge,
      formattedAge: formatDataAge(dataAge)
    };
  } catch (error) {
    console.error('Failed to decode Zero-Net QR:', error);
    return null;
  }
}

// ============================================
// DISPLAY CONVERSION
// ============================================

/**
 * Convert decoded profile to display format
 * Matches the existing PatientEmergencyData interface
 */
export function profileToDisplayData(profile: EmergencyProfile): {
  name: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup: string;
  allergies: string;
  chronicConditions: string;
  currentMedications: string;
  emergencyName: string;
  emergencyRelation: string;
  emergencyPhone: string;
  walletAddress: string;
} {
  return {
    name: profile.n,
    dateOfBirth: formatDOB(profile.d),
    gender: expandGender(profile.g),
    bloodGroup: profile.b,
    allergies: profile.a.join(', '),
    chronicConditions: profile.c.join(', '),
    currentMedications: profile.m.join(', '),
    emergencyName: profile.e.n,
    emergencyRelation: profile.e.r,
    emergencyPhone: profile.e.p,
    walletAddress: profile.w
  };
}

// ============================================
// VOICE/ACCESSIBILITY HELPERS
// ============================================

/**
 * Generate spoken text for emergency data in Hindi
 */
export function generateEmergencyVoiceText(profile: EmergencyProfile, language: 'en' | 'hi' | 'mr' = 'hi'): string {
  if (language === 'hi') {
    const parts = [
      `मरीज़ का नाम: ${profile.n}`,
      `ब्लड ग्रुप: ${profile.b}`,
    ];
    
    if (profile.a.length > 0) {
      parts.push(`एलर्जी: ${profile.a.join(', ')}`);
    } else {
      parts.push('कोई एलर्जी नहीं');
    }
    
    if (profile.m.length > 0) {
      parts.push(`वर्तमान दवाइयाँ: ${profile.m.join(', ')}`);
    }
    
    if (profile.c.length > 0) {
      parts.push(`स्वास्थ्य स्थितियाँ: ${profile.c.join(', ')}`);
    }
    
    if (profile.e.n && profile.e.p) {
      parts.push(`आपातकालीन संपर्क: ${profile.e.n}, ${profile.e.r}, फोन: ${profile.e.p}`);
    }
    
    return parts.join('। ');
  } else if (language === 'mr') {
    const parts = [
      `रुग्णाचे नाव: ${profile.n}`,
      `रक्तगट: ${profile.b}`,
    ];
    
    if (profile.a.length > 0) {
      parts.push(`ॲलर्जी: ${profile.a.join(', ')}`);
    } else {
      parts.push('कोणतीही ॲलर्जी नाही');
    }
    
    if (profile.m.length > 0) {
      parts.push(`सध्याची औषधे: ${profile.m.join(', ')}`);
    }
    
    if (profile.c.length > 0) {
      parts.push(`आरोग्य स्थिती: ${profile.c.join(', ')}`);
    }
    
    if (profile.e.n && profile.e.p) {
      parts.push(`आपत्कालीन संपर्क: ${profile.e.n}, ${profile.e.r}, फोन: ${profile.e.p}`);
    }
    
    return parts.join('. ');
  } else {
    // English
    const parts = [
      `Patient name: ${profile.n}`,
      `Blood group: ${profile.b}`,
    ];
    
    if (profile.a.length > 0) {
      parts.push(`Allergies: ${profile.a.join(', ')}`);
    } else {
      parts.push('No known allergies');
    }
    
    if (profile.m.length > 0) {
      parts.push(`Current medications: ${profile.m.join(', ')}`);
    }
    
    if (profile.c.length > 0) {
      parts.push(`Medical conditions: ${profile.c.join(', ')}`);
    }
    
    if (profile.e.n && profile.e.p) {
      parts.push(`Emergency contact: ${profile.e.n}, ${profile.e.r}, phone: ${profile.e.p}`);
    }
    
    return parts.join('. ');
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 1) + '…';
}

function parseList(str: string | null | undefined): string[] {
  if (!str) return [];
  return str
    .split(/[,;]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function mapGender(gender: string | null | undefined): string {
  if (!gender) return 'U';
  const g = gender.toLowerCase();
  if (g.startsWith('m')) return 'M';
  if (g.startsWith('f')) return 'F';
  if (g.startsWith('o')) return 'O';
  return 'U';
}

function expandGender(g: string): string {
  switch (g) {
    case 'M': return 'Male';
    case 'F': return 'Female';
    case 'O': return 'Other';
    default: return 'Not specified';
  }
}

function formatDOB(dob: string): string {
  if (!dob) return 'Not specified';
  try {
    const date = new Date(dob);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch {
    return dob;
  }
}

function formatDataAge(seconds: number): string {
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return `${Math.floor(seconds / 604800)} weeks ago`;
}

// Base64URL encoding/decoding (URL-safe, no padding)
function bufferToBase64Url(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64UrlToBuffer(base64url: string): Uint8Array {
  // Add padding if needed
  let base64 = base64url
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  while (base64.length % 4) {
    base64 += '=';
  }
  
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ============================================
// EXPORTS FOR TESTING
// ============================================

export const __testing = {
  truncate,
  parseList,
  mapGender,
  formatDataAge,
  PROTOCOL_PREFIX,
  MAX_QR_BYTES
};
