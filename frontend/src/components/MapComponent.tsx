'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Participant, EtaParticipant } from '../types/squad';

interface MapComponentProps {
  currentUserId: string;
  destinationLat?: number;
  destinationLng?: number;
  destinationName?: string;
  participants: Participant[];
  etas: EtaParticipant[];
  cameraAction?: {
    type: 'FOLLOW_ME' | 'FIT_ALL' | 'NORTH_UP' | 'FOCUS_USER';
    userId?: string;
    timestamp: number;
  } | null;
}

export function MapComponent({
  currentUserId,
  destinationLat,
  destinationLng,
  destinationName,
  participants,
  etas,
  cameraAction,
}: MapComponentProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const destMarkerRef = useRef<maplibregl.Marker | null>(null);

  // Initialize MapLibre GL
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialLat = destinationLat ?? 20.5937;
    const initialLng = destinationLng ?? 78.9629;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'carto-dark': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
              'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
              'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
            ],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
          },
        },
        layers: [
          {
            id: 'carto-dark-layer',
            type: 'raster',
            source: 'carto-dark',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [initialLng, initialLat],
      zoom: destinationLat && destinationLng ? 13 : 5,
      pitch: 35, // 35-degree 3D tilt for sleek road-trip perspective
      attributionControl: false,
    });

    map.on('load', () => {
      // Add Route GeoJSON source
      map.addSource('driving-routes', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      // Outer glow line
      map.addLayer({
        id: 'driving-routes-glow',
        type: 'line',
        source: 'driving-routes',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#06B6D4',
          'line-width': 7,
          'line-opacity': 0.35,
          'line-blur': 3,
        },
      });

      // Core crisp driving line
      map.addLayer({
        id: 'driving-routes-core',
        type: 'line',
        source: 'driving-routes',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#38BDF8',
          'line-width': 4,
          'line-opacity': 0.95,
        },
      });

      // Add Geofence circle source & layer (100m radius around destination)
      if (destinationLat && destinationLng) {
        addGeofenceCircle(map, destinationLat, destinationLng);
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Destination Marker & Geofence
  useEffect(() => {
    const map = mapRef.current;
    if (!map || destinationLat == null || destinationLng == null) return;

    if (destMarkerRef.current) {
      destMarkerRef.current.setLngLat([destinationLng, destinationLat]);
    } else {
      const el = document.createElement('div');
      el.className = 'destination-pin group cursor-pointer';
      el.innerHTML = `
        <div class="relative flex flex-col items-center">
          <div class="absolute -top-7 px-2.5 py-0.5 rounded-full bg-rose-500 text-white text-[11px] font-extrabold tracking-wide shadow-lg border border-rose-400 whitespace-nowrap backdrop-blur-md">
            🏁 ${destinationName || 'Destination'}
          </div>
          <div class="w-9 h-9 rounded-full bg-rose-600 flex items-center justify-center text-white shadow-xl shadow-rose-600/50 border-2 border-white animate-bounce">
            📍
          </div>
          <div class="w-3.5 h-1 bg-black/60 rounded-full blur-[1px] mt-0.5"></div>
        </div>
      `;

      destMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([destinationLng, destinationLat])
        .addTo(map);
    }

    if (map.isStyleLoaded()) {
      addGeofenceCircle(map, destinationLat, destinationLng);
    }
  }, [destinationLat, destinationLng, destinationName]);

  // Update Participant Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentMemberIds = new Set<string>();

    participants.forEach((p) => {
      if (p.lat == null || p.lng == null) return;
      currentMemberIds.add(p.id);

      const isSelf = p.id === currentUserId;
      let marker = markersRef.current.get(p.id);

      if (!marker) {
        const el = document.createElement('div');
        el.className = 'participant-marker';
        updateMarkerElement(el, p, isSelf);

        marker = new maplibregl.Marker({ element: el })
          .setLngLat([p.lng, p.lat])
          .addTo(map);

        markersRef.current.set(p.id, marker);
      } else {
        marker.setLngLat([p.lng, p.lat]);
        updateMarkerElement(marker.getElement(), p, isSelf);
      }
    });

    // Cleanup absent markers
    markersRef.current.forEach((marker, id) => {
      if (!currentMemberIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });
  }, [participants, currentUserId]);

  // Update Driving Route Polylines
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource('driving-routes') as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    const features: any[] = [];

    etas.forEach((eta) => {
      if (eta.routeGeometry) {
        try {
          const geom = JSON.parse(eta.routeGeometry);
          features.push({
            type: 'Feature',
            properties: {
              participantId: eta.participantId,
              color: eta.colorHex,
            },
            geometry: geom,
          });
        } catch (e) {
          // ignore parsing error
        }
      }
    });

    source.setData({
      type: 'FeatureCollection',
      features,
    });
  }, [etas]);

  // Handle Imperative Camera Actions from Mobile Controls
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !cameraAction) return;

    switch (cameraAction.type) {
      case 'FOLLOW_ME': {
        const me = participants.find((p) => p.id === currentUserId);
        if (me?.lat && me?.lng) {
          map.flyTo({
            center: [me.lng, me.lat],
            zoom: 15.5,
            pitch: 45,
            bearing: me.heading || 0,
            essential: true,
            duration: 1200,
          });
        }
        break;
      }

      case 'FIT_ALL': {
        const bounds = new maplibregl.LngLatBounds();
        let count = 0;

        if (destinationLat && destinationLng) {
          bounds.extend([destinationLng, destinationLat]);
          count++;
        }

        participants.forEach((p) => {
          if (p.lat && p.lng) {
            bounds.extend([p.lng, p.lat]);
            count++;
          }
        });

        if (count > 0) {
          map.fitBounds(bounds, {
            padding: { top: 120, bottom: 180, left: 40, right: 40 },
            maxZoom: 16,
            essential: true,
            duration: 1200,
          });
        }
        break;
      }

      case 'NORTH_UP': {
        map.easeTo({
          bearing: 0,
          pitch: 35,
          duration: 600,
        });
        break;
      }

      case 'FOCUS_USER': {
        const target = participants.find((p) => p.id === cameraAction.userId);
        if (target?.lat && target?.lng) {
          map.flyTo({
            center: [target.lng, target.lat],
            zoom: 15,
            pitch: 40,
            essential: true,
            duration: 1000,
          });
        }
        break;
      }
    }
  }, [cameraAction, currentUserId, destinationLat, destinationLng, participants]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
}

