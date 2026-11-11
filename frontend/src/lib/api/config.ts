/**
 * Where the API lives. Empty means the same origin as the web app, which is how the dev server
 * (via its proxy) and a same-domain deployment work.
 */
export const API_BASE = `${(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')}/api/v1`;
