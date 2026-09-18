import React, { useState, useEffect } from 'react';
import { Lock, Delete, X, AlertCircle } from 'lucide-react';

interface PinLockModalProps {
  isOpen: boolean;
  expectedPin: string;
  title?: string;
  subtitle?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const PinLockModal: React.FC<PinLockModalProps> = ({
  isOpen,
  expectedPin = '1234',
  title = 'Beveiligde Toegang',
  subtitle = 'Voer de 4-cijferige pincode in om toegang te krijgen tot het beheerportaal.',
  onSuccess,
  onCancel,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [lockoutTimer, setLockoutTimer] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError('');
    }
  }, [isOpen]);

  // Lockout countdown
  useEffect(() => {
    let interval: any = null;
    if (isLockedOut && lockoutTimer > 0) {
      interval = setInterval(() => {
        setLockoutTimer(prev => {
          if (prev <= 1) {
            setIsLockedOut(false);
            setFailedAttempts(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isLockedOut, lockoutTimer]);

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    if (isLockedOut) return;
    if (pin.length >= 6) return;

    const newPin = pin + digit;
    setPin(newPin);
    setError('');

    // Check if entered pin matches or reaches target length
    if (newPin.length === expectedPin.length) {
      if (newPin === expectedPin) {
        // Success
        setPin('');
        setError('');
        setFailedAttempts(0);
        onSuccess();
      } else {
        // Incorrect
        const attempts = failedAttempts + 1;
        setFailedAttempts(attempts);
        setError(`Onjuiste pincode. (Poging ${attempts}/3)`);
        setPin('');

        if (attempts >= 3) {
          setIsLockedOut(true);
          setLockoutTimer(30);
          setError('Te veel mislukte pogingen. Wacht 30 seconden.');
        }
      }
    }
  };

  const handleBackspace = () => {
    if (isLockedOut) return;
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    if (isLockedOut) return;
    setPin('');
    setError('');
  };

  return (
    <div 
      id="modal-pin-lock"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-fade-in"
    >
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 sm:p-8 text-center relative overflow-hidden">
        {/* Close / Cancel */}
        <button
          id="btn-pin-cancel"
          onClick={onCancel}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
          title="Annuleren en terug naar Kiosk"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Lock Icon */}
        <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
          <Lock className="w-7 h-7" />
        </div>

        <h3 className="text-xl font-bold text-slate-800 mb-1">{title}</h3>
        <p className="text-xs text-slate-500 mb-6 leading-relaxed">
          {subtitle}
        </p>

        {/* Pin Dots */}
        <div className="flex justify-center items-center gap-3 mb-6">
          {Array.from({ length: expectedPin.length }).map((_, idx) => (
            <div
              key={idx}
              className={`w-4 h-4 rounded-full transition-all duration-150 ${
                idx < pin.length
                  ? 'bg-indigo-600 scale-110 shadow-sm'
                  : 'bg-slate-200 border border-slate-300'
              }`}
            />
          ))}
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 flex items-center justify-center gap-1.5 text-xs text-rose-600 bg-rose-50 py-1.5 px-3 rounded-lg border border-rose-100 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isLockedOut && (
          <div className="mb-4 text-xs font-semibold text-amber-700 bg-amber-50 py-2 px-3 rounded-lg border border-amber-200">
            Vergrendeld voor: {lockoutTimer}s
          </div>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
            <button
              key={digit}
              id={`btn-pin-digit-${digit}`}
              disabled={isLockedOut}
              onClick={() => handleDigit(digit)}
              className="h-14 text-xl font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 active:bg-indigo-50 active:text-indigo-600 rounded-2xl border border-slate-200 shadow-xs transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {digit}
            </button>
          ))}

          <button
            id="btn-pin-clear"
            disabled={isLockedOut || pin.length === 0}
            onClick={handleClear}
            className="h-14 text-xs font-semibold text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 shadow-xs transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center"
          >
            Wissen
          </button>

          <button
            id="btn-pin-digit-0"
            disabled={isLockedOut}
            onClick={() => handleDigit('0')}
            className="h-14 text-xl font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 active:bg-indigo-50 active:text-indigo-600 rounded-2xl border border-slate-200 shadow-xs transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            0
          </button>

          <button
            id="btn-pin-backspace"
            disabled={isLockedOut || pin.length === 0}
            onClick={handleBackspace}
            className="h-14 text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 shadow-xs transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 text-[11px] text-slate-400">
          Standaard balie-pincode is ingesteld op <strong>1234</strong>
        </div>
      </div>
    </div>
  );
};

export default PinLockModal;

