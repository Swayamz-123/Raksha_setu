import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bell, Shield, Lightning as Zap, MapPin, UsersThree as Users, CaretRight as ChevronRight,
  WarningCircle as AlertTriangle, Heart, NavigationArrow as Navigation, Camera, Buildings as Building2, ArrowRight,
  Clock, Pulse as Activity
} from '@phosphor-icons/react';

const FEATURES = [
  { icon: Bell, title: 'One-Tap SOS', desc: 'Instantly alert nearby responders, guardians, and emergency services with a single tap.', color: 'bg-red-50 text-red-600' },
  { icon: Navigation, title: 'Smart Routing', desc: 'Real-time traffic-aware routing to the nearest hospital using TomTom navigation.', color: 'bg-blue-50 text-blue-600' },
  { icon: Camera, title: 'AI Accident Detection', desc: 'YOLO + Gemini vision models detect accidents and emergencies automatically.', color: 'bg-orange-50 text-orange-600' },
  { icon: Building2, title: 'Hospital Finder', desc: 'Locate nearest hospitals with live ETA, contact info, and turn-by-turn directions.', color: 'bg-emerald-50 text-emerald-600' },
  { icon: Shield, title: 'Guardian Mode', desc: 'Assign trusted contacts who get notified first before the wider community.', color: 'bg-purple-50 text-purple-600' },
  { icon: Users, title: 'Community Responders', desc: 'Skilled volunteers nearby — CPR, first aid, fire safety — dispatched intelligently.', color: 'bg-amber-50 text-amber-600' },
];

const STEPS = [
  { n: '01', title: 'Trigger SOS', desc: 'Tap the SOS button or let AI detect the emergency via camera.' },
  { n: '02', title: 'Alert Sent', desc: 'Guardians, responders, and hospitals are notified instantly with your location.' },
  { n: '03', title: 'Route Optimized', desc: 'TomTom calculates the fastest route considering live traffic.' },
  { n: '04', title: 'Help Arrives', desc: 'Responders coordinate via real-time chat and live location sharing.' },
];

