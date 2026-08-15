"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";


interface Participant {
  id: string;
  displayName: string;
  color?: string;
  isHost?: boolean;
  lastLat?: number | null;
  lastLng?: number | null;
}

interface MapProps {
  destination: {
    name: string;
    lat: number;
    lng: number;
  };
  participants: Participant[];
  userCoords?: { lat: number; lng: number } | null;
}

export default function MapComponent({ destination, participants, userCoords }: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;

    const loadMap = async () => {
      // Fix default marker icon issues in Webpack/Next.js

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      });

      // Initialize map instance if not existing
      if (!mapInstanceRef.current && mapContainerRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [destination.lat, destination.lng],
          zoom: 13,
          zoomControl: false,
        });


        // OpenStreetMap outdoor light tile layer
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        L.control.zoom({ position: "bottomright" }).addTo(map);
        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;

      // Clear existing markers/layers
      map.eachLayer((layer: any) => {
        if (layer instanceof L.Marker || layer instanceof L.Polyline) {
          map.removeLayer(layer);
        }
      });

      // Destination Star Marker
      const destinationHtml = `
        <div style="display:flex;flex-direction:column;align-items:center;">
          <div style="background:#DC2626;color:white;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:16px;box-shadow:0 4px 10px rgba(220,38,38,0.4);border:2px solid white;">
            ★
          </div>
          <div style="background:white;color:#0F172A;font-weight:700;font-size:11px;padding:2px 8px;border-radius:12px;box-shadow:0 2px 6px rgba(0,0,0,0.15);margin-top:4px;border:1px solid #E2E8F0;white-space:nowrap;">
            ${destination.name}
          </div>
        </div>
      `;

      const destIcon = L.divIcon({
        html: destinationHtml,
        className: "custom-dest-pin",
        iconSize: [40, 60],
        iconAnchor: [20, 30],
      });

      L.marker([destination.lat, destination.lng], { icon: destIcon }).addTo(map);

      const bounds = L.latLngBounds([[destination.lat, destination.lng]]);

      // Squad Participant Markers & Driving Routes
      for (let idx = 0; idx < participants.length; idx++) {
        const p = participants[idx]!;
        const pLat = p.lastLat || (destination.lat + (idx + 1) * 0.008);
        const pLng = p.lastLng || (destination.lng + (idx + 1) * 0.008);
        const pColor = p.color || "#059669";

        const pHtml = `
          <div style="display:flex;flex-direction:column;align-items:center;">
            <div style="background:${pColor};color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;box-shadow:0 3px 8px rgba(0,0,0,0.2);border:2px solid white;">
              ${p.displayName.charAt(0).toUpperCase()}
            </div>
            <div style="background:white;color:#1E293B;font-weight:600;font-size:10px;padding:1px 6px;border-radius:10px;box-shadow:0 2px 4px rgba(0,0,0,0.1);margin-top:2px;border:1px solid #E2E8F0;white-space:nowrap;">
              ${p.displayName}${p.isHost ? " (Host)" : ""}
            </div>
          </div>
        `;

        const pIcon = L.divIcon({
          html: pHtml,
          className: `custom-participant-pin-${p.id}`,
          iconSize: [36, 50],
          iconAnchor: [18, 25],
        });

        L.marker([pLat, pLng], { icon: pIcon }).addTo(map);
        bounds.extend([pLat, pLng]);

        // Attempt to fetch real driving road route polyline from OSRM
        try {
          const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${pLng},${pLat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
          const response = await fetch(osrmUrl);
          if (response.ok) {
            const data = await response.json();
            if (data.routes && data.routes[0]?.geometry?.coordinates) {
              const routeCoords = data.routes[0].geometry.coordinates.map(
                (coord: [number, number]) => [coord[1], coord[0]]
              );
              L.polyline(routeCoords, {
                color: pColor,
                weight: 4,
                opacity: 0.8,
                lineCap: "round",
                lineJoin: "round",
              }).addTo(map);
              continue;
            }
          }
        } catch {
          // Fallback to dotted straight line if routing request fails
        }

        L.polyline(
          [
            [pLat, pLng],
            [destination.lat, destination.lng],
          ],
          {
            color: pColor,
            weight: 3,
            dashArray: "6, 8",
            opacity: 0.7,
          }
        ).addTo(map);
      }

      if (userCoords) {
        bounds.extend([userCoords.lat, userCoords.lng]);
      }

      // Auto fit bounds to show all members and destination
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
    };

    loadMap();
  }, [destination, participants, userCoords]);

  return <div ref={mapContainerRef} className="w-full h-full min-h-[400px] z-10" />;
}
