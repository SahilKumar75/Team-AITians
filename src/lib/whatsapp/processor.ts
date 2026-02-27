/**
 * WhatsApp message processor - handle incoming text/commands
 * Resolves user by phone, returns reply text and optional actions
 */

import { prisma } from "@/lib/wallet-service";
import { WHATSAPP_TEMPLATES, detectLanguageFromText, type WhatsAppLang } from "./templates";

const BASE_URL = process.env.NEXTAUTH_URL || "https://swasthya-sanchar.vercel.app";

export interface ProcessResult {
  text: string;
  replyAsVoice?: boolean;
  mediaUrl?: string;
  buttons?: string[];
}

export async function processWhatsAppMessage(params: {
  phone: string;
  message: string;
  isVoice?: boolean;
  language?: string;
}): Promise<ProcessResult> {
  const { phone, message, language: langParam } = params;
  const raw = (message || "").trim().toLowerCase();
  const lang: WhatsAppLang = (langParam as WhatsAppLang) || detectLanguageFromText(message);

  const templates = WHATSAPP_TEMPLATES as any;

  // Normalize phone: strip +91, spaces; use last 10 digits if Indian
  const normalizedPhone = phone.replace(/\D/g, "").slice(-10);

  // Find patient by phone (last 10 digits match)
  const allPatients = await prisma.patientProfile.findMany({
    where: { user: { role: "patient" } },
    include: { user: true },
  });
  const patient = allPatients.find((p) => {
    const pDigits = (p.phone || "").replace(/\D/g, "").slice(-10);
    return pDigits === normalizedPhone || (p.phone || "").includes(normalizedPhone);
  });

  if (!patient) {
    return {
      text: templates.not_registered[lang] || templates.not_registered.en,
    };
  }

  // Command: help, hi, namaste, start
  if (/(help|मदद|hi|hello|namaste|नमस्ते|start|शुरू)/.test(raw)) {
    return { text: templates.welcome[lang] || templates.welcome.en };
  }

  // Command: status, स्थिति, journey
  if (/(status|स्थिति|journey|जर्नी|कतार|queue)/.test(raw)) {
    const journey = await prisma.journey.findFirst({
      where: { patientId: patient.id, status: "active" },
      include: {
        hospital: true,
        checkpoints: {
          where: { status: { in: ["in_queue", "in_progress"] } },
          include: { department: true },
          orderBy: { sequence: "asc" },
          take: 1,
        },
      },
    });

    if (!journey) {
      return { text: templates.no_active_journey[lang] || templates.no_active_journey.en };
    }

    const cp = journey.checkpoints[0];
    const currentStep = cp ? cp.department.name : "Registration";
    const waitTime = cp?.estimatedWaitMinutes ?? 10;
    const queuePos = cp?.queuePosition ?? 0;
    const trackingLink = `${BASE_URL}/journey/track/${journey.id}`;

    const msg =
      lang === "hi"
        ? `*${patient.fullName || "Patient"}* की जर्नी\n\nअभी: *${currentStep}*\nप्रतीक्षा: ~${waitTime} मिनट\nकतार: #${queuePos}\n\nलाइव ट्रैक: ${trackingLink}`
        : `*${patient.fullName || "Patient"}* journey\n\nCurrent: *${currentStep}*\nWait: ~${waitTime} min\nQueue: #${queuePos}\n\nTrack: ${trackingLink}`;

    return { text: msg };
  }

  // Command: qr, emergency, QR
  if (/(qr|emergency|आपातकाल|qr code)/.test(raw)) {
    // We cannot generate QR image in server without auth context; send link to app
    const qrPageUrl = `${BASE_URL}/patient/emergency`;
    const text =
      (templates.qr_sent[lang] || templates.qr_sent.en) +
      `\n\nOpen in app: ${qrPageUrl}`;
    return { text };
  }

  // Unknown
  return { text: templates.welcome[lang] || templates.welcome.en };
}
