/** Dev-only session: no API, no real login. Gated by `import.meta.env.DEV`. */
export const UI_PREVIEW_TOKEN = '__infrazmind_ui_preview__';

export function isAdminUiPreviewEnabled(): boolean {
  return import.meta.env.DEV === true && import.meta.env.VITE_ADMIN_UI_PREVIEW === 'true';
}

export function isUiPreviewToken(token: string | null): boolean {
  return isAdminUiPreviewEnabled() && token === UI_PREVIEW_TOKEN;
}
