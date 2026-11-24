"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { useTheme } from "next-themes";
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

const LIGHT_TILES =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const DARK_TILES =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

function createPinIcon(bg: string, fg: string, label: string): L.DivIcon {
  return L.divIcon({
    className: "ridemate-pin",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9999px;background:${bg};color:${fg};font-weight:800;font-size:12px;border:3px solid #ffffff;box-shadow:0 4px 12px rgba(20,21,23,0.28);">${label}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function createLiveVehicleIcon(): L.DivIcon {
  return L.divIcon({
    className: "ridemate-live-pin",
    html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9999px;background:#FF5A26;color:#ffffff;font-weight:800;font-size:10px;letter-spacing:0.04em;border:3px solid #ffffff;box-shadow:0 0 0 7px rgba(255,90,38,0.25),0 4px 12px rgba(0,0,0,0.32);">LIVE</div>`,
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
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
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
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const originIcon = useMemo(() => createPinIcon("#FF5A26", "#ffffff", "A"), []);
  const destIcon = useMemo(() => createPinIcon("#141517", "#F6F4EE", "B"), []);
  const pickupIcon = useMemo(() => createPinIcon("#15803D", "#ffffff", "P"), []);
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
      pts.push(
        polyline[0],
        polyline[Math.floor(polyline.length / 2)],
        polyline[polyline.length - 1]
      );
    }
    return pts;
  }, [origin, dest, pickup, polyline]);

  const initialCenter: [number, number] = origin
    ? [origin.lat, origin.lng]
    : [BENGALURU_CENTER.lat, BENGALURU_CENTER.lng];

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] ${heightClassName}`}
    >
      <MapContainer
        center={initialCenter}
        zoom={12}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          key={isDark ? "carto-dark" : "carto-voyager"}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
          url={isDark ? DARK_TILES : LIGHT_TILES}
        />

        <MapClickHandler onMapClick={onMapClick} />
        <FitBoundsController points={fitPoints} />

        {polylinePositions.length >= 2 && (
          <Polyline
            positions={polylinePositions}
            pathOptions={{
              color: "#FF5A26",
              weight: 4,
              opacity: 0.92,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        )}

        {origin && (
          <Marker position={[origin.lat, origin.lng]} icon={originIcon}>
            <Popup>
              <strong>Start:</strong> {origin.label ?? "Origin"}
            </Popup>
          </Marker>
        )}

        {dest && (
          <Marker position={[dest.lat, dest.lng]} icon={destIcon}>
            <Popup>
              <strong>Drop-off:</strong> {dest.label ?? "Destination"}
            </Popup>
          </Marker>
        )}

        {pickup && (
          <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon}>
            <Popup>
              <strong>Pickup:</strong> {pickup.label ?? "Your pickup"}
            </Popup>
          </Marker>
        )}

        {livePosition && (
          <Marker
            position={[livePosition.lat, livePosition.lng]}
            icon={liveIcon}
          >
            <Popup>
              <strong>Live Location (Demo Simulation):</strong>{" "}
              {livePosition.label ?? "On route"}
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
