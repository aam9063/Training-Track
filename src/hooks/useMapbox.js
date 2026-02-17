import { useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import polylineCodec from '@mapbox/polyline';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

export default function useMapbox(encodedPolyline, isLoading) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!encodedPolyline || isLoading || !mapContainerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    try {
      const coordinates = polylineCodec.decode(encodedPolyline).map(([lat, lng]) => [lng, lat]);
      if (coordinates.length === 0) return;

      const bounds = coordinates.reduce(
        (b, coord) => b.extend(coord),
        new mapboxgl.LngLatBounds(coordinates[0], coordinates[0])
      );

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/outdoors-v12',
        bounds,
        fitBoundsOptions: { padding: 40 },
      });

      mapRef.current = map;

      map.on('load', () => {
        map.addSource('route', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } },
        });
        map.addLayer({
          id: 'route-outline', type: 'line', source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#000', 'line-width': 6, 'line-opacity': 0.3 },
        });
        map.addLayer({
          id: 'route', type: 'line', source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#f97316', 'line-width': 4 },
        });

        new mapboxgl.Marker({ color: '#22c55e' })
          .setLngLat(coordinates[0])
          .setPopup(new mapboxgl.Popup().setHTML('<strong>Inicio</strong>'))
          .addTo(map);

        new mapboxgl.Marker({ color: '#ef4444' })
          .setLngLat(coordinates[coordinates.length - 1])
          .setPopup(new mapboxgl.Popup().setHTML('<strong>Fin</strong>'))
          .addTo(map);
      });

      map.addControl(new mapboxgl.NavigationControl(), 'top-right');
      map.addControl(new mapboxgl.FullscreenControl(), 'top-right');
    } catch (err) {
      console.error('Error initializing map:', err);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [encodedPolyline, isLoading]);

  return { mapContainerRef };
}
