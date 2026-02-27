import type { Language } from "@/lib/i18n/translations";

export interface HealthInsightsInput {
  age?: number;
  gender?: string;
  bloodGroup?: string;
  bmi?: number;
  bmiCategory?: string;
  allergies?: string;
  chronicConditions?: string;
  currentMedications?: string;
  previousSurgeries?: string;
  language?: Language;
}

export interface HealthInsightsContent {
  dos: string[];
  donts: string[];
}

export interface HealthInsightsResult {
  insights: HealthInsightsContent;
}

export const HEALTH_INSIGHT_COUNT = 5;

interface InsightCopy {
  diabetesDos: string[];
  diabetesDonts: string[];
  bpDos: string[];
  bpDonts: string[];
  heartDos: string[];
  heartDonts: string[];
  asthmaDos: string[];
  asthmaDonts: string[];
  thyroidDos: string[];
  thyroidDonts: string[];
  kidneyDos: string[];
  kidneyDonts: string[];
  arthritisDos: string[];
  arthritisDonts: string[];
  allergyDos: string[];
  allergyDonts: string[];
  age50Dos: string[];
  age50Donts: string[];
  age40Dos: string[];
  age40Donts: string[];
  ageOtherDos: string[];
  ageOtherDonts: string[];
  femaleDos: string[];
  femaleDonts: string[];
  maleDos: string[];
  maleDonts: string[];
  commonDos: string[];
  commonDonts: string[];
}

