export const useSearchParams = () => new URLSearchParams(window.location.search);
export const usePathname = () => window.location.pathname;
export const useParams = () => ({});
export const useRouter = () => ({
  push: (url: string) => { window.__venueNavigation = url; },
  replace: (url: string) => { window.__venueNavigation = url; },
  back: () => undefined, refresh: () => undefined, prefetch: async () => undefined,
});
declare global { interface Window { __venueNavigation?: string } }
