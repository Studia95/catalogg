import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { Check, LocateFixed, MapPin } from 'lucide-react';
import {
  buildOsmTileGrid,
  coordinatesToMapPoint,
  mapPointToCoordinates,
  type DeliveryMapCoordinates,
  type DeliveryMapPoint
} from './deliveryMap';

const mapSize = 320;
const mapZoom = 16;

type DeliveryMapPickerProps = {
  lat: number;
  lng: number;
  accuracyM?: number | null;
  isLocating?: boolean;
  error?: string;
  onLocate: () => void;
  onChange: (coordinates: DeliveryMapCoordinates) => void;
  onDone?: () => void;
};

export function DeliveryMapPicker({
  lat,
  lng,
  accuracyM,
  isLocating = false,
  error = '',
  onLocate,
  onChange,
  onDone
}: DeliveryMapPickerProps) {
  const [center, setCenter] = useState<DeliveryMapCoordinates>({ lat, lng });
  const [isDragging, setIsDragging] = useState(false);
  const shouldRecenterRef = useRef(true);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const marker = useMemo(() => coordinatesToMapPoint({ lat, lng }, center, mapZoom, mapSize), [center, lat, lng]);
  const tiles = useMemo(() => buildOsmTileGrid(center, mapZoom, mapSize), [center]);

  useEffect(() => {
    if (!shouldRecenterRef.current) return;
    setCenter({ lat, lng });
  }, [lat, lng]);

  const moveMarker = (point: DeliveryMapPoint) => {
    shouldRecenterRef.current = false;
    onChange(mapPointToCoordinates(point, center, mapZoom, mapSize));
  };

  const pointFromEvent = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * mapSize,
      y: ((event.clientY - rect.top) / rect.height) * mapSize
    };
  };

  const locate = () => {
    shouldRecenterRef.current = true;
    onLocate();
  };

  return (
    <section className="delivery-map-picker" aria-label="Карта доставки">
      <div
        className="delivery-map-picker__canvas"
        ref={canvasRef}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setIsDragging(true);
          moveMarker(pointFromEvent(event));
        }}
        onPointerMove={(event) => {
          if (!isDragging) return;
          moveMarker(pointFromEvent(event));
        }}
        onPointerUp={() => setIsDragging(false)}
        onPointerCancel={() => setIsDragging(false)}
      >
        {tiles.map((tile) => (
          <img
            alt=""
            aria-hidden="true"
            draggable={false}
            key={tile.key}
            src={tile.url}
            style={{ left: tile.x, top: tile.y }}
          />
        ))}
        <span className="delivery-map-picker__marker" style={{ left: marker.x, top: marker.y }}>
          <MapPin />
        </span>
      </div>

      <div className="delivery-map-picker__meta">
        <strong>{lat.toFixed(7)}, {lng.toFixed(7)}</strong>
        <small>{accuracyM ? `точность ${accuracyM} м` : 'точка выбрана вручную'}</small>
        {error && <p>{error}</p>}
      </div>

      <div className="delivery-map-picker__actions">
        <button type="button" onClick={locate} disabled={isLocating}>
          <LocateFixed />
          {isLocating ? 'Отслеживаем...' : 'Отследить моё местоположение'}
        </button>
        {onDone && (
          <button type="button" onClick={onDone}>
            <Check />
            Готово
          </button>
        )}
      </div>
    </section>
  );
}
