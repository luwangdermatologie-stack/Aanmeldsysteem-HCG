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
  
  // Appt Flow 1 - Screen 1 (Patient Type Selection)
  patientTypeTitle: string;
  patientTypeSub: string;
  knownPatientOption: string;
  knownPatientSub: string;
  newPatientOption: string;
  newPatientSub: string;
  knownPatientNotice: string;

  // Appt Flow 1 - Screen 2
  personalDetailsTitle: string;
  personalDetailsSub: string;
  firstNameLabel: string;
  lastNameLabel: string;
  birthDateLabel: string;
  registryNumLabel: string;
  idCardLabel: string;
  nonBelgianNationalityCheckbox: string;
  nonBelgianNationalityHint: string;
  unknownIdCheckbox: string;
  unknownIdHint: string;
  requiredIdCardError: string;
  nextBtn: string;
  backBtn: string;
  returnToStartBtn: string;
  requiredFieldsError: string;
  invalidFormatError: string;
  invalidRegistryNumError: string;
  invalidBirthDateError: string;

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
  helpScreenTitle: string;
  helpScreenSub: string;
  helpNameLabel: string;
  helpDescriptionLabel: string;
  helpDescriptionPlaceholder: string;
  helpSubmitBtn: string;
  helpCancelBtn: string;
  helpSuccessTitle: string;
  helpSuccessMsg: string;
}

export const isRtl = (lang: LanguageCode): boolean => lang === 'AR';

