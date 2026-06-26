/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LanguageCode } from './types';

export interface TranslationSet {
  welcomeTitle: string;
  welcomeSubtitle: string;
  hasAppointmentBtn: string;
  noAppointmentBtn: string;
  taalSelectLabel: string;
  
  // Appt Flow 1 - Screen 2
  personalDetailsTitle: string;
  personalDetailsSub: string;
  firstNameLabel: string;
  lastNameLabel: string;
  birthDateLabel: string;
  registryNumLabel: string;
  idCardLabel: string;
  nextBtn: string;
  backBtn: string;
  returnToStartBtn: string;
  requiredFieldsError: string;
  invalidFormatError: string;

  // Appt Flow 1 - Screen 3
  apptDetailsTitle: string;
  apptDetailsSub: string;
  apptTimeLabel: string;
  apptDoctorLabel: string;
  selectDoctorPlaceholder: string;
  confirmBtn: string;

  // Appt Flow 1 - Screen 4 (Result)
  checkinSuccessTitle: string;
  directionPrefix: string;
  waitingRoomGround: string;
  waitingRoomFirst: string;
  lateWarningText: string;
  teamsNotificationSent: string;
  redirectTimerText: string;

  // Flow 2 (No Appointment) - Screen 2 Choices
  noApptTitle: string;
  noApptSub: string;
  optionPatientInfo: string;
  optionNonPatient: string;

  // Flow 2 - Screen 3 (Patient Info Form)
  patientHelpTitle: string;
  patientHelpSub: string;

  // Flow 2 - Screen 4 (Success Info Screen)
  noApptSuccessTitle: string;
  noApptSuccessMsg: string;
  nonPatientSuccessMsg: string;
  
  // Help
  helpBtnText: string;
}

export const isRtl = (lang: LanguageCode): boolean => lang === 'AR';

