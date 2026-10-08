import type { ReactNode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';

export function mountPage(id: string, page: ReactNode) {
  const mount = document.getElementById(id);
  if (!mount) return;
  if (mount.hasChildNodes()) hydrateRoot(mount, page);
  else createRoot(mount).render(page);
}