export const translations: Record<LanguageCode, TranslationSet> = {
  NL: {
    welcomeTitle: "Welkom bij Huidcentrum Gent",
    welcomeSubtitle: "Gelieve u aan te melden via de kiosk",
    hasAppointmentBtn: "Ik heb een afspraak",
    noAppointmentBtn: "Ik heb geen afspraak",
    taalSelectLabel: "Kies uw taal / Choose language / Choisissez la langue",
    patientTypeTitle: "Nieuwe of gekende patiënt?",
    patientTypeSub: "Bent u al eerder op consultatie geweest in Huidcentrum Gent?",
    knownPatientOption: "Gekende patiënt",
    knownPatientSub: "Ik ben al eerder in de praktijk geweest (enkel naam en geboortedatum vereist)",
    newPatientOption: "Nieuwe patiënt",
    newPatientSub: "Dit is mijn eerste bezoek aan de praktijk (volledige aanmelding)",
    knownPatientNotice: "Gekende patiënt: vul enkel uw naam en geboortedatum in ter verificatie.",
    personalDetailsTitle: "Uw Persoonlijke Gegevens",
    personalDetailsSub: "Vul onderstaande gegevens in ter verificatie. Deze gegevens worden veilig verwerkt.",
    firstNameLabel: "Voornaam",
    lastNameLabel: "Achternaam",
    birthDateLabel: "Geboortedatum (DD/MM/JJJJ)",
    registryNumLabel: "Rijksregisternummer",
    idCardLabel: "Identiteitskaartnummer",
    nonBelgianNationalityCheckbox: "Ik heb geen Belgische nationaliteit / Buitenlandse patiënt",
    nonBelgianNationalityHint: "Rijksregisternummer en identiteitskaartnummer zijn dan niet verplicht.",
    unknownIdCheckbox: "Ik weet mijn rijksregisternummer en/of identiteitskaartnummer niet",
    unknownIdHint: "Rijksregisternummer en identiteitskaartnummer worden dan optioneel.",
    requiredIdCardError: "Gelieve uw identiteitskaartnummer in te vullen.",
    nextBtn: "Volgende",
    backBtn: "Vorige",
    returnToStartBtn: "Keer terug naar beginscherm",
    requiredFieldsError: "Gelieve alle verplichte velden (*) in te vullen.",
    invalidFormatError: "Ongeldige indeling.",
    invalidRegistryNumError: "Het rijksregisternummer moet 11 cijfers bevatten (bv. 85.08.14-123.45).",
    invalidBirthDateError: "Ongeldige geboortedatum. Gebruik het formaat DD/MM/JJJJ.",
    apptDetailsTitle: "Tijdstip & reden van bezoek",
    apptDetailsSub: "Voer het geplande tijdstip in en kies de reden van bezoek.",
    apptTimeLabel: "Uur van uw afspraak (bv. 14:30)",
    apptDoctorLabel: "Reden van bezoek",
    selectDoctorPlaceholder: "Selecteer de reden van bezoek...",
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
    helpBtnText: "Hulp nodig? Vraag assistentie.",
    helpScreenTitle: "Hulp of Assistentie Nodig?",
    helpScreenSub: "Vul uw naam in en beschrijf kort waarmee we u kunnen helpen.",
    helpNameLabel: "Uw Naam",
    helpDescriptionLabel: "Korte beschrijving van uw probleem of vraag",
    helpDescriptionPlaceholder: "bijv. Ik kan mijn afspraak niet vinden of het scherm reageert niet goed...",
    helpSubmitBtn: "Hulp vragen",
    helpCancelBtn: "Keer terug",
    helpSuccessTitle: "Hulpverzoek Verzonden",
    helpSuccessMsg: "Uw hulpvraag is ontvangen. Een medewerker komt u zo spoedig mogelijk assisteren bij de kiosk."
  },
  EN: {
    welcomeTitle: "Welcome to Huidcentrum Gent",
    welcomeSubtitle: "Please check in using the kiosk terminal",
    hasAppointmentBtn: "I have an appointment",
    noAppointmentBtn: "I do not have an appointment",
    taalSelectLabel: "Choose your language",
    patientTypeTitle: "New or existing patient?",
    patientTypeSub: "Have you visited Huidcentrum Gent before?",
    knownPatientOption: "Existing patient",
    knownPatientSub: "I have visited the clinic before (only name and date of birth required)",
    newPatientOption: "New patient",
    newPatientSub: "First visit to the clinic (full registration)",
    knownPatientNotice: "Existing patient: only enter your name and date of birth for verification.",
    personalDetailsTitle: "Your Personal Details",
    personalDetailsSub: "Please fill in the information below. Your data is processed securely.",
    firstNameLabel: "First Name",
    lastNameLabel: "Last Name",
    birthDateLabel: "Date of Birth (DD/MM/YYYY)",
    registryNumLabel: "National Registry Number",
    idCardLabel: "Identity Card Number",
    nonBelgianNationalityCheckbox: "I do not have Belgian nationality / Foreign patient",
    nonBelgianNationalityHint: "National registry and ID card numbers are not required in this case.",
    unknownIdCheckbox: "I do not know my national registry number and/or ID card number",
    unknownIdHint: "National registry and ID card numbers will be optional.",
    requiredIdCardError: "Please enter your identity card number.",
    nextBtn: "Next",
    backBtn: "Back",
    returnToStartBtn: "Return to start screen",
    requiredFieldsError: "Please fill in all required fields (*).",
    invalidFormatError: "Invalid format.",
    invalidRegistryNumError: "The national registry number must contain 11 digits (e.g. 85.08.14-123.45).",
    invalidBirthDateError: "Invalid date of birth. Please use the format DD/MM/YYYY.",
    apptDetailsTitle: "Time & reason for visit",
    apptDetailsSub: "Enter your scheduled time and select the reason for your visit.",
    apptTimeLabel: "Appointment Time (e.g. 14:30)",
    apptDoctorLabel: "Reason for visit",
    selectDoctorPlaceholder: "Select reason for visit...",
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
    helpBtnText: "Need help? Ask for assistance.",
    helpScreenTitle: "Need Help or Assistance?",
    helpScreenSub: "Please enter your name and briefly describe what you need assistance with.",
    helpNameLabel: "Your Name",
    helpDescriptionLabel: "Brief description of your issue or question",
    helpDescriptionPlaceholder: "e.g. Cannot find my appointment or screen is unresponsive...",
    helpSubmitBtn: "Request help",
    helpCancelBtn: "Go back",
    helpSuccessTitle: "Help Request Dispatched",
    helpSuccessMsg: "Your request for help has been sent. A staff member will come to assist you at the kiosk shortly."
  },
  FR: {
    welcomeTitle: "Bienvenue au Huidcentrum Gent",
    welcomeSubtitle: "Veuillez vous enregistrer sur la borne interactive",
    hasAppointmentBtn: "J'ai un rendez-vous",
    noAppointmentBtn: "Je n'ai pas de rendez-vous",
    taalSelectLabel: "Choisissez votre langue",
    patientTypeTitle: "Nouveau ou patient existant ?",
    patientTypeSub: "Avez-vous déjà consulté au Huidcentrum Gent ?",
    knownPatientOption: "Patient existant",
    knownPatientSub: "Je suis déjà venu au cabinet (seuls le nom et la date de naissance sont requis)",
    newPatientOption: "Nouveau patient",
    newPatientSub: "Première visite au cabinet (inscription complète)",
    knownPatientNotice: "Patient existant : entrez uniquement votre nom et date de naissance.",
    personalDetailsTitle: "Vos Données Personnelles",
    personalDetailsSub: "Veuillez remplir les informations ci-dessous. Vos données sont traitées en toute sécurité.",
    firstNameLabel: "Prénom",
    lastNameLabel: "Nom de famille",
    birthDateLabel: "Date de naissance (JJ/MM/AAAA)",
    registryNumLabel: "Numéro de registre national",
    idCardLabel: "Numéro de carte d'identité",
    nonBelgianNationalityCheckbox: "Je n'ai pas la nationalité belge / Patient étranger",
    nonBelgianNationalityHint: "Le numéro de registre national et la carte d'identité ne sont alors pas requis.",
    unknownIdCheckbox: "Je ne connais pas mon numéro de registre national et/ou de carte d'identité",
    unknownIdHint: "Le numéro de registre national et la carte d'identité deviennent facultatifs.",
    requiredIdCardError: "Veuillez renseigner votre numéro de carte d'identité.",
    nextBtn: "Suivant",
    backBtn: "Retour",
    returnToStartBtn: "Retour à l'écran d'accueil",
    requiredFieldsError: "Veuillez remplir tous les champs obligatoires (*).",
    invalidFormatError: "Format invalide.",
    invalidRegistryNumError: "Le numéro de registre national doit comporter 11 chiffres (ex. 85.08.14-123.45).",
    invalidBirthDateError: "Date de naissance invalide. Veuillez utiliser le format JJ/MM/AAAA.",
    apptDetailsTitle: "Heure & motif de consultation",
    apptDetailsSub: "Indiquez l'heure prévue et choisissez le motif de votre visite.",
    apptTimeLabel: "Heure du rendez-vous (ex: 14:30)",
    apptDoctorLabel: "Motif de la visite",
    selectDoctorPlaceholder: "Sélectionnez le motif...",
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
    helpBtnText: "Besoin d'aide ? Demandez de l'aide.",
    helpScreenTitle: "Besoin d'aide ou d'assistance ?",
    helpScreenSub: "Veuillez entrer votre nom et décrire brièvement votre demande.",
    helpNameLabel: "Votre Nom",
    helpDescriptionLabel: "Courte description de votre problème ou question",
    helpDescriptionPlaceholder: "ex. Impossible de trouver mon rendez-vous, écran non réactif...",
    helpSubmitBtn: "Demander de l'aide",
    helpCancelBtn: "Retourner",
    helpSuccessTitle: "Demande d'aide envoyée",
    helpSuccessMsg: "Votre demande d'assistance a été transmise. Un collaborateur arrive vers la borne pour vous assister."
  },
  TR: {
    welcomeTitle: "Huidcentrum Gent'e Hoş Geldiniz",
    welcomeSubtitle: "Lütfen kiosk'u kullanarak kaydolun",
    hasAppointmentBtn: "Randevum var",
    noAppointmentBtn: "Randevum yok",
    taalSelectLabel: "Dil seçiniz",
    patientTypeTitle: "Yeni veya kayıtlı hasta mı?",
    patientTypeSub: "Daha önce Huidcentrum Gent'e geldiniz mi?",
    knownPatientOption: "Kayıtlı hasta",
    knownPatientSub: "Daha önce kliniğe geldim (sadece isim ve doğum tarihi gereklidir)",
    newPatientOption: "Yeni hasta",
    newPatientSub: "Kliniğe ilk gelişim (tam kayıt)",
    knownPatientNotice: "Kayıtlı hasta: doğrulama için sadece adınızı ve doğum tarihinizi girin.",
    personalDetailsTitle: "Kişisel Bilgileriniz",
    personalDetailsSub: "Lütfen aşağıdaki bilgileri doldurun. Verileriniz güvenle işlenmektedir.",
    firstNameLabel: "Adı",
    lastNameLabel: "Soyadı",
    birthDateLabel: "Doğum Tarihi (GG/AA/YYYY)",
    registryNumLabel: "Ulusal Kayıt Numarası",
    idCardLabel: "Kimlik Kartı Numarası",
    nonBelgianNationalityCheckbox: "Belçika vatandaşı değilim / Yabancı hasta",
    nonBelgianNationalityHint: "Ulusal kayıt ve kimlik kartı numarası zorunlu değildir.",
    unknownIdCheckbox: "Ulusal sicil numaramı ve/veya kimlik kartı numaramı bilmiyorum",
    unknownIdHint: "Ulusal sicil numarası ve kimlik kartı numarası isteğe bağlı hale gelir.",
    requiredIdCardError: "Lütfen kimlik kartı numaranızı girin.",
    nextBtn: "İleri",
    backBtn: "Geri",
    returnToStartBtn: "Başlangıç ekranına dön",
    requiredFieldsError: "Lütfen tüm zorunlu alanları (*) doldurun.",
    invalidFormatError: "Geçersiz biçim.",
    invalidRegistryNumError: "Ulusal kayıt numarası 11 haneli olmalıdır (örn. 85.08.14-123.45).",
    invalidBirthDateError: "Geçersiz doğum tarihi. Lütfen GG/AA/YYYY biçimini kullanın.",
    apptDetailsTitle: "Saat & ziyaret nedeni",
    apptDetailsSub: "Planlanan saati girin ve ziyaret nedeninizi seçin.",
    apptTimeLabel: "Randevu Saati (örn. 14:30)",
    apptDoctorLabel: "Ziyaret nedeni",
    selectDoctorPlaceholder: "Ziyaret nedenini seçin...",
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
    helpBtnText: "Yardıma mı ihtiyacınız var? Destek isteyin.",
    helpScreenTitle: "Yardım veya Destek mi Lazım?",
    helpScreenSub: "Lütfen adınızı yazın ve sorununuzu kısaca belirtin.",
    helpNameLabel: "Adınız Soyadınız",
    helpDescriptionLabel: "Sorununuzun veya sorunuzun kısa açıklaması",
    helpDescriptionPlaceholder: "örn. Randevumu bulamadım veya ekran yanıt vermiyor...",
    helpSubmitBtn: "Yardım iste",
    helpCancelBtn: "Geri dön",
    helpSuccessTitle: "Yardım Talebi İletildi",
    helpSuccessMsg: "Yardım talebiniz alındı. Personelimiz birazdan kioskun yanına gelecektir."
  },
  AR: {
    welcomeTitle: "مرحباً بكم في Huidcentrum Gent",
    welcomeSubtitle: "يرجى تسجيل الوصول باستخدام جهاز الخدمة الذاتية",
    hasAppointmentBtn: "لدي موعد مسبق",
    noAppointmentBtn: "ليس لدي موعد",
    taalSelectLabel: "اختر اللغة",
    patientTypeTitle: "مريض جديد أم مسجل سابقاً؟",
    patientTypeSub: "هل زرت مركز غنت للجلدية من قبل؟",
    knownPatientOption: "مريض مسجل سابقاً",
    knownPatientSub: "زرت العيادة من قبل (الاسم وتاريخ الميلاد فقط مطلوبان)",
    newPatientOption: "مريض جديد",
    newPatientSub: "زيارتي الأولى للعيادة (تسجيل كامل)",
    knownPatientNotice: "مريض سابق: يرجى إدخال الاسم وتاريخ الميلاد فقط للتحقق.",
    personalDetailsTitle: "بياناتك الشخصية",
    personalDetailsSub: "يرجى تعبئة البيانات أدناه للتحقق. يتم معالجة بياناتك بأمان وسرية.",
    firstNameLabel: "الاسم الأول",
    lastNameLabel: "اسم العائلة",
    birthDateLabel: "تاريخ الميلاد (يوم/شهر/سنة)",
    registryNumLabel: "الرقم السجل الوطني",
    idCardLabel: "رقم بطاقة الهوية",
    nonBelgianNationalityCheckbox: "لا أحمل الجنسية البلجيكية / مريض أجنبي",
    nonBelgianNationalityHint: "الرقم السجل الوطني وبطاقة الهوية غير إلزامية في هذه الحالة.",
    unknownIdCheckbox: "لا أعرف رقم السجل الوطني و/أو رقم بطاقة الهوية",
    unknownIdHint: "يصبح رقم السجل الوطني ورقم بطاقة الهوية اختياريين.",
    requiredIdCardError: "يرجى إدخال رقم بطاقة الهوية.",
    nextBtn: "التالي",
    backBtn: "السابق",
    returnToStartBtn: "العودة إلى شاشة البداية",
    requiredFieldsError: "يرجى تعبئة جميع الحقول المطلوبة (*).",
    invalidFormatError: "صيغة غير صالحة.",
    invalidRegistryNumError: "يجب أن يتكون الرقم الوطني من 11 رقماً (مثال 85.08.14-123.45).",
    invalidBirthDateError: "تاريخ ميلاد غير صالح. يرجى استخدام الصيغة يوم/شهر/سنة.",
    apptDetailsTitle: "الوقت وسبب الزيارة",
    apptDetailsSub: "أدخل وقت موعدك المحدد وحدد سبب الزيارة.",
    apptTimeLabel: "وقت الموعد (مثال 14:30)",
    apptDoctorLabel: "سبب الزيارة",
    selectDoctorPlaceholder: "حدد سبب الزيارة...",
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
    helpBtnText: "هل تحتاج مساعدة؟ اطلب المساعدة.",
    helpScreenTitle: "هل تحتاج إلى مساعدة؟",
    helpScreenSub: "يرجى إدخال اسمك ووصف مشكلتك باختصار.",
    helpNameLabel: "الاسم",
    helpDescriptionLabel: "وصف موجز للمشكلة أو السؤال",
    helpDescriptionPlaceholder: "مثال: لا أجد موعدي أو الشاشة لا تستجيب...",
    helpSubmitBtn: "طلب المساعدة",
    helpCancelBtn: "الرجوع",
    helpSuccessTitle: "تم إرسال طلب المساعدة",
    helpSuccessMsg: "تم استلام طلب المساعدة وسيقوم أحد الموظفين بمساعدتك عند الجهاز فوراً."
  }
};
