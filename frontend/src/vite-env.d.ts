/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the API, for example https://api.example.com. Empty means the web app's own origin. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
