"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { LatLng } from "@/lib/geo";
import { BENGALURU_CENTER } from "@/lib/presets";

export interface RideMapProps {
  origin?: { lat: number; lng: number; label?: string } | null;
  dest?: { lat: number; lng: number; label?: string } | null;
  pickup?: { lat: number; lng: number; label?: string } | null;
  livePosition?: { lat: number; lng: number; label?: string } | null;
  polyline?: ReadonlyArray<LatLng>;
  onMapClick?: (coords: LatLng) => void;
  heightClassName?: string;
}

function createPinIcon(color: string, label: string): L.DivIcon {
  return L.divIcon({
    className: "ridemate-pin",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;background:${color};color:#ffffff;font-weight:700;font-size:12px;border:3px solid #ffffff;box-shadow:0 3px 10px rgba(0,0,0,0.35);">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function createLiveVehicleIcon(): L.DivIcon {
  return L.divIcon({
    className: "ridemate-live-pin",
    html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9999px;background:#10b981;color:#09090b;font-weight:800;font-size:11px;border:3px solid #ffffff;box-shadow:0 0 0 6px rgba(16,185,129,0.28),0 4px 12px rgba(0,0,0,0.35);">GPS</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function MapClickHandler({
  onMapClick,
}: {
  onMapClick?: (coords: LatLng) => void;
}) {
  useMapEvents({
    click(e) {
      if (onMapClick) {
        onMapClick({
          lat: Number(e.latlng.lat.toFixed(6)),
          lng: Number(e.latlng.lng.toFixed(6)),
        });
      }
    },
  });
  return null;
}

function FitBoundsController({
  points,
}: {
  points: ReadonlyArray<LatLng>;
}) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 14, { animate: true });
      return;
    }
    const bounds = L.latLngBounds(
      points.map((p) => [p.lat, p.lng] as [number, number])
    );
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
  }, [map, points]);

  return null;
}

export default function RideMapClient({
  origin,
  dest,
  pickup,
  livePosition,
  polyline = [],
  onMapClick,
  heightClassName = "h-72 sm:h-80",
}: RideMapProps) {
  const originIcon = useMemo(() => createPinIcon("#10b981", "A"), []);
  const destIcon = useMemo(() => createPinIcon("#18181b", "B"), []);
  const pickupIcon = useMemo(() => createPinIcon("#f59e0b", "P"), []);
  const liveIcon = useMemo(() => createLiveVehicleIcon(), []);

  const polylinePositions = useMemo(
    () => polyline.map((p) => [p.lat, p.lng] as [number, number]),
    [polyline]
  );

  const fitPoints = useMemo(() => {
    const pts: LatLng[] = [];
    if (origin) pts.push({ lat: origin.lat, lng: origin.lng });
    if (dest) pts.push({ lat: dest.lat, lng: dest.lng });
    if (pickup) pts.push({ lat: pickup.lat, lng: pickup.lng });
    if (polyline.length >= 2) {
      pts.push(polyline[0], polyline[Math.floor(polyline.length / 2)], polyline[polyline.length - 1]);
    }
    return pts;
  }, [origin, dest, pickup, polyline]);

  const initialCenter: [number, number] = origin
    ? [origin.lat, origin.lng]
    : [BENGALURU_CENTER.lat, BENGALURU_CENTER.lng];

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 ${heightClassName}`}
    >
      <MapContainer
        center={initialCenter}
        zoom={12}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapClickHandler onMapClick={onMapClick} />
        <FitBoundsController points={fitPoints} />

        {polylinePositions.length >= 2 && (
          <Polyline
            positions={polylinePositions}
            pathOptions={{
              color: "#10b981",
              weight: 5,
              opacity: 0.9,
            }}
          />
        )}

        {origin && (
          <Marker position={[origin.lat, origin.lng]} icon={originIcon}>
            <Popup>
              <strong>Origin:</strong> {origin.label ?? "Start point"}
            </Popup>
          </Marker>
        )}

        {dest && (
          <Marker position={[dest.lat, dest.lng]} icon={destIcon}>
            <Popup>
              <strong>Destination:</strong> {dest.label ?? "End point"}
            </Popup>
          </Marker>
        )}

        {pickup && (
          <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon}>
            <Popup>
              <strong>Pickup:</strong> {pickup.label ?? "Passenger pickup"}
            </Popup>
          </Marker>
        )}

        {livePosition && (
          <Marker position={[livePosition.lat, livePosition.lng]} icon={liveIcon}>
            <Popup>
              <strong>Live Vehicle (Demo Simulation):</strong>{" "}
              {livePosition.label ?? "In transit"}
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
