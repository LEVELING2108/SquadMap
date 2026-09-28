'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface GeolocationState {
  lat: number | null;
  lng: number | null;
  speed: number; // km/h
  heading: number; // degrees
  accuracy: number | null;
  isPaused: boolean;
  isSimulating: boolean;
  mode: 'DRIVING' | 'MOVING' | 'STATIONARY' | 'PAUSED';
  intervalSeconds: number;
}

interface UseAdaptiveGeolocationProps {
  enabled: boolean;
  destinationLat?: number;
  destinationLng?: number;
  onLocationChange: (lat: number, lng: number, speed: number, heading: number, isPaused: boolean) => void;
}

export function useAdaptiveGeolocation({
  enabled,
  destinationLat,
  destinationLng,
  onLocationChange,
}: UseAdaptiveGeolocationProps) {
  const [state, setState] = useState<GeolocationState>({
    lat: null,
    lng: null,
    speed: 0,
    heading: 0,
    accuracy: null,
    isPaused: false,
    isSimulating: false,
    mode: 'STATIONARY',
    intervalSeconds: 15,
  });

  const lastSentTimeRef = useRef<number>(0);
  const lastPositionRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const onLocationChangeRef = useRef(onLocationChange);
  onLocationChangeRef.current = onLocationChange;
  const simulationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Compute adaptive interval based on speed in km/h
  const getAdaptiveConfig = (speedKmh: number, isPaused: boolean) => {
    if (isPaused) return { mode: 'PAUSED' as const, interval: 60 };
    if (speedKmh > 30) return { mode: 'DRIVING' as const, interval: 5 }; // 5s for fast driving
    if (speedKmh >= 5) return { mode: 'MOVING' as const, interval: 15 }; // 15s for moving/walking
    return { mode: 'STATIONARY' as const, interval: 30 }; // 30s battery saver when parked/stopped
  };

  // Process and throttle location update based on current adaptive interval
  const processLocationUpdate = useCallback(
    (lat: number, lng: number, rawSpeed: number | null, rawHeading: number | null, isSim: boolean = false) => {
      const now = Date.now();
      let speedKmh = 0;
      let headingDeg = rawHeading ?? 0;

      if (rawSpeed != null && rawSpeed >= 0) {
        speedKmh = rawSpeed * 3.6; // convert m/s to km/h
      } else if (lastPositionRef.current) {
        // Fallback speed estimation
        const dtSeconds = (now - lastPositionRef.current.time) / 1000;
        if (dtSeconds > 1) {
          const distMeters = calculateDistance(
            lastPositionRef.current.lat,
            lastPositionRef.current.lng,
            lat,
            lng
          );
          speedKmh = (distMeters / dtSeconds) * 3.6;
          headingDeg = calculateBearing(
            lastPositionRef.current.lat,
            lastPositionRef.current.lng,
            lat,
            lng
          );
        }
      }

      const { mode, interval } = getAdaptiveConfig(speedKmh, state.isPaused);

      setState((prev) => ({
        ...prev,
        lat,
        lng,
        speed: Math.round(speedKmh * 10) / 10,
        heading: Math.round(headingDeg),
        mode,
        intervalSeconds: interval,
        isSimulating: isSim,
      }));

      // Check throttling
      const timeSinceLast = (now - lastSentTimeRef.current) / 1000;
      if (timeSinceLast >= interval || lastSentTimeRef.current === 0 || isSim) {
        lastSentTimeRef.current = now;
        onLocationChangeRef.current(lat, lng, speedKmh, headingDeg, state.isPaused);
      }

      lastPositionRef.current = { lat, lng, time: now };
    },
    [state.isPaused]
  );

  // Watch real GPS when not simulating
  useEffect(() => {
    if (!enabled || state.isSimulating || typeof window === 'undefined' || !navigator.geolocation) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        processLocationUpdate(
          pos.coords.latitude,
          pos.coords.longitude,
          pos.coords.speed,
          pos.coords.heading,
          false
        );
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 2000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [enabled, state.isSimulating, processLocationUpdate]);

  // Pause / Resume toggle
  const togglePause = useCallback(() => {
    setState((prev) => {
      const nextPaused = !prev.isPaused;
      if (prev.lat && prev.lng) {
        onLocationChangeRef.current(prev.lat, prev.lng, 0, prev.heading, nextPaused);
      }
      return { ...prev, isPaused: nextPaused };
    });
  }, []);

  // Simulator for easy desktop testing / demo
  const startSimulation = useCallback(
    (startLat?: number, startLng?: number) => {
      if (!destinationLat || !destinationLng) {
        console.warn('Destination required for simulation');
        return;
      }

      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
      }

      // Default start 2.5 km away from destination if not provided
      const sLat = startLat ?? destinationLat - 0.022;
      const sLng = startLng ?? destinationLng - 0.025;

      let currentLat = sLat;
      let currentLng = sLng;
      const steps = 30; // 30 steps towards destination
      let stepCount = 0;

      const dLat = (destinationLat - sLat) / steps;
      const dLng = (destinationLng - sLng) / steps;

      setState((prev) => ({ ...prev, isSimulating: true, isPaused: false }));

      simulationTimerRef.current = setInterval(() => {
        if (stepCount >= steps) {
          // Arrived!
          processLocationUpdate(destinationLat, destinationLng, 0, 0, true);
          if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
          setState((prev) => ({ ...prev, isSimulating: false }));
          return;
        }

        // Add slight road jitter
        const jitterLat = (Math.random() - 0.5) * 0.0003;
        const jitterLng = (Math.random() - 0.5) * 0.0003;

        currentLat += dLat + jitterLat;
        currentLng += dLng + jitterLng;
        stepCount++;

        const simulatedSpeed = 48.0 + (Math.random() * 10 - 5); // ~48 km/h
        const bearing = calculateBearing(currentLat, currentLng, destinationLat, destinationLng);

        processLocationUpdate(currentLat, currentLng, simulatedSpeed / 3.6, bearing, true);
      }, 1500); // 1.5s per simulated step
    },
    [destinationLat, destinationLng, processLocationUpdate]
  );

  const stopSimulation = useCallback(() => {
    if (simulationTimerRef.current) {
      clearInterval(simulationTimerRef.current);
      simulationTimerRef.current = null;
    }
    setState((prev) => ({ ...prev, isSimulating: false }));
  }, []);

  useEffect(() => {
    return () => {
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
      }
    };
  }, []);

  return {
    ...state,
    togglePause,
    startSimulation,
    stopSimulation,
  };
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}
