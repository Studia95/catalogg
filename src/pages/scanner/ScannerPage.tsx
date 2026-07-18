import { Camera, Flashlight, QrCode, RotateCcw } from 'lucide-react';
import jsQR from 'jsqr';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { confirmDeliveryPickupQr } from '../../shared/api/deliveryApi';
import './scanner.css';

type ParsedQr =
  | { kind: 'restaurant'; slug: string }
  | { kind: 'order'; orderId: string }
  | { kind: 'delivery'; orderId?: string; deliveryId?: string; token?: string }
  | { kind: 'payment'; orderId?: string }
  | { kind: 'unknown'; raw: string };

function parseQr(raw: string): ParsedQr {
  const text = raw.trim();
  if (text.startsWith('wc-delivery|')) {
    const [, deliveryId, ...tokenParts] = text.split('|');
    const token = tokenParts.join('|');
    if (deliveryId && token) return { kind: 'delivery', deliveryId, token };
  }

  try {
    const parsed = JSON.parse(text) as { type?: string; orderId?: string; deliveryId?: string; token?: string };
    if (parsed.type === 'order' && parsed.orderId) return { kind: 'order', orderId: parsed.orderId };
    if (parsed.type === 'delivery' && (parsed.orderId || parsed.deliveryId)) {
      return {
        kind: 'delivery',
        orderId: parsed.orderId,
        deliveryId: parsed.deliveryId,
        token: parsed.token
      };
    }
    if (parsed.type === 'payment') return { kind: 'payment', orderId: parsed.orderId };
  } catch {
    // Plain links are handled below.
  }

  const match = text.match(/(?:#\/|\/)([a-z0-9-]+)(?:\/|$)/i);
  if (match?.[1] && !['admin', 'login', 'scanner', 'register'].includes(match[1])) {
    return { kind: 'restaurant', slug: match[1] };
  }

  return { kind: 'unknown', raw: text };
}

function scanVideoFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement | null) {
  if (!canvas || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0 || video.videoHeight === 0) {
    return '';
  }

  const maxScanSize = 720;
  const scale = Math.min(1, maxScanSize / Math.max(video.videoWidth, video.videoHeight));
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return '';

  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' })?.data ?? '';
}

export function ScannerPage() {
  const navigate = useNavigate();
  const { slug = '' } = useParams();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const handledQrRef = useRef(false);
  const [rawValue, setRawValue] = useState('');
  const [message, setMessage] = useState('Наведите камеру на QR-код');
  const [cameraMode, setCameraMode] = useState<'environment' | 'user'>('environment');
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isDetectorAvailable, setIsDetectorAvailable] = useState(false);

  const scannerTitle = useMemo(() => (slug ? `Сканер ${slug}` : 'Сканер QR'), [slug]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsCameraActive(false);
  };

  const handleParsed = useCallback(async (parsed: ParsedQr) => {
    if (parsed.kind === 'restaurant') {
      navigate(`/${parsed.slug}`);
      return;
    }
    if (parsed.kind === 'order') {
      navigate(`/${slug || 'mangal'}/dashboard?order=${encodeURIComponent(parsed.orderId)}`);
      return;
    }
    if (parsed.kind === 'delivery') {
      if (parsed.deliveryId && parsed.token) {
        try {
          const confirmed = await confirmDeliveryPickupQr(parsed.deliveryId, parsed.token);
          setMessage(confirmed ? 'Выдача подтверждена. Заказ передан водителю.' : 'QR недействителен, устарел или уже отменён.');
        } catch (error) {
          setMessage(error instanceof Error ? error.message : 'Не удалось подтвердить выдачу.');
        }
        return;
      }
      if (!parsed.orderId) {
        setMessage('В QR доставки нет номера заказа или токена выдачи.');
        return;
      }
      navigate(`/${slug || 'mangal'}/dashboard?delivery=${encodeURIComponent(parsed.orderId)}`);
      return;
    }
    if (parsed.kind === 'payment') {
      navigate(`/${slug || 'mangal'}/payments`);
      return;
    }
    setMessage('QR не распознан. Проверьте формат или вставьте ссылку каталога.');
  }, [navigate, slug]);

  const scanManual = () => {
    void handleParsed(parseQr(rawValue));
  };

  useEffect(() => {
    let disposed = false;
    let raf = 0;
    handledQrRef.current = false;

    const start = async () => {
      const detectorConstructor = (window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
      setIsDetectorAvailable(Boolean(detectorConstructor));
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: cameraMode },
          audio: false
        });
        if (disposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        setIsCameraActive(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setMessage(detectorConstructor ? 'Камера работает, ищу QR-код.' : 'Камера работает, ищу QR-код через резервный сканер.');

        const detector = detectorConstructor ? new detectorConstructor({ formats: ['qr_code'] }) : null;
        const tick = async () => {
          if (disposed || handledQrRef.current || !videoRef.current) return;
          try {
            const nativeCodes = detector ? await detector.detect(videoRef.current) : [];
            const nativeValue = nativeCodes[0]?.rawValue;
            const fallbackValue = nativeValue ? '' : scanVideoFrame(videoRef.current, canvasRef.current);
            const value = nativeValue || fallbackValue;
            if (value) {
              handledQrRef.current = true;
              stopCamera();
              void handleParsed(parseQr(value));
              return;
            }
          } catch (error) {
            const fallbackValue = scanVideoFrame(videoRef.current, canvasRef.current);
            if (fallbackValue) {
              handledQrRef.current = true;
              stopCamera();
              void handleParsed(parseQr(fallbackValue));
              return;
            }
            if (error instanceof Error && error.name === 'NotAllowedError') {
              setMessage('Браузер не дал доступ к камере. Разрешите доступ или вставьте QR-текст вручную.');
            }
          }
          raf = window.setTimeout(tick, 220);
        };
        void tick();
      } catch {
        setMessage('Не удалось открыть камеру. Разрешите доступ или вставьте QR-текст вручную.');
      }
    };

    void start();

    return () => {
      disposed = true;
      window.clearTimeout(raf);
      stopCamera();
    };
  }, [cameraMode, handleParsed]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchEnabled } as MediaTrackConstraintSet] });
      setTorchEnabled((current) => !current);
    } catch {
      setMessage('Фонарик недоступен на этом устройстве.');
    }
  };

  return (
    <main className="scanner-page">
      <section className="scanner-camera">
        <video ref={videoRef} playsInline muted />
        <canvas ref={canvasRef} aria-hidden="true" />
        <div className="scanner-frame">
          <QrCode />
          <span>{scannerTitle}</span>
        </div>
      </section>

      <section className="scanner-controls">
        <p>{message}</p>
        {!isDetectorAvailable && <small>Автораспознавание QR может быть недоступно в этом браузере.</small>}
        <div>
          <button type="button" onClick={toggleTorch} disabled={!isCameraActive}>
            <Flashlight />
            Фонарик
          </button>
          <button type="button" onClick={() => setCameraMode((current) => (current === 'environment' ? 'user' : 'environment'))}>
            <RotateCcw />
            Камера
          </button>
          <button type="button" onClick={() => navigate(slug ? `/${slug}/dashboard` : '/')}>
            <Camera />
            Закрыть
          </button>
        </div>
        <label>
          QR-текст или ссылка
          <textarea value={rawValue} onChange={(event) => setRawValue(event.target.value)} placeholder='{"type":"order","orderId":"12345"}' />
        </label>
        <button className="scanner-submit" type="button" onClick={scanManual}>Обработать QR</button>
      </section>
    </main>
  );
}
