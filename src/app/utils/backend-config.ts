export type BackendPreset = 'vercel' | 'render' | 'railway' | 'custom';

const BACKEND_KEY = 'backend_preset';
const CUSTOM_URL_KEY = 'backend_custom_url';

const PRESET_URLS: Record<'vercel' | 'render' | 'railway', string> = {
  vercel: (window as any).__env?.API_URL || 'http://localhost:3000',
  render: 'https://proyectou3-juanj-ad-backend.onrender.com'
  ,
  railway: 'https://proyectou3juanjadbackend-production.up.railway.app'
};

export function getBackendPreset(): BackendPreset {
  const preset = localStorage.getItem(BACKEND_KEY) as BackendPreset | null;
  return preset === 'render' || preset === 'railway' || preset === 'custom' ? preset : 'vercel';
}

export function setBackendPreset(preset: BackendPreset, customUrl?: string): void {
  localStorage.setItem(BACKEND_KEY, preset);
  if (customUrl) {
    localStorage.setItem(CUSTOM_URL_KEY, customUrl);
  }
}

export function getBackendBaseUrl(): string {
  const preset = getBackendPreset();
  if (preset === 'custom') {
    return localStorage.getItem(CUSTOM_URL_KEY) || PRESET_URLS.vercel;
  }
  return PRESET_URLS[preset];
}

export function getBackendLabel(): string {
  const preset = getBackendPreset();
  if (preset === 'custom') return 'Personalizado';
  if (preset === 'render') return 'Render';
  if (preset === 'railway') return 'Railway';
  return 'Vercel';
}

export function getPresetOptions(): Array<{ value: BackendPreset; label: string; url: string }> {
  return [
    { value: 'vercel', label: 'Vercel', url: PRESET_URLS.vercel },
    { value: 'render', label: 'Render', url: PRESET_URLS.render },
    { value: 'railway', label: 'Railway', url: PRESET_URLS.railway }
  ];
}
