import type { Language } from "@/lib/i18n/translations";
import type { VoiceActionDefinition, VoiceActionId, VoiceExecutionContext, VoiceRole } from "@/lib/voice/types";

function homeRouteByRole(role: VoiceRole): string {
  if (role === "doctor") return "/doctor/home";
  if (role === "hospital") return "/hospital/home";
  return "/patient/home";
}

function recordsRouteByRole(role: VoiceRole): string {
  if (role === "doctor") return "/doctor/records";
  if (role === "hospital") return "/hospital/upload";
  return "/patient/records";
}

function journeyRouteByRole(role: VoiceRole): string {
  if (role === "doctor") return "/doctor/queue";
  if (role === "hospital") return "/hospital/admin";
  return "/patient/journey";
}

function setThemeByToggle() {
  if (typeof window === "undefined") return;
  const current = localStorage.getItem("theme") === "dark" ? "dark" : "light";
  const next = current === "dark" ? "light" : "dark";
  localStorage.setItem("theme", next);
  document.documentElement.classList.toggle("dark", next === "dark");
}

function normalizeLanguage(input: string | undefined): Language | null {
  if (!input) return null;
  const normalized = input.toLowerCase();
  if (normalized.includes("hindi") || normalized.includes("हिंदी")) return "hi";
  if (normalized.includes("marathi") || normalized.includes("मराठी")) return "mr";
  if (normalized.includes("bhojpuri") || normalized.includes("भोजपुरी")) return "bh";
  if (normalized.includes("english") || normalized.includes("अंग्रेजी")) return "en";
  if (normalized === "en" || normalized === "hi" || normalized === "mr" || normalized === "bh") return normalized;
  return null;
}

function runCustomAction(
  ctx: VoiceExecutionContext,
  actionId: string,
  args?: Record<string, string | number | boolean>
): boolean {
  const custom = (ctx.pageActions || []).find((a) => a.id === actionId);
  if (custom?.execute) {
    void custom.execute(ctx, args);
    return true;
  }
  return false;
}

function normalizeToken(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9\u0900-\u097f]+/g, "");
}

