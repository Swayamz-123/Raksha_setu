import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { useAuthStore } from '../store/authStore';
import { sosAPI, chatbotAPI, routingAPI } from '../services/api';
import { initSocket, getSocket, broadcastSOS, sendMessage, shareLiveLocation } from '../services/socket';
import ScreenPopup from '../components/ScreenPopup';
import PageLoader from '../components/PageLoader';
import AICrisisChat from '../components/AICrisisChat';
import RatingModal from '../components/RatingModal';
import MapGestureGuard from '../components/MapGestureGuard';
import {
  NavigationArrow as Navigation, PaperPlaneRight as Send, WarningCircle as AlertTriangle, ShieldCheck, MapPin, CornersIn as Minimize2, CornersOut as Maximize2,
  Flag, ArrowLeft, Robot as Bot, Medal as Award, Buildings as Building2, Clock, Phone, CaretRight as ChevronRight, SpinnerGap as Loader2
} from '@phosphor-icons/react';
import {
  Heart,
  FireExtinguisher,
  FirstAidKit,
  PoliceCar,
  FireTruck,
  Ambulance,
  MapPin as PhosphorMapPin,
  CheckCircle,
  Star
} from '@phosphor-icons/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { motion, AnimatePresence } from 'framer-motion';
import 'leaflet/dist/leaflet.css';

