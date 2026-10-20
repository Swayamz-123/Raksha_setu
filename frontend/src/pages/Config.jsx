import { useState, useEffect } from 'react';
import { GearSix, MapPin, FloppyDiskBack, CheckCircle, ClipboardText } from '@phosphor-icons/react';
import '../styles/Config.css';

export default function Config({ initialConfig, onSave }) {
  const [config, setConfig] = useState(initialConfig);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setConfig(initialConfig);
  }, [initialConfig]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: value
    }));
    setSaved(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Save to localStorage
    localStorage.setItem('emergencyConfig', JSON.stringify(config));
    
    // Notify parent
    onSave(config);
    setSaved(true);
    
    setTimeout(() => setSaved(false), 3000);
  };

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setConfig(prev => ({
            ...prev,
            latitude: latitude.toFixed(6),
            longitude: longitude.toFixed(6),
            maps_link: `https://www.google.com/maps?q=${latitude},${longitude}`
          }));
          setSaved(false);
        },
        (error) => {
          alert('Could not get location: ' + error.message);
        }
      );
    }
  };

  return (
    <div className="config">
      <div className="config-container">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><GearSix size={24} weight="duotone" />Configuration Settings</h2>
        
        <form onSubmit={handleSubmit} className="config-form">
          <fieldset className="form-section">
            <legend>Personal Information</legend>
            
            <div className="form-group">
              <label htmlFor="name">Full Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={config.name}
                onChange={handleChange}
                placeholder="e.g., John Doe"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="phone">Phone Number</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={config.phone}
                onChange={handleChange}
                placeholder="Your phone number"
              />
            </div>

            <div className="form-group">
              <label htmlFor="emergency_phone">Emergency Contact Phone</label>
              <input
                type="tel"
                id="emergency_phone"
                name="emergency_phone"
                value={config.emergency_phone}
                onChange={handleChange}
                placeholder="Emergency contact phone"
              />
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend>Location Information</legend>
            
            <div className="form-group">
              <label htmlFor="address">Address</label>
              <input
                type="text"
                id="address"
                name="address"
                value={config.address}
                onChange={handleChange}
                placeholder="Your address"
              />
            </div>

            <div className="location-group">
              <div className="form-group">
                <label htmlFor="latitude">Latitude</label>
                <input
                  type="text"
                  id="latitude"
                  name="latitude"
                  value={config.latitude}
                  onChange={handleChange}
                  placeholder="0.0000"
                  readOnly
                />
              </div>

              <div className="form-group">
                <label htmlFor="longitude">Longitude</label>
                <input
                  type="text"
                  id="longitude"
                  name="longitude"
                  value={config.longitude}
                  onChange={handleChange}
                  placeholder="0.0000"
                  readOnly
                />
              </div>

              <button
                type="button"
                className="location-btn"
                onClick={handleGetLocation}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><MapPin size={16} weight="fill" />Get Current Location</span>
              </button>
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend>Alert Settings</legend>
            
            <div className="form-group">
              <label htmlFor="emergencyResponseEmail">Emergency Response Email *</label>
              <input
                type="email"
                id="emergencyResponseEmail"
                name="emergencyResponseEmail"
                value={config.emergencyResponseEmail}
                onChange={handleChange}
                placeholder="Where to send emergency alerts"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="modelProvider">AI Model Provider</label>
              <select
                id="modelProvider"
                name="modelProvider"
                value={config.modelProvider}
                onChange={handleChange}
              >
                <option value="gemini">Gemini 2.5-Flash (Cloud)</option>
                <option value="llava">Ollama LLaVA (Local)</option>
              </select>
              <small>
                {config.modelProvider === 'gemini'
                  ? 'Uses Google Gemini API (requires internet)'
                  : 'Uses local Ollama LLaVA model'}
              </small>
            </div>
          </fieldset>

          <div className="form-actions">
            <button type="submit" className="save-btn">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><FloppyDiskBack size={16} weight="duotone" />Save Configuration</span>
            </button>
            {saved && <div className="success-msg" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><CheckCircle size={16} weight="fill" />Settings saved successfully!</div>}
          </div>
        </form>

        <div className="config-info">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><ClipboardText size={18} weight="duotone" />Note:</h3>
          <ul>
            <li>All settings are stored locally in your browser</li>
            <li>Email alerts will be sent to the configured address when emergencies are detected</li>
            <li>Location data helps emergency responders</li>
            <li>Ensure your emergency email is correct</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
