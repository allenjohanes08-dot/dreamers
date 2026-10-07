/// <reference types="@types/google.maps" />
import { useEffect, useState, useRef, useCallback } from 'react';
import { AdvancedMarker, Pin, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { fetchWithRetry } from '../lib/api.ts';
import { auth } from '../lib/firebase.ts';
import { Navigation, Compass, Layers, RotateCw, MapPin, Truck, CheckCircle2, AlertTriangle, Crosshair } from 'lucide-react';

export interface RouteMapProps {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  originLabel?: string;
  destinationLabel?: string;
  customerName?: string;
  orderId?: string | number;
  deliveryAddress?: string;
  officerAccuracy?: number | null;
  isOfficerTracking?: boolean;
  language?: string;
  onTelemetryUpdate?: (data: { distanceKm: number; durationMinutes: number; status: string }) => void;
  onArrivedThreshold?: (isNear: boolean, distanceMeters: number) => void;
}

// Client-side polyline decoder fallback to avoid external dependencies
function decodePolyline(encoded: string): google.maps.LatLngLiteral[] {
  const points: google.maps.LatLngLiteral[] = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;

  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

// Distance helper (Haversine formula in meters)
function computeDistanceMeters(p1: { lat: number; lng: number }, p2: { lat: number; lng: number }): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (p1.lat * Math.PI) / 180;
  const φ2 = (p2.lat * Math.PI) / 180;
  const Δφ = ((p2.lat - p1.lat) * Math.PI) / 180;
  const Δλ = ((p2.lng - p1.lng) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export default function RouteMap({
  origin,
  destination,
  originLabel = 'Your current location',
  destinationLabel = 'Customer Delivery Destination',
  customerName,
  orderId,
  deliveryAddress,
  officerAccuracy,
  isOfficerTracking = true,
  language = 'sw',
  onTelemetryUpdate,
  onArrivedThreshold,
}: RouteMapProps) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const geometryLib = useMapsLibrary('geometry');

  const [polylines, setPolylines] = useState<google.maps.Polyline[]>([]);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [durationMins, setDurationMins] = useState<number | null>(null);
  const [routeStatus, setRouteStatus] = useState<string>('Inatafuta njia bora...');
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [isTrafficActive, setIsTrafficActive] = useState<boolean>(false);
  const [trafficLayer, setTrafficLayer] = useState<google.maps.TrafficLayer | null>(null);
  const [accuracyCircle, setAccuracyCircle] = useState<google.maps.Circle | null>(null);

  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid'>('roadmap');
  const [isTransitActive, setIsTransitActive] = useState<boolean>(false);
  const [transitLayer, setTransitLayer] = useState<google.maps.TransitLayer | null>(null);

  useEffect(() => {
    if (!map) return;
    if (mapType === 'roadmap') {
      map.setMapTypeId(google.maps.MapTypeId.ROADMAP);
    } else if (mapType === 'satellite') {
      map.setMapTypeId(google.maps.MapTypeId.SATELLITE);
    } else if (mapType === 'hybrid') {
      map.setMapTypeId(google.maps.MapTypeId.HYBRID);
    }
  }, [map, mapType]);

  const toggleTransit = useCallback(() => {
    if (!map) return;
    if (isTransitActive) {
      if (transitLayer) {
        transitLayer.setMap(null);
      }
      setIsTransitActive(false);
    } else {
      const layer = transitLayer || new google.maps.TransitLayer();
      layer.setMap(map);
      setTransitLayer(layer);
      setIsTransitActive(true);
    }
  }, [map, isTransitActive, transitLayer]);

  const prevOriginRef = useRef<{ lat: number; lng: number } | null>(null);

  // Proximity to destination calculation
  const distanceToDestMeters = (origin && destination) 
    ? computeDistanceMeters(origin, destination) 
    : null;
  const isNearCustomer = distanceToDestMeters !== null && distanceToDestMeters <= 85;

  useEffect(() => {
    if (onArrivedThreshold && distanceToDestMeters !== null) {
      onArrivedThreshold(isNearCustomer, distanceToDestMeters);
    }
  }, [distanceToDestMeters, isNearCustomer, onArrivedThreshold]);

  // Traffic layer toggle
  const toggleTraffic = useCallback(() => {
    if (!map) return;
    if (isTrafficActive) {
      if (trafficLayer) {
        trafficLayer.setMap(null);
      }
      setIsTrafficActive(false);
    } else {
      const layer = trafficLayer || new google.maps.TrafficLayer();
      layer.setMap(map);
      setTrafficLayer(layer);
      setIsTrafficActive(true);
    }
  }, [map, isTrafficActive, trafficLayer]);

  // Center on Logistic Officer
  const handleCenterOfficer = useCallback(() => {
    if (!map || !origin) return;
    map.panTo(origin);
    map.setZoom(16);
  }, [map, origin]);

  // Center on Customer Destination
  const handleCenterCustomer = useCallback(() => {
    if (!map || !destination) return;
    map.panTo(destination);
    map.setZoom(16);
  }, [map, destination]);

  // Calculate high-fidelity traffic route
  const calculateRoute = useCallback(async () => {
    if (!map || !origin || !destination) return;
    if (isNaN(origin.lat) || isNaN(origin.lng) || isNaN(destination.lat) || isNaN(destination.lng)) return;

    setIsCalculating(true);
    setRouteStatus('Inakokotoa njia ya barabara...');

    // Clear existing polylines
    polylines.forEach(p => p.setMap(null));
    setPolylines([]);

    let routeComputed = false;

    // 1. First attempt: Server-side secure Google Maps Routes API Proxy
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetchWithRetry('/api/maps/route', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          origin: { lat: origin.lat, lng: origin.lng },
          destination: { lat: destination.lat, lng: destination.lng },
          travelMode: 'DRIVE'
        })
      }, 0);

      if (res.ok) {
        const data = await res.json();
        const primaryRoute = data.routes?.[0];
        if (primaryRoute && primaryRoute.polyline?.encodedPolyline) {
          const points = decodePolyline(primaryRoute.polyline.encodedPolyline);
          if (points.length > 0) {
            // Draw background stroke for visibility and contrast
            const outlinePolyline = new google.maps.Polyline({
              path: points,
              geodesic: true,
              strokeColor: '#1e3a8a', // Deep Blue outline
              strokeOpacity: 0.9,
              strokeWeight: 8,
              map: map
            });

            // Draw primary traffic route
            const mainPolyline = new google.maps.Polyline({
              path: points,
              geodesic: true,
              strokeColor: '#2563eb', // Vibrant Royal Blue
              strokeOpacity: 1.0,
              strokeWeight: 5,
              map: map
            });

            setPolylines([outlinePolyline, mainPolyline]);

            // Fit bounds
            const bounds = new google.maps.LatLngBounds();
            points.forEach(p => bounds.extend(p));
            map.fitBounds(bounds, { top: 90, bottom: 90, left: 60, right: 60 });

            const distMeters = primaryRoute.distanceMeters || computeDistanceMeters(origin, destination);
            const distKm = Number((distMeters / 1000).toFixed(1));
            
            // Duration parsing (Google API format "1200s")
            let durMins = 10;
            if (primaryRoute.duration) {
              const durSecs = parseInt(String(primaryRoute.duration).replace('s', ''), 10) || 600;
              durMins = Math.max(1, Math.round(durSecs / 60));
            } else {
              durMins = Math.max(2, Math.round((distKm / 25) * 60));
            }

            setDistanceKm(distKm);
            setDurationMins(durMins);
            const statusTxt = 'Njia ya Barabara (Traffic-Aware Driving)';
            setRouteStatus(statusTxt);

            if (onTelemetryUpdate) {
              onTelemetryUpdate({ distanceKm: distKm, durationMinutes: durMins, status: statusTxt });
            }

            routeComputed = true;
          }
        }
      }
    } catch (proxyErr) {
      console.warn('Server route calculation proxy skipped, attempting client fallback:', proxyErr);
    }

    // 2. Client-side SDK Fallback via DirectionsService if server proxy had issues
    if (!routeComputed && typeof google !== 'undefined' && google.maps?.DirectionsService) {
      try {
        const directionsService = new google.maps.DirectionsService();
        const dirResult = await new Promise<google.maps.DirectionsResult | null>((resolve) => {
          directionsService.route({
            origin: new google.maps.LatLng(origin.lat, origin.lng),
            destination: new google.maps.LatLng(destination.lat, destination.lng),
            travelMode: google.maps.TravelMode.DRIVING,
          }, (result, status) => {
            if (status === google.maps.DirectionsStatus.OK && result) {
              resolve(result);
            } else {
              resolve(null);
            }
          });
        });

        if (dirResult && dirResult.routes[0]?.overview_path) {
          const path = dirResult.routes[0].overview_path;
          const leg = dirResult.routes[0].legs[0];

          const mainPolyline = new google.maps.Polyline({
            path: path,
            geodesic: true,
            strokeColor: '#2563eb',
            strokeOpacity: 1.0,
            strokeWeight: 6,
            map: map
          });
          setPolylines([mainPolyline]);

          const bounds = new google.maps.LatLngBounds();
          path.forEach(p => bounds.extend(p));
          map.fitBounds(bounds, { top: 90, bottom: 90, left: 60, right: 60 });

          const distKm = leg?.distance?.value ? Number((leg.distance.value / 1000).toFixed(1)) : 2.5;
          const durMins = leg?.duration?.value ? Math.round(leg.duration.value / 60) : 8;

          setDistanceKm(distKm);
          setDurationMins(durMins);
          const statusTxt = 'Njia Imepatikana (Client Navigation)';
          setRouteStatus(statusTxt);

          if (onTelemetryUpdate) {
            onTelemetryUpdate({ distanceKm: distKm, durationMinutes: durMins, status: statusTxt });
          }

          routeComputed = true;
        }
      } catch (clientErr) {
        console.warn('Client DirectionsService fallback skipped:', clientErr);
      }
    }

    // 3. Graceful Geodesic Highway Path Fallback if offline or API limit reached
    if (!routeComputed) {
      const directPoints = [origin, destination];
      const fallbackPolyline = new google.maps.Polyline({
        path: directPoints,
        geodesic: true,
        strokeColor: '#3b82f6',
        strokeOpacity: 0.9,
        strokeWeight: 5,
        map: map
      });
      setPolylines([fallbackPolyline]);

      const bounds = new google.maps.LatLngBounds();
      bounds.extend(origin);
      bounds.extend(destination);
      map.fitBounds(bounds, { top: 90, bottom: 90, left: 60, right: 60 });

      const distM = computeDistanceMeters(origin, destination);
      const distKm = Number((distM / 1000).toFixed(1));
      const estMins = Math.max(2, Math.round((distKm / 28) * 60));

      setDistanceKm(distKm);
      setDurationMins(estMins);
      const statusTxt = 'Njia ya Moja kwa Moja (GPS Vector)';
      setRouteStatus(statusTxt);

      if (onTelemetryUpdate) {
        onTelemetryUpdate({ distanceKm: distKm, durationMinutes: estMins, status: statusTxt });
      }
    }

    setIsCalculating(false);
  }, [map, origin, destination, onTelemetryUpdate]);

  // Initial route calculation & threshold-based update
  useEffect(() => {
    if (!origin || !destination || !map) return;

    // Check if origin shifted by more than 20 meters before triggering recalculation
    if (prevOriginRef.current) {
      const movedMeters = computeDistanceMeters(prevOriginRef.current, origin);
      if (movedMeters < 20) {
        return; // Avoid unnecessary API thrashing
      }
    }

    prevOriginRef.current = origin;
    calculateRoute();
  }, [origin, destination, map, calculateRoute]);

  // Render GPS Accuracy circle around officer
  useEffect(() => {
    if (!map || !origin || !officerAccuracy || officerAccuracy > 250) {
      if (accuracyCircle) {
        accuracyCircle.setMap(null);
        setAccuracyCircle(null);
      }
      return;
    }

    if (accuracyCircle) {
      accuracyCircle.setCenter(origin);
      accuracyCircle.setRadius(officerAccuracy);
    } else {
      const circle = new google.maps.Circle({
        center: origin,
        radius: officerAccuracy,
        strokeColor: '#10b981',
        strokeOpacity: 0.5,
        strokeWeight: 1.5,
        fillColor: '#10b981',
        fillOpacity: 0.12,
        map: map
      });
      setAccuracyCircle(circle);
    }

    return () => {
      if (accuracyCircle) {
        accuracyCircle.setMap(null);
      }
    };
  }, [map, origin, officerAccuracy]);

  // Cleanup polylines and overlays on unmount
  useEffect(() => {
    return () => {
      polylines.forEach(p => p.setMap(null));
      if (trafficLayer) trafficLayer.setMap(null);
      if (accuracyCircle) accuracyCircle.setMap(null);
    };
  }, [polylines, trafficLayer, accuracyCircle]);

  return (
    <>
      {/* 1. In-Map Interactive Delivery HUD & Telemetry Bar */}
      <div className="absolute top-4 left-4 right-4 z-20 pointer-events-none flex flex-col gap-2">
        {/* Main Telemetry Stats Card */}
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3 sm:p-4 shadow-2xl pointer-events-auto flex flex-wrap items-center justify-between gap-3 text-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center shrink-0">
              <Navigation className="w-5 h-5 text-blue-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {orderId ? `Oda #${orderId}` : 'Usafirishaji / Delivery'}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span className="text-[10px] font-bold text-emerald-400">Muda Halisi / Live Route</span>
              </div>
              <div className="flex items-baseline space-x-3 mt-0.5">
                <span className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {distanceKm !== null ? `${distanceKm} km` : '-- km'}
                </span>
                <span className="text-xs font-bold text-blue-300">
                  {durationMins !== null ? `~${durationMins} dk (Est)` : '-- dk'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Map Action Controls */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Map Type & Transit Controls */}
            <div className="flex items-center gap-0.5 bg-slate-800/90 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setMapType('roadmap')}
                className={`px-2 py-1.5 rounded-lg text-[10px] font-black uppercase transition cursor-pointer ${
                  mapType === 'roadmap' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                Map
              </button>
              <button
                type="button"
                onClick={() => setMapType('satellite')}
                className={`px-2 py-1.5 rounded-lg text-[10px] font-black uppercase transition cursor-pointer ${
                  mapType === 'satellite' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                Satellite
              </button>
              <button
                type="button"
                onClick={() => setMapType('hybrid')}
                className={`px-2 py-1.5 rounded-lg text-[10px] font-black uppercase transition cursor-pointer ${
                  mapType === 'hybrid' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                Hybrid
              </button>
              <button
                type="button"
                onClick={toggleTransit}
                className={`px-2 py-1.5 rounded-lg text-[10px] font-black uppercase transition cursor-pointer ${
                  isTransitActive ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                Transit
              </button>
            </div>

            <button
              type="button"
              onClick={handleCenterOfficer}
              title={language === 'sw' ? 'Nielekeze Nilipo (Afisa)' : 'Center on My Location'}
              className="p-2 sm:px-3 sm:py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-xs font-black text-slate-200 transition flex items-center space-x-1.5 cursor-pointer shadow-sm"
            >
              <Crosshair className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">{language === 'sw' ? 'Nilipo' : 'My Location'}</span>
            </button>

            <button
              type="button"
              onClick={handleCenterCustomer}
              title={language === 'sw' ? 'Lengo la Mteja' : 'Center on Customer Destination'}
              className="p-2 sm:px-3 sm:py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-xs font-black text-slate-200 transition flex items-center space-x-1.5 cursor-pointer shadow-sm"
            >
              <MapPin className="w-4 h-4 text-red-400" />
              <span className="hidden sm:inline">{language === 'sw' ? 'Mteja' : 'Customer'}</span>
            </button>

            <button
              type="button"
              onClick={toggleTraffic}
              title={language === 'sw' ? 'Washa/Zima Foleni ya Barabara' : 'Toggle Live Traffic Layer'}
              className={`p-2 sm:px-3 sm:py-2 border rounded-xl text-xs font-black transition flex items-center space-x-1.5 cursor-pointer shadow-sm ${
                isTrafficActive
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-300'
              }`}
            >
              <Layers className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">{language === 'sw' ? 'Foleni' : 'Traffic'}</span>
            </button>

            <button
              type="button"
              onClick={calculateRoute}
              disabled={isCalculating}
              title={language === 'sw' ? 'Hesabu Njia Upya' : 'Recalculate Driving Route'}
              className="p-2 sm:px-3 sm:py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black transition flex items-center space-x-1.5 cursor-pointer shadow-sm disabled:opacity-50"
            >
              <RotateCw className={`w-4 h-4 ${isCalculating ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">{language === 'sw' ? 'Upya' : 'Recalculate'}</span>
            </button>
          </div>
        </div>

        {/* Proximity Arrival Banner when close to destination */}
        {isNearCustomer && (
          <div className="bg-emerald-500 border border-emerald-400 text-slate-950 px-4 py-2.5 rounded-2xl shadow-xl flex items-center justify-between pointer-events-auto animate-bounce-short">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-slate-950 shrink-0 font-black" />
              <div className="text-xs font-black uppercase tracking-tight">
                {language === 'sw' 
                  ? `Umekaribia Mteja! Umbali ni takriban mita ${distanceToDestMeters} tu.`
                  : `Arriving at Customer! Distance: ~${distanceToDestMeters}m`}
              </div>
            </div>
            <span className="text-[10px] font-black uppercase bg-slate-950 text-emerald-400 px-2.5 py-1 rounded-lg">
              {language === 'sw' ? 'Tayari Kukabidhi' : 'Ready to Deliver'}
            </span>
          </div>
        )}

        {/* GPS Accuracy status pill */}
        <div className="self-start pointer-events-auto">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-slate-900/80 backdrop-blur-sm border border-slate-700 rounded-full text-[10px] font-bold text-slate-300 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{routeStatus}</span>
            {officerAccuracy && (
              <span className="text-slate-400">| GPS: ±{Math.round(officerAccuracy)}m</span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Interactive Markers on Map */}
      {/* LOGISTIC OFFICER MARKER (ORIGIN) */}
      {origin && !isNaN(origin.lat) && !isNaN(origin.lng) && (
        <AdvancedMarker position={origin} title={originLabel}>
          <div className="relative group cursor-pointer">
            {/* Pulsing radar ring */}
            <div className="absolute -inset-2 bg-emerald-500/30 rounded-full animate-ping pointer-events-none" />
            <div className="relative p-2 bg-emerald-600 text-white rounded-2xl shadow-2xl border-2 border-white flex items-center justify-center transform hover:scale-110 transition-transform">
              <Truck className="w-5 h-5 text-white" />
            </div>

            {/* Floating badge */}
            <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900/90 text-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-500/40 shadow-md pointer-events-none">
              {originLabel}
            </div>
          </div>
        </AdvancedMarker>
      )}

      {/* CUSTOMER DELIVERY DESTINATION MARKER (DESTINATION) */}
      {destination && !isNaN(destination.lat) && !isNaN(destination.lng) && (
        <AdvancedMarker position={destination} title={destinationLabel}>
          <div className="relative group cursor-pointer">
            {/* Destination pulse */}
            <div className="absolute -inset-2 bg-red-500/25 rounded-full animate-pulse pointer-events-none" />
            <div className="relative p-2 bg-red-600 text-white rounded-2xl shadow-2xl border-2 border-white flex items-center justify-center transform hover:scale-110 transition-transform">
              <MapPin className="w-5 h-5 text-white" />
            </div>

            {/* Floating destination badge with customer details */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900/95 text-white text-[10px] font-black px-2.5 py-1 rounded-lg border border-red-500/60 shadow-xl pointer-events-none flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
              <span>{customerName ? `Mteja: ${customerName}` : destinationLabel}</span>
            </div>
          </div>
        </AdvancedMarker>
      )}
    </>
  );
}