const INSIGHT_COPY: Record<Language, InsightCopy> = {
  en: {
    diabetesDos: [
      "Check blood sugar as advised and take meds on time.",
      "Eat at fixed times and limit simple carbs.",
    ],
    diabetesDonts: [
      "Do not skip diabetes medication or meals.",
      "Avoid sugary drinks and large single meals.",
    ],
    bpDos: [
      "Limit salt and check blood pressure at home if advised.",
      "Take blood pressure medication at the same time daily.",
    ],
    bpDonts: [
      "Do not stop blood pressure medicine without doctor approval.",
      "Avoid excess salt and highly processed foods.",
    ],
    heartDos: [
      "Take heart medications on time and stay active as advised.",
      "Prefer vegetables and reduce fried foods.",
    ],
    heartDonts: [
      "Do not start heavy exercise without medical clearance.",
      "Avoid smoking and limit alcohol.",
    ],
    asthmaDos: [
      "Keep your inhaler accessible and avoid known triggers.",
      "Stay away from smoke and dust-heavy places.",
    ],
    asthmaDonts: [
      "Do not skip controller inhaler when symptoms improve.",
      "Avoid heavy exercise in cold or polluted air.",
    ],
    thyroidDos: [
      "Take thyroid medicine on an empty stomach at a fixed time.",
      "Check thyroid tests as per your doctor schedule.",
    ],
    thyroidDonts: [
      "Do not stop thyroid medicine without doctor advice.",
      "Avoid taking thyroid medication together with calcium or iron.",
    ],
    kidneyDos: [
      "Limit salt and protein according to your doctor advice.",
      "Stay hydrated unless fluid restriction is advised.",
    ],
    kidneyDonts: [
      "Do not use painkillers without medical advice.",
      "Avoid high-potassium foods if restriction is advised.",
    ],
    arthritisDos: [
      "Do gentle movement and physiotherapy as advised.",
      "Keep joints warm and avoid sudden heavy load.",
    ],
    arthritisDonts: [
      "Do not stay in one posture for too long.",
      "Do not ignore swelling or worsening pain.",
    ],
    allergyDos: ["Carry allergy information and avoid known allergens."],
    allergyDonts: ["Do not consume products that trigger your allergies."],
    age50Dos: [
      "Get annual health checkups and age-appropriate screenings.",
      "Stay active with daily walks or light exercise.",
    ],
    age50Donts: [
      "Do not skip follow-ups or routine screenings.",
      "Avoid prolonged sitting and move every 30 to 45 minutes.",
    ],
    age40Dos: [
      "Schedule regular blood pressure and sugar checks.",
      "Maintain a consistent sleep routine.",
    ],
    age40Donts: ["Do not ignore persistent symptoms."],
    ageOtherDos: ["Sleep 7 to 8 hours and stay active most days."],
    ageOtherDonts: ["Do not skip meals or rely on junk food."],
    femaleDos: ["Continue recommended screening schedules for your age group."],
    femaleDonts: ["Do not delay routine preventive checkups."],
    maleDos: ["Track heart risk and blood pressure regularly after age 40."],
    maleDonts: ["Do not ignore chest discomfort or breathlessness."],
    commonDos: [
      "Drink enough water and eat meals on time.",
      "Take prescribed medicines on schedule.",
      "Visit your doctor for regular follow-ups.",
    ],
    commonDonts: [
      "Do not change medicine dose without doctor advice.",
      "Do not ignore new or worsening symptoms.",
      "Do not delay medical care when needed.",
    ],
  },
  hi: {
    diabetesDos: [
      "डॉक्टर की सलाह के अनुसार शुगर जांचें और दवाएं समय पर लें।",
      "निश्चित समय पर भोजन करें और साधारण कार्ब कम रखें।",
    ],
    diabetesDonts: [
      "मधुमेह की दवा या भोजन न छोड़ें।",
      "मीठे पेय और एक बार में बहुत अधिक भोजन से बचें।",
    ],
    bpDos: [
      "नमक कम रखें और सलाह मिलने पर घर पर रक्तचाप जांचें।",
      "ब्लड प्रेशर की दवा रोज एक ही समय पर लें।",
    ],
    bpDonts: [
      "डॉक्टर की अनुमति बिना बीपी की दवा बंद न करें।",
      "अधिक नमक और प्रोसेस्ड खाद्य पदार्थों से बचें।",
    ],
    heartDos: [
      "हृदय की दवाएं समय पर लें और सलाह अनुसार सक्रिय रहें।",
      "सब्जियां अधिक लें और तली हुई चीजें कम करें।",
    ],
    heartDonts: [
      "मेडिकल अनुमति के बिना भारी व्यायाम शुरू न करें।",
      "धूम्रपान से बचें और शराब सीमित रखें।",
    ],
    asthmaDos: [
      "इनहेलर पास रखें और ज्ञात ट्रिगर्स से बचें।",
      "धुआं और धूल वाली जगहों से दूर रहें।",
    ],
    asthmaDonts: [
      "लक्षण कम होने पर कंट्रोलर इनहेलर बंद न करें।",
      "बहुत ठंडी या प्रदूषित हवा में भारी व्यायाम न करें।",
    ],
    thyroidDos: [
      "थायरॉयड दवा खाली पेट रोज एक तय समय पर लें।",
      "डॉक्टर के अनुसार थायरॉयड जांच समय पर कराएं।",
    ],
    thyroidDonts: [
      "डॉक्टर की सलाह बिना थायरॉयड दवा बंद न करें।",
      "थायरॉयड दवा कैल्शियम या आयरन के साथ न लें।",
    ],
    kidneyDos: [
      "डॉक्टर की सलाह के अनुसार नमक और प्रोटीन नियंत्रित रखें।",
      "यदि तरल प्रतिबंध न हो तो पर्याप्त पानी पिएं।",
    ],
    kidneyDonts: [
      "डॉक्टर की सलाह बिना दर्द निवारक दवाएं न लें।",
      "यदि प्रतिबंध हो तो अधिक पोटैशियम वाले खाद्य से बचें।",
    ],
    arthritisDos: [
      "हल्की गतिविधि और फिजियोथेरेपी नियमित करें।",
      "जोड़ों को गर्म रखें और अचानक भारी दबाव से बचें।",
    ],
    arthritisDonts: [
      "बहुत देर तक एक ही मुद्रा में न रहें।",
      "सूजन या बढ़ते दर्द को नजरअंदाज न करें।",
    ],
    allergyDos: ["एलर्जी की जानकारी साथ रखें और ट्रिगर चीजों से बचें।"],
    allergyDonts: ["जो चीज एलर्जी बढ़ाए उसे बिल्कुल न लें।"],
    age50Dos: [
      "हर साल हेल्थ चेकअप और उम्र अनुसार स्क्रीनिंग कराएं।",
      "रोज हल्की सैर या व्यायाम से सक्रिय रहें।",
    ],
    age50Donts: [
      "फॉलो-अप और नियमित स्क्रीनिंग न छोड़ें।",
      "लंबे समय तक लगातार बैठे न रहें।",
    ],
    age40Dos: [
      "रक्तचाप और शुगर की नियमित जांच कराएं।",
      "नींद का समय नियमित रखें।",
    ],
    age40Donts: ["लगातार बने लक्षणों को अनदेखा न करें।"],
    ageOtherDos: ["रोज 7 से 8 घंटे नींद लें और सक्रिय रहें।"],
    ageOtherDonts: ["भोजन न छोड़ें और जंक फूड पर निर्भर न रहें।"],
    femaleDos: ["अपनी उम्र के अनुसार जरूरी स्क्रीनिंग समय पर कराएं।"],
    femaleDonts: ["रूटीन प्रिवेंटिव चेकअप में देरी न करें।"],
    maleDos: ["40 के बाद हृदय जोखिम और रक्तचाप की नियमित जांच रखें।"],
    maleDonts: ["सीने में दर्द या सांस फूलने को अनदेखा न करें।"],
    commonDos: [
      "पर्याप्त पानी पिएं और समय पर भोजन करें।",
      "डॉक्टर द्वारा दी गई दवाएं समय पर लें।",
      "नियमित फॉलो-अप के लिए डॉक्टर से मिलते रहें।",
    ],
    commonDonts: [
      "डॉक्टर की सलाह बिना दवा की मात्रा न बदलें।",
      "नए या बढ़ते लक्षणों को अनदेखा न करें।",
      "जरूरत होने पर इलाज में देरी न करें।",
    ],
  },
  mr: {
    diabetesDos: [
      "डॉक्टरांच्या सल्ल्यानुसार साखर तपासा आणि औषधे वेळेवर घ्या.",
      "ठरलेल्या वेळी जेवा आणि साधे कार्बोहायड्रेट कमी ठेवा.",
    ],
    diabetesDonts: [
      "डायबेटीसची औषधे किंवा जेवण चुकवू नका.",
      "गोड पेये आणि एकावेळी जास्त जेवण टाळा.",
    ],
    bpDos: [
      "मीठ कमी ठेवा आणि सल्ला असल्यास घरी रक्तदाब मोजा.",
      "रक्तदाबाची औषधे रोज एकाच वेळी घ्या.",
    ],
    bpDonts: [
      "डॉक्टरांच्या परवानगीशिवाय बीपीची औषधे बंद करू नका.",
      "जास्त मीठ आणि प्रोसेस्ड अन्न टाळा.",
    ],
    heartDos: [
      "हृदयाची औषधे वेळेवर घ्या आणि सल्ल्यानुसार सक्रिय राहा.",
      "भाज्या जास्त घ्या आणि तळलेले अन्न कमी करा.",
    ],
    heartDonts: [
      "वैद्यकीय परवानगीशिवाय जड व्यायाम सुरू करू नका.",
      "धूम्रपान टाळा आणि मद्यपान मर्यादित ठेवा.",
    ],
    asthmaDos: [
      "इनहेलर जवळ ठेवा आणि ट्रिगरपासून दूर रहा.",
      "धूर आणि धुळीच्या जागांपासून दूर राहा.",
    ],
    asthmaDonts: [
      "लक्षणे कमी झाली तरी कंट्रोलर इनहेलर बंद करू नका.",
      "थंड किंवा प्रदूषित हवेत जड व्यायाम टाळा.",
    ],
    thyroidDos: [
      "थायरॉईडची औषधे रिकाम्या पोटी ठरलेल्या वेळी घ्या.",
      "डॉक्टरांच्या सल्ल्याप्रमाणे थायरॉईड चाचण्या करा.",
    ],
    thyroidDonts: [
      "डॉक्टरांच्या सल्ल्याशिवाय थायरॉईड औषधे बंद करू नका.",
      "थायरॉईड औषध कॅल्शियम किंवा आयर्नसोबत घेऊ नका.",
    ],
    kidneyDos: [
      "डॉक्टरांच्या सल्ल्यानुसार मीठ आणि प्रोटीन नियंत्रित ठेवा.",
      "द्रव मर्यादा नसल्यास पुरेसे पाणी प्या.",
    ],
    kidneyDonts: [
      "डॉक्टरांच्या सल्ल्याशिवाय वेदनाशामक घेऊ नका.",
      "मर्यादा असल्यास जास्त पोटॅशियम असलेले अन्न टाळा.",
    ],
    arthritisDos: [
      "हलकी हालचाल आणि फिजिओथेरपी नियमित करा.",
      "सांधे उबदार ठेवा आणि अचानक जड ताण टाळा.",
    ],
    arthritisDonts: [
      "खूप वेळ एकाच स्थितीत राहू नका.",
      "सूज किंवा वाढता त्रास दुर्लक्षित करू नका.",
    ],
    allergyDos: ["अॅलर्जीची माहिती जवळ ठेवा आणि ट्रिगर टाळा."],
    allergyDonts: ["ज्यामुळे अॅलर्जी होते ते पदार्थ घेऊ नका."],
    age50Dos: [
      "दरवर्षी हेल्थ चेकअप आणि वयानुसार स्क्रिनिंग करा.",
      "दररोज चालणे किंवा हलका व्यायाम करा.",
    ],
    age50Donts: [
      "फॉलो-अप आणि नियमित चाचण्या चुकवू नका.",
      "खूप वेळ सलग बसून राहू नका.",
    ],
    age40Dos: [
      "रक्तदाब आणि साखरेची नियमित तपासणी करा.",
      "झोपेची वेळ नियमित ठेवा.",
    ],
    age40Donts: ["सतत राहणारी लक्षणे दुर्लक्षित करू नका."],
    ageOtherDos: ["दररोज 7 ते 8 तास झोप घ्या आणि सक्रिय राहा."],
    ageOtherDonts: ["जेवण चुकवू नका आणि जंक फूडवर अवलंबून राहू नका."],
    femaleDos: ["वयानुसार आवश्यक स्क्रिनिंग वेळेवर करा."],
    femaleDonts: ["रुटीन प्रिव्हेंटिव्ह तपासण्या पुढे ढकलू नका."],
    maleDos: ["40 नंतर हृदयजोखीम आणि रक्तदाब नियमित तपासा."],
    maleDonts: ["छातीत दुखणे किंवा धाप लागणे दुर्लक्षित करू नका."],
    commonDos: [
      "पुरेसे पाणी प्या आणि वेळेवर जेवा.",
      "डॉक्टरांनी सांगितलेली औषधे वेळेवर घ्या.",
      "नियमित फॉलो-अपसाठी डॉक्टरांना भेटा.",
    ],
    commonDonts: [
      "डॉक्टरांच्या सल्ल्याशिवाय औषधांचा डोस बदलू नका.",
      "नवीन किंवा वाढती लक्षणे दुर्लक्षित करू नका.",
      "गरज असताना उपचार उशिरा घेऊ नका.",
    ],
  },
  bh: {
    diabetesDos: [
      "डॉक्टर के सलाह मुताबिक शुगर जांचीं आ दवाई समय पर लीं।",
      "ठीक समय पर खाना खाईं आ मीठा कार्ब कम रखीं।",
    ],
    diabetesDonts: [
      "डायबिटीज के दवाई या खाना मत छोड़ीं।",
      "मीठा ड्रिंक आ एके बेर बहुत खाना से बचीं।",
    ],
    bpDos: [
      "नमक कम रखीं आ सलाह मिले त घर पर बीपी जांचीं।",
      "ब्लड प्रेशर के दवाई रोज एके समय पर लीं।",
    ],
    bpDonts: [
      "डॉक्टर के बिना बीपी के दवाई बंद मत करीं।",
      "बहुत नमक आ प्रोसेस्ड खाना से बचीं।",
    ],
    heartDos: [
      "दिल के दवाई समय पर लीं आ सलाह अनुसार सक्रिय रही।",
      "सब्जी जादे खाईं आ तला चीज कम करीं।",
    ],
    heartDonts: [
      "डॉक्टर के अनुमति बिना भारी कसरत शुरू मत करीं।",
      "धूम्रपान से बाचीं आ शराब सीमित रखीं।",
    ],
    asthmaDos: [
      "इनहेलर पासे रखीं आ ट्रिगर चीज से दूर रही।",
      "धुआं आ धूल वाला जगह से दूर रही।",
    ],
    asthmaDonts: [
      "लक्षण घटे पर भी कंट्रोलर इनहेलर बंद मत करीं।",
      "बहुत ठंडा या प्रदूषित हवा में भारी व्यायाम मत करीं।",
    ],
    thyroidDos: [
      "थायरॉयड दवाई खाली पेट रोज तय समय पर लीं।",
      "डॉक्टर के सलाह से थायरॉयड जांच करावत रही।",
    ],
    thyroidDonts: [
      "डॉक्टर के बिना थायरॉयड दवाई बंद मत करीं।",
      "थायरॉयड दवाई कैल्शियम या आयरन संग मत लीं।",
    ],
    kidneyDos: [
      "डॉक्टर के सलाह से नमक आ प्रोटीन कंट्रोल में रखीं।",
      "अगर पानी पर रोक नइखे त पर्याप्त पानी पीं।",
    ],
    kidneyDonts: [
      "डॉक्टर के सलाह बिना दर्द के गोली मत लीं।",
      "रोक होखे त जादे पोटैशियम वाला खाना मत खाईं।",
    ],
    arthritisDos: [
      "हल्का चलल-फिरल आ फिजियोथेरेपी नियमित करीं।",
      "जोड़ गरम रखीं आ अचानक भारी वजन से बचीं।",
    ],
    arthritisDonts: [
      "बहुत देर एके स्थिति में मत रही।",
      "सूजन या बढ़त दर्द के नजरअंदाज मत करीं।",
    ],
    allergyDos: ["एलर्जी के जानकारी साथ रखीं आ ट्रिगर चीज से बाचीं।"],
    allergyDonts: ["जे चीज से एलर्जी होखे, ओकर सेवन मत करीं।"],
    age50Dos: [
      "हर साल हेल्थ चेकअप आ उम्र अनुसार जांच कराईं।",
      "रोज हल्का टहलकदमी या व्यायाम करीं।",
    ],
    age50Donts: [
      "फॉलो-अप आ रूटीन जांच मत छोड़ीं।",
      "लंबा समय तक लगातार बैठल मत रही।",
    ],
    age40Dos: [
      "बीपी आ शुगर के नियमित जांच कराईं।",
      "नींद के समय नियमित रखीं।",
    ],
    age40Donts: ["लगातार लक्षण के नजरअंदाज मत करीं।"],
    ageOtherDos: ["रोज 7 से 8 घंटा नींद लीं आ सक्रिय रही।"],
    ageOtherDonts: ["खाना मत छोड़ीं आ जंक फूड पर निर्भर मत रही।"],
    femaleDos: ["अपना उम्र अनुसार जरूरी स्क्रीनिंग समय पर कराईं।"],
    femaleDonts: ["रूटीन जांच में देरी मत करीं।"],
    maleDos: ["40 के बाद दिल के जोखिम आ बीपी नियमित जांचीं।"],
    maleDonts: ["सीना दर्द या सांस फूले के नजरअंदाज मत करीं।"],
    commonDos: [
      "पर्याप्त पानी पीं आ समय पर भोजन करीं।",
      "डॉक्टर बतवल दवाई समय पर लीं।",
      "नियमित फॉलो-अप खातिर डॉक्टर से मिलत रही।",
    ],
    commonDonts: [
      "डॉक्टर के बिना दवाई के डोज मत बदलीं।",
      "नया या बढ़त लक्षण के नजरअंदाज मत करीं।",
      "जरूरत पड़े त इलाज में देरी मत करीं।",
    ],
  },
};

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function hasAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function unique(list: string[]): string[] {
  return Array.from(new Set(list.filter((item) => typeof item === "string" && item.trim())));
}

