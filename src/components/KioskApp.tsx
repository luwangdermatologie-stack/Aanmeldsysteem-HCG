/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { translations, isRtl } from '../translations';
import { LanguageCode, Doctor, Patient } from '../types';
import { 
  CheckCircle, 
  AlertTriangle, 
  ChevronRight, 
  ChevronLeft, 
  Calendar, 
  User, 
  UserCheck,
  UserPlus,
  Info, 
  Clock, 
  ShieldCheck, 
  Globe2,
  Lock,
  Keyboard,
  Maximize2,
  Minimize2,
  Settings,
  Monitor
} from 'lucide-react';
import { VirtualKeyboard } from './VirtualKeyboard';

interface KioskAppProps {
  doctors: Doctor[];
  onPatientRegister: (patient: Omit<Patient, 'id' | 'arrivalTime' | 'arrivalDate' | 'waitingRoom' | 'status'>) => void;
  onTeamsNotify: (message: string, target?: string, payload?: any) => void;
  isFullscreen?: boolean;
  isKioskLocked?: boolean;
  onRequestStaffUnlock?: () => void;
  onToggleFullscreen?: () => void;
  onOpenAdmin?: () => void;
  onOpenSplit?: () => void;
}

// In-app gentle synthesizer sound for touch feedback (Acoustic feedback removed as requested)
const playTone = (type: 'tap' | 'success' | 'warn') => {
  // Removed
};

