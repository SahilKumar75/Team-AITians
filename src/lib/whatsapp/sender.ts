/**
 * Send WhatsApp and SMS via Twilio
 * Requires: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER, TWILIO_PHONE_NUMBER
 */

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER; // e.g. whatsapp:+14155238886
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

export function isWhatsAppConfigured(): boolean {
  return !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_WHATSAPP_NUMBER);
}

export function isSMSConfigured(): boolean {
  return !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER);
}

/**
 * Normalize to Twilio WhatsApp format: whatsapp:+91XXXXXXXXXX
 */
function toWhatsAppAddress(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const num = digits.length >= 10 ? digits.slice(-10) : digits;
  const withCountry = num.length === 10 ? `91${num}` : num;
  return `whatsapp:+${withCountry}`;
}

/**
 * Send WhatsApp message via Twilio
 */
export async function sendWhatsAppMessage(toPhone: string, body: string): Promise<boolean> {
  if (!isWhatsAppConfigured()) {
    console.warn("WhatsApp not configured: missing Twilio env vars");
    return false;
  }

  try {
    const client = (await import("twilio")).default(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const to = toWhatsAppAddress(toPhone);
    await client.messages.create({
      body,
      from: TWILIO_WHATSAPP_NUMBER!,
      to,
    });
    return true;
  } catch (e) {
    console.error("Twilio WhatsApp send error:", e);
    return false;
  }
}

/**
 * Send SMS via Twilio (fallback when WhatsApp not available)
 */
export async function sendSMS(toPhone: string, body: string): Promise<boolean> {
  if (!isSMSConfigured()) {
    console.warn("SMS not configured: missing Twilio env vars");
    return false;
  }

  try {
    const client = (await import("twilio")).default(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const to = toPhone.replace(/\D/g, "").length === 10 ? `+91${toPhone.replace(/\D/g, "")}` : toPhone.startsWith("+") ? toPhone : `+${toPhone}`;
    await client.messages.create({
      body: body.slice(0, 1600),
      from: TWILIO_PHONE_NUMBER!,
      to,
    });
    return true;
  } catch (e) {
    console.error("Twilio SMS send error:", e);
    return false;
  }
}
