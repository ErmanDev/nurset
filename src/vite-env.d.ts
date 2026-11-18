/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** NurSet server address, e.g. https://nurset-api.onrender.com */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
