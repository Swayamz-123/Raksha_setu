import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Landing from './pages/Landing';
import SOSBroadcast from './pages/SOSBroadcast';
import AdminDashboard from './pages/AdminDashboard';
import History from './pages/History';
import SafetyMonitor from './pages/SafetyMonitor';
import MyEmergencyQR from './pages/MyEmergencyQR';
import EmergencyCard from './pages/EmergencyCard';

function App() {
  const { user } = useAuthStore();

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Landing />} />
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
      <Route path="/register" element={!user ? <Register /> : <Navigate to="/dashboard" />} />
      <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" />} />
      <Route path="/sos/:sosId" element={user ? <SOSBroadcast /> : <Navigate to="/login" />} />
      <Route path="/history" element={user ? <History /> : <Navigate to="/login" />} />
      <Route path="/monitor" element={user ? <SafetyMonitor /> : <Navigate to="/login" />} />
      <Route path="/my-emergency-qr" element={user ? <MyEmergencyQR /> : <Navigate to="/login" />} />
      <Route path="/emergency-card/:token" element={<EmergencyCard />} />
      <Route path="/admin" element={user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/dashboard" />} />
    </Routes>
  );
}

export default App;
