import { Home, MapPin, Navigation } from 'lucide-react';
import { Minus, Plus, LocateFixed } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  buildOsmTileGrid,
  coordinatesToMapPoint,
  getMapCenter,
  type DeliveryMapCoordinates
} from './deliveryMap';
import './delivery-tracking-map.css';

type TrackingPoint = DeliveryMapCoordinates & {
  label: string;
  address?: string;
};

type DeliveryTrackingMapProps = {
  restaurant: TrackingPoint;
  client: TrackingPoint;
  driver?: TrackingPoint | null;
  className?: string;
};

const mapSize = 640;
const defaultMapZoom = 14;

export function DeliveryTrackingMap({ restaurant, client, driver, className = '' }: DeliveryTrackingMapProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [mapZoom, setMapZoom] = useState(defaultMapZoom);
  const points = useMemo(() => [restaurant, client, ...(driver ? [driver] : [])], [client, driver, restaurant]);
  const defaultCenter = useMemo(() => getMapCenter(points), [points]);
  const [center, setCenter] = useState(defaultCenter);
  useEffect(() => setCenter(defaultCenter), [defaultCenter]);
  const tiles = useMemo(() => buildOsmTileGrid(center, mapZoom, mapSize), [center, mapZoom]);
  const projectedPoints = useMemo(
    () => points.map((point) => ({ ...point, ...coordinatesToMapPoint(point, center, mapZoom, mapSize) })),
    [center, mapZoom, points]
  );
  const restaurantPoint = projectedPoints[0];
  const clientPoint = projectedPoints[1];
  const driverPoint = driver ? projectedPoints[2] : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const updateScale = () => setScale(Math.min(1, canvas.clientWidth / mapSize));
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  return (
    <section className={`delivery-tracking-map ${className}`.trim()} aria-label="Карта доставки">
      <div className="delivery-tracking-map__canvas" ref={canvasRef}>
        <div className="delivery-tracking-map__scene" style={{ transform: `scale(${scale})` }}>
          {tiles.map((tile) => (
            <img key={tile.key} src={tile.url} alt="" aria-hidden="true" draggable={false} style={{ left: tile.x, top: tile.y }} />
          ))}
          <svg className="delivery-tracking-map__route" viewBox={`0 0 ${mapSize} ${mapSize}`} aria-hidden="true">
            <polyline
              points={[restaurantPoint, driverPoint, clientPoint]
                .filter(Boolean)
                .map((point) => `${point?.x ?? 0},${point?.y ?? 0}`)
                .join(' ')}
            />
          </svg>
          <TrackingMarker point={restaurantPoint} kind="restaurant" icon={<Home />} />
          {driverPoint && <TrackingMarker point={driverPoint} kind="driver" icon={<Navigation />} />}
          <TrackingMarker point={clientPoint} kind="client" icon={<MapPin />} />
        </div>
        <div className="delivery-tracking-map__controls" aria-label="Управление картой">
          <button type="button" onClick={() => setMapZoom((value) => Math.min(18, value + 1))} aria-label="Приблизить"><Plus /></button>
          <button type="button" onClick={() => setMapZoom((value) => Math.max(10, value - 1))} aria-label="Отдалить"><Minus /></button>
          <button type="button" onClick={() => { setCenter(defaultCenter); setMapZoom(defaultMapZoom); }} aria-label="Показать все точки"><LocateFixed /></button>
        </div>
      </div>
      <div className="delivery-tracking-map__legend">
        <span><i className="delivery-tracking-map__dot delivery-tracking-map__dot--restaurant" />{restaurant.label}</span>
        {driver && <span><i className="delivery-tracking-map__dot delivery-tracking-map__dot--driver" />{driver.label}</span>}
        <span><i className="delivery-tracking-map__dot delivery-tracking-map__dot--client" />{client.label}</span>
      </div>
      <small className="delivery-tracking-map__attribution">© OpenStreetMap contributors</small>
    </section>
  );
}

function TrackingMarker({
  point,
  kind,
  icon
}: {
  point: { x: number; y: number; label: string; address?: string };
  kind: 'restaurant' | 'driver' | 'client';
  icon: ReactNode;
}) {
  return (
    <span className={`delivery-tracking-map__marker delivery-tracking-map__marker--${kind}`} style={{ left: point.x, top: point.y }} title={point.address || point.label}>
      {icon}
    </span>
  );
}
