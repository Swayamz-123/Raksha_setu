import { useEffect, useState } from 'react';
import { sosAPI } from '../services/api';
import PageLoader from '../components/PageLoader';
import AppNavbar from '../components/AppNavbar';
import { ArrowLeft, CalendarBlank as Calendar, Clock, MapPin, CheckCircle as CheckCircle2, WarningCircle as AlertTriangle, User, Shield, RadioButton as Radio, Handshake as HeartHandshake } from '@phosphor-icons/react';
import { Star } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';

function History() {
  const [activeTab, setActiveTab] = useState('broadcasts');
  const [broadcasts, setBroadcasts] = useState([]);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sosAPI.getHistory().then(res => {
      setBroadcasts(res.data.data.broadcasted || []);
      setResponses(res.data.data.responded || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const getStatusColor = (s) => s === 'resolved' ? 'bg-green-100 text-green-700' : s === 'active' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700';
  const getStatusIcon = (s) => s === 'resolved' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />;

  if (loading) return <PageLoader />;
  const currentList = activeTab === 'broadcasts' ? broadcasts : responses;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <AppNavbar />

      <main className="max-w-4xl mx-auto px-4 pt-20 pb-8">
        <div className="pt-4">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">Emergency History</h1>

          <div className="mt-4 flex gap-6 border-b border-gray-200">
            {[
              { id: 'broadcasts', label: 'My Alerts', icon: Radio, count: broadcasts.length, color: 'text-red-600', bar: 'bg-red-600' },
              { id: 'responses', label: 'Responded', icon: HeartHandshake, count: responses.length, color: 'text-blue-600', bar: 'bg-blue-600' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-all relative ${
                  activeTab === tab.id ? tab.color : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs ml-1">{tab.count}</span>
                {activeTab === tab.id && <motion.div layoutId="tab" className={`absolute bottom-0 left-0 right-0 h-0.5 ${tab.bar}`} />}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {currentList.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-center py-20 text-gray-400">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">{activeTab === 'broadcasts' ? <Radio size={32} /> : <Shield size={32} />}</div>
              <p>No {activeTab === 'broadcasts' ? 'alerts' : 'responses'} found in history.</p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {currentList.map((record, index) => (
                <motion.div key={record._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${record.status === 'resolved' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{getStatusIcon(record.status)}</div>
                      <div>
                        <h3 className="font-bold text-gray-900 capitalize">{record.crisisType} Broadcast{activeTab === 'responses' && record.broadcaster && <span className="text-xs font-normal text-gray-500 ml-2">from {record.broadcaster.name}</span>}</h3>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${getStatusColor(record.status)}`}>{record.status}</span>
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <div className="flex items-center justify-end gap-1 mb-1"><Calendar size={12} />{new Date(record.createdAt).toLocaleDateString()}</div>
                      <div className="flex items-center justify-end gap-1"><Clock size={12} />{new Date(record.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                  {activeTab === 'broadcasts' && (
                    <div className="mb-4 bg-gray-50 p-3 rounded-lg text-sm text-gray-700">
                      <div className="flex items-center gap-2 mb-2 font-semibold text-gray-600 text-xs uppercase tracking-wider"><User size={12} />Responders ({record.responders?.length || 0})</div>
                      <div className="flex -space-x-2 overflow-hidden">
                        {record.responders?.slice(0, 5).map((r, i) => (
                          <div key={i} title={r.user?.name} className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">{r.user?.name?.[0] || '?'}</div>
                        ))}
                        {(record.responders?.length || 0) > 5 && <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-xs text-gray-500">+{record.responders.length - 5}</div>}
                      </div>
                    </div>
                  )}
                  {activeTab === 'responses' && (
                    <div className="mb-4 space-y-2">
                      <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800 flex justify-between items-center">
                        <span className="flex items-center gap-2"><CheckCircle2 size={14} />Accepted Request</span>
                        <span className="text-xs opacity-75">{record.myAcceptedAt ? new Date(record.myAcceptedAt).toLocaleTimeString() : ''}</span>
                      </div>
                      {record.myRating && (
                        <div className="text-xs text-yellow-700 bg-yellow-50 px-3 py-2 rounded flex items-center gap-1.5">
                          <span>You were rated:</span>
                          <span className="inline-flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} size={12} weight={i < record.myRating ? 'fill' : 'regular'} className={i < record.myRating ? 'text-yellow-600' : 'text-yellow-300'} />
                            ))}
                          </span>
                          <span>({record.myRating}/5)</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center mt-2 pt-3 border-t border-gray-50 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><MapPin size={12} />Lat: {record.location.coordinates[1].toFixed(4)}, Lng: {record.location.coordinates[0].toFixed(4)}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default History;
