import type { LatLng } from "./geo";

export interface CampusPreset extends LatLng {
  id: string;
  label: string;
  shortLabel: string;
  category: "CAMPUS" | "TRANSIT" | "HUB";
}

export const BENGALURU_CENTER: LatLng = {
  lat: 12.9352,
  lng: 77.5655,
};

export const CAMPUS_PRESETS: ReadonlyArray<CampusPreset> = [
  {
    id: "rvce",
    label: "RV College of Engineering (RVCE), Mysore Road, Bengaluru",
    shortLabel: "RVCE Campus, Mysore Rd",
    lat: 12.9237,
    lng: 77.4987,
    category: "CAMPUS",
  },
  {
    id: "bmsce",
    label: "BMS College of Engineering (BMSCE), Basavanagudi, Bengaluru",
    shortLabel: "BMSCE, Basavanagudi",
    lat: 12.941,
    lng: 77.5655,
    category: "CAMPUS",
  },
  {
    id: "pesu",
    label: "PES University Ring Road Campus, Banashankari, Bengaluru",
    shortLabel: "PES University, BSK",
    lat: 12.9345,
    lng: 77.5345,
    category: "CAMPUS",
  },
  {
    id: "indiranagar",
    label: "Indiranagar Metro Station, 100 Feet Road, Bengaluru",
    shortLabel: "Indiranagar Metro",
    lat: 12.9784,
    lng: 77.6408,
    category: "TRANSIT",
  },
  {
    id: "jayanagar",
    label: "Jayanagar 4th Block Shopping Complex, Bengaluru",
    shortLabel: "Jayanagar 4th Block",
    lat: 12.925,
    lng: 77.5938,
    category: "HUB",
  },
  {
    id: "koramangala",
    label: "Koramangala Sony World Junction, Bengaluru",
    shortLabel: "Koramangala Sony World",
    lat: 12.9352,
    lng: 77.6245,
    category: "HUB",
  },
  {
    id: "majestic",
    label: "Majestic Kempegowda Metro & Bus Station, Bengaluru",
    shortLabel: "Majestic Metro",
    lat: 12.9767,
    lng: 77.5713,
    category: "TRANSIT",
  },
  {
    id: "ecity",
    label: "Electronic City Phase 1 Toll Gate, Bengaluru",
    shortLabel: "Electronic City Ph 1",
    lat: 12.8452,
    lng: 77.6602,
    category: "HUB",
  },
  {
    id: "silkboard",
    label: "Central Silk Board Junction, Bengaluru",
    shortLabel: "Silk Board Junction",
    lat: 12.9177,
    lng: 77.6238,
    category: "TRANSIT",
  },
  {
    id: "kengeri",
    label: "Kengeri Metro Station, Mysore Road, Bengaluru",
    shortLabel: "Kengeri Metro",
    lat: 12.9079,
    lng: 77.4765,
    category: "TRANSIT",
  },
];
