import { Bell } from '@phosphor-icons/react';

export default function PageLoader({ text = 'Loading...' }) {
  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center gap-6">
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-red-600 flex items-center justify-center shadow-xl shadow-red-600/30 sos-btn-glow">
          <Bell size={28} className="text-white" />
        </div>
      </div>
      <div className="text-center">
        <p className="text-slate-900 font-semibold text-lg">{text}</p>
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-red-600 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
