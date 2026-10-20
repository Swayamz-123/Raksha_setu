import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { publicAPI } from '../services/api';
import PageLoader from '../components/PageLoader';

const renderList = (items) => {
  if (!Array.isArray(items) || items.length === 0) return 'None';
  return items.filter(Boolean).join(', ');
};

export default function EmergencyCard() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await publicAPI.getEmergencyCard(token);
        setUser(res.data?.data?.user || null);
      } catch (e) {
        setError(e?.response?.data?.message || 'Emergency card not found');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [token]);

  if (loading) return <PageLoader text="Loading emergency profile..." />;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden border border-slate-200 bg-white">
        <div className="bg-red-600 text-white p-6">
          <h1 className="text-2xl font-bold">Emergency Medical Profile</h1>
          <p className="text-white/90 mt-1 text-sm">For hospital/first responders use only.</p>
        </div>

        <div className="p-6">
          {error ? (
            <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm font-medium border border-red-100">{error}</div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-sm text-slate-500">Patient</div>
                <div className="text-xl font-bold text-slate-900 mt-1">{user?.name || 'Unknown'}</div>
                {user?.phone ? <div className="text-sm text-slate-700 mt-1">Phone: {user.phone}</div> : null}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-sm text-slate-500">Blood Group</div>
                  <div className="text-lg font-semibold text-slate-900 mt-1">{user?.medicalHistory?.bloodType || 'Unknown'}</div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-sm text-slate-500">Allergies</div>
                  <div className="text-sm text-slate-800 mt-1 break-words">{renderList(user?.medicalHistory?.allergies)}</div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-sm text-slate-500">Medications</div>
                  <div className="text-sm text-slate-800 mt-1 break-words">{renderList(user?.medicalHistory?.medications)}</div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-sm text-slate-500">Conditions</div>
                  <div className="text-sm text-slate-800 mt-1 break-words">{renderList(user?.medicalHistory?.conditions)}</div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-sm text-slate-500">Emergency Notes</div>
                <div className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">{user?.medicalHistory?.emergencyNotes || '—'}</div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-sm text-slate-500">Emergency Contacts (Guardians)</div>
                {(user?.guardians || []).length ? (
                  <div className="mt-2 space-y-2">
                    {user.guardians.map((g) => (
                      <div key={g._id} className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">{g.name}</div>
                          {g.email ? <div className="text-xs text-slate-500">{g.email}</div> : null}
                        </div>
                        <div className="text-sm text-slate-800">{g.phone || '—'}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-700 mt-1">No guardians added.</div>
                )}
              </div>

              <div className="text-xs text-slate-500">
                This page is accessible via the QR token. If the token is compromised, rotate it (future enhancement) or regenerate by support.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
