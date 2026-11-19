/** Reads the text of a QR code in the current video frame, or null when none is visible. */
export type FrameReader = (video: HTMLVideoElement) => Promise<string | null>;

/** The browser's built-in detector (Chrome on Android, for example). Not yet in TypeScript's DOM types. */
type NativeDetector = { detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>> };
type NativeDetectorClass = {
  new (options: { formats: string[] }): NativeDetector;
  getSupportedFormats?: () => Promise<string[]>;
};

/** Frames are scaled down to this width before decoding in script: enough for a QR held near the camera. */
const MAX_DECODE_WIDTH = 640;

/**
 * Uses the browser's own QR detector when it has one. Otherwise falls back to decoding in script,
 * loaded only now so the library never weighs on pages that don't scan.
 */
export async function createFrameReader(): Promise<FrameReader> {
  const Native = (globalThis as { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector;
  if (Native) {
    try {
      const formats = (await Native.getSupportedFormats?.()) ?? ['qr_code'];
      if (formats.includes('qr_code')) {
        const detector = new Native({ formats: ['qr_code'] });
        return async (video) => (await detector.detect(video))[0]?.rawValue ?? null;
      }
    } catch {
      // Present but unusable: fall back below.
    }
  }

  const { default: jsQR } = await import('jsqr');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  return async (video) => {
    if (!context || video.videoWidth === 0) return null;
    const scale = Math.min(1, MAX_DECODE_WIDTH / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
  };
}

export type CameraProblem = 'blocked' | 'missing' | 'unsupported' | 'failed';

/** Turns a camera error into something we can explain to the person. */
export function cameraProblem(error: unknown): CameraProblem {
  const name = error instanceof DOMException || error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'blocked';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'missing';
  return 'failed';
}
