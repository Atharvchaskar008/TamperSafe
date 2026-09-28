import React from 'react';

export type SlideId = '01-map' | '02-evidence' | '03-settlement';

interface SlideNavigationProps {
  currentSlide: SlideId;
  onSelectSlide: (slide: SlideId) => void;
  isTampered: boolean;
}

export const SlideNavigation: React.FC<SlideNavigationProps> = ({
  currentSlide,
  onSelectSlide,
  isTampered,
}) => {
  const slides: { id: SlideId; label: string; number: string; alert?: boolean }[] = [
    { id: '01-map', number: '01', label: 'MAP & SMART TILES' },
    { id: '02-evidence', number: '02', label: 'EVIDENCE & TAMPER AUDIT', alert: isTampered },
    { id: '03-settlement', number: '03', label: 'SETTLEMENT & DEPOT' },
  ];

  return (
    <div className="flex items-center gap-2 border-b border-[#2a2f34] bg-black px-4 py-2 flex-shrink-0 select-none font-mono">
      <span className="text-[10px] text-[#ffffff50] uppercase mr-2">WORKSPACE:</span>
      <div className="flex items-center gap-2 flex-1">
        {slides.map(s => {
          const isActive = currentSlide === s.id;
          return (
            <button
              key={s.id}
              onClick={() => onSelectSlide(s.id)}
              className={`px-3 py-1.5 border rounded-[3px] text-[11px] font-bold uppercase transition-all flex items-center gap-2 ${
                isActive
                  ? s.alert
                    ? 'bg-[#EB0C0D] border-[#EB0C0D] text-white shadow-[0_0_12px_rgba(235,12,13,0.4)]'
                    : 'bg-white text-black border-white'
                  : s.alert
                  ? 'bg-[#EB0C0D]/10 border-[#EB0C0D] text-[#EB0C0D] hover:bg-[#EB0C0D]/20'
                  : 'bg-[#0a0c10] border-[#2a2f34] text-[#ffffff80] hover:text-white hover:border-[#ffffff50]'
              }`}
            >
              <span className={`w-2 h-2 ${isActive ? (s.alert ? 'bg-white' : 'bg-black') : (s.alert ? 'bg-[#EB0C0D]' : 'bg-[#2a2f34]')} inline-block`} />
              <span>{s.number}</span>
              <span>{s.label}</span>
              {s.alert && <span className="text-[10px]">⚡</span>}
            </button>
          );
        })}
      </div>

      <div className="text-[10px] text-[#ffffff50] hidden sm:block">
        3 CONNECTED WORKSPACES &bull; ZERO CLUTTER
      </div>
    </div>
  );
};
