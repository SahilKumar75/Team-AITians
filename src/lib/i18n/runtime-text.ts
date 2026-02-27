import { translations, type Language } from "@/lib/i18n/translations";

const MANUAL_PHRASES: Record<Language, Record<string, string>> = {
  en: {},
  hi: {
    "Upload Documents": "दस्तावेज़ अपलोड करें",
    "Upload a file": "फ़ाइल अपलोड करें",
    "Upload Medical Record": "मेडिकल रिकॉर्ड अपलोड करें",
    "Select File": "फ़ाइल चुनें",
    "Category": "श्रेणी",
    "Description": "विवरण",
    "Upload Document": "दस्तावेज़ अपलोड करें",
    "Uploading...": "अपलोड हो रहा है...",
    "Select Category": "श्रेणी चुनें",
    "Lab Report": "लैब रिपोर्ट",
    "Prescription": "प्रिस्क्रिप्शन",
    "Scan/X-Ray": "स्कैन/एक्स-रे",
    "Discharge Summary": "डिस्चार्ज सारांश",
    "Other": "अन्य",
    "Add brief details...": "संक्षिप्त विवरण जोड़ें...",
    "Who can access your documents": "आपके दस्तावेज़ कौन देख सकता है",
    "Manage and revoke access from this screen.": "इस स्क्रीन से एक्सेस प्रबंधित और रद्द करें।",
    "No doctors currently have access.": "अभी किसी डॉक्टर के पास एक्सेस नहीं है।",
    "Manage Access": "एक्सेस प्रबंधित करें",
    "Revoke": "रद्द करें",
    "Patient Timeline": "मरीज टाइमलाइन",
    "Back to Journeys": "यात्रा पर वापस जाएँ",
    "Back to Patients": "मरीजों पर वापस जाएँ",
    "Visits": "विज़िट",
    "Medical Records": "मेडिकल रिकॉर्ड",
    "Family Sharing": "परिवार साझा",
    "Doctor Queue": "डॉक्टर कतार",
    "Mark Checkup Done": "चेकअप पूरा चिह्नित करें",
    "Journey": "यात्रा",
    "Timeline": "टाइमलाइन",
    "Queue": "कतार",
    "Voice": "आवाज",
    "Access": "पहुंच",
    "AI Health Insights": "एआई स्वास्थ्य अंतर्दृष्टि",
    "Complete Your Medical Profile": "अपनी मेडिकल प्रोफाइल पूरी करें",
    "To receive personalized AI health insights, please provide:": "व्यक्तिगत एआई स्वास्थ्य अंतर्दृष्टि पाने के लिए कृपया यह जानकारी दें:",
    "Chronic conditions": "दीर्घकालिक बीमारियां",
    "Current medications": "वर्तमान दवाएं",
    "Complete Profile →": "प्रोफाइल पूरी करें →",
    "Share Your Journey": "अपनी यात्रा साझा करें",
    "Let loved ones track your visit": "अपनों को आपकी विजिट ट्रैक करने दें",
    "Share a live tracking link so anyone can see your current queue position, wait time, and journey progress — in real time, without needing an account.": "एक लाइव ट्रैकिंग लिंक साझा करें ताकि कोई भी आपकी कतार स्थिति, प्रतीक्षा समय और यात्रा प्रगति को रियल-टाइम में बिना अकाउंट देख सके।",
    "Live queue position": "लाइव कतार स्थिति",
    "Wait time estimate": "प्रतीक्षा समय अनुमान",
    "No login needed": "लॉगिन की जरूरत नहीं",
    "WhatsApp share": "व्हाट्सऐप शेयर",
    "Share Journey Link": "यात्रा लिंक साझा करें",
    "Start a journey first to generate a share link": "शेयर लिंक बनाने के लिए पहले यात्रा शुरू करें",
    "Dynamic AI voice mode active": "डायनेमिक एआई वॉइस मोड सक्रिय है",
    "Voice Assistant": "वॉइस सहायक",
    "Understanding...": "समझ रहा है...",
    "Executing command...": "कमांड चल रहा है...",
    "Responding...": "जवाब दे रही हूँ...",
    "Tap to talk": "बोलने के लिए टैप करें",
    "You": "आप",
    "Fill details": "विवरण भरें",
    "Submit form": "फॉर्म सबमिट करें",
    "Stop listening": "सुनना बंद करें",
    "Go home": "होम खोलें",
    "Open records": "रिकॉर्ड खोलें",
    "Open journey": "यात्रा खोलें",
    "Open emergency": "आपातकाल खोलें",
    "Open access": "पहुंच खोलें",
    "Open settings": "सेटिंग्स खोलें",
    "Open help": "सहायता खोलें",
    "Go back": "वापस जाएं",
    "Generate personalized health insights": "व्यक्तिगत स्वास्थ्य अंतर्दृष्टि जनरेट करें",
    "Generate Insights": "अंतर्दृष्टि जनरेट करें",
    "Generating personalized insights...": "व्यक्तिगत अंतर्दृष्टि बनाई जा रही है...",
    "DO's": "करें",
    "DON'Ts": "न करें",
    "My Records": "मेरे रिकॉर्ड",
    "Your health documents — uploaded by you or your doctors.": "आपके स्वास्थ्य दस्तावेज़ — आपके या आपके डॉक्टर द्वारा अपलोड किए गए।",
    "Upload Record": "रिकॉर्ड अपलोड करें",
    "All": "सभी",
    "Self-uploaded": "स्वयं अपलोड",
    "By Doctor": "डॉक्टर द्वारा",
    "No Records Yet": "अभी कोई रिकॉर्ड नहीं",
    "No Self-uploaded Records": "कोई स्वयं अपलोड रिकॉर्ड नहीं",
    "No By Doctor Records": "कोई डॉक्टर द्वारा रिकॉर्ड नहीं",
    "Upload your first record or ask your doctor to add one.": "अपना पहला रिकॉर्ड अपलोड करें या डॉक्टर से जोड़ने को कहें।",
    "Switch to 'All' to see your other records.": "अपने अन्य रिकॉर्ड देखने के लिए 'सभी' चुनें।",
    "Uploaded by": "अपलोड किया गया",
    "Date": "तारीख",
    "Login successful. Enable quick biometric login (fingerprint/face) for this device?": "लॉगिन सफल। क्या इस डिवाइस के लिए तेज बायोमेट्रिक लॉगिन (फिंगरप्रिंट/फेस) सक्षम करें?",
    "Setting up…": "सेटअप हो रहा है…",
    "Yes, enable": "हाँ, सक्षम करें",
    "No, continue": "नहीं, जारी रखें",
    "Verifying…": "सत्यापित किया जा रहा है…",
    "Sign in with biometrics": "बायोमेट्रिक से साइन इन करें",
    "Uses the fingerprint or face you set up on this device (stored locally, not on our servers).": "इस डिवाइस पर सेट किए गए फिंगरप्रिंट या फेस का उपयोग करता है (स्थानीय रूप से संग्रहीत, हमारे सर्वर पर नहीं)।",
    "Setup was cancelled or failed. You can try again or continue without biometrics.": "सेटअप रद्द हुआ या असफल रहा। आप फिर प्रयास कर सकते हैं या बिना बायोमेट्रिक जारी रख सकते हैं।",
    "Setup failed. You can try again or continue without biometrics.": "सेटअप असफल रहा। आप फिर प्रयास कर सकते हैं या बिना बायोमेट्रिक जारी रख सकते हैं।",
    "Enter a valid email address.": "कृपया मान्य ईमेल पता दर्ज करें।",
    "Enter a valid phone number.": "कृपया मान्य फोन नंबर दर्ज करें।",
    "Phone Number": "फोन नंबर",
    "10-digit mobile number": "10 अंकों का मोबाइल नंबर",
    "Microphone is allowed, but speech recognition is blocked by browser policy. Reload and try again.": "माइक्रोफोन अनुमति है, लेकिन ब्राउज़र नीति ने स्पीच पहचान रोक दी है। रीलोड करके फिर कोशिश करें।",
    "Microphone permission is blocked. Please allow mic access in browser settings.": "माइक्रोफोन अनुमति ब्लॉक है। कृपया ब्राउज़र सेटिंग्स में माइक्रोफोन एक्सेस दें।",
    "Microphone access was denied. Please allow microphone for this site and try again.": "माइक्रोफोन एक्सेस अस्वीकार किया गया। कृपया इस साइट के लिए माइक्रोफोन अनुमति दें और फिर कोशिश करें।",
    "Voice locale fallback active": "वॉइस लोकेल फॉलबैक सक्रिय",
    "Voice listening was stopped.": "वॉइस सुनना बंद कर दिया गया है।",
  },
  mr: {
    "Upload Documents": "कागदपत्रे अपलोड करा",
    "Upload a file": "फाइल अपलोड करा",
    "Upload Medical Record": "वैद्यकीय नोंद अपलोड करा",
    "Select File": "फाइल निवडा",
    "Category": "वर्ग",
    "Description": "वर्णन",
    "Upload Document": "कागदपत्र अपलोड करा",
    "Uploading...": "अपलोड होत आहे...",
    "Who can access your documents": "तुमचे कागदपत्र कोण पाहू शकतात",
    "Manage Access": "प्रवेश व्यवस्थापित करा",
    "Revoke": "रद्द करा",
    "Patient Timeline": "रुग्ण टाइमलाइन",
    "Back to Journeys": "जर्नीवर परत",
    "Back to Patients": "रुग्णांकडे परत",
    "Doctor Queue": "डॉक्टर रांग",
    "Journey": "प्रवास",
    "Timeline": "टाइमलाइन",
    "Queue": "रांग",
    "Voice": "आवाज",
    "Access": "प्रवेश",
    "AI Health Insights": "एआय आरोग्य अंतर्दृष्टी",
    "Complete Your Medical Profile": "तुमची वैद्यकीय प्रोफाइल पूर्ण करा",
    "To receive personalized AI health insights, please provide:": "वैयक्तिक एआय आरोग्य अंतर्दृष्टीसाठी कृपया पुढील माहिती द्या:",
    "Allergies": "ऍलर्जी",
    "Chronic conditions": "दीर्घकालीन स्थिती",
    "Current medications": "सध्याची औषधे",
    "Complete Profile →": "प्रोफाइल पूर्ण करा →",
    "Share Your Journey": "तुमचा प्रवास शेअर करा",
    "Let loved ones track your visit": "आप्तेष्टांना तुमची भेट ट्रॅक करू द्या",
    "Share a live tracking link so anyone can see your current queue position, wait time, and journey progress — in real time, without needing an account.": "लाईव्ह ट्रॅकिंग लिंक शेअर करा, ज्यामुळे कुणीही तुमची सध्याची रांग स्थिती, प्रतीक्षा वेळ आणि प्रवास प्रगती रिअल-टाईममध्ये अकाउंटशिवाय पाहू शकेल.",
    "Live queue position": "लाईव्ह रांग स्थिती",
    "Wait time estimate": "प्रतीक्षा वेळ अंदाज",
    "No login needed": "लॉगिनची गरज नाही",
    "WhatsApp share": "व्हॉट्सअॅप शेअर",
    "Share Journey Link": "प्रवास लिंक शेअर करा",
    "Start a journey first to generate a share link": "शेअर लिंक तयार करण्यासाठी प्रथम प्रवास सुरू करा",
    "Dynamic AI voice mode active": "डायनॅमिक एआय आवाज मोड सक्रिय आहे",
    "Voice Assistant": "आवाज सहाय्यक",
    "Understanding...": "समजत आहे...",
    "Executing command...": "कमांड चालू आहे...",
    "Responding...": "उत्तर देत आहे...",
    "Tap to talk": "बोलण्यासाठी टॅप करा",
    "You": "तुम्ही",
    "Fill details": "तपशील भरा",
    "Submit form": "फॉर्म सबमिट करा",
    "Stop listening": "ऐकणे थांबवा",
    "Go home": "होम उघडा",
    "Open records": "रेकॉर्ड उघडा",
    "Open journey": "प्रवास उघडा",
    "Open emergency": "आणीबाणी उघडा",
    "Open access": "प्रवेश उघडा",
    "Open settings": "सेटिंग्ज उघडा",
    "Open help": "मदत उघडा",
    "Go back": "मागे जा",
    "Generate personalized health insights": "वैयक्तिक आरोग्य अंतर्दृष्टी तयार करा",
    "Generate Insights": "अंतर्दृष्टी तयार करा",
    "Generating personalized insights...": "वैयक्तिक अंतर्दृष्टी तयार होत आहे...",
    "DO's": "करा",
    "DON'Ts": "करू नका",
    "My Records": "माझे रेकॉर्ड",
    "Your health documents — uploaded by you or your doctors.": "तुमची आरोग्य कागदपत्रे — तुमच्याकडून किंवा डॉक्टरांकडून अपलोड केलेली.",
    "Upload Record": "रेकॉर्ड अपलोड करा",
    "All": "सर्व",
    "Self-uploaded": "स्वतः अपलोड केलेले",
    "By Doctor": "डॉक्टरकडून",
    "No Records Yet": "अजून रेकॉर्ड नाहीत",
    "No Self-uploaded Records": "स्वतः अपलोड केलेले रेकॉर्ड नाहीत",
    "No By Doctor Records": "डॉक्टरकडून रेकॉर्ड नाहीत",
    "Upload your first record or ask your doctor to add one.": "तुमचा पहिला रेकॉर्ड अपलोड करा किंवा डॉक्टरांना जोडायला सांगा.",
    "Switch to 'All' to see your other records.": "इतर रेकॉर्ड पाहण्यासाठी 'सर्व' निवडा.",
    "Uploaded by": "अपलोड करणारा",
    "Date": "दिनांक",
    "Login successful. Enable quick biometric login (fingerprint/face) for this device?": "लॉगिन यशस्वी. या डिव्हाइससाठी जलद बायोमेट्रिक लॉगिन (फिंगरप्रिंट/फेस) सक्षम करायचे का?",
    "Setting up…": "सेटअप होत आहे…",
    "Yes, enable": "हो, सक्षम करा",
    "No, continue": "नाही, पुढे जा",
    "Verifying…": "पडताळणी होत आहे…",
    "Sign in with biometrics": "बायोमेट्रिकने साइन इन करा",
    "Uses the fingerprint or face you set up on this device (stored locally, not on our servers).": "या डिव्हाइसवर सेट केलेला फिंगरप्रिंट किंवा फेस वापरतो (स्थानिकरित्या साठवलेला, आमच्या सर्व्हरवर नाही).",
    "Setup was cancelled or failed. You can try again or continue without biometrics.": "सेटअप रद्द झाला किंवा अयशस्वी झाला. तुम्ही पुन्हा प्रयत्न करू शकता किंवा बायोमेट्रिकशिवाय पुढे जाऊ शकता.",
    "Setup failed. You can try again or continue without biometrics.": "सेटअप अयशस्वी झाला. तुम्ही पुन्हा प्रयत्न करू शकता किंवा बायोमेट्रिकशिवाय पुढे जाऊ शकता.",
    "Enter a valid email address.": "वैध ईमेल पत्ता टाका.",
    "Enter a valid phone number.": "वैध फोन नंबर टाका.",
    "Phone Number": "फोन नंबर",
    "10-digit mobile number": "10 अंकी मोबाइल नंबर",
    "Microphone is allowed, but speech recognition is blocked by browser policy. Reload and try again.": "मायक्रोफोनला परवानगी आहे, पण ब्राउझर धोरणामुळे आवाज ओळख बंद आहे. रीलोड करून पुन्हा प्रयत्न करा.",
    "Microphone permission is blocked. Please allow mic access in browser settings.": "मायक्रोफोन परवानगी ब्लॉक आहे. कृपया ब्राउझर सेटिंग्जमध्ये मायक्रोफोन परवानगी द्या.",
    "Microphone access was denied. Please allow microphone for this site and try again.": "मायक्रोफोन प्रवेश नाकारला गेला. कृपया या साइटसाठी मायक्रोफोनला परवानगी द्या आणि पुन्हा प्रयत्न करा.",
    "Voice locale fallback active": "आवाज लोकेल फॉलबॅक सक्रिय",
    "Voice listening was stopped.": "आवाज ऐकणे थांबवले आहे.",
  },
  bh: {
    "Upload Documents": "दस्तावेज अपलोड करीं",
    "Upload a file": "फाइल अपलोड करीं",
    "Upload Medical Record": "मेडिकल रिकॉर्ड अपलोड करीं",
    "Select File": "फाइल चुनीं",
    "Category": "श्रेणी",
    "Description": "विवरण",
    "Upload Document": "दस्तावेज अपलोड करीं",
    "Uploading...": "अपलोड होत बा...",
    "Who can access your documents": "रउआ दस्तावेज केहू देख सकेला",
    "Manage Access": "एक्सेस मैनेज करीं",
    "Revoke": "हटाईं",
    "Patient Timeline": "मरीज टाइमलाइन",
    "Back to Journeys": "यात्रा पर वापस जाईं",
    "Back to Patients": "मरीज सूची पर वापस जाईं",
    "Doctor Queue": "डॉक्टर कतार",
    "Journey": "यात्रा",
    "Timeline": "टाइमलाइन",
    "Queue": "कतार",
    "Voice": "आवाज",
    "Access": "पहुंच",
    "AI Health Insights": "एआई स्वास्थ्य जानकारी",
    "Complete Your Medical Profile": "अपना मेडिकल प्रोफाइल पूरा करीं",
    "To receive personalized AI health insights, please provide:": "व्यक्तिगत एआई स्वास्थ्य जानकारी खातिर कृपया ई जानकारी दीं:",
    "Allergies": "एलर्जी",
    "Chronic conditions": "पुरान बीमारी",
    "Current medications": "अबहीं के दवाई",
    "Complete Profile →": "प्रोफाइल पूरा करीं →",
    "Share Your Journey": "अपन यात्रा साझा करीं",
    "Let loved ones track your visit": "अपन लोग के रउरा विजिट ट्रैक करे दीं",
    "Share a live tracking link so anyone can see your current queue position, wait time, and journey progress — in real time, without needing an account.": "लाइव ट्रैकिंग लिंक साझा करीं, ताकि केहू भी रियल-टाइम में रउरा कतार स्थिति, इंतजार समय आ यात्रा प्रगति देख सके, बिना अकाउंट के।",
    "Live queue position": "लाइव कतार स्थिति",
    "Wait time estimate": "इंतजार समय अनुमान",
    "No login needed": "लॉगिन के जरूरत नइखे",
    "WhatsApp share": "व्हाट्सएप साझा",
    "Share Journey Link": "यात्रा लिंक साझा करीं",
    "Start a journey first to generate a share link": "शेयर लिंक बनावे खातिर पहिले यात्रा शुरू करीं",
    "Dynamic AI voice mode active": "डायनामिक एआई आवाज मोड चालू बा",
    "Voice Assistant": "आवाज सहायक",
    "Understanding...": "समझत बा...",
    "Executing command...": "कमांड चलत बा...",
    "Responding...": "जवाब देत बानी...",
    "Tap to talk": "बोले खातिर टैप करीं",
    "You": "रउरा",
    "Fill details": "विवरण भरीं",
    "Submit form": "फॉर्म सबमिट करीं",
    "Stop listening": "सुने बंद करीं",
    "Go home": "होम खोलीं",
    "Open records": "रिकॉर्ड खोलीं",
    "Open journey": "यात्रा खोलीं",
    "Open emergency": "आपातकाल खोलीं",
    "Open access": "पहुंच खोलीं",
    "Open settings": "सेटिंग खोलीं",
    "Open help": "मदद खोलीं",
    "Go back": "वापस जाईं",
    "Generate personalized health insights": "व्यक्तिगत स्वास्थ्य जानकारी बनाईं",
    "Generate Insights": "जानकारी बनाईं",
    "Generating personalized insights...": "व्यक्तिगत जानकारी बनत बा...",
    "DO's": "ई करीं",
    "DON'Ts": "ई मत करीं",
    "My Records": "हमार रिकॉर्ड",
    "Your health documents — uploaded by you or your doctors.": "रउआ स्वास्थ्य दस्तावेज — रउआ या रउआ डॉक्टर द्वारा अपलोड कइल गइल।",
    "Upload Record": "रिकॉर्ड अपलोड करीं",
    "All": "सभे",
    "Self-uploaded": "खुद से अपलोड",
    "By Doctor": "डॉक्टर द्वारा",
    "No Records Yet": "अभी रिकॉर्ड नइखे",
    "No Self-uploaded Records": "खुद से अपलोड रिकॉर्ड नइखे",
    "No By Doctor Records": "डॉक्टर द्वारा रिकॉर्ड नइखे",
    "Upload your first record or ask your doctor to add one.": "अपना पहिला रिकॉर्ड अपलोड करीं या डॉक्टर से जोड़े खातिर कहीं।",
    "Switch to 'All' to see your other records.": "बाकी रिकॉर्ड देखे खातिर 'सभे' चुनीं।",
    "Uploaded by": "अपलोड कइल गइल",
    "Date": "तारीख",
    "Login successful. Enable quick biometric login (fingerprint/face) for this device?": "लॉगिन सफल। एह डिवाइस पर तेज बायोमेट्रिक लॉगिन (फिंगरप्रिंट/फेस) चालू करीं?",
    "Setting up…": "सेटअप होत बा…",
    "Yes, enable": "हाँ, चालू करीं",
    "No, continue": "नहीं, आगे बढ़ीं",
    "Verifying…": "जांच होत बा…",
    "Sign in with biometrics": "बायोमेट्रिक से साइन इन करीं",
    "Uses the fingerprint or face you set up on this device (stored locally, not on our servers).": "एह डिवाइस पर सेट कइल फिंगरप्रिंट या फेस के इस्तेमाल होला (लोकल में सेव, हमनी के सर्वर पर ना)।",
    "Setup was cancelled or failed. You can try again or continue without biometrics.": "सेटअप रद्द भइल या फेल भइल। रउआ फेर कोशिश कर सकत बानी या बायोमेट्रिक बिना आगे बढ़ सकत बानी।",
    "Setup failed. You can try again or continue without biometrics.": "सेटअप फेल भइल। रउआ फेर कोशिश कर सकत बानी या बायोमेट्रिक बिना आगे बढ़ सकत बानी।",
    "Enter a valid email address.": "मान्य ईमेल पता डालीं।",
    "Enter a valid phone number.": "मान्य फोन नंबर डालीं।",
    "Phone Number": "फोन नंबर",
    "10-digit mobile number": "10 अंकों के मोबाइल नंबर",
    "Microphone is allowed, but speech recognition is blocked by browser policy. Reload and try again.": "माइक्रोफोन चालू बा, बाकिर ब्राउजर नीति से आवाज पहचान रुकल बा। रीलोड क के फेर कोशिश करीं।",
    "Microphone permission is blocked. Please allow mic access in browser settings.": "माइक्रोफोन अनुमति ब्लॉक बा। कृपया ब्राउजर सेटिंग में माइक्रोफोन एक्सेस दीं।",
    "Microphone access was denied. Please allow microphone for this site and try again.": "माइक्रोफोन एक्सेस मना हो गइल। कृपया एह साइट खातिर माइक्रोफोन अनुमति दीं आ फेर कोशिश करीं।",
    "Voice locale fallback active": "आवाज लोकेल फॉलबैक सक्रिय बा",
    "Voice listening was stopped.": "आवाज सुने के काम रोक दिहल गइल बा।",
  },
};

