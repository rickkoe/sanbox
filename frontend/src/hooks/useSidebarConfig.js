import { useMemo, useContext } from "react";
import { useLocation } from "react-router-dom";
import { BreadcrumbContext } from "../context/BreadcrumbContext";
import { 
  Network, 
  HardDrive, 
  Menu,
  GitBranch,
  Tags,
  Layers,
  Server,
  Archive,
  Monitor,
  Users,
  Settings,
  Database
} from "lucide-react";

const getSidebarLinks = (pathname) => {
  if (pathname.startsWith("/customers")) {
    return {
      header: "Customer Management",
      icon: Users,
      showBackButton: false,
      links: [
        { path: "/customers", label: "Customers", icon: Users },
      ],
    };
  }

  if (pathname.startsWith("/insights")) {
    return {
      header: "Storage Insights",
      icon: Database,
      showBackButton: false,
      links: [
        { path: "/insights/importer", label: "Data Importer", icon: Database },
      ],
    };
  }

  if (pathname.startsWith("/san")) {
    return {
      header: "SAN Management",
      icon: Network,
      showBackButton: false,
      links: [
        { path: "/san/fabrics", label: "Fabrics", icon: GitBranch },
        { path: "/san/aliases", label: "Aliases", icon: Tags },
        { path: "/san/zones", label: "Zones", icon: Layers },
      ],
    };
  }

  if (pathname.startsWith("/storage")) {
    const storageIdMatch = pathname.match(/^\/storage\/(\d+)/);
    if (storageIdMatch) {
      return {
        header: "Storage System",
        icon: Server,
        showBackButton: true,
        backPath: "/storage",
        storageId: storageIdMatch[1],
        links: [
          { path: `/storage/${storageIdMatch[1]}`, label: "Properties", icon: Server },
          { path: `/storage/${storageIdMatch[1]}/volumes`, label: "Volumes", icon: Archive },
          { path: `/storage/${storageIdMatch[1]}/hosts`, label: "Hosts", icon: Monitor },
        ],
      };
    }

    return {
      header: "Storage Management",
      icon: HardDrive,
      showBackButton: false,
      links: [
        { path: "/storage", label: "Systems", icon: Server },
      ],
    };
  }

  return {
    header: "Main Menu",
    icon: Menu,
    showBackButton: false,
    links: [
      { path: "/customers", label: "Customers", icon: Users },
      { path: "/insights", label: "Storage Insights", icon: Database },
      { path: "/san", label: "SAN", icon: Network },
      { path: "/storage", label: "Storage", icon: HardDrive },
    ],
  };
};

export const useSidebarConfig = () => {
  const location = useLocation();
  const { breadcrumbMap } = useContext(BreadcrumbContext);
  
  const config = useMemo(() => getSidebarLinks(location.pathname), [location.pathname]);
  
  const dynamicHeader = useMemo(() => {
    if (config.storageId && breadcrumbMap[config.storageId]) {
      return breadcrumbMap[config.storageId];
    }
    return config.header;
  }, [config.header, config.storageId, breadcrumbMap]);

  return {
    ...config,
    dynamicHeader,
  };
};