export function safeHealthInsightsLanguage(input: unknown): Language {
  return input === "hi" || input === "mr" || input === "bh" ? input : "en";
}

export function buildHealthInsights(
  input: HealthInsightsInput = {},
  language: Language = "en"
): HealthInsightsResult {
  const copy = INSIGHT_COPY[language] ?? INSIGHT_COPY.en;
  const age = typeof input.age === "number" && Number.isFinite(input.age) ? input.age : 30;
  const gender = normalizeText(input.gender);
  const conditions = normalizeText(input.chronicConditions);
  const allergies = normalizeText(input.allergies);

  const dosPool: string[] = [];
  const dontsPool: string[] = [];

  if (hasAny(conditions, ["diabetes", "blood sugar", "sugar"])) {
    dosPool.push(...copy.diabetesDos);
    dontsPool.push(...copy.diabetesDonts);
  }
  if (hasAny(conditions, ["hypertension", "blood pressure", "bp"])) {
    dosPool.push(...copy.bpDos);
    dontsPool.push(...copy.bpDonts);
  }
  if (hasAny(conditions, ["heart", "cardiac", "cholesterol"])) {
    dosPool.push(...copy.heartDos);
    dontsPool.push(...copy.heartDonts);
  }
  if (hasAny(conditions, ["asthma", "breathing"])) {
    dosPool.push(...copy.asthmaDos);
    dontsPool.push(...copy.asthmaDonts);
  }
  if (hasAny(conditions, ["thyroid"])) {
    dosPool.push(...copy.thyroidDos);
    dontsPool.push(...copy.thyroidDonts);
  }
  if (hasAny(conditions, ["kidney", "renal"])) {
    dosPool.push(...copy.kidneyDos);
    dontsPool.push(...copy.kidneyDonts);
  }
  if (hasAny(conditions, ["arthritis", "joint"])) {
    dosPool.push(...copy.arthritisDos);
    dontsPool.push(...copy.arthritisDonts);
  }
  if (allergies) {
    dosPool.push(...copy.allergyDos);
    dontsPool.push(...copy.allergyDonts);
  }

  if (age >= 50) {
    dosPool.push(...copy.age50Dos);
    dontsPool.push(...copy.age50Donts);
  } else if (age >= 40) {
    dosPool.push(...copy.age40Dos);
    dontsPool.push(...copy.age40Donts);
  } else {
    dosPool.push(...copy.ageOtherDos);
    dontsPool.push(...copy.ageOtherDonts);
  }

  if (gender.includes("female")) {
    dosPool.push(...copy.femaleDos);
    dontsPool.push(...copy.femaleDonts);
  }
  if (gender.includes("male")) {
    dosPool.push(...copy.maleDos);
    dontsPool.push(...copy.maleDonts);
  }

  dosPool.push(...copy.commonDos);
  dontsPool.push(...copy.commonDonts);

  return {
    insights: {
      dos: unique(dosPool).slice(0, HEALTH_INSIGHT_COUNT),
      donts: unique(dontsPool).slice(0, HEALTH_INSIGHT_COUNT),
    },
  };
}

export function normalizeHealthInsightsPayload(payload: unknown): HealthInsightsContent | null {
  if (!payload || typeof payload !== "object") return null;
  const maybe = payload as { dos?: unknown; donts?: unknown };
  if (!Array.isArray(maybe.dos) || !Array.isArray(maybe.donts)) return null;
  const dos = maybe.dos
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, HEALTH_INSIGHT_COUNT);
  const donts = maybe.donts
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, HEALTH_INSIGHT_COUNT);
  if (dos.length === 0 && donts.length === 0) return null;
  return { dos, donts };
}