export const translations: Record<LanguageCode, TranslationSet> = {
  NL: {
    welcomeTitle: "Welkom bij Huidcentrum Gent",
    welcomeSubtitle: "Gelieve u aan te melden via de kiosk",
    hasAppointmentBtn: "Ik heb een afspraak",
    noAppointmentBtn: "Ik heb geen afspraak",
    taalSelectLabel: "Kies uw taal / Choose language / Choisissez la langue",
    personalDetailsTitle: "Uw Persoonlijke Gegevens",
    personalDetailsSub: "Vul onderstaande gegevens in ter verificatie. Deze gegevens worden veilig verwerkt.",
    firstNameLabel: "Voornaam",
    lastNameLabel: "Achternaam",
    birthDateLabel: "Geboortedatum (DD/MM/JJJJ)",
    registryNumLabel: "Rijksregisternummer",
    idCardLabel: "Identiteitskaartnummer (Optioneel)",
    nextBtn: "Volgende",
    backBtn: "Vorige",
    returnToStartBtn: "Keer terug naar beginscherm",
    requiredFieldsError: "Gelieve alle verplichte velden (*) in te vullen.",
    invalidFormatError: "Ongeldige indeling.",
    apptDetailsTitle: "Tijdstip & Dermatoloog",
    apptDetailsSub: "Voer het geplande tijdstip in en kies uw dermatoloog.",
    apptTimeLabel: "Uur van uw afspraak (bv. 14:30)",
    apptDoctorLabel: "Dermatoloog",
    selectDoctorPlaceholder: "Kies een dermatoloog",
    confirmBtn: "Meld Aan & Bevestig",
    checkinSuccessTitle: "Aanmelding Voltooid!",
    directionPrefix: "Gelieve plaats te nemen in de volgende wachtzaal:",
    waitingRoomGround: "Wachtzaal Gelijkvloers (Begane Grond)",
    waitingRoomFirst: "Wachtzaal Bovenverdieping (1ste Verdieping)",
    lateWarningText: "U bent te laat, een personeelslid komt even met u bekijken of uw afspraak nog kan doorgaan. Eventjes geduld.",
    teamsNotificationSent: "Het artsenteam is op de hoogte gebracht van uw komst.",
    redirectTimerText: "Dit scherm herstart over {seconds} seconden...",
    noApptTitle: "Hoe kunnen we u helpen?",
    noApptSub: "Maak een keuze hieronder om de juiste hulp te ontvangen.",
    optionPatientInfo: "Ik ben een patiënt en wens verdere inlichtingen",
    optionNonPatient: "Ik ben geen patiënt (bv. leverancier / arts / bezoeker)",
    patientHelpTitle: "Uw Contactgegevens",
    patientHelpSub: "Vul uw gegevens in zodat onze ondersteunende medewerkers u gericht kunnen aanspreken.",
    noApptSuccessTitle: "Bericht Verstuurd",
    noApptSuccessMsg: "Er is een bericht verstuurd. Neem even plaats, een medewerker komt u zo spoedig mogelijk helpen.",
    nonPatientSuccessMsg: "U bent aangemeld. Een medewerker is op de hoogte gebracht en helpt u zo direct.",
    helpBtnText: "Hulp nodig? Vraag assistentie."
  },
  EN: {
    welcomeTitle: "Welcome to Huidcentrum Gent",
    welcomeSubtitle: "Please check in using the kiosk terminal",
    hasAppointmentBtn: "I have an appointment",
    noAppointmentBtn: "I do not have an appointment",
    taalSelectLabel: "Choose your language",
    personalDetailsTitle: "Your Personal Details",
    personalDetailsSub: "Please fill in the information below. Your data is processed securely.",
    firstNameLabel: "First Name",
    lastNameLabel: "Last Name",
    birthDateLabel: "Date of Birth (DD/MM/YYYY)",
    registryNumLabel: "National Registry Number",
    idCardLabel: "Identity Card Number (Optional)",
    nextBtn: "Next",
    backBtn: "Back",
    returnToStartBtn: "Return to start screen",
    requiredFieldsError: "Please fill in all required fields (*).",
    invalidFormatError: "Invalid format.",
    apptDetailsTitle: "Appointment Details",
    apptDetailsSub: "Enter your scheduled time and choose your dermatologist.",
    apptTimeLabel: "Appointment Time (e.g. 14:30)",
    apptDoctorLabel: "Dermatologist",
    selectDoctorPlaceholder: "Choose a dermatologist",
    confirmBtn: "Register & Confirm",
    checkinSuccessTitle: "Check-in Successful!",
    directionPrefix: "Please take a seat in the following waiting room:",
    waitingRoomGround: "Waiting Room Ground Floor (Gelijkvloers)",
    waitingRoomFirst: "Waiting Room Upper Floor (First Floor/Boven)",
    lateWarningText: "You are late. A staff member will shortly check with you if your appointment can still proceed. Please be patient.",
    teamsNotificationSent: "The medical staff has been notified of your arrival.",
    redirectTimerText: "This screen restarts in {seconds} seconds...",
    noApptTitle: "How can we help you?",
    noApptSub: "Please select an option below so we can assist you properly.",
    optionPatientInfo: "I am a patient and request further information",
    optionNonPatient: "I am not a patient (e.g. supplier / delegate / visitor)",
    patientHelpTitle: "Your Contact Information",
    patientHelpSub: "Please fill in your details so our supporting staff can assist you directly.",
    noApptSuccessTitle: "Notification Dispatched",
    noApptSuccessMsg: "A message has been sent. Please take a seat, an assistant will come to help you as soon as possible.",
    nonPatientSuccessMsg: "You have been registered. A staff member has been notified and will assist you shortly.",
    helpBtnText: "Need help? Ask for assistance."
  },
  FR: {
    welcomeTitle: "Bienvenue au Huidcentrum Gent",
    welcomeSubtitle: "Veuillez vous enregistrer sur la borne interactive",
    hasAppointmentBtn: "J'ai un rendez-vous",
    noAppointmentBtn: "Je n'ai pas de rendez-vous",
    taalSelectLabel: "Choisissez votre langue",
    personalDetailsTitle: "Vos Données Personnelles",
    personalDetailsSub: "Veuillez remplir les informations ci-dessous. Vos données sont traitées en toute sécurité.",
    firstNameLabel: "Prénom",
    lastNameLabel: "Nom de famille",
    birthDateLabel: "Date de naissance (JJ/MM/AAAA)",
    registryNumLabel: "Numéro de registre national",
    idCardLabel: "Numéro de carte d'identité (Optionnel)",
    nextBtn: "Suivant",
    backBtn: "Retour",
    returnToStartBtn: "Retour à l'écran d'accueil",
    requiredFieldsError: "Veuillez remplir tous les champs obligatoires (*).",
    invalidFormatError: "Format invalide.",
    apptDetailsTitle: "Détails du Rendez-vous",
    apptDetailsSub: "Saisissez l'heure prévue et choisissez votre dermatologue.",
    apptTimeLabel: "Heure du rendez-vous (ex: 14:30)",
    apptDoctorLabel: "Dermatologue",
    selectDoctorPlaceholder: "Choisissez un dermatologue",
    confirmBtn: "S'enregistrer & Confirmer",
    checkinSuccessTitle: "Enregistrement Réussi !",
    directionPrefix: "Veuillez vous installer dans la salle d'attente suivante :",
    waitingRoomGround: "Salle d'attente Rez-de-chaussée (Gelijkvloers)",
    waitingRoomFirst: "Salle d'attente Premier étage (Bovenverdieping)",
    lateWarningText: "Vous êtes en retard. Un membre du personnel viendra voir avec vous si votre rendez-vous peut encore avoir lieu. Veuillez patienter.",
    teamsNotificationSent: "L'équipe médicale a été informée de votre arrivée.",
    redirectTimerText: "Cet écran retournera à l'accueil dans {seconds} secondes...",
    noApptTitle: "Comment pouvons-nous vous aider ?",
    noApptSub: "Sélectionnez une option ci-dessous afin que nous puissions vous diriger.",
    optionPatientInfo: "Je suis un patient et souhaite des informations complémentaires",
    optionNonPatient: "Je ne suis pas patient (ex: fournisseur / représentant / visiteur)",
    patientHelpTitle: "Vos Coordonnées",
    patientHelpSub: "Veuillez remplir vos coordonnées afin qu'un membre du personnel puisse vous assister.",
    noApptSuccessTitle: "Message Envoyé",
    noApptSuccessMsg: "Un message a été envoyé. Veuillez vous installer, un collaborateur viendra vous aider au plus vite.",
    nonPatientSuccessMsg: "Vous êtes enregistré. Un collaborateur a été prévenu et sera là sous peu.",
    helpBtnText: "Besoin d'aide ? Demandez de l'aide."
  },
  TR: {
    welcomeTitle: "Huidcentrum Gent'e Hoş Geldiniz",
    welcomeSubtitle: "Lütfen kiosk'u kullanarak kaydolun",
    hasAppointmentBtn: "Randevum var",
    noAppointmentBtn: "Randevum yok",
    taalSelectLabel: "Dil seçiniz",
    personalDetailsTitle: "Kişisel Bilgileriniz",
    personalDetailsSub: "Lütfen aşağıdaki bilgileri doldurun. Verileriniz güvenle işlenmektedir.",
    firstNameLabel: "Adı",
    lastNameLabel: "Soyadı",
    birthDateLabel: "Doğum Tarihi (GG/AA/YYYY)",
    registryNumLabel: "Ulusal Kayıt Numarası",
    idCardLabel: "Kimlik Kartı Numarası (İsteğe Bağlı)",
    nextBtn: "İleri",
    backBtn: "Geri",
    returnToStartBtn: "Başlangıç ekranına dön",
    requiredFieldsError: "Lütfen tüm zorunlu alanları (*) doldurun.",
    invalidFormatError: "Geçersiz biçim.",
    apptDetailsTitle: "Randevu Detayları",
    apptDetailsSub: "Randevu saatinizi girin ve dermatoloğunuzu seçin.",
    apptTimeLabel: "Randevu Saati (örn. 14:30)",
    apptDoctorLabel: "Dermatolog",
    selectDoctorPlaceholder: "Bir doktor seçin",
    confirmBtn: "Kaydı Tamamla & Onayla",
    checkinSuccessTitle: "Kayıt Başarılı!",
    directionPrefix: "Lütfen aşağıdaki bekleme odasında yerinizi alın:",
    waitingRoomGround: "Giriş Kat Bekleme Salonu (Gelijkvloers)",
    waitingRoomFirst: "Üst Kat Bekleme Salonu (First Floor/Boven)",
    lateWarningText: "Geç kaldınız. Bir personel randevunuzun devam edip edemeyeceğini görüşmek üzere birazdan yanınıza gelecektir. Lütfen bekleyin.",
    teamsNotificationSent: "Doktorunuza varışınızla ilgili bildirim gönderildi.",
    redirectTimerText: "Bu ekran {seconds} saniye içinde ana ekrana dönecektir...",
    noApptTitle: "Size nasıl yardımcı olabiliriz?",
    noApptSub: "Doğru yardımı alabilmek için lütfen aşağıdaki seçeneklerden birini belirleyin.",
    optionPatientInfo: "Hastayım ve detaylı bilgi almak istiyorum",
    optionNonPatient: "Hasta değilim (örn. tıbbi mümessil / kargo / ziyaretçi)",
    patientHelpTitle: "İletişim Bilgileriniz",
    patientHelpSub: "Personelimizin size doğrudan ulaşabilmesi için bilgilerinizi girin.",
    noApptSuccessTitle: "Mesaj Gönderildi",
    noApptSuccessMsg: "Bir mesaj gönderildi. Lütfen yerinizi alın, bir çalışanımız en kısa sürede size yardımcı olacaktır.",
    nonPatientSuccessMsg: "Kaydınız alındı. Personelimiz bilgilendirildi ve birazdan size yardımcı olacaktır.",
    helpBtnText: "Yardıma mı ihtiyacınız var? Destek isteyin."
  },
  AR: {
    welcomeTitle: "مرحباً بكم في Huidcentrum Gent",
    welcomeSubtitle: "يرجى تسجيل الوصول باستخدام جهاز الخدمة الذاتية",
    hasAppointmentBtn: "لدي موعد مسبق",
    noAppointmentBtn: "ليس لدي موعد",
    taalSelectLabel: "اختر اللغة",
    personalDetailsTitle: "بياناتك الشخصية",
    personalDetailsSub: "يرجى تعبئة البيانات أدناه للتحقق. يتم معالجة بياناتك بأمان وسرية.",
    firstNameLabel: "الاسم الأول",
    lastNameLabel: "اسم العائلة",
    birthDateLabel: "تاريخ الميلاد (يوم/شهر/سنة)",
    registryNumLabel: "الرقم السجل الوطني",
    idCardLabel: "رقم بطاقة الهوية (اختياري)",
    nextBtn: "التالي",
    backBtn: "السابق",
    returnToStartBtn: "العودة إلى شاشة البداية",
    requiredFieldsError: "يرجى تعبئة جميع الحقول المطلوبة (*).",
    invalidFormatError: "صيغة غير صالحة.",
    apptDetailsTitle: "تفاصيل الموعد",
    apptDetailsSub: "أدخل وقت موعدك المحدد واختر طبيب الجلدية الخاص بك.",
    apptTimeLabel: "وقت الموعد (مثال 14:30)",
    apptDoctorLabel: "طبيب الجلدية",
    selectDoctorPlaceholder: "اختر طبيب الجلدية",
    confirmBtn: "تسجيل وتأكيد",
    checkinSuccessTitle: "تم تسجيل الدخول بنجاح!",
    directionPrefix: "يرجى التفضّل بالجلوس في قاعة الانتظار التالية:",
    waitingRoomGround: "قاعة انتظار الطابق الأرضي (Gelijkvloers)",
    waitingRoomFirst: "قاعة انتظار الطابق العلوي (Bovenverdieping)",
    lateWarningText: "لقد تأخرت. سيناقش معك أحد الموظفين قريباً ما إذا كان موعدك لا يزال ممكناً. يرجى الانتظار قليلاً.",
    teamsNotificationSent: "تم إخطار الفريق الطبي والأخصائيين بوصولك وفوراً.",
    redirectTimerText: "ستعود هذه الشاشة إلى البداية خلال {seconds} ثوانٍ...",
    noApptTitle: "كيف يمكننا مساعدتك؟",
    noApptSub: "يرجى اختيار أحد الخيارات أدناه لتوجيهك بشكل صحيح.",
    optionPatientInfo: "أنا مريض وأرغب في الحصول على مزيد من المعلومات",
    optionNonPatient: "لست مريضاً (مثال: مندوب / مورد / زائر)",
    patientHelpTitle: "معلومات الاتصال الخاصة بك",
    patientHelpSub: "يرجى إدخال بياناتك حتى يتمكن موظفونا من مساعدتك والتواصل معك.",
    noApptSuccessTitle: "تم إرسال الإشعار",
    noApptSuccessMsg: "تم إرسال رسالة للموظفين. يرجى أخذ قسط من الراحة، وسيقوم الموظف بمساعدتك في أقرب وقت ممكن.",
    nonPatientSuccessMsg: "تم تسجيل حضورك. تم إرسال إشعار للموظف المسؤول وسيتواصل معك قريباً.",
    helpBtnText: "هل تحتاج مساعدة؟ اطلب المساعدة."
  }
};