const cache = new Map<string, string>();

const TOKEN_REGEX = /(\{[^{}]+\}|%\w|:[a-zA-Z_][a-zA-Z0-9_]*|\b\d+(?:\.\d+)?\b)/g;

function normalizeRuntimeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function flattenTranslationStrings(
  input: unknown,
  prefix = "",
  out: Record<string, string> = {}
): Record<string, string> {
  if (typeof input === "string") {
    if (prefix) out[prefix] = input;
    return out;
  }
  if (!input || typeof input !== "object") return out;
  Object.entries(input as Record<string, unknown>).forEach(([key, value]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    flattenTranslationStrings(value, nextPrefix, out);
  });
  return out;
}

const AUTO_PHRASES: Record<Language, Record<string, string>> = (() => {
  const enByPath = flattenTranslationStrings(translations.en);
  const out: Record<Language, Record<string, string>> = { en: {}, hi: {}, mr: {}, bh: {} };

  (["hi", "mr", "bh"] as const).forEach((lang) => {
    const targetByPath = flattenTranslationStrings(translations[lang]);
    const map: Record<string, string> = {};
    Object.entries(enByPath).forEach(([path, enValue]) => {
      const target = targetByPath[path];
      if (typeof target === "string" && target !== enValue) {
        map[enValue] = target;
        map[normalizeRuntimeText(enValue)] = target;
      }
    });
    out[lang] = map;
  });

  return out;
})();