function findCandidateFields(fieldKey: string): Array<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> {
  if (typeof document === "undefined") return [];

  const wanted = normalizeToken(fieldKey);
  if (!wanted) return [];

  const fields = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      "input:not([type='hidden']):not([disabled]), textarea:not([disabled]), select:not([disabled])"
    )
  ).filter((el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });

  const scoreField = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): number => {
    const id = el.id ? normalizeToken(el.id) : "";
    const name = el.getAttribute("name") ? normalizeToken(el.getAttribute("name") || "") : "";
    const placeholder = normalizeToken(el.getAttribute("placeholder") || "");
    const aria = normalizeToken(el.getAttribute("aria-label") || "");

    const labels: string[] = [];
    if (el.id && typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      document.querySelectorAll(`label[for='${CSS.escape(el.id)}']`).forEach((node) => {
        labels.push(normalizeToken(node.textContent || ""));
      });
    }
    const parentLabel = el.closest("label");
    if (parentLabel) labels.push(normalizeToken(parentLabel.textContent || ""));
    const nearText = normalizeToken(
      (el.closest("[data-field], .field, .form-group, .input-group")?.textContent || "").slice(0, 120)
    );

    const checks = [id, name, placeholder, aria, ...labels, nearText];
    let score = 0;
    checks.forEach((value) => {
      if (!value) return;
      if (value === wanted) score += 10;
      else if (value.includes(wanted) || wanted.includes(value)) score += 5;
    });
    return score;
  };

  return fields
    .map((field) => ({ field, score: scoreField(field) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.field);
}

function setFieldValue(
  field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  rawValue: string
): boolean {
  const value = rawValue.trim();
  if (!value) return false;

  if (field instanceof HTMLSelectElement) {
    const wanted = normalizeToken(value);
    const option = Array.from(field.options).find((opt) => normalizeToken(opt.textContent || opt.value) === wanted)
      || Array.from(field.options).find((opt) => normalizeToken(opt.textContent || opt.value).includes(wanted));
    if (!option) return false;
    field.value = option.value;
  } else if (field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio")) {
    const low = value.toLowerCase();
    const shouldCheck = ["yes", "true", "1", "on", "haan", "ha", "हो", "हाँ"].some((token) => low.includes(token));
    field.checked = shouldCheck;
  } else {
    field.value = value;
  }

  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function fillFormFields(args?: Record<string, string | number | boolean>): boolean {
  if (!args || typeof args !== "object") return false;

  let changed = 0;
  Object.entries(args).forEach(([key, raw]) => {
    if (raw === undefined || raw === null) return;
    const value = String(raw);
    const candidates = findCandidateFields(key);
    if (candidates.length === 0) return;
    if (setFieldValue(candidates[0], value)) changed += 1;
  });
  return changed > 0;
}

function submitActiveForm(): boolean {
  if (typeof document === "undefined") return false;

  const active = document.activeElement;
  const form = active instanceof HTMLElement ? active.closest("form") : null;
  const forms = Array.from(document.querySelectorAll<HTMLFormElement>("form"));
  const targetForm =
    form ||
    forms.find((candidate) => !!candidate.querySelector("button[type='submit'], input[type='submit']")) ||
    forms[0];

  if (targetForm instanceof HTMLFormElement) {
    if (typeof targetForm.requestSubmit === "function") targetForm.requestSubmit();
    else targetForm.submit();
    return true;
  }

  const submitBtn = document.querySelector<HTMLButtonElement | HTMLInputElement>(
    "button[type='submit'], input[type='submit']"
  );
  if (submitBtn) {
    submitBtn.click();
    return true;
  }
  return false;
}

export async function executeVoiceAction(
  actionId: VoiceActionId | string,
  ctx: VoiceExecutionContext,
  args?: Record<string, string | number | boolean>
): Promise<boolean> {
  if (runCustomAction(ctx, actionId, args)) return true;

  switch (actionId) {
    case "navigate_home":
      ctx.router.push(homeRouteByRole(ctx.role));
      return true;
    case "navigate_records":
      ctx.router.push(recordsRouteByRole(ctx.role));
      return true;
    case "navigate_journey":
      ctx.router.push(journeyRouteByRole(ctx.role));
      return true;
    case "navigate_emergency":
      ctx.router.push(ctx.role === "patient" ? "/patient/emergency" : "/emergency");
      return true;
    case "navigate_permissions":
      ctx.router.push(ctx.role === "patient" ? "/patient/permissions" : "/settings");
      return true;
    case "navigate_settings":
      ctx.router.push("/settings");
      return true;
    case "navigate_help":
      ctx.router.push("/help");
      return true;
    case "navigate_back":
      ctx.router.back();
      return true;

    case "patient_upload_record":
      ctx.router.push("/patient/upload");
      return true;
    case "patient_open_timeline":
      ctx.router.push("/patient/timeline");
      return true;
    case "patient_share_journey":
      ctx.router.push("/patient/journey");
      return true;
    case "patient_open_emergency_qr":
      ctx.router.push("/patient/emergency");
      return true;

    case "doctor_open_queue":
      ctx.router.push("/doctor/queue");
      return true;
    case "doctor_open_voice":
      ctx.router.push("/doctor/voice");
      return true;
    case "doctor_open_records":
      ctx.router.push("/doctor/records");
      return true;
    case "doctor_open_patients":
      ctx.router.push("/doctor/patients");
      return true;
    case "doctor_finalize_note": {
      const btn = typeof document !== "undefined" ? document.querySelector("button[data-voice-action='finalize-note']") : null;
      if (btn instanceof HTMLButtonElement) {
        btn.click();
        return true;
      }
      return false;
    }
    case "doctor_send_note": {
      const btn = typeof document !== "undefined" ? document.querySelector("button[data-voice-action='send-note']") : null;
      if (btn instanceof HTMLButtonElement) {
        btn.click();
        return true;
      }
      return false;
    }

    case "hospital_open_admin":
      ctx.router.push("/hospital/admin");
      return true;
    case "hospital_open_doctors":
      ctx.router.push("/hospital/doctors");
      return true;
    case "hospital_open_upload":
      ctx.router.push("/hospital/upload");
      return true;

    case "switch_language": {
      const raw = args?.language ?? args?.target ?? args?.value;
      const next = normalizeLanguage(raw === undefined || raw === null ? undefined : String(raw));
      if (!next) return false;
      ctx.setLanguage(next);
      return true;
    }

    case "toggle_theme":
      if (ctx.toggleTheme) ctx.toggleTheme();
      else setThemeByToggle();
      return true;

    case "repeat_last_response":
      if (ctx.repeatLastResponse) {
        ctx.repeatLastResponse();
        return true;
      }
      return false;
    case "fill_form_fields":
      return fillFormFields(args);
    case "submit_form":
      return submitActiveForm();
    case "stop_listening":
      return true;

    default:
      return false;
  }
}

export function getActionExecutionLabel(actionId: string): string {
  const labels: Record<string, string> = {
    navigate_home: "Opening home",
    navigate_records: "Opening records",
    navigate_journey: "Opening journey",
    navigate_emergency: "Opening emergency",
    navigate_permissions: "Opening access settings",
    navigate_settings: "Opening settings",
    navigate_help: "Opening help",
    navigate_back: "Going back",
    patient_upload_record: "Opening upload",
    patient_open_timeline: "Opening timeline",
    patient_share_journey: "Opening journey sharing",
    patient_open_emergency_qr: "Opening emergency QR",
    doctor_open_queue: "Opening queue",
    doctor_open_voice: "Opening voice notes",
    doctor_open_records: "Opening records",
    doctor_open_patients: "Opening patients",
    doctor_finalize_note: "Finalizing note",
    doctor_send_note: "Sending note",
    hospital_open_admin: "Opening queue",
    hospital_open_doctors: "Opening doctors",
    hospital_open_upload: "Opening upload",
    switch_language: "Switching language",
    toggle_theme: "Switching theme",
    repeat_last_response: "Repeating response",
    fill_form_fields: "Filling details",
    submit_form: "Submitting form",
    stop_listening: "Stopping voice listening",
  };
  return labels[actionId] || "Executing command";
}

export function toActionHints(actions: VoiceActionDefinition[]): string[] {
  return actions.map((a) => a.label);
}
