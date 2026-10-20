import { useEffect, useState } from 'react';
import { adminAPI, sosAPI, authAPI, ambulanceAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { UsersThree as Users, WarningCircle as AlertTriangle, Pulse as Activity, MapPin, MagnifyingGlass as Search, Funnel as Filter, CheckCircle, List as Menu, Bell, SignOut as LogOut, SquaresFour as LayoutDashboard, Shield, Clock, Flag, MapTrifold as MapIcon, Ambulance, Plus, ArrowsClockwise as RefreshCw, SpinnerGap as Loader2 } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import PageLoader from '../components/PageLoader';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [sosList, setSosList] = useState([]);
  const [users, setUsers] = useState([]);
  const [localityStats, setLocalityStats] = useState([]);
  const [activeSOS, setActiveSOS] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sosFilter, setSosFilter] = useState('');
  const [sosPage, setSosPage] = useState(1);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [ambulances, setAmbulances] = useState([]);
  const [ambulanceLoading, setAmbulanceLoading] = useState(false);
  const [ambulanceForm, setAmbulanceForm] = useState({ name: '', vehicleNumber: '', phone: '', provider: 'community', latitude: '', longitude: '' });
  const [ambulanceSaving, setAmbulanceSaving] = useState(false);
  const [ambulanceSeedCount, setAmbulanceSeedCount] = useState(5);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    if (activeTab === 'analytics') adminAPI.getLocalityAnalytics().then(res => setLocalityStats(res.data.data.localityStats || [])).catch(console.error);
    if (activeTab === 'sos') adminAPI.getAllSOS({ limit: 20, page: sosPage, ...(sosFilter && { status: sosFilter }) }).then(res => setSosList(res.data.data.sosList || [])).catch(console.error);
    if (activeTab === 'map') sosAPI.getActive().then(res => setActiveSOS(res.data.data.activeSOS || [])).catch(console.error);
    if (activeTab === 'ambulances') fetchAmbulances();
  }, [activeTab, sosFilter, sosPage]);

  const fetchData = async () => {
    try {
      const [statsRes, sosRes, usersRes] = await Promise.all([adminAPI.getStats(), adminAPI.getAllSOS({ limit: 10 }), adminAPI.getUsers()]);
      setStats(statsRes.data.data); setSosList(sosRes.data.data.sosList || []); setUsers(usersRes.data.data.users || []);
    } catch { console.error('Failed to load admin data'); } finally { setLoading(false); }
  };

  const handleLogout = async () => { try { await authAPI.logout(); } catch {} logout(); navigate('/login'); };
  const handleToggleSuspend = async (userId, isSuspended) => {
    if (!window.confirm(`Are you sure you want to ${isSuspended ? 'unsuspend' : 'suspend'} this user?`)) return;
    try { isSuspended ? await adminAPI.unsuspendUser(userId) : await adminAPI.suspendUser(userId); const res = await adminAPI.getUsers(); setUsers(res.data.data.users || []); }
    catch { alert('Failed to update user status'); }
  };

  const fetchAmbulances = async () => {
    setAmbulanceLoading(true);
    try {
      const res = await ambulanceAPI.getAll();
      setAmbulances(res.data.data.ambulances || []);
    } catch {
      alert('Failed to load ambulances');
    } finally {
      setAmbulanceLoading(false);
    }
  };

  const handleAddAmbulance = async (e) => {
    e.preventDefault();
    setAmbulanceSaving(true);
    try {
      await ambulanceAPI.add({
        ...ambulanceForm,
        latitude: Number(ambulanceForm.latitude),
        longitude: Number(ambulanceForm.longitude)
      });
      setAmbulanceForm({ name: '', vehicleNumber: '', phone: '', provider: 'community', latitude: '', longitude: '' });
      await fetchAmbulances();
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to add ambulance');
    } finally {
      setAmbulanceSaving(false);
    }
  };

  const handleToggleAmbulanceStatus = async (amb) => {
    const next = amb.status === 'available' ? 'offline' : 'available';
    try {
      await ambulanceAPI.updateStatus(amb._id, next);
      await fetchAmbulances();
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to update status');
    }
  };

  const handleSeedAmbulances = async () => {
    const latitude = Number(ambulanceForm.latitude);
    const longitude = Number(ambulanceForm.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      alert('Enter valid latitude and longitude to seed sample ambulances.');
      return;
    }
    try {
      await ambulanceAPI.seed(longitude, latitude, Number(ambulanceSeedCount) || 5);
      await fetchAmbulances();
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to seed ambulances');
    }
  };

  if (loading) return <PageLoader />;

  const TabButton = ({ id, label, icon: Icon }) => (
    <button onClick={() => { setActiveTab(id); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${activeTab === id ? 'bg-gray-900 text-white shadow-lg shadow-gray-900/20' : 'text-gray-500 hover:bg-gray-100'}`}>
      <Icon size={18} />{label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <AnimatePresence>{sidebarOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/50 z-40 lg:hidden" />}</AnimatePresence>
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-100 flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 flex items-center gap-3 border-b border-gray-50"><span className="font-bold text-gray-900 text-xl tracking-tight">Admin<span className="text-red-600">Panel</span></span></div>
        <div className="flex-1 p-4 space-y-2">
          <p className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Main Menu</p>
          <TabButton id="overview" label="Overview" icon={LayoutDashboard} />
          <TabButton id="map" label="Live SOS Map" icon={MapIcon} />
          <TabButton id="users" label="User Management" icon={Users} />
          <TabButton id="ambulances" label="Ambulance Fleet" icon={Ambulance} />
          <TabButton id="sos" label="Emergency Logs" icon={AlertTriangle} />
          <TabButton id="analytics" label="Geo Analytics" icon={Activity} />
        </div>
        <div className="p-4 border-t border-gray-50"><button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors font-medium text-sm"><LogOut size={18} />Sign Out</button></div>
      </aside>

      <main className="flex-1 w-full overflow-hidden flex flex-col">
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 text-gray-500"><Menu size={20} /></button>
            <h2 className="text-lg font-bold text-gray-900 capitalize">{activeTab.replace('-', ' ')}</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative cursor-pointer p-1 rounded-full"><Bell size={20} className="text-gray-400" /><span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span></div>
            <div className="flex items-center gap-3 pl-2 border-l border-gray-100">
              <div className="hidden md:block text-right"><p className="text-xs font-bold text-gray-900">{user?.name}</p><p className="text-[10px] text-gray-400 font-medium">Administrator</p></div>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-200 flex items-center justify-center shadow-sm"><span className="text-sm font-bold text-gray-600 uppercase">{user?.name?.[0] || 'A'}</span></div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="max-w-6xl mx-auto space-y-6">
              {activeTab === 'overview' && stats && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[{ title: 'Total Users', value: stats.totalUsers, icon: Users, color: 'bg-blue-500' }, { title: 'Active SOS', value: stats.activeSOS, icon: AlertTriangle, color: 'bg-red-500', pulse: true }, { title: 'Resolved SOS', value: stats.resolvedSOS, icon: CheckCircle, color: 'bg-green-500' }, { title: 'Total Responders', value: users.filter(u => u.skills?.length > 0).length, icon: Activity, color: 'bg-purple-500' }].map(card => (
                      <div key={card.title} className="card-premium p-6 flex items-center justify-between relative overflow-hidden group">
                        <div><p className="text-sm font-medium text-gray-500 mb-1">{card.title}</p><h3 className="text-3xl font-bold text-gray-900">{card.value}</h3></div>
                        <div className={`p-3 rounded-xl ${card.color} text-white shadow-lg relative`}>{card.pulse && <div className="absolute inset-0 rounded-xl bg-white opacity-30 animate-ping"></div>}<card.icon size={24} /></div>
                      </div>
                    ))}
                  </div>
                  <div className="grid lg:grid-cols-2 gap-6">
                    <div className="card-premium p-6"><h3 className="font-bold text-gray-900 mb-6">Crisis Breakdown</h3><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.sosByType}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" /><XAxis dataKey="_id" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} /><RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} /><Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} /></BarChart></ResponsiveContainer></div></div>
                    <div className="card-premium p-6"><h3 className="font-bold text-gray-900 mb-6">Recent Activity</h3><div className="space-y-4">{sosList.slice(0, 5).map(sos => (<div key={sos._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"><div className="flex items-center gap-3"><div className={`p-2 rounded-lg ${sos.status === 'active' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{sos.status === 'active' ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}</div><div><p className="text-sm font-bold text-gray-900 capitalize">{sos.crisisType}</p><p className="text-xs text-gray-500">{new Date(sos.createdAt).toLocaleDateString()}</p></div></div><span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${sos.status === 'active' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-600'}`}>{sos.status}</span></div>))}</div></div>
                  </div>
                </>
              )}

              {activeTab === 'users' && (() => {
                const filtered = users.filter(u => (!userSearch || u.name?.toLowerCase().includes(userSearch.toLowerCase()) || u.email?.toLowerCase().includes(userSearch.toLowerCase())) && (!userRoleFilter || u.role === userRoleFilter));
                return (
                  <div className="card-premium overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white gap-3">
                      <div className="relative w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} /><input placeholder="Search users..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="w-full bg-gray-50 border-none rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/20" /></div>
                      <div className="flex items-center gap-2">{['', 'user', 'admin'].map(role => (<button key={role} onClick={() => setUserRoleFilter(role)} className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${userRoleFilter === role ? 'bg-gray-900 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}>{role === '' && <Filter size={14} />}{role || 'All'}</button>))}</div>
                    </div>
                    <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-gray-50 text-gray-500 uppercase text-xs"><tr><th className="px-6 py-4 font-medium">Name</th><th className="px-6 py-4 font-medium">Email</th><th className="px-6 py-4 font-medium">Role</th><th className="px-6 py-4 font-medium">Status</th><th className="px-6 py-4 font-medium text-right">Actions</th></tr></thead><tbody>{filtered.map(u => (<tr key={u._id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"><td className="px-6 py-4 font-medium text-gray-900">{u.name}</td><td className="px-6 py-4 text-gray-500">{u.email}</td><td className="px-6 py-4"><span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-50 text-blue-600'}`}>{u.role}</span></td><td className="px-6 py-4"><span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${u.isSuspended ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{u.isSuspended ? 'suspended' : 'active'}</span></td><td className="px-6 py-4 text-right"><button onClick={() => handleToggleSuspend(u._id, u.isSuspended)} className={`text-xs font-medium px-3 py-1 rounded-lg border transition-colors ${u.isSuspended ? 'border-green-200 text-green-600 hover:bg-green-50' : 'border-red-200 text-red-600 hover:bg-red-50'}`}>{u.isSuspended ? 'Unsuspend' : 'Suspend'}</button></td></tr>))}{filtered.length === 0 && <tr><td colSpan={5} className="text-center py-12 text-gray-400">No users match your search</td></tr>}</tbody></table></div>
                  </div>
                );
              })()}

              {activeTab === 'sos' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 flex-wrap"><span className="text-sm font-medium text-gray-600">Filter:</span>{['', 'active', 'responding', 'resolved', 'cancelled'].map(f => (<button key={f} onClick={() => { setSosFilter(f); setSosPage(1); }} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${sosFilter === f ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'}`}>{f || 'All'}</button>))}</div>
                  <div className="card-premium overflow-hidden">
                    <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-gray-50 text-gray-500 uppercase text-xs"><tr><th className="px-4 py-3 font-medium">Crisis</th><th className="px-4 py-3 font-medium">Broadcaster</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Responders</th><th className="px-4 py-3 font-medium">Response Time</th><th className="px-4 py-3 font-medium">False Alert</th><th className="px-4 py-3 font-medium">Date</th></tr></thead><tbody>{sosList.map(sos => (<tr key={sos._id} className="border-b border-gray-50 hover:bg-gray-50/50"><td className="px-4 py-3 font-medium capitalize text-gray-900">{sos.crisisType}</td><td className="px-4 py-3 text-gray-600">{sos.broadcaster?.name || 'Anonymous'}</td><td className="px-4 py-3"><span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${sos.status === 'active' ? 'bg-red-100 text-red-700' : sos.status === 'responding' ? 'bg-yellow-100 text-yellow-700' : sos.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{sos.status}</span></td><td className="px-4 py-3 text-gray-600">{sos.responders?.length || 0}</td><td className="px-4 py-3 text-gray-600">{sos.timeToAcceptance ? `${Math.round(sos.timeToAcceptance)}s` : '—'}</td><td className="px-4 py-3">{sos.isFalseAlert ? <span className="text-red-600 font-bold flex items-center gap-1"><Flag size={12} /> Yes</span> : <span className="text-gray-400">No</span>}</td><td className="px-4 py-3 text-gray-500 text-xs">{new Date(sos.createdAt).toLocaleString()}</td></tr>))}{sosList.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-gray-400">No emergency records found</td></tr>}</tbody></table></div>
                    <div className="flex items-center justify-between p-4 bg-gray-50 border-t border-gray-100"><button onClick={() => setSosPage(Math.max(1, sosPage - 1))} disabled={sosPage <= 1} className="text-xs px-3 py-1.5 bg-white border rounded-lg disabled:opacity-50">Previous</button><span className="text-xs text-gray-500">Page {sosPage}</span><button onClick={() => setSosPage(sosPage + 1)} disabled={sosList.length < 20} className="text-xs px-3 py-1.5 bg-white border rounded-lg disabled:opacity-50">Next</button></div>
                  </div>
                </div>
              )}

              {activeTab === 'ambulances' && (
                <div className="grid lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-1 card-premium p-5">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Plus size={16} /> Add Ambulance</h3>
                    <form onSubmit={handleAddAmbulance} className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-500">Unit Name</label>
                        <input value={ambulanceForm.name} onChange={(e) => setAmbulanceForm(p => ({ ...p, name: e.target.value }))} required className="mt-1 w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="City Unit Alpha" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500">Vehicle Number</label>
                        <input value={ambulanceForm.vehicleNumber} onChange={(e) => setAmbulanceForm(p => ({ ...p, vehicleNumber: e.target.value }))} required className="mt-1 w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="AMB-1024" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500">Phone</label>
                        <input value={ambulanceForm.phone} onChange={(e) => setAmbulanceForm(p => ({ ...p, phone: e.target.value }))} className="mt-1 w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="+91 98xxxxxx" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500">Provider</label>
                        <input value={ambulanceForm.provider} onChange={(e) => setAmbulanceForm(p => ({ ...p, provider: e.target.value }))} className="mt-1 w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="government/private" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-semibold text-gray-500">Latitude</label>
                          <input type="number" step="any" value={ambulanceForm.latitude} onChange={(e) => setAmbulanceForm(p => ({ ...p, latitude: e.target.value }))} required className="mt-1 w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="28.6139" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500">Longitude</label>
                          <input type="number" step="any" value={ambulanceForm.longitude} onChange={(e) => setAmbulanceForm(p => ({ ...p, longitude: e.target.value }))} required className="mt-1 w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="77.2090" />
                        </div>
                      </div>
                      <button type="submit" disabled={ambulanceSaving} className="w-full bg-gray-900 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-800 disabled:opacity-60 flex items-center justify-center gap-2">{ambulanceSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add Ambulance</button>
                    </form>

                    <div className="mt-6 pt-4 border-t border-gray-100 space-y-3">
                      <h4 className="text-sm font-bold text-gray-800">Quick Seed</h4>
                      <div className="flex items-center gap-2">
                        <input type="number" min="1" max="20" value={ambulanceSeedCount} onChange={(e) => setAmbulanceSeedCount(e.target.value)} className="w-20 bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 text-sm" />
                        <button onClick={handleSeedAmbulances} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700">Seed Around Coordinates</button>
                      </div>
                      <p className="text-[11px] text-gray-500">Uses latitude/longitude from the form above.</p>
                    </div>
                  </div>

                  <div className="lg:col-span-2 card-premium overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                      <h3 className="font-bold text-gray-900">Fleet List</h3>
                      <button onClick={fetchAmbulances} className="text-xs font-medium bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 flex items-center gap-1"><RefreshCw size={12} /> Refresh</button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                          <tr>
                            <th className="px-4 py-3 font-medium">Name</th>
                            <th className="px-4 py-3 font-medium">Vehicle</th>
                            <th className="px-4 py-3 font-medium">Provider</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Phone</th>
                            <th className="px-4 py-3 font-medium text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ambulanceLoading && <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Loading fleet...</td></tr>}
                          {!ambulanceLoading && ambulances.map((amb) => (
                            <tr key={amb._id} className="border-b border-gray-50 hover:bg-gray-50/50">
                              <td className="px-4 py-3 font-medium text-gray-900">{amb.name}</td>
                              <td className="px-4 py-3 text-gray-600">{amb.vehicleNumber}</td>
                              <td className="px-4 py-3 text-gray-600 capitalize">{amb.provider || 'community'}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${amb.status === 'available' ? 'bg-green-100 text-green-700' : amb.status === 'busy' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'}`}>{amb.status}</span>
                              </td>
                              <td className="px-4 py-3 text-gray-600">{amb.phone || '—'}</td>
                              <td className="px-4 py-3 text-right">
                                <button onClick={() => handleToggleAmbulanceStatus(amb)} disabled={amb.status === 'busy'} className={`text-xs font-medium px-3 py-1 rounded-lg border ${amb.status === 'available' ? 'border-gray-200 text-gray-700 hover:bg-gray-50' : 'border-green-200 text-green-700 hover:bg-green-50'} disabled:opacity-50`}>{amb.status === 'available' ? 'Set Offline' : amb.status === 'offline' ? 'Set Available' : 'Busy'}</button>
                              </td>
                            </tr>
                          ))}
                          {!ambulanceLoading && ambulances.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-gray-400">No ambulances found. Add one from the form.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'analytics' && stats && (
                <div className="space-y-6">
                  <div className="grid lg:grid-cols-2 gap-6">
                    <div className="card-premium p-6"><h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Clock size={18} className="text-blue-600" /> Response Time Trend</h3><div className="h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={stats?.responseTimeByDay?.slice().reverse() || []}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" /><XAxis dataKey="_id" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} /><RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none' }} /><Line type="monotone" dataKey="avgTime" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Avg Response Time (s)" /><Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="SOS Count" /></LineChart></ResponsiveContainer></div></div>
                    <div className="card-premium p-6"><h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><MapPin size={18} className="text-red-600" /> Locality Breakdown</h3><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={localityStats.slice(0, 10)}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" /><XAxis dataKey="_id" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 9 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} /><RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none' }} /><Bar dataKey="totalSOS" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={30} name="Total SOS" /><Bar dataKey="activeSOS" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={30} name="Active" /></BarChart></ResponsiveContainer></div></div>
                  </div>
                </div>
              )}

              {activeTab === 'map' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between"><div><h3 className="font-bold text-gray-900 text-lg">Live City-Wide SOS View</h3><p className="text-sm text-gray-500">{activeSOS.length} active emergency alert{activeSOS.length !== 1 ? 's' : ''}</p></div><button onClick={() => sosAPI.getActive().then(res => setActiveSOS(res.data.data.activeSOS || []))} className="text-xs font-medium bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors">Refresh Map</button></div>
                  <div className="card-premium overflow-hidden" style={{ height: '500px' }}>
                    <MapContainer center={[20.5937, 78.9629]} zoom={5} className="h-full w-full" zoomControl={true}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      {activeSOS.map((sos) => {
                        const [lng, lat] = sos.location?.coordinates || [0, 0];
                        return <Marker key={sos._id} position={[lat, lng]} icon={new L.DivIcon({ className: 'sos-pulse-wrapper', html: '<div class="sos-pulse-dot"></div>', iconSize: [26, 26], iconAnchor: [13, 13] })}><Popup><div className="text-xs space-y-1"><div className="font-bold text-red-600 uppercase">{sos.crisisType}</div><div className="text-gray-600">{sos.address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`}</div><div className="text-gray-500">Responders: {sos.responders?.length || 0}</div></div></Popup></Marker>;
                      })}
                    </MapContainer>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default AdminDashboard;
