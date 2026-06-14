/**
 * GPS utility — browser implementation with Wake Lock.
 * For native background GPS (screen off), use the Capacitor build.
 */

export const isNative = () => {
  try {
    return typeof window !== 'undefined' &&
           window.Capacitor?.isNativePlatform?.() === true;
  } catch { return false; }
};

export async function startGPSWatch(onFix, onError) {
  // When running as Capacitor native app, the plugin is pre-loaded
  if (isNative()) {
    return startNativeGPS(onFix, onError);
  }
  return startWebGPS(onFix, onError);
}

async function startNativeGPS(onFix, onError) {
  // Capacitor injects plugins into window.Capacitor.Plugins at runtime
  const BGL = window.Capacitor?.Plugins?.BackgroundGeolocation;
  if (!BGL) {
    console.warn('[GPS] BackgroundGeolocation plugin not found, using web fallback');
    return startWebGPS(onFix, onError);
  }

  const watcherId = await BGL.addWatcher(
    {
      backgroundMessage: 'Summit Paragliding suit votre position GPS.',
      backgroundTitle:   'Summit — GPS vol actif',
      requestPermissions: true,
      stale: false,
      distanceFilter: 5,
    },
    (location, error) => {
      if (error) { onError(error.message); return; }
      onFix({
        lat: location.latitude,
        lon: location.longitude,
        alt: location.altitude ?? 0,
        spd: location.speed   ?? 0,
        t:   location.time   ?? Date.now(),
      });
    }
  );
  return async () => BGL.removeWatcher({ id: watcherId });
}

function startWebGPS(onFix, onError) {
  if (!navigator?.geolocation) { onError('GPS non disponible.'); return () => {}; }
  const watchId = navigator.geolocation.watchPosition(
    (pos) => onFix({
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      alt: pos.coords.altitude ?? 0,
      spd: pos.coords.speed   ?? 0,
      t:   pos.timestamp     ?? Date.now(),
    }),
    (err) => onError(err.message),
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
  );
  return () => navigator.geolocation.clearWatch(watchId);
}
