'use client';

import { useEffect } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type = 'info', onClose, duration = 4000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const icons = {
    success: <CheckCircle size={20} style={{ color: 'var(--success-500)' }} />,
    error: <XCircle size={20} style={{ color: 'var(--danger-500)' }} />,
    info: <Info size={20} style={{ color: 'var(--info-500)' }} />,
  };

  return (
    <div className={`toast toast-${type}`}>
      {icons[type]}
      <span className="toast-message">{message}</span>
      <button onClick={onClose} className="btn-ghost btn-icon btn-sm" style={{ padding: 4 }}>
        <X size={16} />
      </button>
    </div>
  );
}