export default function Landing() {
  return (
    <div className="min-h-[100dvh] bg-[#f7f8f5] overflow-x-hidden text-zinc-900">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(70%_50%_at_20%_15%,rgba(239,68,68,0.10),transparent_60%),radial-gradient(50%_40%_at_85%_80%,rgba(16,185,129,0.12),transparent_65%)]" />
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-[#f7f8f5]/90 backdrop-blur-xl border-b border-zinc-200/70">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-red-600 flex items-center justify-center">
              <Bell size={14} className="text-white" weight="fill" />
            </div>
            <span className="font-semibold text-gray-900 text-lg">RakshaSetu</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-500">
            <a href="#features" className="hover:text-zinc-900 transition-colors">Features</a>
            <a href="#how" className="hover:text-zinc-900 transition-colors">How it works</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-semibold text-zinc-600 hover:text-zinc-900 px-4 py-2 transition-colors">Sign In</Link>
            <Link to="/register" className="bg-red-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-red-700 transition-colors flex items-center gap-1.5">
              Get Started <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-100 mb-6">
                <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                <span className="text-xs font-semibold text-red-700">Sub-100ms Autonomous Emergency Coordination</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-bold tracking-tighter text-zinc-900 leading-none mb-6">
                Help arrives faster
                <br />
                <span className="text-red-600">when every second counts.</span>
              </h1>
              <p className="text-base md:text-lg text-zinc-600 leading-relaxed max-w-[65ch] mb-8">
                RakshaSetu is an emergency coordination network for neighborhoods and campuses. Trigger SOS in one tap, notify guardians first, and route responders with live location intelligence.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/register" className="bg-red-600 text-white font-semibold px-7 py-3.5 rounded-2xl hover:bg-red-700 transition-colors flex items-center gap-2 shadow-lg shadow-red-600/20 active:scale-[0.98]">
                  Start for Free <ChevronRight size={16} />
                </Link>
                <a href="#how" className="border border-zinc-300 text-zinc-700 font-semibold px-7 py-3.5 rounded-2xl hover:bg-zinc-100/70 transition-colors active:scale-[0.98]">
                  See how it works
                </a>
              </div>
              {/* Trust badges */}
              <div className="flex items-center gap-6 mt-10 pt-8 border-t border-zinc-200/70">
                {[
                  { val: '< 30s', label: 'Alert time' },
                  { val: '24/7', label: 'Always active' },
                ].map(s => (
                  <div key={s.label}>
                    <p className="text-2xl font-bold text-zinc-900 tabular-nums">{s.val}</p>
                    <p className="text-xs text-zinc-500 font-medium mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right — UI preview cards */}
            <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.15 }} className="relative">
              {/* Main card */}
              <div className="bg-white rounded-3xl border border-zinc-200/70 shadow-[0_25px_60px_-22px_rgba(24,24,27,0.22)] p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="font-bold text-zinc-900">Emergency Dashboard</p>
                    <p className="text-xs text-zinc-400 mt-0.5">Live · 3 active alerts nearby</p>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 px-3 py-1.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />Connected
                  </span>
                </div>

                {/* SOS button */}
                <div className="flex justify-center py-6">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-red-500 blur-xl opacity-20 animate-pulse" />
                    <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex flex-col items-center justify-center shadow-xl shadow-red-500/30 border-4 border-red-400/20">
                      <Bell size={28} className="text-white mb-1" />
                      <span className="text-white font-bold text-lg tracking-widest">SOS</span>
                    </div>
                  </div>
                </div>

                {/* Mini stats */}
                <div className="grid grid-cols-3 gap-3 mt-2">
                  {[
                    { icon: AlertTriangle, val: '3', label: 'Alerts', color: 'text-red-600 bg-red-50' },
                    { icon: Building2, val: '7', label: 'Hospitals', color: 'text-blue-600 bg-blue-50' },
                    { icon: Clock, val: '4m', label: 'Avg ETA', color: 'text-orange-600 bg-orange-50' },
                  ].map(({ icon: Icon, val, label, color }) => (
                    <div key={label} className="bg-zinc-50 rounded-2xl p-3 text-center">
                      <div className={`w-7 h-7 rounded-xl ${color} flex items-center justify-center mx-auto mb-1.5`}>
                        <Icon size={13} />
                      </div>
                      <p className="font-bold text-zinc-900 text-sm">{val}</p>
                      <p className="text-[10px] text-zinc-500 font-medium">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Floating alert card */}
              <div className="absolute -top-5 -right-5 bg-white rounded-2xl shadow-xl border border-zinc-200 px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                  <AlertTriangle size={16} className="text-red-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-900">SOS Alert sent</p>
                  <p className="text-[10px] text-zinc-500">3 guardians notified</p>
                </div>
              </div>

              {/* Floating hospital card */}
              <div className="absolute -bottom-5 -left-5 bg-white rounded-2xl shadow-xl border border-zinc-200 px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                  <Heart size={16} className="text-green-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-900">Responder nearby</p>
                  <p className="text-[10px] text-zinc-500">2.3 km · 4 min ETA</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6 bg-white/70">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-red-600 text-xs font-bold uppercase tracking-widest mb-3">Platform Features</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-zinc-900 mb-4">Everything you need in an emergency</h2>
            <p className="text-zinc-600 text-lg max-w-xl mx-auto">Built for speed, reliability, and community coordination.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc, color }, i) => (
              <motion.div key={title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }} className="bg-[#f7f8f5] p-6 rounded-2xl border border-zinc-200/70 hover:shadow-md transition-all">
                <div className={`w-10 h-10 rounded-2xl ${color} flex items-center justify-center mb-4`}>
                  <Icon size={18} />
                </div>
                <h3 className="font-bold text-zinc-900 mb-2">{title}</h3>
                <p className="text-zinc-600 text-sm leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-24 px-6 bg-[#f7f8f5]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-red-600 text-xs font-bold uppercase tracking-widest mb-3">How It Works</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-zinc-900 mb-4">From alert to rescue in minutes</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            {STEPS.map(({ n, title, desc }, i) => (
              <motion.div key={n} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="text-center bg-white rounded-2xl border border-zinc-200/70 p-6">
                <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-5">
                  <span className="text-red-600 font-bold">{n}</span>
                </div>
                <h3 className="font-bold text-zinc-900 mb-2">{title}</h3>
                <p className="text-zinc-600 text-sm leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-red-600">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-4xl font-bold tracking-tighter text-white mb-4">Ready to protect your community?</h2>
            <p className="text-red-100 text-lg mb-8">Join RakshaSetu. Free to use, always available.</p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link to="/register" className="bg-white text-red-600 font-bold px-8 py-3.5 rounded-2xl hover:bg-red-50 transition-colors flex items-center gap-2 shadow-lg active:scale-[0.98]">
                Create Free Account <ArrowRight size={16} />
              </Link>
              <Link to="/login" className="border-2 border-white/30 text-white font-semibold px-8 py-3.5 rounded-2xl hover:bg-white/10 transition-colors active:scale-[0.98]">
                Sign In
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 bg-zinc-900">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-red-600 flex items-center justify-center">
              <Bell size={13} className="text-white" />
            </div>
            <span className="font-bold text-white">RakshaSetu</span>
          </div>
          <p className="text-zinc-500 text-sm">Every second counts.</p>
          <div className="flex items-center gap-5 text-sm text-zinc-500">
            <Link to="/login" className="hover:text-zinc-300 transition-colors">Sign In</Link>
            <Link to="/register" className="hover:text-zinc-300 transition-colors">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