function cacheKey(lang: Language, text: string): string {
  return `${lang}::${normalizeRuntimeText(text)}`;
}

export function protectRuntimeTokens(text: string): { masked: string; tokens: string[] } {
  const tokens: string[] = [];
  const masked = text.replace(TOKEN_REGEX, (match) => {
    const idx = tokens.push(match) - 1;
    return `__TOKEN_${idx}__`;
  });
  return { masked, tokens };
}

export function restoreRuntimeTokens(text: string, tokens: string[]): string {
  return text.replace(/__TOKEN_(\d+)__/g, (_, idx) => {
    const value = tokens[Number(idx)];
    return typeof value === "string" ? value : "";
  });
}

export function addToRuntimeCache(language: Language, text: string, translated: string) {
  cache.set(cacheKey(language, text), translated);
}

export function translateRuntimeText(language: Language, text: string): string {
  if (!text || language === "en") return text;

  const normalized = normalizeRuntimeText(text);
  const key = cacheKey(language, normalized);
  const hit = cache.get(key);
  if (hit) return hit;

  const manual = MANUAL_PHRASES[language] || {};
  const auto = AUTO_PHRASES[language] || {};
  const translated = manual[text] || manual[normalized] || auto[text] || auto[normalized] || text;
  cache.set(key, translated);
  return translated;
}
