import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { LayerSpecification, StyleSpecification } from 'mapbox-gl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '../api/queryClient';
import {
  DEFAULT_SETTINGS,
  settingsKey,
  useMapStyle,
  type Settings,
} from '../../features/profile/settingsApi';
import { ATLAS_MAP, ATLAS_STYLE, atlasPaint, loadAtlasStyle, toAtlas } from './atlasStyle';

const tokens = JSON.parse(
  readFileSync(resolve(process.cwd(), '../design/tokens/tokens-atlas.json'), 'utf8'),
) as { map: Record<string, string>; color: Record<string, string> };

const layer = (id: string, type: LayerSpecification['type']) => ({ id, type });

describe('Atlas map colours', () => {
  it('match design/tokens/tokens-atlas.json', () => {
    for (const name of ['land', 'park', 'water', 'roadCasing', 'road', 'highway', 'highwayCasing', 'label']) {
      expect(ATLAS_MAP[name as keyof typeof ATLAS_MAP]).toBe(tokens.map[name]);
    }
    expect(ATLAS_MAP.tint).toBe(tokens.color.tint);
    expect(ATLAS_MAP.lagoon).toBe(tokens.color.lagoon);
  });

  it.each([
    [layer('land', 'background'), { 'background-color': ATLAS_MAP.land }],
    [layer('water', 'fill'), { 'fill-color': ATLAS_MAP.water }],
    [layer('waterway', 'line'), { 'line-color': ATLAS_MAP.water }],
    [layer('national-park', 'fill'), { 'fill-color': ATLAS_MAP.park }],
    [layer('road-street', 'line'), { 'line-color': ATLAS_MAP.road }],
    [layer('road-street-case', 'line'), { 'line-color': ATLAS_MAP.roadCasing }],
    [layer('bridge-motorway-trunk-2', 'line'), { 'line-color': ATLAS_MAP.highway }],
    [layer('road-primary-case', 'line'), { 'line-color': ATLAS_MAP.highwayCasing }],
    [layer('road-label', 'symbol'), { 'text-color': ATLAS_MAP.label, 'text-halo-color': ATLAS_MAP.land }],
    [
      layer('water-point-label', 'symbol'),
      { 'text-color': ATLAS_MAP.lagoon, 'text-halo-color': ATLAS_MAP.land },
    ],
  ])('paints $0.id', (spec, paint) => {
    expect(atlasPaint(spec)).toEqual(paint);
  });

  it.each([
    layer('road-rail', 'line'),
    layer('bridge-rail-tracks', 'line'),
    layer('admin-0-boundary', 'line'),
  ])('leaves $id as Streets draws it', (spec) => {
    expect(atlasPaint(spec)).toBeNull();
  });

  it('changes only colours: data, filters, widths and layout stay as they were', () => {
    const street: LayerSpecification = {
      id: 'road-street',
      type: 'line',
      source: 'composite',
      'source-layer': 'road',
      filter: ['==', ['get', 'class'], 'street'],
      layout: { 'line-cap': 'round' },
      paint: { 'line-color': 'hsl(0, 0%, 100%)', 'line-width': 4, 'line-opacity': 1 },
    };
    const rail: LayerSpecification = {
      id: 'road-rail',
      type: 'line',
      source: 'composite',
      paint: { 'line-color': '#999' },
    };
    const streets = {
      version: 8,
      name: 'Mapbox Streets',
      sources: {},
      layers: [street, rail],
    } as StyleSpecification;

    const atlas = toAtlas(streets);

    expect(atlas.name).toBe('SquadMap Atlas');
    expect(atlas.layers[0]).toEqual({ ...street, paint: { ...street.paint, 'line-color': ATLAS_MAP.road } });
    expect(atlas.layers[1]).toBe(rail);
    expect(streets.layers[0]).toBe(street);
  });
});

describe('loadAtlasStyle', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches Streets once, repaints it, and tries again after a failure', async () => {
    const streets = { version: 8, sources: {}, layers: [{ id: 'land', type: 'background' }] };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValue(new Response(JSON.stringify(streets), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadAtlasStyle('pk.test')).rejects.toThrow('Mapbox answered 503');
    const style = await loadAtlasStyle('pk.test');
    await loadAtlasStyle('pk.test');

    expect(style.layers[0]).toEqual({
      id: 'land',
      type: 'background',
      paint: { 'background-color': ATLAS_MAP.land },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]![0])).toBe(
      'https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token=pk.test',
    );
  });
});

describe('useMapStyle in the Atlas theme', () => {
  function styleFor(settings: Partial<Settings>) {
    const client = createQueryClient();
    client.setQueryData(settingsKey, { ...DEFAULT_SETTINGS, ...settings });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);
    return renderHook(() => useMapStyle(), { wrapper }).result.current;
  }

  it('repaints Streets, and leaves Outdoors, Satellite and the Dark map setting alone', () => {
    document.documentElement.setAttribute('data-theme', 'atlas');

    expect(styleFor({ mapStyle: 'streets' })).toBe(ATLAS_STYLE);
    expect(styleFor({ mapStyle: 'streets', darkMap: true })).toBe('mapbox/dark-v11');
    expect(styleFor({ mapStyle: 'outdoors' })).toBe('mapbox/outdoors-v12');
    expect(styleFor({ mapStyle: 'satellite' })).toBe('mapbox/satellite-streets-v12');
  });
});