function updateMarkerElement(el: HTMLElement, p: Participant, isSelf: boolean) {
  const color = p.colorHex || '#3B82F6';
  const speed = p.speed ? Math.round(p.speed) : 0;
  const heading = p.heading || 0;
  const isMoving = speed > 5;

  el.innerHTML = `
    <div class="relative flex flex-col items-center select-none group cursor-pointer active:scale-90 transition-transform">
      <!-- Name & Speed Pill -->
      <div class="mb-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 shadow-lg border border-white/10 whitespace-nowrap backdrop-blur-md"
           style="background-color: rgba(15, 23, 42, 0.92); color: ${color};">
        <span>${p.displayName}${isSelf ? ' (You)' : ''}</span>
        ${
          p.hasArrived
            ? '<span class="text-emerald-400 font-extrabold">✓ ARRIVED</span>'
            : isMoving
            ? `<span class="text-gray-300 font-medium">${speed} km/h</span>`
            : p.isPaused
            ? '<span class="text-amber-400 font-medium">⏸</span>'
            : ''
        }
      </div>

      <!-- Avatar Ring & Car Arrow -->
      <div class="relative flex items-center justify-center">
        ${
          isMoving
            ? `<div class="absolute w-11 h-11 rounded-full animate-ping opacity-35" style="background-color: ${color};"></div>`
            : ''
        }
        <div class="w-9 h-9 rounded-full border-2 border-white shadow-2xl flex items-center justify-center font-bold text-xs text-white"
             style="background-color: ${color};">
          ${
            p.hasArrived
              ? '🎉'
              : isMoving
              ? `<div style="transform: rotate(${heading}deg); transition: transform 0.3s ease;">🚗</div>`
              : p.displayName.charAt(0).toUpperCase()
          }
        </div>
      </div>
    </div>
  `;
}

function addGeofenceCircle(map: maplibregl.Map, lat: number, lng: number) {
  const points = 64;
  const radiusMeters = 100; // 100m geofence
  const coords: [number, number][] = [];

  const distanceX = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180));
  const distanceY = radiusMeters / 110540;

  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([lng + x, lat + y]);
  }

  const circleGeoJson: any = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [coords],
    },
  };

  const source = map.getSource('geofence-circle') as maplibregl.GeoJSONSource | undefined;
  if (source) {
    source.setData(circleGeoJson);
  } else {
    map.addSource('geofence-circle', {
      type: 'geojson',
      data: circleGeoJson,
    });

    map.addLayer({
      id: 'geofence-fill',
      type: 'fill',
      source: 'geofence-circle',
      paint: {
        'fill-color': '#10B981',
        'fill-opacity': 0.15,
      },
    });

    map.addLayer({
      id: 'geofence-stroke',
      type: 'line',
      source: 'geofence-circle',
      paint: {
        'line-color': '#10B981',
        'line-width': 2,
        'line-dasharray': [2, 2],
        'line-opacity': 0.8,
      },
    });
  }
}
