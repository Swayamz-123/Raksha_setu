import '../styles/Results.css';
import {
  WarningCircle,
  CheckCircle,
  ChartBar,
  XCircle,
  FlagPennant,
  Lightning,
  Phone,
  EnvelopeSimple,
  Printer
} from '@phosphor-icons/react';

export default function Results({ result }) {
  const parseAnalysis = (message) => {
    const text = typeof message === 'string' ? message : '';
    const lines = text.split('\n').filter(line => line.trim());
    return lines[0] || text;
  };

  const extractIntensity = (message) => {
    const text = typeof message === 'string' ? message : '';
    const match = text.match(/[Ii]ntensity:\s*(\d+)/);
    return match ? parseInt(match[1]) : 0;
  };

  const getIntensityColor = (intensity) => {
    if (intensity >= 80) return '#dc2626'; // red
    if (intensity >= 60) return '#ea580c'; // orange
    if (intensity >= 40) return '#eab308'; // yellow
    return '#22c55e'; // green
  };

  const getEmergencyIcon = (emergency) => (emergency
    ? <WarningCircle size={38} weight="fill" />
    : <CheckCircle size={38} weight="fill" />);

  const messageText = typeof result?.message === 'string' ? result.message : '';
  const intensity = extractIntensity(messageText);
  const analysis = parseAnalysis(messageText);
  const emergencyColors = {
    'fallen': '#dc2626',
    'unresponsive': '#dc2626',
    'severe risk': '#ea580c',
    'potential danger': '#ea580c',
    'hazard': '#eab308',
    'disoriented': '#eab308',
  };

  const getMessageColor = () => {
    for (const [key, color] of Object.entries(emergencyColors)) {
      if (analysis.toLowerCase().includes(key)) {
        return color;
      }
    }
    return '#22c55e';
  };

  return (
    <div className="results">
      <div className="results-container">
        <div className={`alert-section ${result.emergency ? 'emergency' : 'normal'}`}>
          <div className="alert-icon">
            {getEmergencyIcon(result.emergency)}
          </div>
          <h2>{result.emergency ? 'EMERGENCY ALERT' : 'Status Report'}</h2>
          <p className="alert-status">
            {result.emergency
              ? 'An emergency condition has been detected'
              : 'No emergency conditions detected'}
          </p>
        </div>

        <div className="analysis-section">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><ChartBar size={18} weight="duotone" />AI Analysis Result</h3>
          
          <div className="intensity-meter">
            <div className="meter-label">Risk Level: <strong>{intensity}%</strong></div>
            <div className="meter-bar-container">
              <div
                className="meter-bar"
                style={{
                  width: `${intensity}%`,
                  backgroundColor: getIntensityColor(intensity)
                }}
              />
            </div>
            <div className="meter-legend">
              <span style={{ color: '#22c55e' }}>0% Safe</span>
              <span style={{ color: '#eab308' }}>50%</span>
              <span style={{ color: '#dc2626' }}>100% Critical</span>
            </div>
          </div>

          <div className="analysis-message" style={{ borderLeftColor: getMessageColor() }}>
            <pre>{analysis}</pre>
          </div>

          <div className="analysis-details">
            <div className="detail-card">
              <span className="detail-label">Detection Status:</span>
              <span className="detail-value" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                {messageText.includes('No Person')
                  ? <><XCircle size={14} weight="fill" />No Person</>
                  : <><CheckCircle size={14} weight="fill" />Person Detected</>}
              </span>
            </div>
            <div className="detail-card">
              <span className="detail-label">Emergency:</span>
              <span className="detail-value" style={{ color: result.emergency ? '#dc2626' : '#22c55e', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                {result.emergency ? <WarningCircle size={14} weight="fill" /> : <CheckCircle size={14} weight="fill" />} {result.emergency ? 'YES' : 'NO'}
              </span>
            </div>
            <div className="detail-card">
              <span className="detail-label">Timestamp:</span>
              <span className="detail-value">{new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        </div>

        <div className="flags-section">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><FlagPennant size={18} weight="fill" />Detected Flags</h3>
          <div className="flags-grid">
            {['fallen', 'unresponsive', 'severe risk', 'potential danger', 'hazard nearby', 'disoriented', 'restricted movement', 'labored breathing'].map(flag => (
              <div
                key={flag}
                className={`flag-item ${analysis.toLowerCase().includes(flag) ? 'active' : ''}`}
              >
                {flag}
              </div>
            ))}
          </div>
        </div>

        <div className="action-section">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Lightning size={18} weight="duotone" />Actions</h3>
          {result.emergency && (
            <div className="emergency-actions">
              <button className="action-btn emergency" onClick={() => alert('Emergency services contacted!')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><Phone size={16} weight="fill" />Contact Emergency Services</span>
              </button>
              <button className="action-btn" onClick={() => alert('Notification sent to contacts!')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><EnvelopeSimple size={16} weight="fill" />Notify Contacts</span>
              </button>
            </div>
          )}
          <button className="action-btn secondary" onClick={() => window.print()}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><Printer size={16} weight="duotone" />Print Report</span>
          </button>
        </div>

        <div className="report-footer">
          <p>
            <strong>System Info:</strong> YOLO Detection + Gemini 2.5-Flash Analysis
          </p>
          <p style={{ fontSize: '0.9em', color: '#666' }}>
            Generated: {new Date().toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
