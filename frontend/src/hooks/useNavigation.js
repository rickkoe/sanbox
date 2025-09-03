import { useMemo } from "react";
import { useLocation } from "react-router-dom";

export const useNavigation = () => {
  const location = useLocation();

  const getBackPath = () => {
    const path = location.pathname;
    
    if (path === "/storage/systems") {
      return "/";
    }
    if (path.match(/^\/storage\/\d+$/)) {
      return "/storage/systems";
    }
    if (path.match(/^\/storage\/(\d+)\/volumes$/)) {
      const storageId = path.match(/^\/storage\/(\d+)\/volumes$/)[1];
      return `/storage/${storageId}`;
    }
    if (path.match(/^\/storage\/(\d+)\/hosts$/)) {
      const storageId = path.match(/^\/storage\/(\d+)\/hosts$/)[1];
      return `/storage/${storageId}`;
    }
    if (path === "/san") {
      return "/";
    }
    if (path.startsWith("/san/") && path !== "/san") {
      return "/san";
    }
    if (path === "/customers") {
      return "/";
    }
    if (path === "/insights") {
      return "/";
    }
    if (path.startsWith("/insights/") && path !== "/insights") {
      return "/insights";
    }
    if (["/settings", "/tools", "/scripts"].some(p => path.startsWith(p))) {
      return "/";
    }
    if (path.includes("/import")) {
      if (path.includes("/san/aliases")) return "/san/aliases";
      if (path.includes("/san/zones")) return "/san/zones";
      return "/";
    }
    
    return null;
  };

  const backPath = useMemo(() => getBackPath(), [location.pathname]);
  const showBackButton = useMemo(() => backPath && location.pathname !== "/", [backPath, location.pathname]);

  const navigationState = useMemo(() => ({
    isSanActive: location.pathname.startsWith("/san"),
    isStorageActive: location.pathname.startsWith("/storage"),
  }), [location.pathname]);

  return {
    backPath,
    showBackButton,
    ...navigationState,
  };
};