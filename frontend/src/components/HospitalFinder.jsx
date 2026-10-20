import { useState, useEffect } from 'react';
import { hospitalAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Buildings as Building2, Phone, GlobeHemisphereWest as Globe, NavigationArrow as NavigationIcon, ArrowsClockwise as RefreshCw, Plus, X, CaretDown as ChevronDown, CaretUp as ChevronUp, Siren, SpinnerGap as Loader2 } from '@phosphor-icons/react';

function HospitalFinder({ location }) {
  const { user } = useAuthStore();
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchRadius, setSearchRadius] = useState(5);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', phone: '', website: '', emergency: '', operator: '', openingHours: '' });

  useEffect(() => {
    if (location) fetchHospitals();
  }, [location]);

  const fetchHospitals = async () => {
    if (!location) { setError('Location access is required.'); return; }
    setLoading(true); setError(null);
    try {
      const res = await hospitalAPI.getNearby(location.latitude, location.longitude, searchRadius * 1000);
      setHospitals(res.data.data.hospitals || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not connect to server. Please try again.');
    } finally { setLoading(false); }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!location) return;
    setSaving(true);
    try {
      await hospitalAPI.add({ ...form, latitude: location.latitude, longitude: location.longitude });
      setShowAddForm(false);
      setForm({ name: '', address: '', phone: '', website: '', emergency: '', operator: '', openingHours: '' });
      fetchHospitals();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to add hospital');
    } finally { setSaving(false); }
  };

  const handleSeedFromOSM = async () => {
    if (!location) return;
    setLoading(true);
    try {
      const res = await hospitalAPI.seed(location.latitude, location.longitude, searchRadius * 1000);
      setError(null);
      alert(`Seeded ${res.data.data.inserted} new hospitals from OpenStreetMap into database.`);
    } catch (err) {
      setError('Failed to seed hospitals');
    } finally { setLoading(false); }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md mt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg"><Building2 className="w-5 h-5 text-blue-600" /></div>
          <div><h3 className="font-bold text-gray-900">Nearby Hospitals</h3><p className="text-xs text-gray-500">Live data from OpenStreetMap</p></div>
        </div>
        <div className="flex gap-2">
          {user?.role === 'admin' && (
            <button onClick={handleSeedFromOSM} disabled={loading} className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1">
              <RefreshCw size={12} /> Seed to DB
            </button>
          )}
          <button onClick={() => setShowAddForm(!showAddForm)} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 flex items-center gap-1">
            {showAddForm ? <><X size={12} /> Cancel</> : <><Plus size={12} /> Add Hospital</>}
          </button>
        </div>
      </div>

      {/* Add Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} onSubmit={handleAdd} className="mb-4 p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-3 overflow-hidden">
            <p className="text-sm font-bold text-blue-900">Add Hospital at Current Location</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium mb-1">Name *</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Hospital name" /></div>
              <div><label className="block text-xs font-medium mb-1">Phone</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="+91 ..." /></div>
              <div><label className="block text-xs font-medium mb-1">Address</label><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Street address" /></div>
              <div><label className="block text-xs font-medium mb-1">Website</label><input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="https://..." /></div>
              <div><label className="block text-xs font-medium mb-1">Operator</label><input value={form.operator} onChange={e => setForm({ ...form, operator: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Govt / Private" /></div>
              <div><label className="block text-xs font-medium mb-1">Opening Hours</label><input value={form.openingHours} onChange={e => setForm({ ...form, openingHours: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="24/7 or Mo-Fr 08:00-20:00" /></div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="emergency" checked={form.emergency === 'yes'} onChange={e => setForm({ ...form, emergency: e.target.checked ? 'yes' : '' })} className="rounded" />
              <label htmlFor="emergency" className="text-sm text-gray-700">Has Emergency Department</label>
            </div>
            <button type="submit" disabled={saving} className="btn-primary text-sm py-2 px-4 h-auto">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : 'Add Hospital'}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Radius Slider */}
      <div className="flex items-center gap-4 bg-gray-50 p-3 rounded-xl border border-gray-100 mb-4">
        <label className="text-sm font-bold text-gray-700 whitespace-nowrap w-28">Radius: {searchRadius} km</label>
        <input type="range" min="1" max="30" step="1" value={searchRadius} onChange={e => setSearchRadius(Number(e.target.value))} className="w-full accent-blue-500 cursor-pointer" />
        <button onClick={fetchHospitals} disabled={loading} className="shrink-0 px-3 py-1.5 bg-blue-500 text-white text-xs font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1">
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Search
        </button>
      </div>

      {/* Error */}
      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800 mb-4">{error}</div>}

      {/* Loading */}
      {loading && <div className="flex flex-col items-center py-10 text-gray-400"><Loader2 size={32} className="animate-spin text-blue-500 mb-2" /><p className="text-sm">Finding hospitals near you...</p></div>}

      {/* Results */}
      {!loading && hospitals.length > 0 && (
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          <p className="text-xs text-gray-500 font-medium">{hospitals.length} hospital{hospitals.length !== 1 ? 's' : ''} found within {searchRadius} km</p>
          {hospitals.map((h, i) => (
            <motion.div key={h.id || h._id || i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-gray-900 truncate">{h.name}</h4>
                  {h.address && <p className="text-xs text-gray-500 mt-0.5 truncate">{h.address}</p>}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {h.phone && (
                      <a href={`tel:${h.phone}`} className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full hover:bg-emerald-100 transition-colors">
                        <Phone size={11} />{h.phone}
                      </a>
                    )}
                    {h.website && (
                      <a href={h.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full hover:bg-blue-100 transition-colors">
                        <Globe size={11} />Website
                      </a>
                    )}
                    {(h.emergency === 'yes' || h.emergency === true) && (
                      <span className="flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 px-2.5 py-1 rounded-full">
                        <Siren size={11} />Emergency
                      </span>
                    )}
                    {h.openingHours && <span className="text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full">{h.openingHours}</span>}
                  </div>
                </div>
                {(h.location?.lat && h.location?.lng) || (h.location?.coordinates) ? (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${h.location?.lat ?? h.location?.coordinates?.[1]},${h.location?.lng ?? h.location?.coordinates?.[0]}`}
                    target="_blank" rel="noopener noreferrer"
                    className="shrink-0 w-9 h-9 rounded-full bg-gray-900 text-white flex items-center justify-center hover:bg-gray-800 active:scale-95 transition-all"
                    title="Get Directions"
                  >
                    <NavigationIcon size={14} />
                  </a>
                ) : null}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {!loading && !error && hospitals.length === 0 && (
        <div className="flex flex-col items-center py-10 text-gray-400">
          <Building2 size={32} className="mb-2 opacity-50" />
          <p className="text-sm">No hospitals found nearby</p>
          <button onClick={fetchHospitals} className="text-blue-600 text-sm font-medium hover:underline mt-1">Try again</button>
        </div>
      )}
    </div>
  );
}

export default HospitalFinder;
