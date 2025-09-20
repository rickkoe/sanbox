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
  Database,
  Building2,
  FolderOpen,
  Wrench,
  Type,
  Calculator,
  Cable,
  BarChart3,
  Layout,
} from "lucide-react";

const getSidebarLinks = (pathname) => {
  // Only use layered navigation for individual storage system detail pages
  if (pathname.startsWith("/storage/")) {
    const storageIdMatch = pathname.match(/^\/storage\/(\d+)/);
    if (storageIdMatch) {
      return {
        header: "Storage System",
        icon: Server,
        showBackButton: true,
        backPath: "/storage/systems",
        storageId: storageIdMatch[1],
        links: [
          {
            path: `/storage/${storageIdMatch[1]}`,
            label: "Properties",
            icon: Server,
          },
          {
            path: `/storage/${storageIdMatch[1]}/volumes`,
            label: "Volumes",
            icon: Archive,
          },
          {
            path: `/storage/${storageIdMatch[1]}/hosts`,
            label: "Hosts",
            icon: Monitor,
          },
        ],
      };
    }
  }

  // For all other pages, show the expandable main menu
  return {
    header: "Main Menu",
    icon: Menu,
    showBackButton: false,
    links: [
      { 
        label: "Dashboard", 
        icon: BarChart3, 
        expandable: true,
        subLinks: [
          { path: "/", label: "Overview", icon: BarChart3 },
          { path: "/dashboard-v2", label: "Customizable Dashboard", icon: Layout },
        ]
      },
      { 
        label: "Organization", 
        icon: Building2, 
        expandable: true,
        subLinks: [
          { path: "/customers", label: "Customers", icon: Users },
          { path: "/projects", label: "Projects", icon: FolderOpen },
        ]
      },
      { 
        label: "Storage Insights", 
        icon: Database, 
        expandable: true,
        subLinks: [
          { path: "/import/ibm-storage-insights", label: "Data Importer", icon: Database },
        ]
      },
      { 
        label: "SAN", 
        icon: Network, 
        expandable: true,
        subLinks: [
          { path: "/san/fabrics", label: "Fabrics", icon: GitBranch },
          { path: "/san/aliases", label: "Aliases", icon: Tags },
          { path: "/san/zones", label: "Zones", icon: Layers },
        ]
      },
      { 
        label: "Storage", 
        icon: HardDrive, 
        expandable: true,
        subLinks: [
          { path: "/storage/systems", label: "Systems", icon: Server },
          { path: "/storage/hosts", label: "Hosts", icon: Monitor },
        ]
      },
      { 
        label: "Tools", 
        icon: Wrench, 
        expandable: true,
        subLinks: [
          { path: "/tools/custom-naming", label: "Custom Naming", icon: Type },
          { path: "/tools/wwpn-colonizer", label: "WWPN Colonizer", icon: Cable },
          { path: "/tools/ibm-storage-calculator", label: "Storage Calculators", icon: Calculator },
        ]
      },
    ],
  };
};

export const useSidebarConfig = () => {
  const location = useLocation();
  const { breadcrumbMap } = useContext(BreadcrumbContext);

  const config = useMemo(
    () => getSidebarLinks(location.pathname),
    [location.pathname]
  );

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
