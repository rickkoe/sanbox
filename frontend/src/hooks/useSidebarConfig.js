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
  Building2,
  FolderOpen,
  Wrench,
  Type,
  Calculator,
  Cable,
  Layout,
  Terminal,
  Upload,
  FileSpreadsheet,
  Router,
  History,
  Database,
} from "lucide-react";

const getSidebarLinks = (pathname, storageType) => {

  // Only use layered navigation for individual storage system detail pages
  if (pathname.startsWith("/storage/")) {
    const storageIdMatch = pathname.match(/^\/storage\/(\d+)/);
    if (storageIdMatch) {
      // Build Volumes subLinks - LSS Summary only for DS8000
      const volumeSubLinks = [
        {
          path: `/storage/${storageIdMatch[1]}/volumes`,
          label: "Volumes",
          icon: Archive,
        },
        {
          path: `/storage/${storageIdMatch[1]}/volume-ranges`,
          label: "Volume Ranges",
          icon: Layers,
        },
        {
          path: `/storage/${storageIdMatch[1]}/volume-mappings`,
          label: "Volume Mappings",
          icon: GitBranch,
        },
      ];

      // Add LSS Summary only for DS8000 storage systems
      if (storageType === 'DS8000') {
        volumeSubLinks.push({
          path: `/storage/${storageIdMatch[1]}/lss-summary`,
          label: "LSS Summary",
          icon: Layers,
        });
      }

      return {
        header: "Storage System",
        icon: Menu,
        storageId: storageIdMatch[1],
        showBackButton: true,
        backPath: "/storage",
        showHeaderInNav: true, // Show the dynamic header at the top of nav links
        links: [
          {
            path: `/storage/${storageIdMatch[1]}`,
            label: "Properties",
            icon: Server,
          },
          {
            path: `/storage/${storageIdMatch[1]}/pools`,
            label: "Pools",
            icon: Database,
          },
          {
            label: "Volumes",
            icon: Archive,
            expandable: true,
            subLinks: volumeSubLinks,
          },
          {
            label: "Hosts",
            icon: Monitor,
            expandable: true,
            subLinks: [
              {
                path: `/storage/${storageIdMatch[1]}/hosts`,
                label: "Hosts",
                icon: Monitor,
              },
              {
                path: `/storage/${storageIdMatch[1]}/host-clusters`,
                label: "Host Clusters",
                icon: Users,
              },
              {
                path: `/storage/${storageIdMatch[1]}/ibmi-lpars`,
                label: "IBM i LPARs",
                icon: Layers,
              },
            ],
          },
          {
            path: `/storage/${storageIdMatch[1]}/ports`,
            label: "Ports",
            icon: Cable,
          },
          { divider: true },
          {
            path: `/storage/${storageIdMatch[1]}/scripts`,
            label: "Storage Scripts",
            icon: Terminal,
          },
        ],
      };
    }
  }

  // For all other pages, show the expandable main menu
  return {
    header: "",
    icon: Menu,
    links: [
      { 
        path: "/", 
        label: "Dashboard", 
        icon: Layout 
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
        label: "SAN",
        icon: Network,
        expandable: true,
        subLinks: [
          { path: "/san/fabrics", label: "Fabrics", icon: GitBranch },
          { path: "/san/switches", label: "Switches", icon: Router },
          { path: "/san/aliases", label: "Aliases", icon: Tags },
          { path: "/san/zones", label: "Zones", icon: Layers },
        ]
      },
      {
        path: "/storage",
        label: "Storage Systems",
        icon: HardDrive
      },
      { 
        label: "Scripts", 
        icon: Terminal, 
        expandable: true,
        subLinks: [
          { path: "/scripts/zoning", label: "SAN Scripts", icon: Terminal },
          { path: "/scripts/storage", label: "Storage Scripts", icon: Terminal },
        ]
      },
      {
        label: "Data Import",
        icon: Upload,
        expandable: true,
        subLinks: [
          { path: "/import/universal", label: "Universal Importer", icon: Upload },
          { path: "/import/monitor", label: "Import History", icon: History },
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
          { path: "/tools/doc-builder", label: "Doc Builder", icon: FileSpreadsheet },
        ]
      },
    ],
  };
};

export const useSidebarConfig = () => {
  const location = useLocation();
  const { breadcrumbMap, storageTypeMap } = useContext(BreadcrumbContext);

  // Get storage ID from pathname for storage detail pages
  const storageIdMatch = location.pathname.match(/^\/storage\/(\d+)/);
  const storageId = storageIdMatch ? storageIdMatch[1] : null;
  const storageType = storageId ? storageTypeMap[storageId] : null;

  const config = useMemo(
    () => getSidebarLinks(location.pathname, storageType),
    [location.pathname, storageType]
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
