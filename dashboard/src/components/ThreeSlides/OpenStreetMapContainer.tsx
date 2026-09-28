import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { SmartContainer } from '../../types/commandCenter';

interface OpenStreetMapContainerProps {
  containers: SmartContainer[];
  selectedContainerId: string;
  onSelectContainer: (id: string) => void;
  onViewEvidence?: () => void;
}

type MapLayerType = 'roadmap' | 'satellite' | 'terrain';

export const OpenStreetMapContainer: React.FC<OpenStreetMapContainerProps> = ({
  containers,
  selectedContainerId,
  onSelectContainer,
  onViewEvidence,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const currentTileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const [mapType, setMapType] = useState<MapLayerType>('roadmap');
  const [searchQuery, setSearchQuery] = useState<string>('I-80 Midwest Arterial Corridor');

  // Tile URLs for Google Maps
  const getGoogleTileUrl = (type: MapLayerType) => {
    switch (type) {
      case 'satellite':
        // Google Hybrid (satellite + road labels)
        return 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
      case 'terrain':
        // Google Terrain
        return 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}';
      case 'roadmap':
      default:
        // Google Standard Road Map
        return 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
    }
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [41.1294, -81.4820], // Akron, OH corridor
        zoom: 6,
        zoomControl: false,
        attributionControl: false,
      });

      const initialLayer = L.tileLayer(getGoogleTileUrl('roadmap'), {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      }).addTo(map);

      currentTileLayerRef.current = initialLayer;
      mapInstanceRef.current = map;
    }
  }, []);

  // Handle Map Type Change
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (currentTileLayerRef.current) {
      mapInstanceRef.current.removeLayer(currentTileLayerRef.current);
    }
    const newLayer = L.tileLayer(getGoogleTileUrl(mapType), {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    }).addTo(mapInstanceRef.current);
    currentTileLayerRef.current = newLayer;
  }, [mapType]);

  // Update Markers & Route
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old markers
    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};

    // Add Google Maps styled pins
    containers.forEach(box => {
      const isSelected = box.id === selectedContainerId;
      const isTampered = box.status === 'TAMPERED';

      const pinColor = isTampered ? '#EB0C0D' : isSelected ? '#1a73e8' : '#202124';

      const customPin = L.divIcon({
        className: 'google-maps-pin',
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
            <!-- Floating label badge -->
            <div style="
              background: #ffffff;
              color: #202124;
              font-family: 'Roboto', -apple-system, sans-serif;
              font-size: 11px;
              font-weight: 700;
              padding: 2px 7px;
              border-radius: 4px;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              white-space: nowrap;
              margin-bottom: 2px;
              display: flex;
              align-items: center;
              gap: 4px;
              border: 1px solid ${isTampered ? '#EB0C0D' : '#dadce0'};
            ">
              <span style="width: 7px; height: 7px; border-radius: 50%; background: ${isTampered ? '#EB0C0D' : '#1a73e8'}; display: inline-block;"></span>
              <span>${box.id}</span>
              ${isTampered ? '<span style="color:#EB0C0D;font-weight:900;">⚠️</span>' : ''}
            </div>

            <!-- Authentic Google Maps Teardrop Pin -->
            <svg width="28" height="38" viewBox="0 0 28 38" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 5px rgba(0,0,0,0.35));">
              <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 38 14 38C14 38 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="${pinColor}"/>
              <circle cx="14" cy="14" r="5.5" fill="#ffffff"/>
            </svg>

            ${isTampered ? `
              <div style="
                position: absolute;
                bottom: 2px;
                width: 32px;
                height: 32px;
                border: 2px solid #EB0C0D;
                border-radius: 50%;
                animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
                pointer-events: none;
              "></div>
            ` : ''}
          </div>
        `,
        iconSize: [80, 50],
        iconAnchor: [40, 48],
      });

      const marker = L.marker([box.coordinates.lat, box.coordinates.lon], {
        icon: customPin,
        zIndexOffset: isSelected ? 1000 : isTampered ? 900 : 100,
      }).addTo(map);

      // Popup styled like Google Maps Place card
      const popupContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 4px; min-width: 180px; color: #202124;">
          <div style="font-weight: 700; font-size: 13px; margin-bottom: 2px; display: flex; align-items: center; justify-content: space-between;">
            <span>${box.id}</span>
            <span style="font-size: 10px; color: ${isTampered ? '#EB0C0D' : '#137333'}; font-weight: 600;">
              ${box.status}
            </span>
          </div>
          <div style="font-size: 11px; color: #5f6368; margin-bottom: 6px;">
            ${box.consignment}
          </div>
          <div style="font-size: 11px; margin-bottom: 4px; border-top: 1px solid #e8eaed; padding-top: 4px;">
            <strong>GPS:</strong> ${box.currentLocationName}
          </div>
          <div style="font-size: 11px; margin-bottom: 4px;">
            <strong>Escrow:</strong> ${box.escrowValueMst} MST
          </div>
          <div style="font-size: 10px; color: #70757a;">
            Lat: ${box.coordinates.lat.toFixed(4)}, Lon: ${box.coordinates.lon.toFixed(4)}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        offset: [0, -38],
        closeButton: true,
      });

      marker.on('click', () => {
        onSelectContainer(box.id);
      });

      markersRef.current[box.id] = marker;
    });

    // Draw Google Maps blue & red arterial corridor
    const routeCoords: L.LatLngExpression[] = [
      [41.8781, -87.6298], // Chicago Origin
      [41.5868, -83.5552], // Toledo Depot
      [41.1294, -81.4820], // Akron (Breach Zone)
      [41.0253, -78.4386], // PA Turnpike
      [40.7128, -74.0060], // NYC Port Destination
    ];

    // Glow background
    const polylineGlow = L.polyline(routeCoords, {
      color: '#ffffff',
      weight: 6,
      opacity: 0.8,
    }).addTo(map);

    // Active route line
    const polyline = L.polyline(routeCoords, {
      color: '#1a73e8', // Google Maps route blue
      weight: 4,
      opacity: 0.95,
    }).addTo(map);

    return () => {
      polylineGlow.remove();
      polyline.remove();
    };
  }, [containers, selectedContainerId, onSelectContainer]);

  // Smoothly center when selected container changes
  useEffect(() => {
    const selectedBox = containers.find(c => c.id === selectedContainerId);
    if (selectedBox && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([selectedBox.coordinates.lat, selectedBox.coordinates.lon], 7, {
        duration: 0.6,
      });
    }
  }, [selectedContainerId, containers]);

  // Center on Breach
  const handleCenterOnBreach = () => {
    const tampered = containers.find(c => c.status === 'TAMPERED') || containers[0];
    if (tampered && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([tampered.coordinates.lat, tampered.coordinates.lon], 9, {
        duration: 0.8,
      });
      onSelectContainer(tampered.id);
    }
  };

  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  return (
    <div className="relative w-full h-full overflow-hidden border border-[#2a2f34] bg-[#f8f9fa] rounded-[3px]">
      {/* Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Google Maps Top Bar: Search Pill */}
      <div className="absolute top-3 left-3 z-[400] flex items-center gap-2 max-w-[calc(100%-120px)]">
        <div className="bg-white text-gray-800 px-3 py-1.5 rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.3)] flex items-center gap-2 text-xs border border-gray-200">
          <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-gray-800 text-[11px] font-sans font-medium focus:outline-none w-48 sm:w-64"
            placeholder="Search Google Maps corridor..."
          />
          <span className="text-[10px] text-gray-400 font-mono hidden sm:inline">LIVE GPS</span>
        </div>

        {/* Center Breach Alert Button */}
        <button
          onClick={handleCenterOnBreach}
          className="bg-[#EB0C0D] hover:bg-[#c90a0b] text-white px-2.5 py-1.5 rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.3)] flex items-center gap-1.5 text-[10px] font-mono font-bold transition-transform active:scale-95"
        >
          <span>⚠️</span>
          <span className="hidden sm:inline">FOCUS BREACH</span>
        </button>
      </div>

      {/* Google Maps Layer Selector (Map vs Satellite) in Top-Right */}
      <div className="absolute top-3 right-3 z-[400] bg-white rounded-[4px] shadow-[0_2px_6px_rgba(0,0,0,0.25)] flex overflow-hidden border border-gray-200 text-xs font-sans">
        <button
          onClick={() => setMapType('roadmap')}
          className={`px-3 py-1.5 font-medium transition-colors ${
            mapType === 'roadmap' ? 'bg-[#1a73e8] text-white font-semibold' : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          Map
        </button>
        <button
          onClick={() => setMapType('satellite')}
          className={`px-3 py-1.5 font-medium transition-colors border-l border-gray-200 ${
            mapType === 'satellite' ? 'bg-[#1a73e8] text-white font-semibold' : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          Satellite
        </button>
        <button
          onClick={() => setMapType('terrain')}
          className={`px-3 py-1.5 font-medium transition-colors border-l border-gray-200 hidden md:block ${
            mapType === 'terrain' ? 'bg-[#1a73e8] text-white font-semibold' : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          Terrain
        </button>
      </div>

      {/* Google Maps Zoom Controls in Bottom-Right */}
      <div className="absolute bottom-4 right-3 z-[400] flex flex-col gap-1.5">
        {/* Recenter Button */}
        <button
          onClick={handleCenterOnBreach}
          title="Recenter on Corridor"
          className="w-8 h-8 bg-white hover:bg-gray-50 text-gray-700 rounded shadow-[0_2px_6px_rgba(0,0,0,0.3)] flex items-center justify-center border border-gray-200 transition-colors"
        >
          <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        {/* Zoom Controls */}
        <div className="bg-white rounded shadow-[0_2px_6px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden border border-gray-200">
          <button
            onClick={handleZoomIn}
            title="Zoom In"
            className="w-8 h-8 flex items-center justify-center text-gray-700 hover:bg-gray-100 font-bold text-base transition-colors border-b border-gray-200"
          >
            +
          </button>
          <button
            onClick={handleZoomOut}
            title="Zoom Out"
            className="w-8 h-8 flex items-center justify-center text-gray-700 hover:bg-gray-100 font-bold text-base transition-colors"
          >
            −
          </button>
        </div>
      </div>

      {/* Google Maps Clean Watermark / Attribution in Bottom-Left */}
      <div className="absolute bottom-1 left-2 z-[400] text-[10px] text-gray-600 bg-white/80 px-1.5 py-0.5 rounded shadow-sm flex items-center gap-1 font-sans pointer-events-none">
        <span className="font-bold text-[#1a73e8]">Google</span>
        <span>Maps Imagery &bull; TamperSafe Telemetry Overlay</span>
      </div>
    </div>
  );
};
