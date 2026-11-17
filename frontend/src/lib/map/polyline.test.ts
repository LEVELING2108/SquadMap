import { describe, expect, it } from 'vitest';
import { decodePolyline } from './polyline';

describe('decodePolyline', () => {
  it('decodes the example from the format’s documentation', () => {
    // Google's example: (38.5, -120.2), (40.7, -120.95), (43.252, -126.453), at precision 5.
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@', 5)).toEqual([
      [-120.2, 38.5],
      [-120.95, 40.7],
      [-126.453, 43.252],
    ]);
  });

  it('reads precision 6, as Mapbox sends', () => {
    // (18.5679, 73.9143) and (18.5622, 73.9167).
    const points = decodePolyline('wlhlb@wzj~kCfcJ_uC');
    expect(points[0]![0]).toBeCloseTo(73.9143, 5);
    expect(points[0]![1]).toBeCloseTo(18.5679, 5);
    expect(points).toHaveLength(2);
  });

  it('gives nothing for an empty or cut-off line', () => {
    expect(decodePolyline('')).toEqual([]);
    expect(decodePolyline('_p~iF', 5)).toEqual([]);
  });
});
