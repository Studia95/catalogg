import React from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { App } from './app/App';
import { ClientPlatformApp } from './pages/client-platform/ClientPlatformApp';
import { CatalogAdminApp } from './pages/catalog-admin/CatalogAdminApp';
import { resolveSessionRedirect } from './shared/api/loginRedirectApi';
import { appIsRunningStandalone, readPwaResumePath, rememberPwaResumePath, routeIsRoleAppPath } from './shared/pwaSession';

export function CatalogAdminRoute() {
  const { slug = '' } = useParams();
  return <CatalogAdminApp slug={decodeURIComponent(slug)} />;
}

export function RestaurantRouteRedirect() {
  const { slug = '' } = useParams();
  return <Navigate replace to={`/${decodeURIComponent(slug)}`} />;
}

export function RestaurantPublicRoute() {
  return <App />;
}

export function PwaResumeTracker() {
  const location = useLocation();

  React.useEffect(() => {
    rememberPwaResumePath(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  return null;
}

export function PwaHomeRoute() {
  const initialResumePath = React.useMemo(() => {
    const path = readPwaResumePath();
    if (!path) return null;
    return routeIsRoleAppPath(path) ? path : null;
  }, []);
  const publicStandaloneResumePath = React.useMemo(() => {
    const path = readPwaResumePath();
    if (!path || routeIsRoleAppPath(path)) return null;
    return appIsRunningStandalone() ? path : null;
  }, []);
  const [sessionPath, setSessionPath] = React.useState(initialResumePath);
  const [isSessionChecked, setIsSessionChecked] = React.useState(Boolean(initialResumePath));

  React.useEffect(() => {
    if (sessionPath) return undefined;

    let isMounted = true;
    void resolveSessionRedirect().then((redirect) => {
      if (!isMounted) return;
      const targetPath = redirect === '/admin' ? '/admin/clients' : redirect;
      if (targetPath && targetPath !== '/') {
        rememberPwaResumePath(targetPath);
        setSessionPath(targetPath);
      }
      setIsSessionChecked(true);
    }).catch(() => {
      if (isMounted) setIsSessionChecked(true);
    });

    return () => {
      isMounted = false;
    };
  }, [sessionPath]);

  if (sessionPath) return <Navigate replace to={sessionPath} />;
  if (!isSessionChecked) return null;
  return publicStandaloneResumePath ? <Navigate replace to={publicStandaloneResumePath} /> : <ClientPlatformApp />;
}
