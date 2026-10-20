import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Camera, ClockCounterClockwise as History, Shield, SignOut as LogOut, X } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { authAPI } from '../services/api';
import ScreenPopup from './ScreenPopup';

export default function AppNavbar({ beforeNavigate }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, setAuth } = useAuthStore();

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [popup, setPopup] = useState(null);
  const [medicalForm, setMedicalForm] = useState({
    bloodType: 'Unknown',
    allergies: '',
    medications: '',
    conditions: '',
    emergencyNotes: ''
  });
  const [medicalSaving, setMedicalSaving] = useState(false);

  useEffect(() => {
    const mh = user?.medicalHistory;
    if (!mh) return;
    setMedicalForm({
      bloodType: mh.bloodType || 'Unknown',
      allergies: Array.isArray(mh.allergies) ? mh.allergies.join(', ') : '',
      medications: Array.isArray(mh.medications) ? mh.medications.join(', ') : '',
      conditions: Array.isArray(mh.conditions) ? mh.conditions.join(', ') : '',
      emergencyNotes: mh.emergencyNotes || ''
    });
  }, [user?.medicalHistory]);

  const safeNavigate = (to) => {
    try {
      beforeNavigate?.();
    } catch {}
    navigate(to);
  };

  const handleLogout = async () => {
    try {
      beforeNavigate?.();
    } catch {}

    try {
      await authAPI.logout();
    } catch {}

    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <>
      <ScreenPopup popup={popup} onClose={() => setPopup(null)} />

      <nav className="fixed top-0 w-full z-[1000] bg-white/90 backdrop-blur-xl border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 md:px-4 h-16 flex items-center justify-between gap-2">
          <Link to="/dashboard" className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center shadow-sm shadow-red-600/20">
              <Bell size={16} className="text-white" weight="fill" />
            </div>
            <span className="font-bold text-slate-900 text-base md:text-lg tracking-tight truncate">RakshaSetu</span>
          </Link>

          <div className="flex items-center gap-0.5 md:gap-1 shrink-0">
            <button
              onClick={() => safeNavigate('/dashboard')}
              className={`nav-link p-2 md:p-2.5 ${isActive('/dashboard') ? 'bg-red-50 text-red-600' : ''}`}
              title="Dashboard"
            >
              <Bell size={19} />
            </button>
            <button
              onClick={() => safeNavigate('/monitor')}
              className={`nav-link p-2 md:p-2.5 ${isActive('/monitor') ? 'bg-red-50 text-red-600' : ''}`}
              title="Safety Monitor"
            >
              <Camera size={19} />
            </button>
            <button
              onClick={() => safeNavigate('/history')}
              className={`nav-link p-2 md:p-2.5 ${isActive('/history') ? 'bg-red-50 text-red-600' : ''}`}
              title="History"
            >
              <History size={19} />
            </button>
            {user?.role === 'admin' && (
              <button
                onClick={() => safeNavigate('/admin')}
                className={`hidden md:flex nav-link items-center gap-1.5 text-xs font-semibold px-3 ${location.pathname.startsWith('/admin') ? 'bg-red-50 text-red-600' : ''}`}
                title="Admin"
              >
                <Shield size={14} />Admin
              </button>
            )}
            <div className="w-px h-6 bg-slate-200 mx-1" />
            <button
              type="button"
              onClick={() => setShowProfileModal(true)}
              className="hidden md:flex items-center gap-2 px-3 rounded-xl hover:bg-slate-50 transition-colors"
              title="Profile"
            >
              <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <span className="text-sm font-medium text-slate-700">{user?.name?.split(' ')[0]}</span>
            </button>
            <button onClick={handleLogout} className="nav-link text-red-500 hover:text-red-600 hover:bg-red-50" title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {showProfileModal && (
          <div className="fixed inset-0 z-[1200] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/45 backdrop-blur-sm"
              onClick={() => setShowProfileModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 24 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              className="relative w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl border border-slate-200 bg-white px-4 sm:px-6 pt-3 sm:pt-6 pb-5 sm:pb-6 shadow-2xl"
            >
              <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-3 sm:hidden" />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900">Profile</h3>
                  <p className="text-sm text-slate-600 mt-1">Update medical details for SOS + QR card.</p>
                </div>
                <button onClick={() => setShowProfileModal(false)} className="nav-link" title="Close">
                  <X size={18} />
                </button>
              </div>

              <div className="mt-5 grid lg:grid-cols-2 gap-5">
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">Name</p>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">{user?.name || '—'}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">Email</p>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">{user?.email || '—'}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">Phone</p>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">{user?.phone || '—'}</p>
                  </div>

                  <button
                    onClick={() => {
                      setShowProfileModal(false);
                      safeNavigate('/my-emergency-qr');
                    }}
                    className="btn-primary text-sm px-5 py-2.5 h-auto rounded-xl"
                  >
                    View Emergency QR
                  </button>
                </div>

                <div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Blood Group</label>
                      <select
                        className="input-field"
                        value={medicalForm.bloodType}
                        onChange={(e) => setMedicalForm((p) => ({ ...p, bloodType: e.target.value }))}
                      >
                        {['Unknown', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Allergies (comma separated)</label>
                      <input
                        className="input-field"
                        value={medicalForm.allergies}
                        onChange={(e) => setMedicalForm((p) => ({ ...p, allergies: e.target.value }))}
                        placeholder="Peanuts, Penicillin"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Medications (comma separated)</label>
                      <input
                        className="input-field"
                        value={medicalForm.medications}
                        onChange={(e) => setMedicalForm((p) => ({ ...p, medications: e.target.value }))}
                        placeholder="Insulin, Aspirin"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Conditions (comma separated)</label>
                      <input
                        className="input-field"
                        value={medicalForm.conditions}
                        onChange={(e) => setMedicalForm((p) => ({ ...p, conditions: e.target.value }))}
                        placeholder="Asthma, Diabetes"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Emergency Notes</label>
                    <textarea
                      className="input-field min-h-[110px]"
                      value={medicalForm.emergencyNotes}
                      onChange={(e) => setMedicalForm((p) => ({ ...p, emergencyNotes: e.target.value }))}
                      placeholder="Any important notes for doctors/paramedics"
                    />
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button
                      onClick={async () => {
                        try {
                          setMedicalSaving(true);
                          const toArray = (s) =>
                            (s || '')
                              .split(',')
                              .map((x) => x.trim())
                              .filter(Boolean);

                          const payload = {
                            medicalHistory: {
                              bloodType: medicalForm.bloodType || 'Unknown',
                              allergies: toArray(medicalForm.allergies),
                              medications: toArray(medicalForm.medications),
                              conditions: toArray(medicalForm.conditions),
                              emergencyNotes: (medicalForm.emergencyNotes || '').trim()
                            }
                          };

                          const res = await authAPI.updateProfile(payload);
                          setAuth(res.data.data.user);
                          setPopup({ type: 'success', message: 'Medical details saved!' });
                        } catch (e) {
                          setPopup({ type: 'error', message: e?.response?.data?.message || 'Failed to save medical details' });
                        } finally {
                          setMedicalSaving(false);
                        }
                      }}
                      disabled={medicalSaving}
                      className="btn-primary text-sm px-5 py-2.5 h-auto rounded-xl"
                    >
                      {medicalSaving ? 'Saving...' : 'Save Medical Details'}
                    </button>
                    <p className="text-xs text-slate-500">Used in SOS emails + QR emergency card.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
