import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { useAuthStore } from '../store/authStore';
import { authAPI } from '../services/api';
import PageLoader from '../components/PageLoader';
import AppNavbar from '../components/AppNavbar';

export default function MyEmergencyQR() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [token, setToken] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const emergencyUrl = useMemo(() => {
    if (!token) return '';
    return `${window.location.origin}/emergency-card/${token}`;
  }, [token]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await authAPI.getEmergencyCardToken();
        setToken(res.data?.data?.token || null);
      } catch (e) {
        setError(e?.response?.data?.message || 'Failed to load emergency card token');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppNavbar />
        <div className="pt-20">
          <PageLoader text="Generating your emergency QR..." />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppNavbar />
      <div className="pt-20 flex items-center justify-center p-6">
        <div className="w-full max-w-xl rounded-2xl overflow-hidden border border-slate-200 bg-white">
          <div className="bg-red-600 text-white p-6">
            <h1 className="text-2xl font-bold">Emergency QR Card</h1>
            <p className="text-white/90 mt-1 text-sm">Scan to open your emergency medical profile.</p>
          </div>

          <div className="p-6">
            {error ? (
              <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm font-medium border border-red-100">{error}</div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="bg-red-600 p-5 rounded-2xl">
                  <div className="bg-white rounded-xl p-4">
                    <QRCodeCanvas value={emergencyUrl} size={220} includeMargin />
                  </div>
                </div>
                <div className="w-full rounded-xl border border-slate-200 p-4 bg-slate-50">
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold">Link:</span>{' '}
                    <a className="text-red-600 font-semibold break-all" href={emergencyUrl} target="_blank" rel="noreferrer">{emergencyUrl}</a>
                  </p>
                  <p className="text-xs text-slate-500 mt-2">
                    Tip: keep a screenshot of this QR on your lock screen or wallet card.
                  </p>
                </div>

                <button
                  className="btn-primary h-11 px-5 text-sm uppercase tracking-wider"
                  onClick={() => navigate('/dashboard')}
                >
                  Back to Dashboard
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
