"use client";

import React, { useEffect, useRef } from "react";
import L from "leaflet";
import { Recommendation } from "@/components/ServiceCard";

interface ExploreMapProps {
  services: Recommendation[];
}

// Map coordinates for mock locations in Cyprus
const mockCoordinates: { [key: string]: [number, number] } = {
  "Larnaca": [34.922, 33.623],
  "Limassol": [34.678, 33.041],
  "Nicosia": [35.185, 33.382],
  "Paphos": [34.776, 32.421],
  "Protaras": [35.012, 34.054],
  "Ayia Napa": [34.981, 33.999],
};

export default function ExploreMap({ services }: ExploreMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  // Load Leaflet CSS dynamically
  useEffect(() => {
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
  }, []);

  // Initialize and update Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Center map around Larnaca or Cyprus center initially
    const center: L.LatLngExpression = [34.922, 33.623];

    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center,
        zoom: 9,
        minZoom: 3,
        zoomControl: true,
      });

      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom',
      }).addTo(map);

      mapRef.current = map;
    }

    const map = mapRef.current;

    // Clear old markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add markers for services
    services.forEach(service => {
      // Find matching coordinates based on location travel locations or location text
      let coords: [number, number] = mockCoordinates["Larnaca"]; // default fallback

      if (service.travelsToYou && service.travelLocations && service.travelLocations.length > 0) {
        const firstLoc = service.travelLocations[0];
        if (mockCoordinates[firstLoc]) coords = mockCoordinates[firstLoc];
      } else if (service.location) {
        const matched = Object.keys(mockCoordinates).find(key => service.location?.includes(key));
        if (matched) coords = mockCoordinates[matched];
      }

      // Add a small randomized offset so multiple pins in the same city don't stack directly on top of each other
      const latOffset = (Math.random() - 0.5) * 0.03;
      const lngOffset = (Math.random() - 0.5) * 0.03;
      const finalCoords: L.LatLngExpression = [coords[0] + latOffset, coords[1] + lngOffset];

      // Custom divIcon matching address label styling: "Soho Vintage 4.5"
      const ratingLabel = service.rating !== null ? String(service.rating) : "New";
      const labelText = `${service.title.split("|")[0].trim().substring(0, 14)} ${ratingLabel}`;

      const customIcon = L.divIcon({
        className: "custom-map-address-pin",
        html: `
          <div class="flex flex-col items-center select-none cursor-pointer">
            <!-- Address text tag -->
            <div class="px-3 py-1.5 bg-[#0F0F14]/90 text-white rounded-[15px] font-sans text-xs font-medium whitespace-nowrap shadow-md flex items-center gap-1">
              <span>${labelText}</span>
            </div>
            <!-- Pin Arrow pointing down -->
            <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-[#0F0F14]/90 -mt-0.5"></div>
          </div>
        `,
        iconSize: [120, 40],
        iconAnchor: [60, 36],
      });

      const marker = L.marker(finalCoords, { icon: customIcon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family: Poppins, sans-serif; padding: 2px;">
            <strong style="display: block; margin-bottom: 4px;">${service.title}</strong>
            <span style="color: #E49D12;">${service.rating !== null ? `★ ${service.rating} (${service.reviews} reviews)` : "New — no reviews yet"}</span>
            ${service.startingPrice !== null ? `<div style="margin-top: 6px; font-weight: bold;">Starting from $${service.startingPrice}</div>` : ""}
          </div>
        `);

      markersRef.current.push(marker);
    });

    // If we have markers, fit bounds to them
    if (markersRef.current.length > 0) {
      const group = L.featureGroup(markersRef.current);
      map.fitBounds(group.getBounds().pad(0.15));
    }

    // Force Leaflet to recalculate size after render
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

  }, [services]);

  return (
    <div className="w-full h-full relative rounded-2xl overflow-hidden border border-[#E5E5E5]/50 shadow-sm min-h-[500px] bg-[#d4e6ec]">
      <div ref={mapContainerRef} className="w-full h-full min-h-[500px] z-0 bg-[#d4e6ec]" />
    </div>
  );
}
