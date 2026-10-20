import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useAuthStore } from '../store/authStore';
import { sosAPI, authAPI, routingAPI } from '../services/api';
import { initSocket, updateLocation, acceptSOS, broadcastSOS } from '../services/socket';
import { attachAutoSync, getQueue } from '../services/offlineSOSQueue';
import CrisisSelector from '../components/CrisisSelector';
import SOSAlertModal from '../components/SOSAlertModal';
import ScreenPopup from '../components/ScreenPopup';
import AppNavbar from '../components/AppNavbar';
import PageLoader from '../components/PageLoader';
import ResourceMap from '../components/ResourceMap';
import HospitalFinder from '../components/HospitalFinder';
import MapGestureGuard from '../components/MapGestureGuard';
import {
  SignOut as LogOut, ClockCounterClockwise as History, Shield, MapPin, Bell, WarningCircle as AlertCircle, CaretRight as ChevronRight,
  User, UserPlus, X, Heartbeat as HeartPulse, ShieldCheck, Camera, Buildings as Building2,
  NavigationArrow as Navigation, Clock, Pulse as Activity, Lightning as Zap
} from '@phosphor-icons/react';
import { Ambulance, FireTruck, PoliceCar, Lifebuoy, Check } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import 'leaflet/dist/leaflet.css';

const AUTO_SOS_COOLDOWN_MS = 45000;
const MOTION_ACCEL_THRESHOLD = 28;
const MOTION_ROTATION_THRESHOLD = 420;

function FitBounds({ userLocation, sosLocation }) {
  const map = useMap();
  useEffect(() => {
    if (userLocation && sosLocation) {
      map.fitBounds(L.latLngBounds([userLocation.latitude, userLocation.longitude], [sosLocation[0], sosLocation[1]]), { padding: [50, 50], maxZoom: 16 });
    } else if (sosLocation) {
      map.setView([sosLocation[0], sosLocation[1]], 15);
    }
  }, [map, userLocation, sosLocation]);
  return null;
}

function FitLiveSOSBounds({ location, points }) {
  const map = useMap();

  useEffect(() => {
    if (!location) return;
    if (!points?.length) {
      map.setView([location.latitude, location.longitude], 13);
      return;
    }

    const boundsPoints = [
      [location.latitude, location.longitude],
      ...points.map((p) => [p.location.coordinates[1], p.location.coordinates[0]])
    ];
    map.fitBounds(boundsPoints, { padding: [35, 35], maxZoom: 15 });
  }, [map, location, points]);

  return null;
}

