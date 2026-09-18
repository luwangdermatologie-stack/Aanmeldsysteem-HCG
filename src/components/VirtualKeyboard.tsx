import React, { useState, useEffect } from 'react';
import { 
  Delete, 
  Check, 
  Globe, 
  Hash, 
  Type, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  CornerDownLeft, 
  Sparkles,
  Minimize2,
  Maximize2
} from 'lucide-react';

interface VirtualKeyboardProps {
  onKeyPress: (char: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onClose: () => void;
  activeFieldName?: string;
  activeFieldValue?: string;
  isNumericOnly?: boolean;
  onNextField?: () => void;
  onPrevField?: () => void;
  hasNextField?: boolean;
  hasPrevField?: boolean;
}

export const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({
  onKeyPress,
  onBackspace,
  onClear,
  onClose,
  activeFieldName,
  activeFieldValue = '',
  isNumericOnly = false,
  onNextField,
  onPrevField,
  hasNextField = false,
  hasPrevField = false,
}) => {
  const [layout, setLayout] = useState<'AZERTY' | 'QWERTY'>('AZERTY');
  const [isShift, setIsShift] = useState(false);
  const [isNumericMode, setIsNumericMode] = useState(isNumericOnly);
  const [isCompact, setIsCompact] = useState(true); // Default to compact to prevent covering input fields

  // Synchronize numeric mode when field changes
  useEffect(() => {
    setIsNumericMode(isNumericOnly);
  }, [isNumericOnly, activeFieldName]);

  // Subtle acoustic tap feedback
  const playClick = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(540, ctx.currentTime);
      gain.gain.setValueAtTime(0.025, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.025);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.025);
    } catch {
      // Audio context may be restricted in sandbox
    }
  };

  const handleKeyClick = (char: string) => {
    playClick();
    onKeyPress(isShift ? char.toUpperCase() : char.toLowerCase());
  };

  const handleBackspace = () => {
    playClick();
    onBackspace();
  };

  const azertyRows = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '/'],
    ['a', 'z', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['q', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm'],
    ['w', 'x', 'c', 'v', 'b', 'n', '.', '@', '\'']
  ];

  const qwertyRows = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '/'],
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm', '.', '@', '\'']
  ];

  const activeRows = layout === 'AZERTY' ? azertyRows : qwertyRows;

  // Dynamic key heights based on compact mode to maximize visible form area
  const keyHeightClass = isCompact ? 'h-8 sm:h-9 text-xs sm:text-sm' : 'h-9 sm:h-10 text-sm sm:text-base';
  const numKeyHeightClass = isCompact ? 'h-9 sm:h-10 text-base sm:text-lg' : 'h-10 sm:h-11 text-lg sm:text-xl';

  return (
    <div 
      id="kiosk-virtual-keyboard"
      className="fixed bottom-0 left-0 right-0 z-50 apple-glass border-t border-white/80 shadow-[0_-12px_45px_rgba(0,0,0,0.12)] p-2 sm:p-2.5 transition-all duration-200 select-none backdrop-blur-2xl"
      style={{
        background: 'rgba(248, 250, 252, 0.88)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        backdropFilter: 'blur(20px) saturate(160%)'
      }}
    >
      <div className="max-w-3xl mx-auto flex flex-col gap-1.5">
        {/* ========================================================================= */}
        {/* 1. COMPACT APPLE-GLASS TOP BAR: ACTIVE FIELD + NAVIGATION + CONTROLS */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-between gap-2 pb-1 border-b border-black/5">
          {/* Active Field Name & Live Value Preview */}
          <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[#0071E3] shrink-0">
              <Sparkles className="w-3 h-3 text-[#0071E3]" />
              <span className="text-[11px] font-bold tracking-tight truncate max-w-[130px] sm:max-w-[180px]">
                {activeFieldName || 'Invoerveld'}
              </span>
            </div>

            {/* Live Text Preview Box with Apple blinking blue cursor */}
            <div className="flex items-center apple-glass-input rounded-lg px-2.5 py-0.5 text-xs font-mono text-slate-800 flex-1 min-w-[110px] max-w-[260px] h-6.5 overflow-hidden shadow-2xs">
              {activeFieldValue ? (
                <span className="truncate font-semibold text-slate-800 text-[11px]">{activeFieldValue}</span>
              ) : (
                <span className="text-slate-400 italic text-[10px]">Typen...</span>
              )}
              <span className="inline-block w-1.5 h-3 bg-[#0071E3] ml-0.5 animate-pulse shrink-0 rounded-xs" />
            </div>

            {/* Previous / Next field mini buttons */}
            {(onPrevField || onNextField) && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={onPrevField}
                  disabled={!hasPrevField}
                  className="p-1 rounded-lg apple-glass-card hover:bg-white text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                  title="Vorig veld"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onNextField}
                  disabled={!hasNextField}
                  className="p-1 rounded-lg apple-glass-card hover:bg-white text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                  title="Volgend veld"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Action & Toggle Controls in Apple Glass Pill Design */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Compact vs Standard Height Toggle */}
            <button
              type="button"
              onClick={() => setIsCompact(!isCompact)}
              className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold apple-glass-card hover:bg-white text-slate-600 transition cursor-pointer"
              title={isCompact ? 'Vergroten (ruime toetsen)' : 'Verkleinen (meer schermruimte)'}
            >
              {isCompact ? <Maximize2 className="w-3 h-3 text-slate-500" /> : <Minimize2 className="w-3 h-3 text-slate-500" />}
              <span>{isCompact ? 'Ruimer' : 'Compact'}</span>
            </button>

            {/* Numeric / Letters Toggle */}
            <button
              type="button"
              onClick={() => setIsNumericMode(!isNumericMode)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold apple-glass-card hover:bg-white text-slate-700 active:scale-95 transition cursor-pointer"
            >
              {isNumericMode ? (
                <>
                  <Type className="w-3 h-3 text-[#0071E3]" />
                  <span>ABC</span>
                </>
              ) : (
                <>
                  <Hash className="w-3 h-3 text-[#0071E3]" />
                  <span>123</span>
                </>
              )}
            </button>

            {/* AZERTY / QWERTY layout toggle (only in letters mode) */}
            {!isNumericMode && (
              <button
                type="button"
                onClick={() => setLayout(layout === 'AZERTY' ? 'QWERTY' : 'AZERTY')}
                className="hidden xs:flex items-center gap-1 px-1.5 py-1 rounded-lg text-[10px] font-semibold apple-glass-card hover:bg-white text-slate-600 active:scale-95 transition cursor-pointer"
                title="Wissel toetsenbordindeling"
              >
                <Globe className="w-2.5 h-2.5 text-slate-400" />
                <span>{layout}</span>
              </button>
            )}

            {/* Clear Button */}
            <button
              type="button"
              onClick={() => {
                playClick();
                onClear();
              }}
              className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-rose-50/80 hover:bg-rose-100 text-rose-600 border border-rose-200/60 active:scale-95 transition cursor-pointer"
            >
              Wissen
            </button>

            {/* Done / Close Button in Apple Royal Blue */}
            <button
              type="button"
              id="btn-keyboard-close"
              onClick={onClose}
              className="flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-bold bg-[#0071E3] hover:bg-[#0077ED] text-white shadow-sm shadow-blue-500/25 active:scale-95 transition cursor-pointer"
            >
              <Check className="w-3 h-3" />
              <span>Gereed</span>
              <ChevronDown className="w-3 h-3 opacity-80" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. KEYS CONTAINER - SLEEK APPLE GLASS CARDS */}
        {/* ========================================================================= */}
        {isNumericMode ? (
          /* Numeric Keypad layout - Ideal for birthdates and Rijksregisternummer */
          <div className="grid grid-cols-4 gap-1.5 max-w-sm mx-auto w-full py-0.5">
            {['1', '2', '3'].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeyClick(num)}
                className={`${numKeyHeightClass} font-bold apple-glass-card hover:bg-white text-slate-800 rounded-xl active:bg-blue-50/80 active:scale-95 transition flex items-center justify-center cursor-pointer border border-white/90 shadow-2xs`}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleBackspace}
              className={`${numKeyHeightClass} bg-slate-200/70 hover:bg-slate-300/80 text-slate-700 rounded-xl active:scale-95 transition flex items-center justify-center gap-1 font-semibold text-xs border border-slate-300/50 cursor-pointer`}
              title="Wis laatste teken"
            >
              <Delete className="w-4 h-4 text-slate-600" />
              <span className="hidden sm:inline">Wis</span>
            </button>

            {['4', '5', '6'].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeyClick(num)}
                className={`${numKeyHeightClass} font-bold apple-glass-card hover:bg-white text-slate-800 rounded-xl active:bg-blue-50/80 active:scale-95 transition flex items-center justify-center cursor-pointer border border-white/90 shadow-2xs`}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleKeyClick('-')}
              className={`${numKeyHeightClass} font-bold bg-slate-100/80 hover:bg-white text-slate-700 rounded-xl border border-slate-200/70 active:scale-95 transition flex items-center justify-center cursor-pointer`}
            >
              -
            </button>

            {['7', '8', '9'].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeyClick(num)}
                className={`${numKeyHeightClass} font-bold apple-glass-card hover:bg-white text-slate-800 rounded-xl active:bg-blue-50/80 active:scale-95 transition flex items-center justify-center cursor-pointer border border-white/90 shadow-2xs`}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleKeyClick('/')}
              className={`${numKeyHeightClass} font-bold bg-slate-100/80 hover:bg-white text-slate-700 rounded-xl border border-slate-200/70 active:scale-95 transition flex items-center justify-center cursor-pointer`}
            >
              /
            </button>

            <button
              type="button"
              onClick={() => handleKeyClick('.')}
              className={`${numKeyHeightClass} font-bold bg-slate-100/80 hover:bg-white text-slate-700 rounded-xl border border-slate-200/70 active:scale-95 transition flex items-center justify-center cursor-pointer`}
            >
              .
            </button>
            <button
              type="button"
              onClick={() => handleKeyClick('0')}
              className={`${numKeyHeightClass} font-bold apple-glass-card hover:bg-white text-slate-800 rounded-xl active:bg-blue-50/80 active:scale-95 transition flex items-center justify-center cursor-pointer border border-white/90 shadow-2xs`}
            >
              0
            </button>
            
            {/* Next Field or Close in Numeric Pad */}
            <button
              type="button"
              onClick={hasNextField && onNextField ? onNextField : onClose}
              className={`col-span-2 ${numKeyHeightClass} bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-xl shadow-md shadow-blue-500/25 active:scale-95 transition flex items-center justify-center gap-1.5 font-bold text-xs cursor-pointer`}
            >
              {hasNextField && onNextField ? (
                <>
                  <span>Volgend Veld</span>
                  <CornerDownLeft className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Klaar</span>
                </>
              )}
            </button>
          </div>
        ) : (
          /* Standard Full QWERTY / AZERTY Layout with Apple Glass Keys */
          <div className="flex flex-col gap-1 py-0.5">
            {activeRows.map((row, rowIdx) => (
              <div key={rowIdx} className="flex justify-center gap-1">
                {rowIdx === 3 && (
                  <button
                    type="button"
                    onClick={() => setIsShift(!isShift)}
                    className={`${keyHeightClass} px-2.5 sm:px-3.5 rounded-xl font-bold border transition-all flex items-center justify-center cursor-pointer active:scale-95 ${
                      isShift
                        ? 'bg-[#0071E3] text-white border-[#0071E3] shadow-sm shadow-blue-500/25'
                        : 'bg-slate-200/70 hover:bg-slate-300/80 text-slate-700 border-slate-300/50 shadow-2xs'
                    }`}
                  >
                    Shift
                  </button>
                )}

                {row.map(char => (
                  <button
                    key={char}
                    type="button"
                    onClick={() => handleKeyClick(char)}
                    className={`${keyHeightClass} flex-1 max-w-[46px] apple-glass-card hover:bg-white active:bg-blue-50/80 active:scale-95 text-slate-800 rounded-xl border border-white/90 shadow-2xs font-semibold transition-all flex items-center justify-center cursor-pointer`}
                  >
                    {isShift ? char.toUpperCase() : char}
                  </button>
                ))}

                {rowIdx === 3 && (
                  <button
                    type="button"
                    onClick={handleBackspace}
                    className={`${keyHeightClass} px-2.5 sm:px-3.5 bg-slate-200/70 hover:bg-slate-300/80 text-slate-700 rounded-xl border border-slate-300/50 shadow-2xs font-medium active:scale-95 transition flex items-center justify-center cursor-pointer`}
                    title="Wis laatste teken"
                  >
                    <Delete className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                )}
              </div>
            ))}

            {/* Bottom Row: Spacebar and Enter/Next Field */}
            <div className="flex justify-center gap-2 mt-0.5">
              <button
                type="button"
                onClick={() => {
                  playClick();
                  onKeyPress(' ');
                }}
                className={`${keyHeightClass} w-1/2 max-w-sm apple-glass-card hover:bg-white active:bg-slate-100 active:scale-98 text-slate-700 rounded-xl border border-white/90 shadow-2xs font-semibold transition flex items-center justify-center tracking-wider text-[11px] uppercase cursor-pointer`}
              >
                Spatiebalk
              </button>

              {hasNextField && onNextField && (
                <button
                  type="button"
                  onClick={onNextField}
                  className={`${keyHeightClass} px-4 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-xl shadow-md shadow-blue-500/25 active:scale-95 font-bold transition flex items-center justify-center gap-1.5 cursor-pointer text-xs`}
                >
                  <span>Volgend Veld</span>
                  <CornerDownLeft className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
