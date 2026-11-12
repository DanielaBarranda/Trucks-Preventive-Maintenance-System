import indexHtml from '../index.html?raw';
import manifestText from '../public/manifest.webmanifest?raw';
import swText from '../public/sw.js?raw';
import { registerServiceWorker } from './pwa';

const iconFiles = Object.keys(import.meta.glob('../public/icons/*'));

it('has a web app manifest that makes the app installable', () => {
  const manifest = JSON.parse(manifestText);
  expect(manifest.name).toBe('FleetPMTS');
  expect(manifest.short_name).toBe('FleetPMTS');
  expect(manifest.start_url).toBe('/');
  expect(manifest.display).toBe('standalone');
  expect(manifest.theme_color).toMatch(/^#/);
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  for (const icon of manifest.icons) expect(iconFiles).toContain(`../public${icon.src}`);
});

it('index.html links the manifest and the iPhone home-screen icon', () => {
  expect(indexHtml).toContain('<link rel="manifest" href="/manifest.webmanifest"');
  expect(indexHtml).toContain('rel="apple-touch-icon"');
  expect(iconFiles).toContain('../public/icons/apple-touch-icon.png');
});

it('the service worker never caches API calls', () => {
  expect(swText).toContain("url.pathname.startsWith('/api/')");
});

it('registers the service worker only in a production build', () => {
  const register = vi.fn(() => Promise.resolve());
  Object.defineProperty(navigator, 'serviceWorker', { value: { register }, configurable: true });
  registerServiceWorker(false);
  window.dispatchEvent(new Event('load'));
  expect(register).not.toHaveBeenCalled();
  registerServiceWorker(true);
  window.dispatchEvent(new Event('load'));
  expect(register).toHaveBeenCalledWith('/sw.js');
});