const SKILL_OPTIONS = [
  { type: 'cpr', label: 'CPR', color: 'red' },
  { type: 'first_aid', label: 'First Aid', color: 'orange' },
  { type: 'medical_professional', label: 'Doctor/Nurse', color: 'blue' },
  { type: 'fire_safety', label: 'Fire Safety', color: 'amber' },
  { type: 'security', label: 'Security', color: 'purple' },
];

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function Dashboard() {
  const { user, setAuth } = useAuthStore();
  const [showCrisisSelector, setShowCrisisSelector] = useState(false);
  const [incomingAlert, setIncomingAlert] = useState(null);
  const [location, setLocation] = useState(null);
  const [pendingSOS, setPendingSOS] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [profileSaving, setProfileSaving] = useState(false);
  const [popup, setPopup] = useState(null);
  const [guardians, setGuardians] = useState([]);
  const [guardianEmail, setGuardianEmail] = useState('');
  const [guardianLoading, setGuardianLoading] = useState(false);
  const [wards, setWards] = useState([]);
  const [welfareChecks, setWelfareChecks] = useState([]);
  const [nearestHospitals, setNearestHospitals] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [recentActivity, setRecentActivity] = useState([]);
  const [autoSosEnabled, setAutoSosEnabled] = useState(false);
  const [autoSosSending, setAutoSosSending] = useState(false);
  const [sensorSupported, setSensorSupported] = useState(true);
  const [autoSosModal, setAutoSosModal] = useState(null);
  const navigate = useNavigate();
  const motionCooldownRef = useRef(0);

  const sosPulseIcon = useMemo(() => new L.DivIcon({ className: 'sos-pulse-wrapper', html: '<div class="sos-pulse-dot"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }), []);
  const userIcon = useMemo(() => new L.DivIcon({ className: 'user-map-wrapper', html: '<div class="user-map-dot"></div>', iconSize: [14, 14], iconAnchor: [7, 7] }), []);

  useEffect(() => { setSelectedSkills((user?.skills || []).map(s => s.type)); }, [user]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [g, w, wf] = await Promise.all([authAPI.getGuardians(), authAPI.getWards(), sosAPI.getWelfareChecks()]);
        setGuardians(g.data.data.guardians || []);
        setWards(w.data.data.wards || []);
        setWelfareChecks(wf.data.data.welfareChecks || []);
      } catch {}
    };
    load();
  }, []);

  useEffect(() => {
    if (location) {
      routingAPI.getNearestHospitals(location.latitude, location.longitude, 10000)
        .then(res => setNearestHospitals(res.data.data.hospitals || []))
        .catch(() => {});
    }
  }, [location?.latitude, location?.longitude]);

  useEffect(() => {
    const socket = initSocket();

    // Timeout fallback — if location not granted in 5s, proceed without it
    const locationTimeout = setTimeout(() => {
      if (!location) {
        setLocation({ longitude: 77.209, latitude: 28.6139 }); // Delhi fallback
        setPopup({ type: 'warning', message: 'Location access denied or timed out. Using default location.' });
      }
    }, 5000);

    const watchId = navigator.geolocation.watchPosition(
      pos => {
        clearTimeout(locationTimeout);
        setLocation({ longitude: pos.coords.longitude, latitude: pos.coords.latitude });
        updateLocation(pos.coords.longitude, pos.coords.latitude);
      },
      err => {
        clearTimeout(locationTimeout);
        console.error('Location error:', err);
        setLocation({ longitude: 77.209, latitude: 28.6139 }); // Delhi fallback
        setPopup({ type: 'warning', message: 'Location access denied. Some features may be limited.' });
      },
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
    socket.on('sos_alert', alert => { setIncomingAlert(alert); setPopup({ type: 'warning', message: alert.isGuardianAlert ? `GUARDIAN ALERT: ${alert.wardName || 'Your ward'} needs help!` : 'New SOS Alert nearby!' }); fetchPendingSOS(); });
    socket.on('guardian_sos_alert', alert => { setIncomingAlert({ ...alert, isGuardianAlert: true }); setPopup({ type: 'warning', message: `GUARDIAN ALERT: ${alert.wardName || 'Your ward'} triggered an SOS!` }); });
    socket.on('sos_accepted', ({ sos }) => { if (sos?._id) navigate(`/sos/${sos._id}`); });
    socket.on('sos_already_taken', () => { setPopup({ type: 'info', message: 'This SOS has already been accepted.' }); navigate('/dashboard', { replace: true }); });
    const cleanupAutoSync = attachAutoSync(results => {
      const synced = results.filter(r => r.success);
      if (synced.length > 0) { setPopup({ type: 'success', message: `${synced.length} offline SOS alert(s) synced.` }); if (synced[0]?.sosId) navigate(`/sos/${synced[0].sosId}`); }
    });
    const pendingQueue = getQueue().filter(i => !i.synced);
    if (pendingQueue.length > 0 && navigator.onLine) {
      import('../services/offlineSOSQueue.js').then(({ syncOfflineQueue, clearSyncedQueue }) => {
        syncOfflineQueue().then(results => { clearSyncedQueue(); const synced = results.filter(r => r.success); if (synced.length > 0 && synced[0]?.sosId) navigate(`/sos/${synced[0].sosId}`); });
      });
    }
    return () => {
      clearTimeout(locationTimeout);
      navigator.geolocation.clearWatch(watchId);
      socket.off('sos_alert'); socket.off('sos_accepted'); socket.off('sos_already_taken'); socket.off('guardian_sos_alert');
      if (cleanupAutoSync) cleanupAutoSync();
    };
  }, [navigate]);

  useEffect(() => {
    if (location) { fetchPendingSOS(); const i = setInterval(fetchPendingSOS, 12000); return () => clearInterval(i); }
  }, [location?.longitude, location?.latitude]);

  const fetchPendingSOS = async () => {
    if (!location) return;
    try { const res = await sosAPI.getPending(); setPendingSOS((res.data.data.pendingSOS || []).filter(s => s.broadcaster?._id !== user?._id)); } catch {}
  };

  const nearestSOS = useMemo(() => {
    if (!location || !pendingSOS.length) return null;
    return pendingSOS.reduce((nearest, sos) => {
      const [lng, lat] = sos.location.coordinates;
      const d = getDistanceKm(location.latitude, location.longitude, lat, lng);
      return !nearest || d < nearest.distanceKm ? { ...sos, distanceKm: d } : nearest;
    }, null);
  }, [pendingSOS, location]);

  const triggerAutoSosModal = (reason) => {
    const now = Date.now();
    if (now - motionCooldownRef.current < AUTO_SOS_COOLDOWN_MS) return;
    motionCooldownRef.current = now;
    setAutoSosModal({ reason, triggeredAt: now });
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([250, 120, 250, 120, 350]);
  };

  const enableAutoSosMonitoring = async () => {
    if (typeof window === 'undefined' || typeof window.DeviceMotionEvent === 'undefined') {
      setSensorSupported(false);
      setPopup({ type: 'warning', message: 'Motion sensors are not available on this device/browser.' });
      return;
    }
    try {
      if (typeof window.DeviceMotionEvent.requestPermission === 'function') {
        const state = await window.DeviceMotionEvent.requestPermission();
        if (state !== 'granted') {
          setPopup({ type: 'warning', message: 'Motion permission denied. Auto SOS is off.' });
          return;
        }
      }
      setAutoSosEnabled(true);
      setPopup({ type: 'success', message: 'Auto SOS monitoring enabled.' });
    } catch {
      setPopup({ type: 'error', message: 'Could not enable motion monitoring.' });
    }
  };

  const handleAutoSosCall = async () => {
    if (!location || autoSosSending) return;
    setAutoSosSending(true);
    try {
      const response = await sosAPI.create({
        crisisType: 'other',
        longitude: location.longitude,
        latitude: location.latitude,
        broadcastRadius: 1000,
        isAnonymous: false,
        address: 'Auto-detected sudden phone motion event'
      });
      const sosId = response.data?.data?._id || response.data?.data?.sos?._id;
      if (sosId) {
        broadcastSOS(sosId);
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([120, 60, 120]);
        setAutoSosModal(null);
        navigate(`/sos/${sosId}`);
      } else {
        setPopup({ type: 'error', message: 'Auto SOS failed. Please try manual SOS.' });
        setAutoSosModal(null);
        setShowCrisisSelector(true);
      }
    } catch (error) {
      const reason = error?.response?.data?.message || 'Auto SOS request failed. Please try manual SOS.';
      setPopup({ type: 'error', message: reason });
      setAutoSosModal(null);
      setShowCrisisSelector(true);
    } finally {
      setAutoSosSending(false);
    }
  };

  useEffect(() => {
    if (!autoSosEnabled) return;
    if (typeof window === 'undefined' || typeof window.DeviceMotionEvent === 'undefined') return;

    const onMotion = (event) => {
      const acc = event.accelerationIncludingGravity || event.acceleration;
      if (!acc) return;

      const ax = Math.abs(acc.x || 0);
      const ay = Math.abs(acc.y || 0);
      const az = Math.abs(acc.z || 0);
      const magnitude = Math.sqrt(ax * ax + ay * ay + az * az);

      const rotation = event.rotationRate
        ? Math.max(
            Math.abs(event.rotationRate.alpha || 0),
            Math.abs(event.rotationRate.beta || 0),
            Math.abs(event.rotationRate.gamma || 0)
          )
        : 0;

      if (magnitude >= MOTION_ACCEL_THRESHOLD || rotation >= MOTION_ROTATION_THRESHOLD) {
        const reason = magnitude >= MOTION_ACCEL_THRESHOLD
          ? `High acceleration detected (${magnitude.toFixed(1)} m/s2)`
          : `High rotation detected (${rotation.toFixed(0)} deg/s)`;
        triggerAutoSosModal(reason);
      }
    };

    window.addEventListener('devicemotion', onMotion);
    return () => window.removeEventListener('devicemotion', onMotion);
  }, [autoSosEnabled]);

  const handleAddGuardian = async () => {
    if (!guardianEmail.trim()) return;
    setGuardianLoading(true);
    try { const res = await authAPI.addGuardian(guardianEmail.trim()); setGuardians(res.data.data.user.guardians || []); setGuardianEmail(''); setPopup({ type: 'success', message: 'Guardian added!' }); }
    catch (e) { setPopup({ type: 'error', message: e.response?.data?.message || 'Failed to add guardian' }); }
    finally { setGuardianLoading(false); }
  };

  if (!location) return <PageLoader text="Acquiring secure location..." />;

  const TABS = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'hospitals', label: 'Hospitals', icon: Building2 },
    { id: 'resources', label: 'Resources', icon: MapPin },
    { id: 'guardian', label: 'Guardian', icon: ShieldCheck },
  ];

  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden">
      <ScreenPopup popup={popup} onClose={() => setPopup(null)} />

      <AppNavbar />

      <main className="max-w-7xl mx-auto px-3 md:px-4 pt-20 pb-12">
        {/* SOS Hero */}
        <section className="py-10 flex flex-col items-center">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-3">Emergency Response</h1>
            <p className="text-slate-500 max-w-md mx-auto">One tap to alert nearby responders, hospitals, and emergency services instantly.</p>
          </motion.div>

          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => setShowCrisisSelector(true)} className="relative outline-none group">
            <div className="absolute inset-0 rounded-full bg-red-600 blur-2xl opacity-25 group-hover:opacity-40 transition-opacity" />
            <div className="relative w-44 h-44 md:w-52 md:h-52 rounded-full bg-linear-to-br from-red-500 to-red-700 flex flex-col items-center justify-center shadow-2xl shadow-red-600/40 sos-btn-glow border-4 border-red-400/20 group-hover:border-red-400/40 transition-all">
              <Bell className="w-14 h-14 text-white mb-1.5 drop-shadow" />
              <span className="text-2xl font-bold text-white tracking-widest">SOS</span>
              <span className="text-red-200 text-xs mt-1 font-medium">Tap to Alert</span>
            </div>
          </motion.button>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3 sm:gap-6 mt-8 w-full max-w-md text-center">
            <div><p className="text-xl sm:text-2xl font-bold text-slate-900">{pendingSOS.length}</p><p className="text-[11px] sm:text-xs text-slate-500 font-medium">Active Alerts</p></div>
            <div><p className="text-xl sm:text-2xl font-bold text-slate-900">{nearestHospitals.length}</p><p className="text-[11px] sm:text-xs text-slate-500 font-medium">Hospitals Nearby</p></div>
            <div><p className="text-xl sm:text-2xl font-bold text-slate-900">{guardians.length}</p><p className="text-[11px] sm:text-xs text-slate-500 font-medium">Guardians</p></div>
          </div>
        </section>

        {/* Tab Navigation */}
        <div className="mb-8 overflow-x-auto">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-max min-w-full sm:min-w-0 sm:w-fit mx-auto">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id)} className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${activeTab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <Icon size={15} />{label}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>

            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Quick Actions */}
                <div className="card-elevated p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center"><Zap size={18} className="text-indigo-600" /></div>
                    <div><p className="font-bold text-slate-900">Quick Actions</p><p className="text-xs text-slate-500">Fast access to emergency features</p></div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  
                    <button onClick={() => navigate('/monitor')} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-100 transition-colors group">
                      <div className="w-12 h-12 rounded-full bg-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform"><Camera size={20} className="text-white" /></div>
                      <span className="text-xs font-semibold text-slate-900">AI Monitor</span>
                    </button>
                    <button onClick={() => setActiveTab('hospitals')} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-100 transition-colors group">
                      <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform"><Building2 size={20} className="text-white" /></div>
                      <span className="text-xs font-semibold text-slate-900">Hospitals</span>
                    </button>
                    <button onClick={() => navigate('/history')} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-100 transition-colors group">
                      <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform"><History size={20} className="text-white" /></div>
                      <span className="text-xs font-semibold text-slate-900">History</span>
                    </button>
                    <button onClick={() => navigate('/my-emergency-qr')} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors group">
                      <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center group-hover:scale-110 transition-transform"><User size={20} className="text-white" /></div>
                      <span className="text-xs font-semibold text-slate-900">Emergency QR</span>
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Auto SOS Motion Guard</p>
                      <p className="text-xs text-slate-500">Detects sudden acceleration/rotation and asks before placing SOS.</p>
                    </div>
                    {!sensorSupported ? (
                      <span className="text-xs font-semibold px-3 py-2 rounded-lg bg-slate-200 text-slate-600">Not Supported</span>
                    ) : autoSosEnabled ? (
                      <button onClick={() => setAutoSosEnabled(false)} className="text-xs font-semibold px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">Enabled (Tap to Disable)</button>
                    ) : (
                      <button onClick={enableAutoSosMonitoring} className="text-xs font-semibold px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-colors">Enable Auto SOS</button>
                    )}
                  </div>
                </div>

                {/* Live SOS Map */}
                <div className="card-elevated overflow-hidden">
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center"><Bell size={18} className="text-red-600" /></div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">Live SOS Map</p>
                        <p className="text-xs text-slate-500">All active incidents around your location</p>
                      </div>
                    </div>
                    <button onClick={fetchPendingSOS} className="text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-xl transition-colors">Refresh</button>
                  </div>
                  {pendingSOS.length === 0 ? (
                    <div className="flex flex-col items-center py-14 text-center px-6">
                      <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mb-4"><Shield size={24} className="text-green-600" /></div>
                      <p className="font-semibold text-slate-900">No live SOS alerts</p>
                      <p className="text-sm text-slate-500 mt-1">Your area is currently calm and monitored.</p>
                    </div>
                  ) : (
                    <div className="grid lg:grid-cols-[1.5fr_1fr]">
                      <div className="h-[360px] border-b lg:border-b-0 lg:border-r border-slate-100">
                        <MapContainer center={[location.latitude, location.longitude]} zoom={13} className="h-full w-full" zoomControl={false} preferCanvas>
                          <MapGestureGuard />
                          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                          <FitLiveSOSBounds location={location} points={pendingSOS} />
                          <Marker position={[location.latitude, location.longitude]} icon={userIcon}>
                            <Popup>You are here</Popup>
                          </Marker>
                          {pendingSOS.map((sos) => {
                            const [lng, lat] = sos.location.coordinates;
                            return (
                              <Marker key={sos._id} position={[lat, lng]} icon={sosPulseIcon}>
                                <Popup>
                                  <div className="text-xs">
                                    <div className="font-semibold capitalize">{sos.crisisType}</div>
                                    <div className="text-slate-500">{sos.address || 'Address unavailable'}</div>
                                  </div>
                                </Popup>
                              </Marker>
                            );
                          })}
                        </MapContainer>
                      </div>
                      <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100 bg-white">
                        {pendingSOS.slice(0, 8).map((sos, index) => {
                          const [lng, lat] = sos.location.coordinates;
                          const km = getDistanceKm(location.latitude, location.longitude, lat, lng);
                          return (
                            <div key={sos._id} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-bold uppercase">{sos.crisisType}</span>
                                  <span className="text-[11px] text-slate-400">#{index + 1}</span>
                                </div>
                                <p className="text-xs text-slate-500 truncate">{sos.address || 'Address unavailable'}</p>
                                <p className="text-xs font-semibold text-slate-700 mt-1">{km.toFixed(2)} km away</p>
                              </div>
                              <button
                                onClick={() => {
                                  acceptSOS(sos._id);
                                  navigate(`/sos/${sos._id}`);
                                }}
                                className="shrink-0 text-xs font-semibold px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-colors"
                              >
                                Respond
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Emergency Contacts */}
                <div className="card-elevated p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center"><HeartPulse size={18} className="text-green-600" /></div>
                    <div><p className="font-bold text-slate-900">Emergency Contacts</p><p className="text-xs text-slate-500">Quick dial emergency services</p></div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <a href="tel:108" className="flex flex-col items-center gap-2 p-4 rounded-xl bg-red-50 hover:bg-red-100 border border-red-100 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center"><Ambulance size={20} weight="duotone" className="text-red-600" /></div>
                      <span className="text-xs font-semibold text-slate-900">Ambulance</span>
                      <span className="text-lg font-bold text-red-600">108</span>
                    </a>
                    <a href="tel:101" className="flex flex-col items-center gap-2 p-4 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-100 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center"><FireTruck size={20} weight="duotone" className="text-orange-600" /></div>
                      <span className="text-xs font-semibold text-slate-900">Fire</span>
                      <span className="text-lg font-bold text-orange-600">101</span>
                    </a>
                    <a href="tel:100" className="flex flex-col items-center gap-2 p-4 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-100 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center"><PoliceCar size={20} weight="duotone" className="text-blue-600" /></div>
                      <span className="text-xs font-semibold text-slate-900">Police</span>
                      <span className="text-lg font-bold text-blue-600">100</span>
                    </a>
                    <a href="tel:112" className="flex flex-col items-center gap-2 p-4 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-100 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center"><Lifebuoy size={20} weight="duotone" className="text-purple-600" /></div>
                      <span className="text-xs font-semibold text-slate-900">All Services</span>
                      <span className="text-lg font-bold text-purple-600">112</span>
                    </a>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Nearest Incident */}
                  <div className="card-elevated overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center"><AlertCircle size={18} className="text-red-600" /></div>
                        <div><p className="font-bold text-slate-900 text-sm">Nearby Incidents</p><p className="text-xs text-slate-500">Live alerts in your area</p></div>
                      </div>
                      <button onClick={fetchPendingSOS} className="text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-xl transition-colors">Refresh</button>
                    </div>
                    {!nearestSOS ? (
                      <div className="flex flex-col items-center py-14 text-center px-6">
                        <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mb-4"><Shield size={24} className="text-green-600" /></div>
                        <p className="font-semibold text-slate-900">Area Secure</p>
                        <p className="text-sm text-slate-500 mt-1">No active emergency alerts in your radius.</p>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="h-64">
                          <MapContainer center={[nearestSOS.location.coordinates[1], nearestSOS.location.coordinates[0]]} zoom={14} className="h-full w-full" zoomControl={false} preferCanvas>
                            <MapGestureGuard />
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                            <FitBounds userLocation={location} sosLocation={[nearestSOS.location.coordinates[1], nearestSOS.location.coordinates[0]]} />
                            <Marker position={[location.latitude, location.longitude]} icon={userIcon} />
                            <Marker position={[nearestSOS.location.coordinates[1], nearestSOS.location.coordinates[0]]} icon={sosPulseIcon} />
                          </MapContainer>
                        </div>
                        <div className="absolute bottom-3 left-3 right-3 z-[999]">
                          <div className="glass-panel rounded-2xl p-3 flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-0.5"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /><span className="text-xs font-bold text-red-600 uppercase">{nearestSOS.crisisType}</span></div>
                              <div className="flex items-center gap-1 text-sm font-medium text-slate-700"><MapPin size={13} className="text-slate-400" />{nearestSOS.distanceKm.toFixed(2)} km away</div>
                            </div>
                            <button onClick={() => { acceptSOS(nearestSOS._id); navigate(`/sos/${nearestSOS._id}`); }} className="btn-emergency text-sm px-4 py-2 h-auto rounded-xl">Respond <ChevronRight size={15} /></button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Nearest Hospitals with ETA */}
                  <div className="card-elevated overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center"><Building2 size={18} className="text-blue-600" /></div>
                        <div><p className="font-bold text-slate-900 text-sm">Nearest Hospitals</p><p className="text-xs text-slate-500">With live traffic ETA</p></div>
                      </div>
                      <button onClick={() => setActiveTab('hospitals')} className="text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-colors">View All</button>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {nearestHospitals.length === 0 ? (
                        <div className="flex flex-col items-center py-14 text-center px-6">
                          <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-4"><Building2 size={24} className="text-slate-400" /></div>
                          <p className="text-sm text-slate-500">Loading nearby hospitals...</p>
                        </div>
                      ) : nearestHospitals.slice(0, 4).map((h, i) => (
                        <div key={h._id || i} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 text-sm font-bold text-blue-600">{i + 1}</div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 text-sm truncate">{h.name}</p>
                              <p className="text-xs text-slate-500 truncate">{h.address || 'Address not available'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-3">
                            <div className="text-right">
                              <div className="flex items-center gap-1 text-sm font-bold text-slate-900"><Clock size={12} className="text-blue-500" />{h.eta ?? '?'} min</div>
                              <p className="text-xs text-slate-400">{h.distanceKm} km</p>
                            </div>
                            {h.location?.coordinates && (
                              <a href={`https://www.google.com/maps/dir/?api=1&destination=${h.location.coordinates[1]},${h.location.coordinates[0]}`} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center hover:bg-slate-700 transition-colors">
                                <Navigation size={13} />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Responder Profile */}
                <div className="card-elevated p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center"><User size={18} className="text-indigo-600" /></div>
                    <div><p className="font-bold text-slate-900">Responder Profile</p><p className="text-xs text-slate-500">Select your skills to receive relevant alerts</p></div>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-5">
                    {SKILL_OPTIONS.map(skill => {
                      const selected = selectedSkills.includes(skill.type);
                      return (
                        <button key={skill.type} onClick={() => setSelectedSkills(prev => prev.includes(skill.type) ? prev.filter(s => s !== skill.type) : [...prev, skill.type])} className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${selected ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                          {selected && <Check size={12} weight="bold" className="mr-1.5 inline" />} {skill.label}
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={async () => { try { setProfileSaving(true); const res = await authAPI.updateProfile({ skills: selectedSkills.map(s => ({ type: s, verified: false })) }); setAuth(res.data.data.user); setPopup({ type: 'success', message: 'Profile updated!' }); } catch { setPopup({ type: 'error', message: 'Update failed' }); } finally { setProfileSaving(false); } }} disabled={profileSaving} className="btn-primary text-sm px-5 py-2.5 h-auto rounded-xl">
                    {profileSaving ? 'Saving...' : 'Save Skills'}
                  </button>
                </div>

                {/* Welfare Checks */}
                {welfareChecks.length > 0 && (
                  <div className="card-elevated p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center"><HeartPulse size={18} className="text-amber-600" /></div>
                      <div><p className="font-bold text-slate-900">Welfare Check-In</p><p className="text-xs text-slate-500">How are you doing after your recent emergency?</p></div>
                    </div>
                    <div className="space-y-3">
                      {welfareChecks.map(check => (
                        <div key={check._id} className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                          <p className="text-sm font-semibold text-amber-900 mb-1">Your <span className="capitalize">{check.crisisType}</span> emergency was resolved on {new Date(check.resolvedAt).toLocaleDateString()}.</p>
                          <p className="text-xs text-amber-700 mb-3">We want to make sure you're doing well.</p>
                          <div className="flex gap-2">
                            <button onClick={async () => { await sosAPI.respondToWelfareCheck(check._id, 'fine'); setWelfareChecks(p => p.filter(w => w._id !== check._id)); setPopup({ type: 'success', message: 'Glad you are safe!' }); }} className="flex-1 bg-green-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors">I'm Fine</button>
                            <button onClick={async () => { await sosAPI.respondToWelfareCheck(check._id, 'need_help'); setWelfareChecks(p => p.filter(w => w._id !== check._id)); setPopup({ type: 'warning', message: 'Help is being coordinated.' }); }} className="flex-1 bg-red-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors">Need Help</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'hospitals' && <HospitalFinder location={location} />}
            {activeTab === 'resources' && <ResourceMap location={location} />}

            {activeTab === 'guardian' && (
              <div className="grid md:grid-cols-2 gap-6">
                <div className="card-elevated p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center"><ShieldCheck size={18} className="text-purple-600" /></div>
                    <div><p className="font-bold text-slate-900">Guardian Mode</p><p className="text-xs text-slate-500">Guardians get notified first during your SOS</p></div>
                  </div>
                  <div className="flex gap-2 mb-4">
                    <input type="email" value={guardianEmail} onChange={e => setGuardianEmail(e.target.value)} placeholder="Guardian's email" className="flex-1 input-field text-sm" onKeyDown={e => e.key === 'Enter' && handleAddGuardian()} />
                    <button onClick={handleAddGuardian} disabled={guardianLoading || !guardianEmail.trim()} className="bg-purple-600 text-white px-4 py-2.5 rounded-2xl text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"><UserPlus size={14} />{guardianLoading ? '...' : 'Add'}</button>
                  </div>
                  {guardians.length > 0 ? (
                    <div className="space-y-2">
                      {guardians.map(g => (
                        <div key={g._id} className="flex items-center justify-between p-3 bg-purple-50 border border-purple-100 rounded-2xl">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-purple-200 flex items-center justify-center text-purple-700 text-xs font-bold">{g.name?.[0]}</div>
                            <div><p className="text-sm font-semibold text-slate-900">{g.name}</p><p className="text-xs text-slate-500">{g.email}</p></div>
                          </div>
                          <button onClick={async () => { const res = await authAPI.removeGuardian(g._id); setGuardians(res.data.data.user.guardians || []); }} className="text-slate-400 hover:text-red-500 transition-colors p-1"><X size={14} /></button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-400"><ShieldCheck size={28} className="mx-auto mb-2 opacity-40" /><p className="text-sm">No guardians assigned yet</p></div>
                  )}
                </div>

                <div className="card-elevated p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center"><User size={18} className="text-blue-600" /></div>
                    <div><p className="font-bold text-slate-900">You are Guardian For</p><p className="text-xs text-slate-500">People who have added you as their guardian</p></div>
                  </div>
                  {wards.length > 0 ? (
                    <div className="space-y-2">
                      {wards.map(w => (
                        <div key={w._id} className="flex items-center gap-2.5 p-3 bg-blue-50 border border-blue-100 rounded-2xl">
                          <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 text-xs font-bold">{w.name?.[0]}</div>
                          <div><p className="text-sm font-semibold text-slate-900">{w.name}</p><p className="text-xs text-slate-500">{w.email}</p></div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-400"><User size={28} className="mx-auto mb-2 opacity-40" /><p className="text-sm">No one has added you as guardian yet</p></div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {showCrisisSelector && <CrisisSelector location={location} onClose={() => setShowCrisisSelector(false)} user={user} guardians={guardians} />}
      {incomingAlert && <SOSAlertModal alert={incomingAlert} onClose={() => setIncomingAlert(null)} onAccepted={sosId => { setIncomingAlert(null); navigate(`/sos/${sosId}`); }} />}

      <AnimatePresence>
        {autoSosModal && (
          <div className="fixed inset-0 z-[1200] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/45 backdrop-blur-sm"
              onClick={() => setAutoSosModal(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 24 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-red-200 bg-white px-4 sm:px-6 pt-3 sm:pt-6 pb-5 sm:pb-6 shadow-2xl"
            >
              <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-3 sm:hidden" />
              <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mb-4 mx-auto sm:mx-0">
                <AlertCircle size={24} className="text-red-600" weight="fill" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 text-center sm:text-left">Sudden movement detected</h3>
              <p className="text-sm sm:text-base text-slate-600 mt-2 text-center sm:text-left">{autoSosModal.reason}. Do you want to call SOS now?</p>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 text-center sm:text-left">Your phone vibrated to draw immediate attention.</p>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={handleAutoSosCall}
                  disabled={autoSosSending}
                  className="w-full py-3.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  {autoSosSending ? 'Calling SOS...' : 'Call SOS'}
                </button>
                <button
                  onClick={() => setAutoSosModal(null)}
                  className="w-full py-3.5 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 active:scale-[0.98] transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Dashboard;
