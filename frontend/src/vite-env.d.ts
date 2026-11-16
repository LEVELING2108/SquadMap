/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the API, for example https://api.example.com. Empty means the web app's own origin. */
  readonly VITE_API_URL?: string;
  /** Mapbox public token, restricted to the web app's address. Without one, maps show a plain picture. */
  readonly VITE_MAPBOX_PUBLIC_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
