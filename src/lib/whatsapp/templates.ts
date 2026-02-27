/**
 * WhatsApp message templates - EN, HI, MR
 * Use for journey updates, QR sharing, and bot replies
 */

export const WHATSAPP_TEMPLATES = {
  welcome: {
    en: `Welcome to Swasthya Sanchar. Reply with:
*status* - Your journey position
*qr* - Get emergency QR code
*help* - Show this menu`,
    hi: `Swasthya Sanchar में आपका स्वागत। जवाब दें:
*status* - आपकी जर्नी स्थिति
*qr* - इमरजेंसी QR कोड
*help* - यह मेनू`,
    mr: `Swasthya Sanchar मध्ये आपले स्वागत. उत्तर द्या:
*status* - तुमची जर्नी स्थिती
*qr* - आपत्कालीन QR कोड
*help* - हे मेनू`,
  },

  journey_started: {
    en: (p: { patientName: string; hospitalName: string; currentStep: string; estimatedTime: string; trackingLink: string }) =>
      `*${p.patientName}* has started their visit at *${p.hospitalName}*\n\nCurrent: ${p.currentStep}\nEstimated time: ${p.estimatedTime}\n\nTrack live: ${p.trackingLink}`,
    hi: (p: { patientName: string; hospitalName: string; currentStep: string; estimatedTime: string; trackingLink: string }) =>
      `*${p.patientName}* ने *${p.hospitalName}* में विज़िट शुरू की\n\nवर्तमान: ${p.currentStep}\nअनुमानित समय: ${p.estimatedTime}\n\nलाइव ट्रैक: ${p.trackingLink}`,
  },

  checkpoint_update: {
    en: (p: { patientName: string; checkpointName: string; status: string; waitTime: string; queuePosition: string }) =>
      `Update for *${p.patientName}*\n\nNow at: *${p.checkpointName}*\nStatus: ${p.status}\nWait: ~${p.waitTime} min\nQueue: #${p.queuePosition}`,
    hi: (p: { patientName: string; checkpointName: string; status: string; waitTime: string; queuePosition: string }) =>
      `*${p.patientName}* के लिए अपडेट\n\nअभी: *${p.checkpointName}*\nस्थिति: ${p.status}\nप्रतीक्षा: ~${p.waitTime} मिनट\nकतार: #${p.queuePosition}`,
  },

  journey_completed: {
    en: (p: { patientName: string }) => `*${p.patientName}* has completed their hospital visit.`,
    hi: (p: { patientName: string }) => `*${p.patientName}* की अस्पताल विज़िट पूरी हो गई।`,
  },

  qr_sent: {
    en: `Your emergency QR code is attached. It works without internet. Show it to medical staff in emergency.`,
    hi: `आपका इमरजेंसी QR कोड संलग्न है। यह बिना इंटरनेट के काम करता है। आपातकाल में मेडिकल स्टाफ को दिखाएं।`,
  },

  no_active_journey: {
    en: `You have no active hospital visit. Start one from the app.`,
    hi: `आपकी कोई सक्रिय अस्पताल विज़िट नहीं है। ऐप से शुरू करें।`,
  },

  not_registered: {
    en: `This number is not linked to a Swasthya Sanchar account. Sign up at the app first.`,
    hi: `यह नंबर Swasthya Sanchar अकाउंट से लिंक नहीं है। पहले ऐप पर साइन अप करें।`,
  },

  error_generic: {
    en: `Something went wrong. Please try again or use the app.`,
    hi: `कुछ गलत हो गया। कृपया पुनः प्रयास करें या ऐप इस्तेमाल करें।`,
  },
};

export type WhatsAppLang = "en" | "hi" | "mr";

export function detectLanguageFromText(text: string): WhatsAppLang {
  const t = text.trim().toLowerCase();
  if (/[\u0900-\u097F]/.test(t) && /(है|में|की|को|नहीं|आप|मेरी)/.test(t)) return "hi";
  if (/[\u0900-\u097F]/.test(t) && /(आहे|मध्ये|करा|असते)/.test(t)) return "mr";
  return "en";
}

export function generateProgressBar(progress: number): string {
  const filled = Math.min(10, Math.floor(progress / 10));
  const empty = 10 - filled;
  return "▓".repeat(filled) + "░".repeat(empty) + ` ${progress}%`;
}