export default function KioskApp({ 
  doctors, 
  onPatientRegister, 
  onTeamsNotify, 
  isFullscreen = false,
  isKioskLocked = false,
  onRequestStaffUnlock,
  onToggleFullscreen,
  onOpenAdmin,
  onOpenSplit
}: KioskAppProps) {
  const [lang, setLang] = useState<LanguageCode>('NL');
  const [currentScreen, setCurrentScreen] = useState<'home' | 'f1_patient_type' | 'f1_details' | 'f1_appointment' | 'f1_success' | 'f2_choice' | 'f2_patient_form' | 'f2_success' | 'help_form' | 'help_success'>('home');
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [currentTimeStr, setCurrentTimeStr] = useState('');

  const [helpCooldown, setHelpCooldown] = useState(false);

  // Form auto-formatting helpers for Belgian clinic usage
  // Automatically pre-fills separators (slashes, dots, dashes) as soon as user types
  const formatNationalRegistryNumber = (input: string): string => {
    const digits = input.replace(/\D/g, '').slice(0, 11);
    if (digits.length === 0) return '';
    if (digits.length < 2) return digits;
    if (digits.length === 2) return `${digits}.`;
    if (digits.length < 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    if (digits.length === 4) return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.`;
    if (digits.length < 6) return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
    if (digits.length === 6) return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 6)}-`;
    if (digits.length < 9) return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 6)}-${digits.slice(6)}`;
    if (digits.length === 9) return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 6)}-${digits.slice(6, 9)}.`;
    return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 6)}-${digits.slice(6, 9)}.${digits.slice(9, 11)}`;
  };

  const formatBirthDate = (input: string): string => {
    const digits = input.replace(/\D/g, '').slice(0, 8);
    if (digits.length === 0) return '';
    if (digits.length < 2) return digits;
    if (digits.length === 2) return `${digits}/`;
    if (digits.length < 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    if (digits.length === 4) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
  };

  const formatIdCardNumber = (input: string): string => {
    const digits = input.replace(/\D/g, '').slice(0, 12);
    if (digits.length === 0) return '';
    if (digits.length < 3) return digits;
    if (digits.length === 3) return `${digits}-`;
    if (digits.length < 10) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 10)}-`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 10)}-${digits.slice(10, 12)}`;
  };

  const handleBirthDateChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 8);
    if (val.length < birthDate.length) {
      if (digits.length === 0) setBirthDate('');
      else if (digits.length <= 2) setBirthDate(digits);
      else if (digits.length <= 4) setBirthDate(`${digits.slice(0, 2)}/${digits.slice(2)}`);
      else setBirthDate(`${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`);
      return;
    }
    setBirthDate(formatBirthDate(val));
  };

  const handleNationalRegNumChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (val.length < nationalRegNum.length) {
      if (digits.length === 0) setNationalRegNum('');
      else if (digits.length <= 2) setNationalRegNum(digits);
      else if (digits.length <= 4) setNationalRegNum(`${digits.slice(0, 2)}.${digits.slice(2)}`);
      else if (digits.length <= 6) setNationalRegNum(`${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`);
      else if (digits.length <= 9) setNationalRegNum(`${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 6)}-${digits.slice(6)}`);
      else setNationalRegNum(`${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 6)}-${digits.slice(6, 9)}.${digits.slice(9)}`);
      return;
    }
    setNationalRegNum(formatNationalRegistryNumber(val));
  };

  const handleIdCardNumChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 12);
    if (val.length < idCardNum.length) {
      if (digits.length === 0) setIdCardNum('');
      else if (digits.length <= 3) setIdCardNum(digits);
      else if (digits.length <= 10) setIdCardNum(`${digits.slice(0, 3)}-${digits.slice(3)}`);
      else setIdCardNum(`${digits.slice(0, 3)}-${digits.slice(3, 10)}-${digits.slice(10)}`);
      return;
    }
    setIdCardNum(formatIdCardNumber(val));
  };

  const isValidBirthDate = (dateStr: string): boolean => {
    const cleanDigits = dateStr.replace(/\D/g, '');
    if (cleanDigits.length !== 8) return false;
    const day = parseInt(cleanDigits.slice(0, 2), 10);
    const month = parseInt(cleanDigits.slice(2, 4), 10);
    const year = parseInt(cleanDigits.slice(4, 8), 10);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    const currentYear = new Date().getFullYear();
    if (year < 1900 || year > currentYear) return false;
    const testDate = new Date(year, month - 1, day);
    return testDate.getFullYear() === year && testDate.getMonth() === month - 1 && testDate.getDate() === day;
  };

  // Form Fields
  const [patientType, setPatientType] = useState<'new' | 'known'>('new');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [nationalRegNum, setNationalRegNum] = useState('');
  const [idCardNum, setIdCardNum] = useState('');
  const [hasForeignNationality, setHasForeignNationality] = useState(false);
  const [unknownIdentification, setUnknownIdentification] = useState(false);
  const [appointmentTime, setAppointmentTime] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');

  // Available practitioners including "De verpleegkundige" (always on Gelijkvloers)
  const availableDoctors = useMemo(() => {
    const list = [...(doctors || [])];
    if (!list.some(d => d.id === 'nurse-verpleegkundige' || d.name.toLowerCase().includes('verpleegkundige'))) {
      list.push({
        id: 'nurse-verpleegkundige',
        name: 'De verpleegkundige',
        specialty: 'Verpleegkundige zorg & Wondzorg',
        waitingRoom: 'Gelijkvloers',
        isAvailable: true,
        avatarColor: 'bg-emerald-500'
      });
    }
    return list;
  }, [doctors]);

  // Help request form fields
  const [helpName, setHelpName] = useState('');
  const [helpDescription, setHelpDescription] = useState('');

  // Virtual Keyboard on-screen state
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false);
  const [activeInputField, setActiveInputField] = useState<{
    id: 'firstName' | 'lastName' | 'birthDate' | 'nationalRegNum' | 'idCardNum' | 'helpName' | 'helpDescription';
    label: string;
    isNumeric: boolean;
  } | null>(null);

  const handleInputFocus = (
    fieldId: 'firstName' | 'lastName' | 'birthDate' | 'nationalRegNum' | 'idCardNum' | 'helpName' | 'helpDescription',
    label: string,
    isNumeric: boolean
  ) => {
    setActiveInputField({ id: fieldId, label, isNumeric });

    // Only scroll into view if keyboard is already visible
    if (showVirtualKeyboard) {
      setTimeout(() => {
        let elId = '';
        if (fieldId === 'helpName') elId = 'input-kiosk-help-name';
        else if (fieldId === 'helpDescription') elId = 'input-kiosk-help-desc';
        else if (fieldId === 'birthDate') elId = 'input-kiosk-f1-birthdate';
        else if (fieldId === 'idCardNum') elId = 'input-kiosk-f1-idcard';
        else if (currentScreen === 'f2_patient_form') {
          if (fieldId === 'firstName') elId = 'input-kiosk-f2-firstname';
          else if (fieldId === 'lastName') elId = 'input-kiosk-f2-lastname';
          else if (fieldId === 'nationalRegNum') elId = 'input-kiosk-f2-regnum';
        } else {
          if (fieldId === 'firstName') elId = 'input-kiosk-f1-firstname';
          else if (fieldId === 'lastName') elId = 'input-kiosk-f1-lastname';
          else if (fieldId === 'nationalRegNum') elId = 'input-kiosk-f1-regnum';
        }

        if (elId) {
          const el = document.getElementById(elId);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }, 100);
    }
  };

  const handleVirtualKeyPress = (char: string) => {
    if (!activeInputField) {
      setActiveInputField({ id: 'firstName', label: 'Voornaam', isNumeric: false });
      setFirstName(prev => prev + char);
      return;
    }

    if (activeInputField.id === 'firstName') {
      setFirstName(prev => prev + char);
    } else if (activeInputField.id === 'lastName') {
      setLastName(prev => prev + char);
    } else if (activeInputField.id === 'birthDate') {
      setBirthDate(prev => formatBirthDate(prev + char));
    } else if (activeInputField.id === 'nationalRegNum') {
      setNationalRegNum(prev => formatNationalRegistryNumber(prev + char));
    } else if (activeInputField.id === 'idCardNum') {
      setIdCardNum(prev => formatIdCardNumber(prev + char));
    } else if (activeInputField.id === 'helpName') {
      setHelpName(prev => prev + char);
    } else if (activeInputField.id === 'helpDescription') {
      setHelpDescription(prev => prev + char);
    }
  };

  const handleVirtualBackspace = () => {
    if (!activeInputField) return;
    if (activeInputField.id === 'firstName') setFirstName(prev => prev.slice(0, -1));
    else if (activeInputField.id === 'lastName') setLastName(prev => prev.slice(0, -1));
    else if (activeInputField.id === 'birthDate') {
      setBirthDate(prev => {
        const clean = prev.replace(/\D/g, '');
        if (clean.length <= 1) return '';
        const newDigits = clean.slice(0, -1);
        if (newDigits.length < 2) return newDigits;
        if (newDigits.length < 4) return `${newDigits.slice(0, 2)}/${newDigits.slice(2)}`;
        return `${newDigits.slice(0, 2)}/${newDigits.slice(2, 4)}/${newDigits.slice(4)}`;
      });
    } else if (activeInputField.id === 'nationalRegNum') {
      setNationalRegNum(prev => {
        const clean = prev.replace(/\D/g, '');
        if (clean.length <= 1) return '';
        const newDigits = clean.slice(0, -1);
        if (newDigits.length < 2) return newDigits;
        if (newDigits.length < 4) return `${newDigits.slice(0, 2)}.${newDigits.slice(2)}`;
        if (newDigits.length < 6) return `${newDigits.slice(0, 2)}.${newDigits.slice(2, 4)}.${newDigits.slice(4)}`;
        if (newDigits.length < 9) return `${newDigits.slice(0, 2)}.${newDigits.slice(2, 4)}.${newDigits.slice(4, 6)}-${newDigits.slice(6)}`;
        return `${newDigits.slice(0, 2)}.${newDigits.slice(2, 4)}.${newDigits.slice(4, 6)}-${newDigits.slice(6, 9)}.${newDigits.slice(9)}`;
      });
    } else if (activeInputField.id === 'idCardNum') {
      setIdCardNum(prev => {
        const clean = prev.replace(/\D/g, '');
        if (clean.length <= 1) return '';
        const newDigits = clean.slice(0, -1);
        if (newDigits.length < 3) return newDigits;
        if (newDigits.length < 10) return `${newDigits.slice(0, 3)}-${newDigits.slice(3)}`;
        return `${newDigits.slice(0, 3)}-${newDigits.slice(3, 10)}-${newDigits.slice(10)}`;
      });
    } else if (activeInputField.id === 'helpName') setHelpName(prev => prev.slice(0, -1));
    else if (activeInputField.id === 'helpDescription') setHelpDescription(prev => prev.slice(0, -1));
  };

  const handleVirtualClear = () => {
    if (!activeInputField) return;
    if (activeInputField.id === 'firstName') setFirstName('');
    else if (activeInputField.id === 'lastName') setLastName('');
    else if (activeInputField.id === 'birthDate') setBirthDate('');
    else if (activeInputField.id === 'nationalRegNum') setNationalRegNum('');
    else if (activeInputField.id === 'idCardNum') setIdCardNum('');
    else if (activeInputField.id === 'helpName') setHelpName('');
    else if (activeInputField.id === 'helpDescription') setHelpDescription('');
  };

  // Validation/Error feedback
  const [formError, setFormError] = useState('');

  // Redirect Timer
  const [countdown, setCountdown] = useState(10);
  const [isPatientLate, setIsPatientLate] = useState(false);
  const [resolvedRoom, setResolvedRoom] = useState<'Gelijkvloers' | 'Bovenverdieping'>('Gelijkvloers');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const t = translations[lang];

  // Helper to obtain current text value of active field for live preview
  const getCurrentInputValue = (): string => {
    if (!activeInputField) return '';
    switch (activeInputField.id) {
      case 'firstName': return firstName;
      case 'lastName': return lastName;
      case 'birthDate': return birthDate;
      case 'nationalRegNum': return nationalRegNum;
      case 'idCardNum': return idCardNum;
      case 'helpName': return helpName;
      case 'helpDescription': return helpDescription;
      default: return '';
    }
  };

  // Helper to get all sequential fields for the current screen
  const getFormFieldsForCurrentScreen = () => {
    if (currentScreen === 'f1_details') {
      return [
        { id: 'firstName' as const, label: t.firstNameLabel, isNumeric: false, elId: 'input-kiosk-f1-firstname' },
        { id: 'lastName' as const, label: t.lastNameLabel, isNumeric: false, elId: 'input-kiosk-f1-lastname' },
        { id: 'birthDate' as const, label: t.birthDateLabel, isNumeric: true, elId: 'input-kiosk-f1-birthdate' },
        { id: 'nationalRegNum' as const, label: t.registryNumLabel, isNumeric: true, elId: 'input-kiosk-f1-regnum' },
        { id: 'idCardNum' as const, label: t.idCardLabel, isNumeric: true, elId: 'input-kiosk-f1-idcard' },
      ];
    }
    if (currentScreen === 'f2_patient_form') {
      return [
        { id: 'firstName' as const, label: t.firstNameLabel, isNumeric: false, elId: 'input-kiosk-f2-firstname' },
        { id: 'lastName' as const, label: t.lastNameLabel, isNumeric: false, elId: 'input-kiosk-f2-lastname' },
        { id: 'nationalRegNum' as const, label: t.registryNumLabel, isNumeric: true, elId: 'input-kiosk-f2-regnum' },
      ];
    }
    if (currentScreen === 'help_form') {
      return [
        { id: 'helpName' as const, label: t.helpNameLabel, isNumeric: false, elId: 'input-kiosk-help-name' },
        { id: 'helpDescription' as const, label: t.helpDescriptionLabel, isNumeric: false, elId: 'input-kiosk-help-desc' },
      ];
    }
    return [];
  };

  const currentScreenFields = getFormFieldsForCurrentScreen();
  const currentFieldIndex = activeInputField ? currentScreenFields.findIndex(f => f.id === activeInputField.id) : -1;
  const hasPrevField = currentFieldIndex > 0;
  const hasNextField = currentFieldIndex >= 0 && currentFieldIndex < currentScreenFields.length - 1;

  const handleNextField = () => {
    if (!currentScreenFields.length || !activeInputField) return;
    if (hasNextField) {
      const nextField = currentScreenFields[currentFieldIndex + 1];
      handleInputFocus(nextField.id, nextField.label, nextField.isNumeric);
      const el = document.getElementById(nextField.elId);
      if (el) el.focus();
    } else {
      // Reached the last field, close keyboard so patient sees next step / submit button
      setShowVirtualKeyboard(false);
    }
  };

  const handlePrevField = () => {
    if (!currentScreenFields.length || !activeInputField) return;
    if (hasPrevField) {
      const prevField = currentScreenFields[currentFieldIndex - 1];
      handleInputFocus(prevField.id, prevField.label, prevField.isNumeric);
      const el = document.getElementById(prevField.elId);
      if (el) el.focus();
    }
  };

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
    setFormError('');
    setCurrentScreen('help_form');
  };

  const handleCancelHelp = () => {
    playTone('tap');
    setShowVirtualKeyboard(false);
    setActiveInputField(null);
    setHelpName('');
    setHelpDescription('');
    setFormError('');
    setCurrentScreen('home');
  };

  const submitHelpRequest = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!helpName.trim()) {
      setFormError(t.requiredFieldsError);
      return;
    }

    playTone('tap');
    setShowVirtualKeyboard(false);
    
    // Send detailed Teams notification with name and description
    onTeamsNotify(
      `🆘 **HULP GEVRAAGD**: Bezoeker **${helpName.trim()}** heeft assistentie nodig aan de kiosk!\n*Probleem*: ${helpDescription.trim() || 'Geen toelichting opgegeven'}`, 
      undefined, 
      { 
        type: "Hulpverzoek Kiosk",
        naam: helpName.trim(),
        beschrijving: helpDescription.trim() || "Niet gespecificeerd",
        tijdstip: currentTimeStr,
        bron: "Kiosk Scherm Hulp Nodig"
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
    setShowVirtualKeyboard(false);
    setActiveInputField(null);
    setPatientType('new');
    setFirstName('');
    setLastName('');
    setBirthDate('');
    setNationalRegNum('');
    setIdCardNum('');
    setHasForeignNationality(false);
    setUnknownIdentification(false);
    setAppointmentTime('');
    setSelectedDoctorId('');
    setHelpName('');
    setHelpDescription('');
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
    setCurrentScreen('f1_patient_type');
  };

  const handleSelectPatientType = (type: 'new' | 'known') => {
    playTone('tap');
    setPatientType(type);
    setFormError('');
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

    // Name and birth date are always required
    if (!firstName.trim() || !lastName.trim() || !birthDate.trim()) {
      playTone('warn');
      setFormError(t.requiredFieldsError);
      return;
    }

    if (!isValidBirthDate(birthDate)) {
      playTone('warn');
      setFormError(t.invalidBirthDateError);
      return;
    }

    // If patient is a known patient, ID and national registry number are not required
    if (patientType !== 'known') {
      const isIdOptional = hasForeignNationality || unknownIdentification;
      if (!isIdOptional) {
        if (!nationalRegNum.trim()) {
          playTone('warn');
          setFormError(t.requiredFieldsError);
          return;
        }
        const cleanReg = nationalRegNum.replace(/\D/g, '');
        if (cleanReg.length !== 11) {
          playTone('warn');
          setFormError(t.invalidRegistryNumError);
          return;
        }
        if (!idCardNum.trim()) {
          playTone('warn');
          setFormError(t.requiredIdCardError);
          return;
        }
      } else {
        // If optional and a registry number was entered, validate only if unknownIdentification is false
        if (nationalRegNum.trim() && !unknownIdentification) {
          const cleanReg = nationalRegNum.replace(/\D/g, '');
          if (cleanReg.length > 0 && cleanReg.length !== 11) {
            playTone('warn');
            setFormError(t.invalidRegistryNumError);
            return;
          }
        }
      }
    }

    setFormError('');

    // Pre-initialize appointmentTime with a rounded upcoming slot if not set
    if (!appointmentTime) {
      const now = new Date();
      const currentHour = now.getHours();
      const clampedHour = Math.max(8, Math.min(18, currentHour));
      const hr = clampedHour.toString().padStart(2, '0');
      const minRemainder = now.getMinutes() % 15;
      const roundedMin = ((minRemainder > 7 ? now.getMinutes() + (15 - minRemainder) : now.getMinutes() - minRemainder) % 60).toString().padStart(2, '0');
      setAppointmentTime(`${hr}:${roundedMin}`);
    }

    setShowVirtualKeyboard(false);
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

    const doctor = availableDoctors.find(d => d.id === selectedDoctorId);
    if (!doctor) {
      playTone('warn');
      setFormError("Geselecteerde arts of verpleegkundige is niet beschikbaar.");
      return;
    }

    setFormError('');
    const late = checkIsLate(appointmentTime);
    setIsPatientLate(late);

    // "De verpleegkundige zit altijd op gelijkvloers"
    const isNurse = (doctor.id === 'nurse-verpleegkundige') || doctor.name.toLowerCase().includes('verpleegkundige');
    const assignedRoom = isNurse ? 'Gelijkvloers' : doctor.waitingRoom;
    setResolvedRoom(assignedRoom);

    if (late) {
      playTone('warn');
    } else {
      playTone('success');
    }

    const isIdOptional = (patientType === 'known') || hasForeignNationality || unknownIdentification;
    // Register Patient
    onPatientRegister({
      firstName,
      lastName,
      birthDate,
      nationalRegistryNum: isIdOptional ? (nationalRegNum.trim() || '-') : nationalRegNum,
      idCardNum: isIdOptional ? (idCardNum.trim() || undefined) : idCardNum,
      hasForeignNationality,
      unknownIdentification,
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
        "Rijksregisternummer": nationalRegNum.trim() ? nationalRegNum : (patientType === 'known' ? 'Gekende patiënt' : 'Niet gekend'),
        "Status": "⚠️ TE LAAT (ROOD/VET/OPVALLEND)",
        "Wachtzaal": assignedRoom === 'Gelijkvloers' ? 'Gelijkvloers (G)' : 'Bovenverdieping (B)'
      });
    }

    setShowVirtualKeyboard(false);
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

    // Name is always required
    if (!firstName.trim() || !lastName.trim()) {
      playTone('warn');
      setFormError(t.requiredFieldsError);
      return;
    }

    // Unless the patient indicates foreign nationality or unknown identification,
    // Rijksregisternummer is strictly required.
    const isIdOptional = hasForeignNationality || unknownIdentification;
    if (!isIdOptional) {
      if (!nationalRegNum.trim()) {
        playTone('warn');
        setFormError(t.requiredFieldsError);
        return;
      }
      const cleanReg = nationalRegNum.replace(/\D/g, '');
      if (cleanReg.length !== 11) {
        playTone('warn');
        setFormError(t.invalidRegistryNumError);
        return;
      }
    } else {
      if (nationalRegNum.trim() && !unknownIdentification) {
        const cleanReg = nationalRegNum.replace(/\D/g, '');
        if (cleanReg.length > 0 && cleanReg.length !== 11) {
          playTone('warn');
          setFormError(t.invalidRegistryNumError);
          return;
        }
      }
    }

    setFormError('');
    playTone('success');

    const finalRegistryNum = isIdOptional ? (nationalRegNum.trim() || '-') : nationalRegNum;

    // Register Patient info
    onPatientRegister({
      firstName,
      lastName,
      birthDate: '-',
      nationalRegistryNum: finalRegistryNum,
      idCardNum: isIdOptional ? (idCardNum.trim() || '') : (idCardNum.trim() || ''),
      hasForeignNationality,
      unknownIdentification,
      appointmentTime: undefined,
      doctorId: undefined,
      doctorName: undefined,
      hasAppointment: false,
      flowType: 'patient_info'
    });

    // Send Simulated Teams notification to active support staff member
    const message = `👤 **Aanvraag Baliehulp**: Patiënt zonder afspraak **${firstName} ${lastName}** (Rijksregisternr: ${finalRegistryNum}) vraagt om verdere inlichtingen bij de ontvangstkiosk. Gelieve deze persoon te assisteren.`;
    onTeamsNotify(message, 'Ondersteunende Medewerker', {
      type: 'patient_info',
      patientName: `${firstName} ${lastName}`,
      nationalRegistryNum: finalRegistryNum,
      time: new Date().toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })
    });

    setShowVirtualKeyboard(false);
    setCurrentScreen('f2_success');
  };

  const isCurrentRtl = isRtl(lang);

  return (
    <div 
      className={`relative flex flex-col justify-between bg-gradient-to-b from-[#f8fafc] via-[#f1f5f9] to-[#e2e8f0] text-slate-800 select-none transition-all duration-300 w-full min-h-screen p-4 sm:p-6 md:p-8 overflow-y-auto ${
        showVirtualKeyboard ? 'pb-72 sm:pb-80 md:pb-96' : ''
      }`}
      dir={isCurrentRtl ? 'rtl' : 'ltr'}
    >
      {/* High-End Clinic Brand Header Decorator - Apple Glass Bar */}
      <div className="flex justify-between items-center border-b border-black/5 pb-3 mb-2">
        <div className="flex items-center gap-2.5">
          <div className="h-2.5 w-2.5 rounded-full bg-[#0071E3] shadow-sm shadow-blue-500/50 animate-pulse"></div>
          <button
            type="button"
            onClick={onOpenAdmin || onRequestStaffUnlock}
            className="font-sans font-bold tracking-tight text-slate-800 text-sm sm:text-base flex items-center gap-1.5 hover:text-[#0071E3] transition text-left cursor-pointer"
            title="Klik voor balie-/secretariaatsbeheer"
          >
            Huidcentrum Gent
          </button>
          {isKioskLocked && (
            <button
              onClick={onRequestStaffUnlock}
              className="ml-2 flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 border border-amber-500/30 rounded-full text-[11px] font-semibold transition cursor-pointer backdrop-blur-xs"
              title="Kiosk is vergrendeld voor patiënten. Klik om als baliepersoneel te ontgrendelen met PIN."
            >
              <Lock className="h-3 w-3 text-amber-600" />
              <span>Vergrendeld</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
          <span className="flex items-center gap-1 bg-white/70 px-2.5 py-1 rounded-full border border-black/5 shadow-2xs backdrop-blur-xs">
            <Clock className="h-3.5 w-3.5 text-[#0071E3]" />
            {currentTimeStr || "00:00:00"}
          </span>
        </div>
      </div>

      {/* RENDER ACTIVE SCREEN */}
      <div className={`flex-1 flex flex-col justify-center items-center py-2 transition-all duration-300 ${showVirtualKeyboard ? 'justify-start pt-1' : ''}`}>
        {currentScreen === 'home' && (
          <div className="w-full text-center max-w-xl animate-fade-in">
            <h1 className="text-2xl sm:text-3xl font-sans text-slate-900 font-bold mb-6 tracking-tight">
              {t.welcomeTitle}
            </h1>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
              <button
                id="btn-kiosk-has-appointment"
                onClick={startFlow1}
                className="group relative flex flex-col items-center justify-center p-6 rounded-2xl apple-glass-card apple-glass-card-hover apple-glass-card-active text-slate-900 font-bold text-base cursor-pointer h-40 border border-white/80"
              >
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-500 to-sky-400 text-white flex items-center justify-center mb-3 shadow-md shadow-blue-500/25 group-hover:scale-110 transition-transform duration-300">
                  <Calendar className="h-6 w-6" />
                </div>
                <span className="tracking-tight">{t.hasAppointmentBtn}</span>
                <span className="text-[11px] font-normal text-slate-500 mt-1">
                  Ik heb reeds een tijdstip gereserveerd
                </span>
              </button>

              <button
                id="btn-kiosk-no-appointment"
                onClick={startFlow2}
                className="group relative flex flex-col items-center justify-center p-6 rounded-2xl apple-glass-card apple-glass-card-hover apple-glass-card-active text-slate-900 font-bold text-base cursor-pointer h-40 border border-white/80"
              >
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-slate-200 to-slate-100 text-slate-700 flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform duration-300 border border-black/5">
                  <User className="h-6 w-6 text-slate-700" />
                </div>
                <span className="tracking-tight">{t.noAppointmentBtn}</span>
                <span className="text-[11px] font-normal text-slate-500 mt-1">
                  Aangemeld voor inlichtingen of levering
                </span>
              </button>
            </div>

            <div className="mt-5 flex justify-center w-full">
              <button
                id="btn-kiosk-help"
                onClick={handleHelpClick}
                disabled={helpCooldown}
                className="group relative flex items-center justify-center gap-2 p-3 rounded-xl bg-white/60 hover:bg-white border border-black/5 text-slate-600 hover:text-slate-900 font-medium text-xs shadow-2xs transition-all duration-200 cursor-pointer w-full max-w-sm disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-xs"
              >
                <Info className="h-4 w-4 text-[#0071E3]" />
                <span>{t.helpBtnText}</span>
              </button>
            </div>
          </div>
        )}

        {/* FLOW 1: NEW VS KNOWN PATIENT SELECTION (Step 1 of 3) */}
        {currentScreen === 'f1_patient_type' && (
          <div className="w-full max-w-xl animate-fade-in flex flex-col h-full justify-between">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-sans font-bold text-slate-900 tracking-tight">{t.patientTypeTitle}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{t.patientTypeSub}</p>
                </div>
                <span className="text-xs font-semibold bg-blue-500/10 text-[#0071E3] border border-blue-500/20 px-3 py-1 rounded-full font-mono">
                  Stap 1 van 3
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full mt-2">
                <button
                  id="btn-kiosk-known-patient"
                  type="button"
                  onClick={() => handleSelectPatientType('known')}
                  className="group relative flex flex-col items-center justify-center p-6 rounded-2xl apple-glass-card apple-glass-card-hover apple-glass-card-active text-slate-900 font-bold text-base cursor-pointer min-h-[160px] border border-white/80"
                >
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center mb-3 shadow-md shadow-emerald-500/25 group-hover:scale-110 transition-transform duration-300">
                    <UserCheck className="h-6 w-6" />
                  </div>
                  <span className="tracking-tight text-center">{t.knownPatientOption}</span>
                  <span className="text-[11px] font-normal text-slate-500 mt-1.5 text-center leading-tight">
                    {t.knownPatientSub}
                  </span>
                </button>

                <button
                  id="btn-kiosk-new-patient"
                  type="button"
                  onClick={() => handleSelectPatientType('new')}
                  className="group relative flex flex-col items-center justify-center p-6 rounded-2xl apple-glass-card apple-glass-card-hover apple-glass-card-active text-slate-900 font-bold text-base cursor-pointer min-h-[160px] border border-white/80"
                >
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-500 to-sky-400 text-white flex items-center justify-center mb-3 shadow-md shadow-blue-500/25 group-hover:scale-110 transition-transform duration-300">
                    <UserPlus className="h-6 w-6" />
                  </div>
                  <span className="tracking-tight text-center">{t.newPatientOption}</span>
                  <span className="text-[11px] font-normal text-slate-500 mt-1.5 text-center leading-tight">
                    {t.newPatientSub}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex justify-start items-center pt-3 border-t border-black/5 mt-4">
              <button
                type="button"
                onClick={() => { playTone('tap'); setCurrentScreen('home'); }}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition duration-150 cursor-pointer"
              >
                {isCurrentRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                {t.backBtn}
              </button>
            </div>
          </div>
        )}

        {/* FLOW 1: PATIENT MET AFSPRAAK - STEP 2 (Personal details input) */}
        {currentScreen === 'f1_details' && (
          <div className="w-full max-w-2xl animate-fade-in flex flex-col h-full justify-between">
            <div>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h2 className="text-xl font-sans font-bold text-slate-900 tracking-tight">{t.personalDetailsTitle}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {patientType === 'known' ? t.knownPatientNotice : t.personalDetailsSub}
                  </p>
                </div>
                <span className="text-xs font-semibold bg-blue-500/10 text-[#0071E3] border border-blue-500/20 px-3 py-1 rounded-full font-mono">
                  Stap 2 van 3
                </span>
              </div>

              {formError && (
                <div className="mb-2.5 p-3 rounded-xl bg-red-500/10 text-red-700 text-xs flex items-center gap-2 border border-red-500/20 backdrop-blur-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                  <span>{formError}</span>
                </div>
              )}

              {patientType === 'known' && (
                <div className="mb-3 p-3 rounded-xl bg-emerald-500/10 text-emerald-800 text-xs flex items-center gap-2 border border-emerald-500/20 backdrop-blur-xs">
                  <UserCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="font-medium">{t.knownPatientNotice}</span>
                </div>
              )}

              <form onSubmit={submitF1Details} className="grid grid-cols-2 gap-3 apple-glass-card p-4 rounded-2xl border border-white/80">
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-700 mb-1">{t.firstNameLabel} *</label>
                  <input
                    id="input-kiosk-f1-firstname"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    onFocus={() => handleInputFocus('firstName', 'Voornaam', false)}
                    onClick={() => handleInputFocus('firstName', 'Voornaam', false)}
                    placeholder="bijv. Sophie"
                    className="p-2.5 text-sm rounded-xl apple-glass-input scroll-mt-16"
                    required
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-700 mb-1">{t.lastNameLabel} *</label>
                  <input
                    id="input-kiosk-f1-lastname"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    onFocus={() => handleInputFocus('lastName', 'Achternaam', false)}
                    onClick={() => handleInputFocus('lastName', 'Achternaam', false)}
                    placeholder="bijv. Peeters"
                    className="p-2.5 text-sm rounded-xl apple-glass-input scroll-mt-16"
                    required
                  />
                </div>

                <div className={`flex flex-col ${patientType === 'known' ? 'col-span-2 sm:col-span-1' : ''}`}>
                  <label className="text-xs font-semibold text-slate-700 mb-1">{t.birthDateLabel} *</label>
                  <input
                    id="input-kiosk-f1-birthdate"
                    type="text"
                    value={birthDate}
                    onChange={(e) => handleBirthDateChange(e.target.value)}
                    onFocus={() => handleInputFocus('birthDate', 'Geboortedatum (DD/MM/JJJJ)', true)}
                    onClick={() => handleInputFocus('birthDate', 'Geboortedatum (DD/MM/JJJJ)', true)}
                    maxLength={10}
                    placeholder="DD/MM/JJJJ (bijv. 14/08/1985)"
                    className="p-2.5 text-sm rounded-xl apple-glass-input scroll-mt-16"
                    required
                  />
                </div>

                {/* Only display ID Card and National Registry fields for NEW patients */}
                {patientType !== 'known' && (
                  <>
                    {/* Keuzeknoppen voor Identificatie / Nationaliteit */}
                    <div className="col-span-2 flex flex-col gap-2.5">
                      {/* Geen Belgische Nationaliteit Toggle */}
                      <div 
                        onClick={() => {
                          setHasForeignNationality(!hasForeignNationality);
                          setFormError('');
                        }}
                        className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition select-none ${
                          hasForeignNationality 
                            ? 'bg-blue-500/10 border-[#0071E3]/50 shadow-xs' 
                            : 'bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/10'
                        }`}
                      >
                        <input
                          id="checkbox-kiosk-f1-non-belgian"
                          type="checkbox"
                          checked={hasForeignNationality}
                          onChange={(e) => {
                            setHasForeignNationality(e.target.checked);
                            setFormError('');
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0071E3] focus:ring-[#0071E3] cursor-pointer shrink-0"
                        />
                        <label htmlFor="checkbox-kiosk-f1-non-belgian" className="text-xs text-slate-700 cursor-pointer select-none">
                          <span className="font-semibold text-slate-900 block">{t.nonBelgianNationalityCheckbox}</span>
                          <span className="text-slate-500 block text-[11px] mt-0.5">{t.nonBelgianNationalityHint}</span>
                        </label>
                      </div>

                      {/* Rijksregisternummer / ID niet gekend Toggle */}
                      <div 
                        onClick={() => {
                          setUnknownIdentification(!unknownIdentification);
                          setFormError('');
                        }}
                        className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition select-none ${
                          unknownIdentification 
                            ? 'bg-blue-500/10 border-[#0071E3]/50 shadow-xs' 
                            : 'bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/10'
                        }`}
                      >
                        <input
                          id="checkbox-kiosk-f1-unknown-id"
                          type="checkbox"
                          checked={unknownIdentification}
                          onChange={(e) => {
                            setUnknownIdentification(e.target.checked);
                            setFormError('');
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0071E3] focus:ring-[#0071E3] cursor-pointer shrink-0"
                        />
                        <label htmlFor="checkbox-kiosk-f1-unknown-id" className="text-xs text-slate-700 cursor-pointer select-none">
                          <span className="font-semibold text-slate-900 block">{t.unknownIdCheckbox}</span>
                          <span className="text-slate-500 block text-[11px] mt-0.5">{t.unknownIdHint}</span>
                        </label>
                      </div>
                    </div>

                    <div className="flex flex-col">
                      <label className="text-xs font-semibold text-slate-700 mb-1">
                        {t.registryNumLabel} {!(hasForeignNationality || unknownIdentification) && '*'}
                      </label>
                      <input
                        id="input-kiosk-f1-regnum"
                        type="text"
                        value={nationalRegNum}
                        onChange={(e) => handleNationalRegNumChange(e.target.value)}
                        onFocus={() => handleInputFocus('nationalRegNum', 'Rijksregisternummer (YY.MM.DD-XXX.CC)', true)}
                        onClick={() => handleInputFocus('nationalRegNum', 'Rijksregisternummer (YY.MM.DD-XXX.CC)', true)}
                        maxLength={15}
                        placeholder={(hasForeignNationality || unknownIdentification) ? "Optioneel (bv. 85.08.14-123.45)" : "bijv. 85.08.14-123.45"}
                        className="p-2.5 text-sm rounded-xl apple-glass-input scroll-mt-16"
                        required={!(hasForeignNationality || unknownIdentification)}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="text-xs font-semibold text-slate-700 mb-1">
                        {t.idCardLabel} {!(hasForeignNationality || unknownIdentification) && '*'}
                        {(hasForeignNationality || unknownIdentification) && (
                          <span className="text-[9px] text-slate-400 font-normal ml-1">(Optioneel)</span>
                        )}
                      </label>
                      <input
                        id="input-kiosk-f1-idcard"
                        type="text"
                        maxLength={14}
                        placeholder={(hasForeignNationality || unknownIdentification) ? "Optioneel (bv. 592-1234567-89)" : "bijv. 592-1234567-89"}
                        value={idCardNum}
                        onChange={(e) => handleIdCardNumChange(e.target.value)}
                        onFocus={() => handleInputFocus('idCardNum', 'Identiteitskaartnummer', true)}
                        onClick={() => handleInputFocus('idCardNum', 'Identiteitskaartnummer', true)}
                        className="p-2.5 text-sm rounded-xl apple-glass-input scroll-mt-16"
                        required={!(hasForeignNationality || unknownIdentification)}
                      />
                    </div>
                  </>
                )}
              </form>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-black/5 mt-3">
              <button
                type="button"
                onClick={() => { playTone('tap'); setCurrentScreen('f1_patient_type'); }}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition duration-150 cursor-pointer"
              >
                {isCurrentRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                {t.backBtn}
              </button>

              <button
                type="button"
                onClick={submitF1Details}
                className="flex items-center gap-1.5 bg-[#0071E3] hover:bg-[#0077ED] active:scale-95 text-white px-6 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-blue-500/25 transition duration-150 cursor-pointer"
              >
                {t.nextBtn}
                {isCurrentRtl ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}

        {/* FLOW 1: STEP 3 (Select Time & Practitioner / De verpleegkundige) */}
        {currentScreen === 'f1_appointment' && (
          <div className="w-full max-w-xl animate-fade-in flex flex-col h-full justify-between">
            <div>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h2 className="text-xl font-sans font-bold text-slate-900 tracking-tight">{t.apptDetailsTitle}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{t.apptDetailsSub}</p>
                </div>
                <span className="text-xs font-semibold bg-blue-500/10 text-[#0071E3] border border-blue-500/20 px-3 py-1 rounded-full font-mono">
                  Stap 3 van 3
                </span>
              </div>

              {formError && (
                <div className="mb-3 p-3 rounded-xl bg-red-500/10 text-red-700 text-xs flex items-center gap-2 border border-red-500/20 backdrop-blur-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleConfirmF1Appointment} className="space-y-4 apple-glass-card p-5 rounded-2xl border border-white/80">
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-700 mb-1.5">{t.apptTimeLabel}</label>
                  <div className="flex gap-2.5">
                    <select
                      id="input-kiosk-f1-time-hr"
                      value={appointmentTime ? appointmentTime.split(':')[0] : ''}
                      onChange={(e) => {
                        const min = (appointmentTime && appointmentTime.split(':')[1]) ? appointmentTime.split(':')[1] : '00';
                        setAppointmentTime(`${e.target.value}:${min}`);
                      }}
                      className="p-3 w-full text-base rounded-xl apple-glass-input font-medium"
                      required
                    >
                      <option value="" disabled>Uur</option>
                      {Array.from({ length: 11 }, (_, i) => i + 8).map((hour) => {
                        const v = hour.toString().padStart(2, '0');
                        return <option key={`hr-${v}`} value={v}>{v}u</option>;
                      })}
                    </select>
                    <span className="text-xl font-bold self-center text-slate-400">:</span>
                    <select
                      id="input-kiosk-f1-time-min"
                      value={appointmentTime ? appointmentTime.split(':')[1] : ''}
                      onChange={(e) => {
                        const hr = (appointmentTime && appointmentTime.split(':')[0]) ? appointmentTime.split(':')[0] : '08';
                        setAppointmentTime(`${hr}:${e.target.value}`);
                      }}
                      className="p-3 w-full text-base rounded-xl apple-glass-input font-medium"
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
                  <label className="text-xs font-semibold text-slate-700 mb-1.5">{t.apptDoctorLabel}</label>
                  <select
                    id="select-kiosk-f1-doctor"
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                    className="p-3 w-full text-sm rounded-xl apple-glass-input font-medium"
                    required
                  >
                    <option value="">{t.selectDoctorPlaceholder}</option>
                    {availableDoctors && availableDoctors.map((dr) => {
                      const isNurse = (dr.id === 'nurse-verpleegkundige') || dr.name.toLowerCase().includes('verpleegkundige');
                      const roomLabel = isNurse || dr.waitingRoom === 'Gelijkvloers' ? 'Gelijkvloers' : '1ste Verdiep';
                      return (
                        <option key={dr.id} value={dr.id}>
                          {dr.name} - {dr.specialty} ({roomLabel})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </form>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-black/5 mt-4">
              <button
                type="button"
                onClick={() => { playTone('tap'); setCurrentScreen('f1_details'); }}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition duration-150 cursor-pointer"
              >
                {isCurrentRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                {t.backBtn}
              </button>

              <button
                type="button"
                onClick={handleConfirmF1Appointment}
                className="flex items-center gap-2 bg-[#0071E3] hover:bg-[#0077ED] active:scale-95 text-white px-7 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-blue-500/30 transition duration-150 cursor-pointer"
              >
                <CheckCircle className="h-4 w-4 text-white" />
                {t.confirmBtn}
              </button>
            </div>
          </div>
        )}

        {/* FLOW 1: SUCCESS RESULT PAGE (Auto countdown) */}
        {currentScreen === 'f1_success' && (
          <div className="w-full max-w-2xl text-center animate-bounce-in py-2">
            <div className="h-16 w-16 bg-emerald-500/15 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/30 shadow-lg shadow-emerald-500/20">
              <CheckCircle className="h-9 w-9 text-emerald-600" />
            </div>

            <h2 className="text-2xl font-sans font-bold text-slate-900 mb-1.5 tracking-tight">
              {t.checkinSuccessTitle}
            </h2>
            
            <p className="text-slate-500 text-sm mb-5">
              Mevr/Dhr. <strong>{lastName}</strong>, {t.teamsNotificationSent}
            </p>

            <div className="p-5 apple-glass-card rounded-2xl inline-block max-w-[480px] border border-white/90 shadow-lg mb-5">
              <span className="block text-xs uppercase font-mono tracking-wider font-semibold text-slate-400 mb-1">
                {t.directionPrefix}
              </span>
              <span className="text-xl font-sans font-bold text-slate-900">
                {resolvedRoom === 'Gelijkvloers' ? t.waitingRoomGround : t.waitingRoomFirst}
              </span>
            </div>

            {isPatientLate && (
              <div className="mx-auto max-w-md p-3.5 rounded-xl bg-amber-500/10 text-amber-800 text-xs flex items-center gap-2.5 border border-amber-500/20 mb-4 backdrop-blur-xs">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                <span className="text-start font-medium">{t.lateWarningText}</span>
              </div>
            )}

            <div className="text-xs text-slate-400">
              <p>{t.redirectTimerText.replace('{seconds}', countdown.toString())}</p>
              <button 
                onClick={handleResetToHome}
                className="mt-2.5 underline hover:text-slate-900 cursor-pointer text-[11px] font-semibold"
              >
                {t.returnToStartBtn}
              </button>
            </div>
          </div>
        )}

        {/* FLOW 2: WITHOUT APPOINTMENT - OPTION CHOICES */}
        {currentScreen === 'f2_choice' && (
          <div className="w-full max-w-2xl text-center animate-fade-in">
            <h2 className="text-xl sm:text-2xl font-sans font-bold text-slate-900 mb-6 tracking-tight">
              {t.noApptTitle}
            </h2>

            <div className="flex flex-col gap-3.5 max-w-md mx-auto">
              <button
                id="btn-kiosk-f2-patient"
                onClick={() => selectF2Choice('patient_info')}
                className="flex items-center gap-4 p-4.5 rounded-2xl apple-glass-card apple-glass-card-hover apple-glass-card-active text-start cursor-pointer border border-white/80"
              >
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-[#0071E3] flex items-center justify-center shrink-0 border border-blue-500/20">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-slate-900 font-bold text-sm">{t.optionPatientInfo}</div>
                </div>
              </button>

              <button
                id="btn-kiosk-f2-nonpatient"
                onClick={() => selectF2Choice('non_patient')}
                className="flex items-center gap-4 p-4.5 rounded-2xl apple-glass-card apple-glass-card-hover apple-glass-card-active text-start cursor-pointer border border-white/80"
              >
                <div className="h-10 w-10 rounded-xl bg-slate-200/60 text-slate-700 flex items-center justify-center shrink-0 border border-black/5">
                  <Info className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-slate-900 font-bold text-sm">{t.optionNonPatient}</div>
                </div>
              </button>
            </div>

            <button
              onClick={handleResetToHome}
              className="mt-6 flex items-center gap-1 mx-auto text-xs font-semibold text-slate-500 hover:text-slate-900 transition cursor-pointer"
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
                  <h2 className="text-xl font-sans font-bold text-slate-900 tracking-tight">{t.patientHelpTitle}</h2>
                  <p className="text-xs text-slate-500">{t.patientHelpSub}</p>
                </div>
              </div>

              {formError && (
                <div className="mb-3 p-3 rounded-xl bg-red-500/10 text-red-700 text-xs flex items-center gap-2 border border-red-500/20 col-span-2 backdrop-blur-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={submitF2PatientForm} className="grid grid-cols-2 gap-3 apple-glass-card p-5 rounded-2xl border border-white/80">
                {/* Keuzeknoppen voor Identificatie / Nationaliteit */}
                <div className="col-span-2 flex flex-col gap-2.5">
                  {/* Geen Belgische Nationaliteit Toggle */}
                  <div 
                    onClick={() => {
                      setHasForeignNationality(!hasForeignNationality);
                      setFormError('');
                    }}
                    className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition select-none ${
                      hasForeignNationality 
                        ? 'bg-blue-500/10 border-[#0071E3]/50 shadow-xs' 
                        : 'bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/10'
                    }`}
                  >
                    <input
                      id="checkbox-kiosk-f2-non-belgian"
                      type="checkbox"
                      checked={hasForeignNationality}
                      onChange={(e) => {
                        setHasForeignNationality(e.target.checked);
                        setFormError('');
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0071E3] focus:ring-[#0071E3] cursor-pointer shrink-0"
                    />
                    <label htmlFor="checkbox-kiosk-f2-non-belgian" className="text-xs text-slate-700 cursor-pointer select-none">
                      <span className="font-semibold text-slate-900 block">{t.nonBelgianNationalityCheckbox}</span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">{t.nonBelgianNationalityHint}</span>
                    </label>
                  </div>

                  {/* Rijksregisternummer / ID niet gekend Toggle */}
                  <div 
                    onClick={() => {
                      setUnknownIdentification(!unknownIdentification);
                      setFormError('');
                    }}
                    className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition select-none ${
                      unknownIdentification 
                        ? 'bg-blue-500/10 border-[#0071E3]/50 shadow-xs' 
                        : 'bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/10'
                    }`}
                  >
                    <input
                      id="checkbox-kiosk-f2-unknown-id"
                      type="checkbox"
                      checked={unknownIdentification}
                      onChange={(e) => {
                        setUnknownIdentification(e.target.checked);
                        setFormError('');
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0071E3] focus:ring-[#0071E3] cursor-pointer shrink-0"
                    />
                    <label htmlFor="checkbox-kiosk-f2-unknown-id" className="text-xs text-slate-700 cursor-pointer select-none">
                      <span className="font-semibold text-slate-900 block">{t.unknownIdCheckbox}</span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">{t.unknownIdHint}</span>
                    </label>
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-700 mb-1">{t.firstNameLabel} *</label>
                  <input
                    id="input-kiosk-f2-firstname"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    onFocus={() => handleInputFocus('firstName', 'Voornaam', false)}
                    onClick={() => handleInputFocus('firstName', 'Voornaam', false)}
                    placeholder="Voornaam"
                    className="p-2.5 text-sm rounded-xl apple-glass-input scroll-mt-16"
                    required
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-slate-700 mb-1">{t.lastNameLabel} *</label>
                  <input
                    id="input-kiosk-f2-lastname"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    onFocus={() => handleInputFocus('lastName', 'Achternaam', false)}
                    onClick={() => handleInputFocus('lastName', 'Achternaam', false)}
                    placeholder="Achternaam"
                    className="p-2.5 text-sm rounded-xl apple-glass-input scroll-mt-16"
                    required
                  />
                </div>

                <div className="flex flex-col col-span-2">
                  <label className="text-xs font-semibold text-slate-700 mb-1">
                    {t.registryNumLabel} {!(hasForeignNationality || unknownIdentification) && '*'}
                    <span className="text-[10px] text-slate-400 font-normal ml-1">
                      {(hasForeignNationality || unknownIdentification) ? '(Optioneel)' : 'Ter identificatie bij de balie'}
                    </span>
                  </label>
                  <input
                    id="input-kiosk-f2-regnum"
                    type="text"
                    value={nationalRegNum}
                    onChange={(e) => handleNationalRegNumChange(e.target.value)}
                    onFocus={() => handleInputFocus('nationalRegNum', 'Rijksregisternummer (YY.MM.DD-XXX.CC)', true)}
                    onClick={() => handleInputFocus('nationalRegNum', 'Rijksregisternummer (YY.MM.DD-XXX.CC)', true)}
                    maxLength={15}
                    placeholder={(hasForeignNationality || unknownIdentification) ? "Optioneel (bv. 85.08.14-123.45)" : "Rijksregisternummer (bijv. 85.08.14-123.45)"}
                    className="p-2.5 text-sm rounded-xl apple-glass-input scroll-mt-16"
                    required={!(hasForeignNationality || unknownIdentification)}
                  />
                </div>
              </form>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-black/5 mt-4">
              <button
                onClick={() => { playTone('tap'); setCurrentScreen('f2_choice'); }}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition duration-150 cursor-pointer"
              >
                {isCurrentRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                {t.backBtn}
              </button>

              <button
                type="button"
                onClick={submitF2PatientForm}
                className="flex items-center gap-1.5 bg-[#0071E3] hover:bg-[#0077ED] active:scale-95 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-blue-500/25 transition duration-150 cursor-pointer"
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
            <div className="h-16 w-16 bg-blue-500/15 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/30 shadow-lg shadow-blue-500/20">
              <CheckCircle className="h-9 w-9 text-[#0071E3]" />
            </div>

            <h2 className="text-2xl font-sans font-bold text-slate-900 mb-1.5 tracking-tight">
              {t.noApptSuccessTitle}
            </h2>
            
            <p className="text-slate-600 text-sm leading-relaxed max-w-md mx-auto mb-6">
              {firstName === 'Bezoeker/Leverancier' ? t.nonPatientSuccessMsg : t.noApptSuccessMsg}
            </p>

            <div className="text-xs text-slate-400">
              <p>{t.redirectTimerText.replace('{seconds}', countdown.toString())}</p>
              <button 
                onClick={handleResetToHome}
                className="mt-2 text-xs underline hover:text-slate-900 cursor-pointer font-medium"
              >
                {t.returnToStartBtn}
              </button>
            </div>
          </div>
        )}

        {/* HELP REQUEST FORM SCREEN */}
        {currentScreen === 'help_form' && (
          <div className="w-full max-w-xl animate-fade-in flex flex-col h-full justify-between">
            <div>
              <div className="text-center mb-4">
                <div className="h-12 w-12 bg-amber-500/15 rounded-2xl flex items-center justify-center mx-auto mb-2.5 border border-amber-500/30 shadow-md shadow-amber-500/15">
                  <Info className="h-6 w-6 text-amber-600" />
                </div>
                <h2 className="text-xl font-sans font-bold text-slate-900 tracking-tight">
                  {t.helpScreenTitle}
                </h2>
                <p className="text-slate-500 text-xs mt-1">
                  {t.helpScreenSub}
                </p>
              </div>

              {formError && (
                <div className="mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 text-xs font-medium flex items-center gap-2 animate-fade-in">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={submitHelpRequest} className="flex flex-col gap-3 apple-glass-card p-5 rounded-2xl border border-white/80">
                <div className="flex flex-col">
                  <label htmlFor="input-kiosk-help-name" className="text-xs font-semibold text-slate-700 mb-1">
                    {t.helpNameLabel} *
                  </label>
                  <input
                    id="input-kiosk-help-name"
                    type="text"
                    value={helpName}
                    onChange={(e) => {
                      setHelpName(e.target.value);
                      if (formError) setFormError('');
                    }}
                    onFocus={() => handleInputFocus('helpName', t.helpNameLabel, false)}
                    onClick={() => handleInputFocus('helpName', t.helpNameLabel, false)}
                    placeholder="bijv. Jan Janssens"
                    className="p-3 text-sm rounded-xl apple-glass-input scroll-mt-16"
                    required
                    autoFocus
                  />
                </div>

                <div className="flex flex-col">
                  <label htmlFor="input-kiosk-help-desc" className="text-xs font-semibold text-slate-700 mb-1">
                    {t.helpDescriptionLabel}
                  </label>
                  <textarea
                    id="input-kiosk-help-desc"
                    rows={3}
                    value={helpDescription}
                    onChange={(e) => setHelpDescription(e.target.value)}
                    onFocus={() => handleInputFocus('helpDescription', t.helpDescriptionLabel, false)}
                    onClick={() => handleInputFocus('helpDescription', t.helpDescriptionLabel, false)}
                    placeholder={t.helpDescriptionPlaceholder}
                    className="p-3 text-sm rounded-xl apple-glass-input resize-none scroll-mt-16"
                  />
                </div>
              </form>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-black/5 mt-4">
              <button
                type="button"
                id="btn-kiosk-help-cancel"
                onClick={handleCancelHelp}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition duration-150 cursor-pointer rounded-xl bg-white/60 hover:bg-white border border-black/5"
              >
                {isCurrentRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                {t.helpCancelBtn}
              </button>

              <button
                type="button"
                id="btn-kiosk-help-submit"
                onClick={submitHelpRequest}
                className="flex items-center gap-1.5 bg-[#0071E3] hover:bg-[#0077ED] active:scale-95 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-blue-500/25 transition duration-150 cursor-pointer"
              >
                <Info className="h-4 w-4" />
                {t.helpSubmitBtn}
              </button>
            </div>
          </div>
        )}

        {/* HELP SUCCESS PAGE */}
        {currentScreen === 'help_success' && (
          <div className="w-full max-w-xl text-center animate-fade-in py-4">
            <div className="h-16 w-16 bg-blue-500/15 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/30 shadow-lg shadow-blue-500/20">
              <CheckCircle className="h-9 w-9 text-[#0071E3]" />
            </div>

            <h2 className="text-2xl font-sans font-bold text-slate-900 mb-1.5 tracking-tight">
              {t.helpSuccessTitle}
            </h2>
            
            <p className="text-slate-600 text-sm leading-relaxed max-w-md mx-auto mb-6">
              {t.helpSuccessMsg}
            </p>

            <div className="text-xs text-slate-400">
              <p>{t.redirectTimerText.replace('{seconds}', countdown.toString())}</p>
              <button 
                onClick={handleResetToHome}
                className="mt-2 text-xs underline hover:text-slate-900 cursor-pointer font-medium"
              >
                {t.returnToStartBtn}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM ACTION BAR - Apple Glass Action Pills */}
      <div 
        className={`flex items-center gap-2 border-t border-black/5 pt-2.5 mt-2 select-none ${isCurrentRtl ? 'justify-start' : 'justify-end'}`}
        dir={isCurrentRtl ? 'rtl' : 'ltr'}
      >
        {/* Toggle Virtual Keyboard Button */}
        <button
          id="btn-kiosk-toggle-keyboard"
          type="button"
          onClick={() => {
            const nextState = !showVirtualKeyboard;
            setShowVirtualKeyboard(nextState);
            if (nextState && !activeInputField) {
              if (currentScreen === 'f1_details' || currentScreen === 'f2_patient_form') {
                setActiveInputField({ id: 'firstName', label: 'Voornaam', isNumeric: false });
              } else if (currentScreen === 'help_form') {
                setActiveInputField({ id: 'helpName', label: t.helpNameLabel, isNumeric: false });
              }
            }
          }}
          className={`flex items-center gap-1.5 text-xs transition-all duration-200 font-semibold cursor-pointer py-1.5 px-3.5 rounded-full border backdrop-blur-xs ${
            showVirtualKeyboard 
              ? 'bg-[#0071E3] text-white border-blue-400/40 shadow-sm' 
              : 'text-slate-600 hover:text-slate-900 bg-white/70 border-black/5 hover:bg-white shadow-2xs'
          }`}
          title="Schermtoetsenbord in- of uitschakelen"
        >
          <Keyboard className="h-3.5 w-3.5" />
          <span>{showVirtualKeyboard ? 'Toetsenbord sluiten' : 'Toetsenbord'}</span>
        </button>

        {/* Language selector */}
        <div className="relative">
          <button
            id="btn-kiosk-lang-selector"
            onClick={() => { playTone('tap'); setLangMenuOpen(!langMenuOpen); }}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 transition font-semibold cursor-pointer py-1.5 px-3 rounded-full bg-white/70 hover:bg-white border border-black/5 shadow-2xs backdrop-blur-xs"
          >
            <Globe2 className="h-3.5 w-3.5 text-[#0071E3]" />
            <span>taal &bull; language &bull; langue</span>
            <span className="bg-[#0071E3] text-white rounded-md px-1.5 py-0.5 text-[10px] ml-1 font-bold">
              {lang}
            </span>
          </button>

          {langMenuOpen && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setLangMenuOpen(false)} 
              />
              <div 
                className={`absolute bottom-10 z-50 apple-glass border border-white/80 rounded-2xl shadow-2xl p-2 w-52 animate-fade-in-up ${isCurrentRtl ? 'left-0' : 'right-0'}`}
              >
                <div className="text-[11px] text-slate-400 font-semibold px-2.5 pb-2 border-b border-black/5 mb-1">
                  Kies uw taal / Choose language:
                </div>
                
                <button
                  onClick={() => handleLanguageSelect('NL')}
                  className={`w-full text-start px-3 py-2 rounded-xl text-sm transition flex items-center justify-between cursor-pointer ${lang === 'NL' ? 'bg-[#0071E3] text-white font-bold shadow-xs' : 'text-slate-700 hover:bg-black/5'}`}
                >
                  <span>Nederlands</span>
                  <span className={`text-xs font-mono ${lang === 'NL' ? 'text-white/80' : 'text-slate-400'}`}>NL</span>
                </button>

                <button
                  onClick={() => handleLanguageSelect('EN')}
                  className={`w-full text-start px-3 py-2 rounded-xl text-sm transition flex items-center justify-between cursor-pointer ${lang === 'EN' ? 'bg-[#0071E3] text-white font-bold shadow-xs' : 'text-slate-700 hover:bg-black/5'}`}
                >
                  <span>English</span>
                  <span className={`text-xs font-mono ${lang === 'EN' ? 'text-white/80' : 'text-slate-400'}`}>EN</span>
                </button>

                <button
                  onClick={() => handleLanguageSelect('FR')}
                  className={`w-full text-start px-3 py-2 rounded-xl text-sm transition flex items-center justify-between cursor-pointer ${lang === 'FR' ? 'bg-[#0071E3] text-white font-bold shadow-xs' : 'text-slate-700 hover:bg-black/5'}`}
                >
                  <span>Français</span>
                  <span className={`text-xs font-mono ${lang === 'FR' ? 'text-white/80' : 'text-slate-400'}`}>FR</span>
                </button>

                <button
                  onClick={() => handleLanguageSelect('TR')}
                  className={`w-full text-start px-3 py-2 rounded-xl text-sm transition flex items-center justify-between cursor-pointer ${lang === 'TR' ? 'bg-[#0071E3] text-white font-bold shadow-xs' : 'text-slate-700 hover:bg-black/5'}`}
                >
                  <span>Türkçe</span>
                  <span className={`text-xs font-mono ${lang === 'TR' ? 'text-white/80' : 'text-slate-400'}`}>TR</span>
                </button>

                <button
                  onClick={() => handleLanguageSelect('AR')}
                  className={`w-full text-start px-3 py-2 rounded-xl text-sm transition flex items-center justify-between cursor-pointer ${lang === 'AR' ? 'bg-[#0071E3] text-white font-bold shadow-xs' : 'text-slate-700 hover:bg-black/5'}`}
                >
                  <span className="font-sans">العربية</span>
                  <span className={`text-xs font-mono ${lang === 'AR' ? 'text-white/80' : 'text-slate-400'}`}>AR</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* On-Screen Touch Virtual Keyboard */}
      {showVirtualKeyboard && (
        <div className="pt-2">
          <VirtualKeyboard
            activeFieldName={activeInputField?.label || 'Actief invoerveld'}
            activeFieldValue={getCurrentInputValue()}
            isNumericOnly={activeInputField?.isNumeric || false}
            onKeyPress={handleVirtualKeyPress}
            onBackspace={handleVirtualBackspace}
            onClear={handleVirtualClear}
            onClose={() => setShowVirtualKeyboard(false)}
            onNextField={handleNextField}
            onPrevField={handlePrevField}
            hasNextField={hasNextField}
            hasPrevField={hasPrevField}
          />
        </div>
      )}
    </div>
  );
}
