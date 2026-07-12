import React from 'react';
import { Navigate, useLocation, useNavigationType, useParams } from 'react-router-dom';
import { App } from './app/App';
import { ClientPlatformApp } from './pages/client-platform/ClientPlatformApp';
import { CatalogAdminApp } from './pages/catalog-admin/CatalogAdminApp';
import { resolveSessionRedirect } from './shared/api/loginRedirectApi';
import {
  appIsRunningStandalone,
  clearPwaResumePath,
  readPwaResumePath,
  rememberPwaResumePath,
  resolvePwaHomeTarget
} from './shared/pwaSession';

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
  const navigationType = useNavigationType();
  const explicitNavigation = navigationType !== 'POP';
  const savedPath = React.useMemo(readPwaResumePath, []);
  const [sessionPath, setSessionPath] = React.useState<string | null>(null);
  const [isSessionChecked, setIsSessionChecked] = React.useState(explicitNavigation);

  React.useEffect(() => {
    if (explicitNavigation) {
      clearPwaResumePath();
      setSessionPath(null);
      setIsSessionChecked(true);
      return undefined;
    }

    let isMounted = true;
    void resolveSessionRedirect().then((redirect) => {
      if (!isMounted) return;
      const verifiedPath = redirect === '/admin' ? '/admin/clients' : redirect;
      const targetPath = resolvePwaHomeTarget({
        explicitNavigation: false,
        savedPath,
        sessionRedirect: verifiedPath,
        standalone: appIsRunningStandalone()
      });
      if (targetPath) {
        rememberPwaResumePath(targetPath);
      }
      setSessionPath(targetPath);
      setIsSessionChecked(true);
    }).catch(() => {
      if (isMounted) setIsSessionChecked(true);
    });

    return () => {
      isMounted = false;
    };
  }, [explicitNavigation, savedPath]);

  if (sessionPath) return <Navigate replace to={sessionPath} />;
  if (!isSessionChecked) return null;
  return <ClientPlatformApp />;
}
