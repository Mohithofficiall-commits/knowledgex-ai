import { useEffect, useState } from 'react';

export const APP_ROUTES = [
  '/dashboard',
  '/library',
  '/assistant',
  '/research',
  '/summarize',
  '/compare',
  '/knowledge-graph',
  '/history',
  '/settings',
] as const;

export type AppRoute = (typeof APP_ROUTES)[number] | '/';

const ALL_ROUTES: readonly string[] = ['/', ...APP_ROUTES];

export function routeHref(route: AppRoute): string {
  return `#${route}`;
}

function readRoute(): AppRoute {
  const path = window.location.hash.replace(/^#/, '') || '/';
  return ALL_ROUTES.includes(path) ? (path as AppRoute) : '/';
}

export function useRoute(): AppRoute {
  const [route, setRoute] = useState<AppRoute>(readRoute);

  useEffect(() => {
    const handleChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', handleChange);
    return () => window.removeEventListener('hashchange', handleChange);
  }, []);

  return route;
}
