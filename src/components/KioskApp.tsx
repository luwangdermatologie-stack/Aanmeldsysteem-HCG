/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { translations, isRtl } from '../translations';
import { LanguageCode, Doctor, Patient } from '../types';
import { 
  CheckCircle, 
  AlertTriangle, 
  ChevronRight, 
  ChevronLeft, 
  Calendar, 
  User, 
  Info, 
  Clock, 
  ShieldCheck, 
  Globe2 
} from 'lucide-react';

interface KioskAppProps {
  doctors: Doctor[];
  onPatientRegister: (patient: Omit<Patient, 'id' | 'arrivalTime' | 'arrivalDate' | 'waitingRoom' | 'status'>) => void;
  onTeamsNotify: (message: string, target?: string, payload?: any) => void;
  isFullscreen?: boolean;
}

// In-app gentle synthesizer sound for touch feedback (Acoustic feedback removed as requested)
const playTone = (type: 'tap' | 'success' | 'warn') => {
  // Removed
};

export default function KioskApp({ doctors, onPatientRegister, onTeamsNotify, isFullscreen = false }: KioskAppProps) {
  const [lang, setLang] = useState<LanguageCode>('NL');
  const [currentScreen, setCurrentScreen] = useState<'home' | 'f1_details' | 'f1_appointment' | 'f1_success' | 'f2_choice' | 'f2_patient_form' | 'f2_success' | 'help_success'>('home');
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [currentTimeStr, setCurrentTimeStr] = useState('');

  const [helpCooldown, setHelpCooldown] = useState(false);

  // Form Fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [nationalRegNum, setNationalRegNum] = useState('');
  const [idCardNum, setIdCardNum] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');

  // Validation/Error feedback
  const [formError, setFormError] = useState('');

  // Redirect Timer
  const [countdown, setCountdown] = useState(10);
  const [isPatientLate, setIsPatientLate] = useState(false);
  const [resolvedRoom, setResolvedRoom] = useState<'Gelijkvloers' | 'Bovenverdieping'>('Gelijkvloers');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const t = translations[lang];

  // Keep live time updated
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeStr(now.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle countdown timers for success screens
  useEffect(() => {
    if (currentScreen === 'f1_success' || currentScreen === 'f2_success' || currentScreen === 'help_success') {
      const targetSec = 30;
      setCountdown(targetSec);
      
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            handleResetToHome();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentScreen]);

  const handleHelpClick = () => {
    if (helpCooldown) return;
    playTone('tap');
    
    onTeamsNotify(
      "🆘 **NOODOPROEP / HELP**: Er is hulp gevraagd aan de kiosk door een bezoeker!", 
      undefined, 
      { 
        type: "Emergency Help / Assistentie Nodig", 
        tijdstip: currentTimeStr,
        bron: "Kiosk Voorpagina"
      }
    );
    
    setHelpCooldown(true);
    setCurrentScreen('help_success');
    
    setTimeout(() => {
      setHelpCooldown(false);
    }, 15000); // 15s cooldown independent of screen state
  };

  const handleResetToHome = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setFirstName('');
    setLastName('');
    setBirthDate('');
    setNationalRegNum('');
    setIdCardNum('');
    setAppointmentTime('');
    setSelectedDoctorId('');
    setFormError('');
    setIsPatientLate(false);
    setCurrentScreen('home');
    setLangMenuOpen(false);
    setLang('NL');
  };

  const handleLanguageSelect = (code: LanguageCode) => {
    playTone('tap');
    setLang(code);
    setLangMenuOpen(false);
  };

  // Screen 1: Choose Flow
  const startFlow1 = () => {
    playTone('tap');
    setCurrentScreen('f1_details');
  };

  const startFlow2 = () => {
    playTone('tap');
    setCurrentScreen('f2_choice');
  };

  // Flow 1 - Screen 2 Submitting details
  const submitF1Details = (e: React.FormEvent) => {
    e.preventDefault();
    playTone('tap');
    if (!firstName.trim() || !lastName.trim() || !birthDate.trim() || !nationalRegNum.trim()) {
      playTone('warn');
      setFormError(t.requiredFieldsError);
      return;
    }
    setFormError('');
    setCurrentScreen('f1_appointment');
  };

  // Compare entered time with current time to see if late (with a clinical grace period of 5 minutes)
  const checkIsLate = (enteredTime: string): boolean => {
    if (!enteredTime) return false;
    const now = new Date();
    const [entHours, entMins] = enteredTime.split(':').map(Number);
    if (isNaN(entHours) || isNaN(entMins)) return false;
    
    // Set a clear comparison: compare hour and minute of today only!
    const currentMinutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
    const enteredMinutesSinceMidnight = entHours * 60 + entMins;

    // A patient is only humanly/clinically late if they arrive MORE THAN 5 minutes after their appointment time.
    // This 5-minute grace period prevents false webhook triggers for patients checking in "on-time" or within a normal window.
    const gracePeriodMinutes = 5;
    return currentMinutesSinceMidnight > (enteredMinutesSinceMidnight + gracePeriodMinutes);
  };

  // Flow 1 - Screen 3 Register appointment
  const handleConfirmF1Appointment = (e: React.FormEvent) => {
    e.preventDefault();
    playTone('tap');
    if (!appointmentTime.trim() || !selectedDoctorId) {
      playTone('warn');
      setFormError(t.requiredFieldsError);
      return;
    }

    const doctor = doctors.find(d => d.id === selectedDoctorId);
    if (!doctor) {
      playTone('warn');
      setFormError("Geselecteerde arts is niet beschikbaar.");
      return;
    }

    setFormError('');
    const late = checkIsLate(appointmentTime);
    setIsPatientLate(late);
    setResolvedRoom(doctor.waitingRoom);

    if (late) {
      playTone('warn');
    } else {
      playTone('success');
    }

    // Register Patient
    onPatientRegister({
      firstName,
      lastName,
      birthDate,
      nationalRegistryNum: nationalRegNum,
      idCardNum,
      appointmentTime,
      doctorId: doctor.id,
      doctorName: doctor.name,
      hasAppointment: true,
      flowType: 'appointment'
    });

    // Inderdaad sturen we enkel een melding als de patiënt te laat is
    if (late) {
      const teamsMessage = `⚠️ **Patiënt is te laat**: ${firstName} ${lastName} is zojuist aangemeld voor de afspraak van **${appointmentTime}** bij **${doctor.name}** (Status: <strong style="color:#d50000; font-size:15px; font-weight:bold;">⚠️ TE LAAT</strong>).`;
      onTeamsNotify(teamsMessage, doctor.name, {
        Naam: `${firstName} ${lastName}`,
        Dokter: doctor.name,
        Type: "Te late patiënt",
        Tijdstip: appointmentTime,
        Geboortedatum: birthDate,
        "Rijksregisternummer": nationalRegNum,
        "Status": "⚠️ TE LAAT (ROOD/VET/OPVALLEND)",
        "Wachtzaal": doctor.waitingRoom === 'Gelijkvloers' ? 'Gelijkvloers (G)' : 'Bovenverdieping (B)'
      });
    }

    setCurrentScreen('f1_success');
  };

  // Flow 2 (No appointment) - Step 2 Choice "Patient info" vs "Non-patient"
  const selectF2Choice = (choice: 'patient_info' | 'non_patient') => {
    playTone('tap');
    if (choice === 'patient_info') {
      setCurrentScreen('f2_patient_form');
    } else {
      // Direct success screen for non-patients (skip name entry screen)
      playTone('success');
      
      onPatientRegister({
        firstName: 'Bezoeker/Leverancier',
        lastName: '-',
        birthDate: '-',
        nationalRegistryNum: '-',
        idCardNum: '',
        appointmentTime: undefined,
        doctorId: undefined,
        doctorName: undefined,
        hasAppointment: false,
        flowType: 'non_patient'
      });

      // Send Simulated Teams notification to active support staff member
      const message = `👥 **Kiosk Balie Activiteit**: Er heeft zich zojuist een **niet-patiënt** (bv. leverancier / vertegenwoordiger) aangemeld bij de baliekiosk. Gelieve naar de receptie te gaan.`;
      onTeamsNotify(message, 'Ondersteunende Medewerker', {
        type: 'non_patient',
        time: new Date().toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })
      });

      setCurrentScreen('f2_success');
    }
  };

  // Flow 2 - Screen 3 Patient info submission
  const submitF2PatientForm = (e: React.FormEvent) => {
    e.preventDefault();
    playTone('tap');
    if (!firstName.trim() || !lastName.trim() || !nationalRegNum.trim()) {
      playTone('warn');
      setFormError(t.requiredFieldsError);
      return;
    }

    playTone('success');

    // Register Patient info
    onPatientRegister({
      firstName,
      lastName,
      birthDate: '-',
      nationalRegistryNum: nationalRegNum,
      idCardNum: '',
      appointmentTime: undefined,
      doctorId: undefined,
      doctorName: undefined,
      hasAppointment: false,
      flowType: 'patient_info'
    });

    // Send Simulated Teams notification to active support staff member
    const message = `👤 **Aanvraag Baliehulp**: Patiënt zonder afspraak **${firstName} ${lastName}** (Rijksregisternr: ${nationalRegNum}) vraagt om verdere inlichtingen bij de ontvangstkiosk. Gelieve deze persoon te assisteren.`;
    onTeamsNotify(message, 'Ondersteunende Medewerker', {
      type: 'patient_info',
      patientName: `${firstName} ${lastName}`,
      nationalRegistryNum: nationalRegNum,
      time: new Date().toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })
    });

    setCurrentScreen('f2_success');
  };

  const isCurrentRtl = isRtl(lang);

  return (
    <div 
      className={`relative flex flex-col justify-between bg-bg-medical text-text-main shadow-inner select-none ${isFullscreen ? 'p-6' : 'w-full h-[490px] rounded-2xl p-6 overflow-hidden'}`}
      style={isFullscreen ? { 
        transform: 'scale(1.5)',
        transformOrigin: 'top left',
        width: '66.6667vw',
        height: '66.6667vh',
        position: 'absolute',
        top: 0,
        left: 0
      } : undefined}
      dir={isCurrentRtl ? 'rtl' : 'ltr'}
    >
      {/* High-End Clinic Brand Header Decorator */}
      <div className="flex justify-between items-center border-b border-border-soft pb-3 mb-2">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-button-active animate-pulse"></div>
          <span className="font-sans font-semibold tracking-wider text-text-sub text-sm sm:text-base">
            Huidcentrum Gent
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono text-text-sub">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {currentTimeStr || "00:00:00"}
          </span>
        </div>
      </div>

      {/* RENDER ACTIVE SCREEN */}
      <div className="flex-1 flex flex-col justify-center items-center">
        {currentScreen === 'home' && (
          <div className="w-full text-center max-w-xl animate-fade-in">
            <h1 className="text-2xl sm:text-3xl font-sans text-text-main font-bold mb-1 tracking-tight">
              {t.welcomeTitle}
            </h1>
            <p className="text-xs sm:text-sm text-text-sub font-sans tracking-wide mb-6">
              {t.welcomeSubtitle}
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
              <button
                id="btn-kiosk-has-appointment"
                onClick={startFlow1}
                className="group relative flex flex-col items-center justify-center p-5 rounded-xl border-2 border-accent-peach hover:border-button-active bg-white hover:bg-accent-peach/20 text-text-main font-semibold text-base shadow-sm hover:shadow transition-all duration-200 cursor-pointer h-36"
              >
                <div className="h-10 w-10 rounded-full bg-accent-peach flex items-center justify-center mb-3 text-text-main group-hover:scale-110 transition-transform">
                  <Calendar className="h-5 w-5" />
                </div>
                <span>{t.hasAppointmentBtn}</span>
                <span className="text-[11px] font-normal text-text-sub mt-1.5 opacity-80 decoration-0">
                  Ik heb reeds een tijdstip gereserveerd
                </span>
              </button>

              <button
                id="btn-kiosk-no-appointment"
                onClick={startFlow2}
                className="group relative flex flex-col items-center justify-center p-5 rounded-xl border-2 border-border-soft hover:border-button-active bg-white hover:bg-bg-medical text-text-main font-semibold text-base shadow-sm hover:shadow transition-all duration-200 cursor-pointer h-36"
              >
                <div className="h-10 w-10 rounded-full bg-button-beige flex items-center justify-center mb-3 text-text-sub group-hover:scale-110 transition-transform">
                  <User className="h-5 w-5" />
                </div>
                <span>{t.noAppointmentBtn}</span>
                <span className="text-[11px] font-normal text-text-sub mt-1.5 opacity-80">
                  Aangemeld voor inlichtingen of levering
                </span>
              </button>
            </div>

            <div className="mt-6 flex justify-center w-full">
              <button
                id="btn-kiosk-help"
                onClick={handleHelpClick}
                disabled={helpCooldown}
                className="group relative flex items-center justify-center gap-2 p-3 rounded-xl border border-border-soft hover:border-button-active bg-white hover:bg-accent-peach/20 text-text-sub hover:text-text-main font-medium text-sm shadow-sm transition-all duration-200 cursor-pointer w-full max-w-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Info className="h-4 w-4" />
                <span>{t.helpBtnText}</span>
              </button>
            </div>
          </div>
        )}

        {/* FLOW 1: PATIENT MET AFSPRAAK - STEP 1 (Personal details input) */}
        {currentScreen === 'f1_details' && (
          <div className="w-full max-w-2xl animate-fade-in flex flex-col h-full justify-between">
            <div>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h2 className="text-xl font-sans font-bold text-text-main">{t.personalDetailsTitle}</h2>
                  <p className="text-xs text-text-sub">{t.personalDetailsSub}</p>
                </div>
                <span className="text-xs font-semibold bg-button-beige text-text-main px-2.5 py-1 rounded-full font-mono">
                  Stap 1 van 2
                </span>
              </div>

              {formError && (
                <div className="mb-2 p-2.5 rounded-lg bg-red-50 text-red-700 text-xs flex items-center gap-2 border border-red-200">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={submitF1Details} className="grid grid-cols-2 gap-3">
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-text-main mb-1">{t.firstNameLabel} *</label>
                  <input
                    id="input-kiosk-f1-firstname"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="bijv. Sophie"
                    className="p-2 text-sm rounded-lg border border-border-soft bg-white focus:outline-none focus:border-button-active focus:ring-1 focus:ring-button-active"
                    required
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-text-main mb-1">{t.lastNameLabel} *</label>
                  <input
                    id="input-kiosk-f1-lastname"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="bijv. Peeters"
                    className="p-2 text-sm rounded-lg border border-border-soft bg-white focus:outline-none focus:border-button-active focus:ring-1 focus:ring-button-active"
                    required
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-text-main mb-1">{t.birthDateLabel} *</label>
                  <input
                    id="input-kiosk-f1-birthdate"
                    type="text"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    placeholder="bijv. 14/08/1985"
                    className="p-2 text-sm rounded-lg border border-border-soft bg-white focus:outline-none focus:border-button-active focus:ring-1 focus:ring-button-active"
                    required
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-text-main mb-1">
                    {t.registryNumLabel} * 
                    <span className="text-[9px] text-zinc-500 font-normal ml-1">(Belgisch Rijksregister)</span>
                  </label>
                  <input
                    id="input-kiosk-f1-regnum"
                    type="text"
                    value={nationalRegNum}
                    onChange={(e) => setNationalRegNum(e.target.value)}
                    placeholder="bijv. 85.08.14-123.45"
                    className="p-2 text-sm rounded-lg border border-border-soft bg-white focus:outline-none focus:border-button-active focus:ring-1 focus:ring-button-active"
                    required
                  />
                </div>

                <div className="col-span-2 flex flex-col">
                  <label className="text-xs font-semibold text-text-main mb-1">{t.idCardLabel}</label>
                  <input
                    id="input-kiosk-f1-idcard"
                    type="text"
                    placeholder="bijv. 592-1234567-89"
                    value={idCardNum}
                    onChange={(e) => setIdCardNum(e.target.value)}
                    className="p-2 text-sm rounded-lg border border-border-soft bg-white focus:outline-none focus:border-button-active"
                  />
                </div>
              </form>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-border-soft mt-3">
              <button
                onClick={handleResetToHome}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-text-sub hover:text-text-main transition duration-150 cursor-pointer"
              >
                {isCurrentRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                {t.backBtn}
              </button>

              <button
                type="button"
                onClick={submitF1Details}
                className="flex items-center gap-1.5 bg-button-active hover:bg-button-active/85 text-text-main px-5 py-2 rounded-lg text-sm font-bold shadow-sm transition duration-150 cursor-pointer"
              >
                {t.nextBtn}
                {isCurrentRtl ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}

        {/* FLOW 1: STEP 2 (Select Doctor & Time) */}
        {currentScreen === 'f1_appointment' && (
          <div className="w-full max-w-xl animate-fade-in flex flex-col h-full justify-between">
            <div>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h2 className="text-xl font-sans font-bold text-text-main">{t.apptDetailsTitle}</h2>
                  <p className="text-xs text-text-sub">{t.apptDetailsSub}</p>
                </div>
                <span className="text-xs font-semibold bg-button-beige text-text-main px-2.5 py-1 rounded-full font-mono">
                  Stap 2 van 2
                </span>
              </div>

              {formError && (
                <div className="mb-2 p-2.5 rounded-lg bg-red-50 text-red-700 text-xs flex items-center gap-2 border border-red-200">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleConfirmF1Appointment} className="space-y-4">
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-text-main mb-1">{t.apptTimeLabel}</label>
                  <div className="flex gap-2">
                    <select
                      id="input-kiosk-f1-time-hr"
                      value={appointmentTime ? appointmentTime.split(':')[0] : ''}
                      onChange={(e) => {
                        const min = (appointmentTime && appointmentTime.split(':')[1]) ? appointmentTime.split(':')[1] : '00';
                        setAppointmentTime(`${e.target.value}:${min}`);
                      }}
                      className="p-2.5 w-full text-base rounded-lg border border-border-soft bg-white focus:outline-none focus:border-button-active focus:ring-1 focus:ring-button-active"
                      required
                    >
                      <option value="" disabled>Uur</option>
                      {Array.from({ length: 24 }).map((_, i) => {
                        const v = i.toString().padStart(2, '0');
                        return <option key={`hr-${v}`} value={v}>{v}</option>;
                      })}
                    </select>
                    <span className="text-xl font-bold self-center text-text-sub">:</span>
                    <select
                      id="input-kiosk-f1-time-min"
                      value={appointmentTime ? appointmentTime.split(':')[1] : ''}
                      onChange={(e) => {
                        const hr = (appointmentTime && appointmentTime.split(':')[0]) ? appointmentTime.split(':')[0] : '08';
                        setAppointmentTime(`${hr}:${e.target.value}`);
                      }}
                      className="p-2.5 w-full text-base rounded-lg border border-border-soft bg-white focus:outline-none focus:border-button-active focus:ring-1 focus:ring-button-active"
                      required
                    >
                      <option value="" disabled>Min</option>
                      {Array.from({ length: 12 }).map((_, i) => {
                        const v = (i * 5).toString().padStart(2, '0');
                        return <option key={`min-${v}`} value={v}>{v}</option>;
                      })}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-text-main mb-1">{t.apptDoctorLabel}</label>
                  <select
                    id="select-kiosk-f1-doctor"
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                    className="p-2.5 w-full text-sm rounded-lg border border-border-soft bg-white focus:outline-none focus:border-button-active focus:ring-1 focus:ring-button-active"
                    required
                  >
                    <option value="">{t.selectDoctorPlaceholder}</option>
                    {doctors && doctors.map((dr) => (
                      <option key={dr.id} value={dr.id}>
                        {dr.name} - {dr.specialty} ({dr.waitingRoom === 'Gelijkvloers' ? 'Gelijkvloers' : '1ste Verdiep'})
                      </option>
                    ))}
                  </select>
                </div>
              </form>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-border-soft mt-4">
              <button
                onClick={() => { playTone('tap'); setCurrentScreen('f1_details'); }}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-text-sub hover:text-text-main transition duration-150 cursor-pointer"
              >
                {isCurrentRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                {t.backBtn}
              </button>

              <button
                type="button"
                onClick={handleConfirmF1Appointment}
                className="flex items-center gap-1.5 bg-text-main hover:bg-text-main/85 text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm transition duration-150 cursor-pointer"
              >
                <CheckCircle className="h-4 w-4 text-emerald-400" />
                {t.confirmBtn}
              </button>
            </div>
          </div>
        )}

        {/* FLOW 1: SUCCESS RESULT PAGE (Auto countdown) */}
        {currentScreen === 'f1_success' && (
          <div className="w-full max-w-2xl text-center animate-bounce-in py-2">
            <div className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-200">
              <CheckCircle className="h-10 w-10 text-emerald-600" />
            </div>

            <h2 className="text-2xl font-sans font-bold text-text-main mb-2">
              {t.checkinSuccessTitle}
            </h2>
            
            <p className="text-text-sub text-sm mb-4">
              Mevr/Dhr. <strong>{lastName}</strong>, {t.teamsNotificationSent}
            </p>

            <div className="p-4 bg-button-beige rounded-xl inline-block max-w-[480px] border border-border-soft mb-5">
              <span className="block text-xs uppercase font-mono tracking-wider font-semibold text-text-sub mb-1">
                {t.directionPrefix}
              </span>
              <span className="text-lg font-sans font-bold text-text-main">
                {resolvedRoom === 'Gelijkvloers' ? t.waitingRoomGround : t.waitingRoomFirst}
              </span>
            </div>

            {isPatientLate && (
              <div className="mx-auto max-w-md p-3 rounded-lg bg-[#FFF2DE] text-[#A6690B] text-xs flex items-center gap-2 border border-[#F5E0C2] mb-4">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span className="text-start">{t.lateWarningText}</span>
              </div>
            )}

            <div className="text-xs text-[#8C7670]">
              <p>{t.redirectTimerText.replace('{seconds}', countdown.toString())}</p>
              <button 
                onClick={handleResetToHome}
                className="mt-2.5 underline hover:text-text-main cursor-pointer text-[11px] font-semibold"
              >
                {t.returnToStartBtn}
              </button>
            </div>
          </div>
        )}

        {/* FLOW 2: WITHOUT APPOINTMENT - OPTION CHOICES */}
        {currentScreen === 'f2_choice' && (
          <div className="w-full max-w-2xl text-center animate-fade-in">
            <h2 className="text-xl sm:text-2xl font-sans font-semibold text-text-main mb-2">
              {t.noApptTitle}
            </h2>
            <p className="text-xs text-text-sub mb-6">
              {t.noApptSub}
            </p>

            <div className="flex flex-col gap-3 max-w-md mx-auto">
              <button
                id="btn-kiosk-f2-patient"
                onClick={() => selectF2Choice('patient_info')}
                className="flex items-center gap-4 p-4 rounded-xl border-2 border-accent-peach hover:border-button-active bg-white hover:bg-accent-peach/20 text-start font-semibold text-sm transition duration-150 cursor-pointer"
              >
                <div className="h-8 w-8 rounded-full bg-accent-peach flex items-center justify-center text-text-main shrink-0">
                  <User className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="text-text-main">{t.optionPatientInfo}</div>
                  <div className="text-[10px] text-text-sub font-normal mt-0.5">Voor administratieve vragen, voorschriften of inschrijving</div>
                </div>
              </button>

              <button
                id="btn-kiosk-f2-nonpatient"
                onClick={() => selectF2Choice('non_patient')}
                className="flex items-center gap-4 p-4 rounded-xl border-2 border-border-soft hover:border-button-active bg-white hover:bg-bg-medical text-start font-semibold text-sm transition duration-150 cursor-pointer"
              >
                <div className="h-8 w-8 rounded-full bg-button-beige flex items-center justify-center text-text-sub shrink-0">
                  <Info className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="text-text-main">{t.optionNonPatient}</div>
                  <div className="text-[10px] text-text-sub font-normal mt-0.5">Voor postbezorging, medische afgevaardigden en technici</div>
                </div>
              </button>
            </div>

            <button
              onClick={handleResetToHome}
              className="mt-6 flex items-center gap-1 mx-auto text-xs font-semibold text-text-sub hover:text-text-main transition cursor-pointer"
            >
              {isCurrentRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              {t.backBtn}
            </button>
          </div>
        )}

        {/* FLOW 2: PATIENT WITHOUT APPOINTMENT DETAILS FORM */}
        {currentScreen === 'f2_patient_form' && (
          <div className="w-full max-w-xl animate-fade-in flex flex-col h-full justify-between">
            <div>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h2 className="text-xl font-sans font-bold text-text-main">{t.patientHelpTitle}</h2>
                  <p className="text-xs text-text-sub">{t.patientHelpSub}</p>
                </div>
              </div>

              {formError && (
                <div className="mb-2 p-2.5 rounded-lg bg-red-50 text-red-700 text-xs flex items-center gap-2 border border-red-200 col-span-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={submitF2PatientForm} className="grid grid-cols-2 gap-3">
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-text-main mb-1">{t.firstNameLabel} *</label>
                  <input
                    id="input-kiosk-f2-firstname"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Voornaam"
                    className="p-2 text-sm rounded-lg border border-border-soft bg-white focus:outline-none focus:border-button-active"
                    required
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-text-main mb-1">{t.lastNameLabel} *</label>
                  <input
                    id="input-kiosk-f2-lastname"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Achternaam"
                    className="p-2 text-sm rounded-lg border border-border-soft bg-white focus:outline-none focus:border-button-active"
                    required
                  />
                </div>

                <div className="flex flex-col col-span-2">
                  <label className="text-xs font-semibold text-text-main mb-1">
                    {t.registryNumLabel} *
                    <span className="text-[10px] text-zinc-500 font-normal ml-1">Ter identificatie bij de balie</span>
                  </label>
                  <input
                    id="input-kiosk-f2-regnum"
                    type="text"
                    value={nationalRegNum}
                    onChange={(e) => setNationalRegNum(e.target.value)}
                    placeholder="Rijksregisternummer (bijv. 85.08.14-123.45)"
                    className="p-2 text-sm rounded-lg border border-border-soft bg-white focus:outline-none focus:border-button-active"
                    required
                  />
                </div>
              </form>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-border-soft mt-4">
              <button
                onClick={() => { playTone('tap'); setCurrentScreen('f2_choice'); }}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-text-sub hover:text-text-main transition duration-150 cursor-pointer"
              >
                {isCurrentRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                {t.backBtn}
              </button>

              <button
                type="button"
                onClick={submitF2PatientForm}
                className="flex items-center gap-1.5 bg-button-active hover:bg-button-active/85 text-text-main px-5 py-2 rounded-lg text-sm font-bold shadow-sm transition duration-150 cursor-pointer"
              >
                {t.nextBtn}
                {isCurrentRtl ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}

        {/* FLOW 2: SUCCESS RESULT PAGE */}
        {currentScreen === 'f2_success' && (
          <div className="w-full max-w-xl text-center animate-fade-in py-4">
            <div className="h-16 w-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-200">
              <CheckCircle className="h-10 w-10 text-blue-600" />
            </div>

            <h2 className="text-2xl font-sans font-bold text-text-main mb-2">
              {t.noApptSuccessTitle}
            </h2>
            
            <p className="text-text-main text-sm leading-relaxed max-w-md mx-auto mb-6">
              {firstName === 'Bezoeker/Leverancier' ? t.nonPatientSuccessMsg : t.noApptSuccessMsg}
            </p>

            <div className="text-xs text-text-sub">
              <p>{t.redirectTimerText.replace('{seconds}', countdown.toString())}</p>
              <button 
                onClick={handleResetToHome}
                className="mt-2 text-xs underline hover:text-text-main cursor-pointer"
              >
                {t.returnToStartBtn}
              </button>
            </div>
          </div>
        )}

        {/* HELP SUCCESS PAGE */}
        {currentScreen === 'help_success' && (
          <div className="w-full max-w-xl text-center animate-fade-in py-4">
            <div className="h-16 w-16 bg-pink-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-pink-200">
              <Info className="h-10 w-10 text-pink-600" />
            </div>

            <h2 className="text-2xl font-sans font-bold text-text-main mb-2">
              {t.noApptSuccessTitle}
            </h2>
            
            <p className="text-text-main text-sm leading-relaxed max-w-md mx-auto mb-6">
              {t.noApptSuccessMsg}
            </p>

            <div className="text-xs text-text-sub">
              <p>{t.redirectTimerText.replace('{seconds}', countdown.toString())}</p>
              <button 
                onClick={handleResetToHome}
                className="mt-2 text-xs underline hover:text-text-main cursor-pointer"
              >
                {t.returnToStartBtn}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* LANGUAGE SELECTION TOGGLE FOOTER BAR - Bottom Right ALWAYS clickable */}
      <div 
        className={`flex border-t border-border-soft pt-2 mt-2 select-none ${isCurrentRtl ? 'justify-start' : 'justify-end'}`}
        dir={isCurrentRtl ? 'rtl' : 'ltr'}
      >
        <div className="relative">
          <button
            id="btn-kiosk-lang-selector"
            onClick={() => { playTone('tap'); setLangMenuOpen(!langMenuOpen); }}
            className="flex items-center gap-1.5 text-xs text-text-sub hover:text-button-active transition font-semibold cursor-pointer py-1 px-2.5 rounded-full bg-button-beige/50"
          >
            <Globe2 className="h-3.5 w-3.5" />
            <span>taal &bull; language &bull; langue &bull; dil &bull; لغة</span>
            <span className="bg-button-active text-text-main rounded-md px-1.5 py-0.5 text-[10px] ml-1 font-bold">
              {lang}
            </span>
          </button>

          {langMenuOpen && (
            <div 
              className={`absolute bottom-8 z-50 bg-white border border-border-soft rounded-xl shadow-xl p-2 w-48 animate-fade-in-up ${isCurrentRtl ? 'left-0' : 'right-0'}`}
            >
              <div className="text-[10px] text-zinc-500 font-semibold px-2 pb-1.5 border-b border-zinc-100 mb-1">
                Kies uw taal / Choose:
              </div>
              
              <button
                onClick={() => handleLanguageSelect('NL')}
                className={`w-full text-start px-3 py-1.5 rounded-lg text-xs hover:bg-bg-medical flex items-center justify-between cursor-pointer ${lang === 'NL' ? 'bg-bg-medical font-bold text-text-sub' : 'text-zinc-700'}`}
              >
                <span>Nederlands</span>
                <span className="text-[10px] text-zinc-400">NL</span>
              </button>

              <button
                onClick={() => handleLanguageSelect('EN')}
                className={`w-full text-start px-3 py-1.5 rounded-lg text-xs hover:bg-bg-medical flex items-center justify-between cursor-pointer ${lang === 'EN' ? 'bg-bg-medical font-bold text-text-sub' : 'text-zinc-700'}`}
              >
                <span>English</span>
                <span className="text-[10px] text-zinc-400">EN</span>
              </button>

              <button
                onClick={() => handleLanguageSelect('FR')}
                className={`w-full text-start px-3 py-1.5 rounded-lg text-xs hover:bg-bg-medical flex items-center justify-between cursor-pointer ${lang === 'FR' ? 'bg-bg-medical font-bold text-text-sub' : 'text-zinc-700'}`}
              >
                <span>Français</span>
                <span className="text-[10px] text-zinc-400">FR</span>
              </button>

              <button
                onClick={() => handleLanguageSelect('TR')}
                className={`w-full text-start px-3 py-1.5 rounded-lg text-xs hover:bg-bg-medical flex items-center justify-between cursor-pointer ${lang === 'TR' ? 'bg-bg-medical font-bold text-text-sub' : 'text-zinc-700'}`}
              >
                <span>Türkçe</span>
                <span className="text-[10px] text-zinc-400">TR</span>
              </button>

              <button
                onClick={() => handleLanguageSelect('AR')}
                className={`w-full text-start px-3 py-1.5 rounded-lg text-xs hover:bg-bg-medical flex items-center justify-between cursor-pointer ${lang === 'AR' ? 'bg-bg-medical font-bold text-text-sub' : 'text-zinc-700'}`}
              >
                <span className="font-sans">العربية</span>
                <span className="text-[10px] text-zinc-400">AR</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
