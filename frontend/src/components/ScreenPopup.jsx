import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, WarningCircle as AlertTriangle, Info, X, WarningCircle as AlertOctagon } from '@phosphor-icons/react';

const CONFIG = {
  success: { bg: 'bg-emerald-600', icon: CheckCircle, border: 'border-emerald-500' },
  error:   { bg: 'bg-red-600',     icon: AlertOctagon, border: 'border-red-500' },
  warning: { bg: 'bg-amber-500',   icon: AlertTriangle, border: 'border-amber-400' },
  info:    { bg: 'bg-blue-600',    icon: Info,          border: 'border-blue-500' },
};

export default function ScreenPopup({ popup, onClose }) {
  if (!popup) return null;
  const { bg, icon: Icon, border } = CONFIG[popup.type] || CONFIG.info;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -16, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="fixed top-4 right-4 z-[9999] max-w-sm w-full"
      >
        <div className={`${bg} text-white rounded-2xl shadow-2xl p-4 border ${border}/30`}>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
              <Icon size={16} />
            </div>
            <p className="text-sm font-medium leading-relaxed flex-1 whitespace-pre-line">{popup.message}</p>
            <button onClick={onClose} className="text-white/70 hover:text-white transition-colors shrink-0 mt-0.5">
              <X size={16} />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