const RESOURCE_ICONS = {
  aed: { icon: Heart, color: '#ca8a04' },
  fire_extinguisher: { icon: FireExtinguisher, color: '#dc2626' },
  hospital: { icon: FirstAidKit, color: '#2563eb' },
  police_station: { icon: PoliceCar, color: '#1d4ed8' },
  fire_station: { icon: FireTruck, color: '#ea580c' }
};
const resourceIconCache = {};
const getResourceIcon = (resourceType) => {
  if (!resourceIconCache[resourceType]) {
    const config = RESOURCE_ICONS[resourceType] || { icon: PhosphorMapPin, color: '#475569' };
    const Icon = config.icon;
    const iconMarkup = renderToStaticMarkup(<Icon size={14} weight="fill" color={config.color} />);
    resourceIconCache[resourceType] = new L.DivIcon({
      className: 'resource-icon-wrapper',
      html: `<div style="width:24px;height:24px;border-radius:999px;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(15,23,42,.22);border:1px solid #e2e8f0">${iconMarkup}</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
  }
  return resourceIconCache[resourceType];
};
const sosPulseIcon = new L.DivIcon({ className: 'sos-pulse-wrapper', html: '<div class="sos-pulse-dot"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });
const responderIcon = new L.DivIcon({ className: 'user-map-wrapper', html: '<div style="width:16px;height:16px;border-radius:50%;background:#16a34a;border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });
const hospitalIcon = new L.DivIcon({ className: '', html: `<div style="width:28px;height:28px;border-radius:8px;background:#2563eb;border:2px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(37,99,235,.4)">${renderToStaticMarkup(<FirstAidKit size={14} weight="fill" color="#ffffff" />)}</div>`, iconSize: [28, 28], iconAnchor: [14, 14] });
const ambulanceIcon = new L.DivIcon({ className: '', html: `<div style="width:24px;height:24px;border-radius:999px;background:#dc2626;border:2px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(220,38,38,.45)">${renderToStaticMarkup(<Ambulance size={12} weight="fill" color="#ffffff" />)}</div>`, iconSize: [24, 24], iconAnchor: [12, 12] });

export default function SOSBroadcast() {
  const { sosId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [sos, setSos] = useState(null);
  const [guidance, setGuidance] = useState(null);
  const [emergencySummary, setEmergencySummary] = useState('');
  const [nearbyResources, setNearbyResources] = useState([]);
  const [nearbyAmbulances, setNearbyAmbulances] = useState([]);
  const [assignedAmbulances, setAssignedAmbulances] = useState([]);
  const [nearestHospitals, setNearestHospitals] = useState([]);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [routePolyline, setRoutePolyline] = useState([]);
  const [responders, setResponders] = useState([]);
  const [selectedResponderId, setSelectedResponderId] = useState(null);
  const [responderLocations, setResponderLocations] = useState({});
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [resolveDebrief, setResolveDebrief] = useState('');
  const [activeTab, setActiveTab] = useState('team');
  const [aiMessages, setAiMessages] = useState([{ sender: 'ai', text: 'I am your emergency AI assistant. How can I help you handle this situation?' }]);
  const [aiLoading, setAiLoading] = useState(false);
  const [hospitalsLoading, setHospitalsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const sosRef = useRef(null);

  useEffect(() => { sosRef.current = sos; }, [sos]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, aiMessages, activeTab]);

  useEffect(() => {
    loadSOSData();
    const socket = initSocket();
    if (socket) {
      socket.emit('join_sos', { sosId });
      socket.on('responder_accepted', ({ responder }) => {
        const id = responder?.user?._id;
        setResponders(prev => prev.some(r => r.user?._id === id) ? prev : [...prev, responder]);
        if (!selectedResponderId && id) setSelectedResponderId(id);
      });
      socket.on('sos_accepted', ({ sos: acceptedSos }) => {
        // If someone accepts this SOS and we're not already on this page, navigate to it
        if (acceptedSos?._id && acceptedSos._id !== sosId) {
          navigate(`/sos/${acceptedSos._id}`);
        }
      });
      socket.on('sos_state_updated', ({ status, responders: next }) => {
        if (status) setSos(prev => prev ? { ...prev, status } : prev);
        if (Array.isArray(next)) { setResponders(next); if (!selectedResponderId && next[0]?.user?._id) setSelectedResponderId(next[0].user._id); }
      });
      socket.on('new_message', msg => setMessages(prev => [...prev, msg]));
      socket.on('live_location_update', ({ userId, longitude, latitude, responderId }) => setResponderLocations(prev => ({ ...prev, [responderId || userId]: { longitude, latitude } })));
      socket.on('sos_resolved', ({ debrief }) => {
        const cur = sosRef.current;
        const curUser = useAuthStore.getState().user;
        if (cur?.broadcaster?._id !== curUser?._id) { setPopup({ type: 'success', message: 'SOS resolved. Returning to dashboard...' }); setTimeout(() => navigate('/dashboard'), 2000); }
      });
      socket.on('no_responders_found', () => setPopup({ type: 'info', message: 'No responders found nearby. Expanding search...' }));
      socket.on('expanding_search', () => setPopup({ type: 'info', message: 'Expanding search radius...' }));
      socket.on('sos_already_taken', () => { setPopup({ type: 'info', message: 'This SOS has already been accepted.' }); setTimeout(() => navigate('/dashboard', { replace: true }), 1500); });
      socket.on('guardians_notified', ({ count, message }) => setPopup({ type: 'success', message: message || `${count} guardian(s) notified first.` }));
      socket.on('ambulance_dispatched', ({ ambulances }) => {
        setAssignedAmbulances(prev => {
          const merged = [...prev];
          (ambulances || []).forEach((amb) => {
            if (!merged.some((x) => String(x._id) === String(amb._id))) merged.push(amb);
          });
          return merged;
        });
        if ((ambulances || []).length > 0) {
          setPopup({ type: 'success', message: `${ambulances.length} ambulance unit(s) dispatched.` });
        }
      });
      socket.on('sos_enriched', ({ aiGuidance, emergencySummary }) => {
        if (aiGuidance) setGuidance(aiGuidance);
        if (emergencySummary) setEmergencySummary(emergencySummary);
      });
      socket.on('sos_dispatched', ({ responderCount, ambulanceCount }) => {
        setPopup({
          type: 'info',
          message: `Dispatch active: ${responderCount} nearby responder(s), ${ambulanceCount} ambulance unit(s) alerted.`
        });
      });
    }
    const locationInterval = setInterval(() => {
      navigator.geolocation.getCurrentPosition(pos => shareLiveLocation(sosId, pos.coords.longitude, pos.coords.latitude, selectedResponderId));
    }, 5000);
    return () => {
      clearInterval(locationInterval);
      if (socket) ['responder_accepted','sos_accepted','sos_state_updated','new_message','live_location_update','sos_resolved','no_responders_found','expanding_search','sos_already_taken','guardians_notified','ambulance_dispatched'].forEach(e => socket.off(e));
    };
  }, [sosId, selectedResponderId, navigate]);

  const loadSOSData = async () => {
    try {
      const res = await sosAPI.getById(sosId);
      const data = res.data.data;
      setSos(data.sos); setGuidance(data.guidance); setEmergencySummary(data.emergencySummary || ''); setNearbyResources(data.nearbyResources || []); setNearbyAmbulances(data.nearbyAmbulances || []);
      const existingDispatches = (data.sos?.ambulanceDispatches || []).map((d) => ({
        _id: d.ambulance?._id || d.ambulance,
        name: d.ambulance?.name || 'Ambulance Unit',
        vehicleNumber: d.ambulance?.vehicleNumber || 'N/A',
        phone: d.ambulance?.phone || null,
        etaMinutes: d.etaMinutes,
        distanceKm: d.distanceKm,
        status: d.status,
        location: d.ambulance?.location
      }));
      setAssignedAmbulances(existingDispatches);
      const init = data.sos?.responders || [];
      setResponders(init);
      if (init.length > 0) setSelectedResponderId(init[0].user?._id || null);
      if (data.sos?.broadcaster?._id === user?._id && data.sos?.status === 'active') broadcastSOS(sosId);

      // Load nearest hospitals with routing
      const [lng, lat] = data.sos.location.coordinates;
      setHospitalsLoading(true);
      routingAPI.getNearestHospitals(lat, lng, 10000)
        .then(r => { setNearestHospitals(r.data.data.hospitals || []); })
        .catch(() => {})
        .finally(() => setHospitalsLoading(false));
    } catch { console.error('Failed to load SOS data'); }
    finally { setLoading(false); }
  };

  const handleSelectHospital = (hospital) => {
    setSelectedHospital(hospital);
    if (hospital.routePolyline?.length > 0) setRoutePolyline(hospital.routePolyline);
    else setRoutePolyline([]);
  };

  const handleResolve = async () => {
    if (!window.confirm('Are you certain the emergency is over?')) return;
    try { const res = await sosAPI.resolve(sosId); setResolveDebrief(res.data?.data?.debrief || ''); setShowRatingModal(true); }
    catch { setPopup({ type: 'error', message: 'Failed to resolve SOS' }); }
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!messageInput.trim()) return;
    if (activeTab === 'ai') {
      const userMsg = { sender: 'user', text: messageInput };
      setAiMessages(prev => [...prev, userMsg]); setMessageInput(''); setAiLoading(true);
      try {
        const history = aiMessages.map(m => ({ role: m.sender === 'ai' ? 'assistant' : 'user', content: m.text }));
        const res = await chatbotAPI.chat({ question: messageInput, crisisType: sos?.crisisType || 'general', conversationHistory: history });
        setAiMessages(prev => [...prev, { sender: 'ai', text: res.data.data.answer }]);
      } catch { setAiMessages(prev => [...prev, { sender: 'ai', text: "Connection error. Please focus on safety." }]); }
      finally { setAiLoading(false); }
    } else { sendMessage(sosId, messageInput, selectedResponderId); setMessageInput(''); }
  };

  const visibleMessages = useMemo(() => !selectedResponderId ? messages : messages.filter(m => (m.responderId || null) === selectedResponderId), [messages, selectedResponderId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="pt-6">
          <PageLoader text="Connecting to Secure Channel..." />
        </div>
      </div>
    );
  }
  if (!sos) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="pt-6 p-8 text-center text-red-600">SOS ID not found</div>
      </div>
    );
  }

  const isBroadcaster = sos?.broadcaster?._id === user?._id;
  const [longitude, latitude] = sos.location.coordinates;

  return (
    <div className="min-h-screen bg-slate-100">
      <ScreenPopup popup={popup} onClose={() => setPopup(null)} />
      <div className="h-[100vh] w-full flex flex-col md:flex-row overflow-hidden">

      {/* Map */}
      <div className={`relative isolate transition-all duration-300 ${isFullscreen ? 'w-full h-full absolute z-50' : 'w-full md:w-3/5 h-[42vh] md:h-full'}`}>
        <MapContainer center={[latitude, longitude]} zoom={15} className="h-full w-full outline-none" zoomControl={false} preferCanvas>
          <MapGestureGuard />
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" updateWhenZooming={false} updateWhenIdle keepBuffer={8} maxZoom={19} />
          <Marker position={[latitude, longitude]} icon={sosPulseIcon}><Popup><div className="text-center font-bold text-red-600 uppercase text-xs">{sos.crisisType} Emergency</div></Popup></Marker>
          <Circle center={[latitude, longitude]} radius={sos.broadcastRadius || 1000} pathOptions={{ color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.06, weight: 1.5, dashArray: '6 4' }} />
          {Object.entries(responderLocations).map(([key, value]) => (
            <Marker key={key} position={[value.latitude, value.longitude]} icon={responderIcon}><Popup><div className="text-xs font-bold">{responders.find(r => r.user?._id === key)?.user?.name || 'Responder'}</div></Popup></Marker>
          ))}
          {nearbyResources.map(resource => {
            const [rLng, rLat] = resource.location.coordinates;
            return <Marker key={resource._id} position={[rLat, rLng]} icon={getResourceIcon(resource.type)}><Popup><div className="text-xs"><div className="font-bold">{resource.name}</div><div className="capitalize text-slate-500">{resource.type.replaceAll('_', ' ')}</div></div></Popup></Marker>;
          })}
          {nearestHospitals.slice(0, 5).map((h, i) => {
            const hLat = h.location?.coordinates?.[1];
            const hLng = h.location?.coordinates?.[0];
            if (!hLat || !hLng) return null;
            return <Marker key={h._id || i} position={[hLat, hLng]} icon={hospitalIcon}><Popup><div className="text-xs"><div className="font-bold text-blue-700">{h.name}</div><div className="text-slate-500">{h.eta} min ETA · {h.distanceKm} km</div>{h.phone && <div className="text-green-600 font-medium">{h.phone}</div>}</div></Popup></Marker>;
          })}
          {assignedAmbulances.map((amb, i) => {
            const aLat = amb.location?.coordinates?.[1];
            const aLng = amb.location?.coordinates?.[0];
            if (!aLat || !aLng) return null;
            return <Marker key={`assigned-amb-${amb._id || i}`} position={[aLat, aLng]} icon={ambulanceIcon}><Popup><div className="text-xs"><div className="font-bold text-red-600">{amb.name}</div><div className="text-slate-500">{amb.vehicleNumber}</div><div className="text-slate-500">ETA {amb.etaMinutes ?? '?'} min · {amb.distanceKm ?? '?'} km</div>{amb.phone && <div className="text-green-600 font-medium">{amb.phone}</div>}</div></Popup></Marker>;
          })}
          {assignedAmbulances.length === 0 && nearbyAmbulances.slice(0, 3).map((amb, i) => {
            const aLat = amb.location?.coordinates?.[1];
            const aLng = amb.location?.coordinates?.[0];
            if (!aLat || !aLng) return null;
            return <Marker key={`nearby-amb-${amb._id || i}`} position={[aLat, aLng]} icon={ambulanceIcon}><Popup><div className="text-xs"><div className="font-bold text-red-600">{amb.name}</div><div className="text-slate-500">{amb.vehicleNumber}</div><div className="text-slate-500">ETA {amb.etaMinutes ?? '?'} min · {amb.distanceKm ?? '?'} km</div>{amb.phone && <div className="text-green-600 font-medium">{amb.phone}</div>}</div></Popup></Marker>;
          })}
          {routePolyline.length > 1 && <Polyline positions={routePolyline} pathOptions={{ color: '#2563eb', weight: 4, opacity: 0.8, dashArray: '8 4' }} />}
        </MapContainer>

        {/* Map controls */}
        <div className="absolute top-3 left-3 z-[999] flex gap-2">
          <button onClick={() => navigate('/dashboard')} className="glass-panel rounded-xl p-2 text-slate-700 hover:text-slate-900 shadow-sm"><ArrowLeft size={18} /></button>
        </div>
        <button onClick={() => setIsFullscreen(!isFullscreen)} className="absolute top-3 right-3 z-[999] glass-panel rounded-xl p-2 text-slate-700 hover:text-slate-900 shadow-sm hidden md:block">{isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>

        {/* Status badge */}
        <div className="absolute bottom-4 left-3 right-3 md:left-auto md:right-3 z-[999] max-w-xs ml-auto">
          <div className="bg-red-600/95 backdrop-blur text-white p-4 rounded-2xl shadow-xl border border-red-500/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2"><AlertTriangle size={16} className="animate-pulse" /><span className="font-bold text-sm">Active Emergency</span></div>
              <span className="text-[10px] bg-red-800/60 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">Live</span>
            </div>
            <p className="text-red-200 text-xs mb-3 uppercase tracking-wide font-semibold">{sos.crisisType} Alert</p>
            {isBroadcaster ? (
              <button onClick={handleResolve} className="w-full bg-white text-red-600 py-2 rounded-xl font-bold text-sm hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5"><CheckCircle size={15} weight="fill" />Mark Safe</button>
            ) : (
              <button onClick={async () => { if (!window.confirm('Flag as false alert?')) return; try { await sosAPI.flag(sosId); setPopup({ type: 'info', message: 'Alert flagged.' }); } catch { setPopup({ type: 'error', message: 'Failed to flag' }); } }} className="w-full bg-red-800/60 text-white py-2 rounded-xl font-bold text-sm hover:bg-red-800 transition-colors flex items-center justify-center gap-1.5"><Flag size={13} /> Report False</button>
            )}
          </div>
        </div>
      </div>

      {/* Side Panel */}
      <div className={`bg-white flex flex-col border-l border-slate-200 z-20 transition-all ${isFullscreen ? 'hidden' : 'w-full md:w-2/5 h-[58vh] md:h-full'}`}>
        {/* Tabs */}
        <div className="border-b border-slate-100 px-4 pt-3">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-3">
            {[
              { id: 'team', label: `Responders (${responders.length})` },
              { id: 'hospitals', label: 'Hospitals' },
              { id: 'ai', label: 'AI Assistant' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{tab.label}</button>
            ))}
          </div>

          {activeTab === 'team' && (
            <>
              {guidance && (
                <div className="mb-3 bg-blue-50 border border-blue-100 p-3 rounded-xl">
                  <p className="text-xs font-bold text-blue-800 mb-1 flex items-center gap-1.5"><ShieldCheck size={13} /> AI Safety Guidance</p>
                  <p className="text-xs text-blue-700 leading-relaxed max-h-16 overflow-y-auto">{guidance.emergencyScript || emergencySummary}</p>
                </div>
              )}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {responders.length === 0 && <p className="text-slate-400 text-xs italic py-1">Scanning for nearby responders...</p>}
                {responders.map(r => {
                  const hasSkills = r.user?.skills?.length > 0;
                  const selected = selectedResponderId === r.user._id;
                  const responderName = (r.user?.name || '').trim();
                  return (
                    <button key={r.user._id} onClick={() => setSelectedResponderId(prev => prev === r.user._id ? null : r.user._id)} className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${selected ? 'bg-slate-900 text-white border-slate-900' : hasSkills ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                      {hasSkills ? <Award size={11} className={selected ? 'text-yellow-300' : 'text-amber-500'} /> : <div className="w-1.5 h-1.5 rounded-full bg-green-400" />}
                      {(responderName ? responderName.split(' ')[0] : 'Responder')}
                      {r.user?.trustScore != null && <span className={`text-[9px] ${selected ? 'text-slate-300' : 'text-slate-400'} inline-flex items-center gap-0.5`}><Star size={9} weight="fill" />{(r.user.trustScore * 5).toFixed(1)}</span>}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">Ambulance Dispatch</p>
                {assignedAmbulances.length > 0 ? (
                  <div className="space-y-1.5 max-h-24 overflow-y-auto">
                    {assignedAmbulances.map((amb, i) => (
                      <div key={`amb-row-${amb._id || i}`} className="flex items-center justify-between p-2 rounded-xl bg-red-50 border border-red-100">
                        <div>
                          <p className="text-xs font-bold text-slate-900">{amb.name}</p>
                          <p className="text-[10px] text-slate-500">{amb.vehicleNumber} • ETA {amb.etaMinutes ?? '?'} min • {amb.distanceKm ?? '?'} km</p>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-600 text-white uppercase font-bold">{amb.status || 'assigned'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400">No ambulance assigned yet. Dispatch in progress...</p>
                )}
              </div>
            </>
          )}

          {activeTab === 'hospitals' && (
            <div className="pb-2">
              {hospitalsLoading ? (
                <div className="flex items-center gap-2 py-2 text-slate-500 text-xs"><Loader2 size={14} className="animate-spin" />Loading hospitals with routes...</div>
              ) : nearestHospitals.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No hospitals found nearby</p>
              ) : (
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {nearestHospitals.slice(0, 5).map((h, i) => (
                    <button key={h._id || i} onClick={() => handleSelectHospital(h)} className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${selectedHospital?._id === h._id ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-100 hover:border-slate-200'}`}>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{h.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-0.5 text-[10px] text-blue-600 font-semibold"><Clock size={9} />{h.eta ?? '?'} min</span>
                          <span className="text-[10px] text-slate-400">{h.distanceKm} km</span>
                          {h.routeFallback && <span className="text-[9px] text-amber-500">est.</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {h.phone && <a href={`tel:${h.phone}`} onClick={e => e.stopPropagation()} className="w-6 h-6 rounded-lg bg-green-100 text-green-700 flex items-center justify-center hover:bg-green-200"><Phone size={10} /></a>}
                        <ChevronRight size={13} className="text-slate-400" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chat / AI area */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 flex flex-col gap-3">
          {activeTab === 'ai' ? <AICrisisChat messages={aiMessages} /> : activeTab === 'team' ? (
            visibleMessages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center flex-col text-slate-400 opacity-60"><Navigation size={40} className="mb-2" /><p className="text-sm">Start coordinating with responders</p></div>
            ) : visibleMessages.map((msg, i) => {
              const isMe = msg.senderId === user?._id;
              return (
                <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${isMe ? 'bg-slate-900 text-white rounded-br-none' : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'}`}>
                    <p>{msg.message}</p>
                    <span className={`text-[10px] block mt-1 ${isMe ? 'text-slate-400' : 'text-slate-400'}`}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex-1 flex items-center justify-center flex-col text-slate-400 opacity-60">
              <Building2 size={40} className="mb-2" />
              <p className="text-sm">Select a hospital above to see route on map</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        {(activeTab === 'team' || activeTab === 'ai') && (
          <div className="p-4 bg-white border-t border-slate-100">
            {activeTab === 'ai' && aiLoading && <div className="text-xs text-blue-500 animate-pulse text-center mb-2">Analyzing situation...</div>}
            <form onSubmit={handleSendMessage} className="relative">
              <input type="text" value={messageInput} onChange={e => setMessageInput(e.target.value)} placeholder={activeTab === 'ai' ? "Ask for safety advice..." : "Message responders..."} className="w-full bg-slate-100 text-slate-900 placeholder-slate-400 rounded-2xl pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-slate-900/20 text-sm font-medium" />
              <button type="submit" disabled={!messageInput.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-slate-900 text-white rounded-xl hover:bg-slate-700 disabled:opacity-40 disabled:bg-slate-300 transition-colors"><Send size={15} /></button>
            </form>
          </div>
        )}
      </div>

      {showRatingModal && <RatingModal sosId={sosId} responders={responders} debrief={resolveDebrief} onClose={() => navigate('/dashboard')} />}
      </div>
    </div>
  );
}
