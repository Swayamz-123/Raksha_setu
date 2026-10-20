import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, FirstAidKit } from "@phosphor-icons/react";

export default function SetupAccount() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    bloodGroup: "",
    height: "",
    weight: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    medicalConditions: ""
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const accessToken = localStorage.getItem("accessToken");
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const res = await fetch(`${API_URL}/api/v1/auth/setup-account`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok) {
        navigate("/dashboard");
      } else {
        alert(data.message || "An error occurred");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#fdfbf7] flex items-center justify-center p-6 py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
        className="w-full max-w-[600px] bg-white rounded-[2.5rem] p-2 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-zinc-200/50"
      >
        <div className="bg-zinc-50 rounded-[calc(2.5rem-0.5rem)] p-8 md:p-10">
          <div className="flex flex-col items-center gap-4 mb-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/20 flex items-center justify-center text-white">
              <FirstAidKit weight="duotone" className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl font-bold tracking-tighter text-zinc-950">
                Medical Baseline
              </h2>
              <p className="text-zinc-500 mt-2 max-w-[40ch] mx-auto text-sm leading-relaxed">
                Complete your profile to enable instant SOS alerts and precise AI diagnostics.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5 md:col-span-1">
              <label className="text-[13px] font-medium text-zinc-700">Blood Group</label>
              <input 
                type="text" required value={formData.bloodGroup}
                onChange={(e) => setFormData({...formData, bloodGroup: e.target.value})}
                placeholder="O+"
                className="px-4 py-3 rounded-xl bg-white border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 md:col-span-1">
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-zinc-700">Height (cm)</label>
                <input 
                  type="text" required value={formData.height}
                  onChange={(e) => setFormData({...formData, height: e.target.value})}
                  placeholder="175"
                  className="px-4 py-3 rounded-xl bg-white border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-zinc-700">Weight (kg)</label>
                <input 
                  type="text" required value={formData.weight}
                  onChange={(e) => setFormData({...formData, weight: e.target.value})}
                  placeholder="70"
                  className="px-4 py-3 rounded-xl bg-white border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-[13px] font-medium text-zinc-700">Existing Medical Conditions</label>
              <textarea 
                value={formData.medicalConditions}
                onChange={(e) => setFormData({...formData, medicalConditions: e.target.value})}
                placeholder="Asthma, Diabetes..."
                rows={2}
                className="px-4 py-3 rounded-xl bg-white border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm resize-none"
              />
            </div>

            <div className="flex flex-col gap-1.5 md:col-span-1">
              <label className="text-[13px] font-medium text-zinc-700">Emergency Contact</label>
              <input 
                type="text" required value={formData.emergencyContactName}
                onChange={(e) => setFormData({...formData, emergencyContactName: e.target.value})}
                placeholder="Jane Doe"
                className="px-4 py-3 rounded-xl bg-white border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5 md:col-span-1">
              <label className="text-[13px] font-medium text-zinc-700">Contact Phone</label>
              <input 
                type="tel" required value={formData.emergencyContactPhone}
                onChange={(e) => setFormData({...formData, emergencyContactPhone: e.target.value})}
                placeholder="+1 234 567 890"
                className="px-4 py-3 rounded-xl bg-white border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm"
              />
            </div>

            <button 
              disabled={loading}
              className="md:col-span-2 mt-6 group relative px-6 py-4 rounded-full bg-zinc-950 text-white font-medium tracking-wide active:scale-[0.98] transition-transform w-full flex items-center justify-center gap-2 overflow-hidden shadow-xl shadow-zinc-950/10 disabled:opacity-50"
            >
              <span>{loading ? "Saving Profile..." : "Complete Setup"}</span>
              {!loading && (
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center transition-transform group-hover:translate-x-1 group-hover:-translate-y-[1px] absolute right-3">
                  <ArrowRight weight="bold" className="w-4 h-4" />
                </div>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
