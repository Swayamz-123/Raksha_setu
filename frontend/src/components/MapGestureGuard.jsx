import { useEffect, useState, useRef, useCallback } from 'react';
import { useMap } from 'react-leaflet';

export default function MapGestureGuard() {
  const map = useMap();
  const [showHint, setShowHint] = useState(false);
  const hintTimer = useRef(null);

  const clearHintTimer = useCallback(() => {
    if (hintTimer.current) { clearTimeout(hintTimer.current); hintTimer.current = null; }
  }, []);

  useEffect(() => {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouch) return;
    map.dragging.disable();
    const container = map.getContainer();

    const handleTouchStart = (e) => {
      if (e.touches.length >= 2) { map.dragging.enable(); setShowHint(false); clearHintTimer(); }
      else { map.dragging.disable(); setShowHint(true); clearHintTimer(); hintTimer.current = setTimeout(() => setShowHint(false), 1500); }
    };
    const handleTouchEnd = (e) => {
      if (e.touches.length < 2) map.dragging.disable();
      if (e.touches.length === 0) { clearHintTimer(); hintTimer.current = setTimeout(() => setShowHint(false), 400); }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => { container.removeEventListener('touchstart', handleTouchStart); container.removeEventListener('touchend', handleTouchEnd); clearHintTimer(); map.dragging.enable(); };
  }, [map, clearHintTimer]);

  if (!showHint) return null;
  return (
    <div className="map-gesture-overlay">
      <span className="map-gesture-text">Use two fingers to move the map</span>
    </div>
  );
}
