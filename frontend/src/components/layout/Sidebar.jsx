// src/components/layout/Sidebar.jsx
'use client';

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import { Input, Layout, Menu, Tag, Tooltip } from 'antd';
import {
  DashboardOutlined,
  FileSearchOutlined,
  PlusCircleOutlined,
  UserOutlined,
  DatabaseOutlined,
  LogoutOutlined,
  EnvironmentOutlined,
  TeamOutlined,
  BankOutlined,
  ApartmentOutlined,
  StarOutlined,
  SearchOutlined,
  BarChartOutlined,
  IdcardOutlined,
} from '@ant-design/icons';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const { Sider } = Layout;

const Sidebar = ({ collapsed }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [query, setQuery] = useState('');

  const role = user?.role;
  const dashboardPathMap = {
    admin: '/dashboard/admin',
    officer: '/dashboard/officer',
    ward_commander: '/dashboard/ward_commander',
    cid: '/dashboard/cid',
    state_admin: '/dashboard/unit',
    region_admin: '/dashboard/unit',
    city_admin: '/dashboard/unit',
    district_admin: '/dashboard/unit',
    neighborhood_admin: '/dashboard/unit',
    state_commander: '/dashboard/unit',
    region_commander: '/dashboard/unit',
    district_commander: '/dashboard/unit',
    police_station_commander: '/dashboard/unit',
    waax_commander: '/dashboard/unit',
    ob_staff: '/cases',
    staff: '/cases',
    court: '/dashboard/court',
    jail: '/dashboard/jail',
  };
  const dashboardPath = dashboardPathMap[role] || '/cases';

  const roleNames = {
    admin: 'Administrator',
    officer: 'Officer',
    ward_commander: 'Station Commander',
    cid: 'CID',
    court: 'Court',
    jail: 'Jail',
    state_admin: 'State Admin',
    region_admin: 'Region Admin',
    city_admin: 'City Admin',
    district_admin: 'District Admin',
    neighborhood_admin: 'Neighborhood Admin',
    state_commander: 'State Commander',
    region_commander: 'Region Commander',
    district_commander: 'District Commander',
    police_station_commander: 'Police Station Commander',
    waax_commander: 'Waax Commander',
    ob_staff: 'OB Staff',
    staff: 'Staff',
  };
  const roleLabel = roleNames[role] || 'Isticmaale';

  const sections = useMemo(() => {
    if (!role) return [];

    const stationOperationRoles = ['district_admin', 'neighborhood_admin'];
    const commanderRoles = ['state_commander', 'region_commander', 'district_commander', 'police_station_commander', 'waax_commander'];
    const canRegisterCase = ['admin', 'officer', ...stationOperationRoles].includes(role);
    const canViewOffenders = ['admin', 'officer', 'cid', 'court', 'jail', 'staff', ...commanderRoles, ...stationOperationRoles].includes(role);
    const canViewEvidence = ['admin', 'officer', 'cid', 'court', 'jail', 'staff', ...stationOperationRoles].includes(role);
    const canViewReports = ['admin', 'region_admin', 'officer', 'cid', 'court', 'jail', ...commanderRoles, ...stationOperationRoles].includes(role);

    const primaryItems = [
      {
        key: dashboardPath,
        icon: <DashboardOutlined />,
        label: 'Dashboard',
      },
      {
        key: '/search',
        icon: <SearchOutlined />,
        label: 'Search',
      },
      {
        key: '/cases',
        icon: <FileSearchOutlined />,
        label: 'Cases',
      },
      ...(canViewOffenders ? [{
        key: '/offenders',
        icon: <IdcardOutlined />,
        label: 'Offenders',
      }] : []),
    ];

    if (canRegisterCase) {
      primaryItems.push({
        key: '/cases/new',
        icon: <PlusCircleOutlined />,
        label: 'Register Case',
      });
    }

    const adminMenus = [];

    if (role === 'admin') {
      adminMenus.push({ key: '/users', icon: <UserOutlined />, label: 'User Role Management' });
      adminMenus.push({
        key: 'special_users',
        icon: <UserOutlined />,
        label: 'Special Users',
        children: [
          { key: '/special-users/admin', label: 'Administrators' },
          { key: '/special-users/cid', label: 'CID' },
          { key: '/special-users/court', label: 'Court' },
          { key: '/special-users/jail', label: 'Jail' },
        ],
      });
      adminMenus.push({ key: '/ranks', icon: <StarOutlined />, label: 'Ranks' });
      adminMenus.push({ key: '/state-administrations', icon: <BankOutlined />, label: 'State Administrations' });
    }

    if (canViewReports) {
      adminMenus.push({
        key: 'reports_menu',
        icon: <BarChartOutlined />,
        label: 'Reports',
        children: [
          { key: '/reports', label: 'All Reports' },
        ],
      });
    }

    if (role === 'region_admin') {
      adminMenus.push({
        key: 'region_police_stations',
        icon: <BankOutlined />,
        label: 'Police Stations',
        children: [
          { key: '/stations', label: 'District Stations' },
          { key: '/reports?section=station-performance', label: 'Station Reports' },
        ],
      });
      adminMenus.push({
        key: 'region_waax_stations',
        icon: <EnvironmentOutlined />,
        label: 'Waax Police Stations',
        children: [
          { key: '/neighborhoods', label: 'Waax Stations' },
          { key: '/reports?section=waax-performance', label: 'Waax Reports' },
        ],
      });
      adminMenus.push({ key: '/police-officers', icon: <TeamOutlined />, label: 'Police Officers' });
    }

    if (['admin', 'state_admin'].includes(role)) {
      adminMenus.push({ key: '/regions', icon: <ApartmentOutlined />, label: 'Regions' });
    }

    if (role === 'admin') {
      adminMenus.push({ key: '/cities', icon: <EnvironmentOutlined />, label: 'Cities' });
    }

    if (role === 'admin') {
      adminMenus.push({ key: '/districts', icon: <EnvironmentOutlined />, label: 'Districts' });
    }

    if (['admin', 'state_admin', 'city_admin'].includes(role)) {
      adminMenus.push({ key: '/stations', icon: <EnvironmentOutlined />, label: 'District Stations' });
    }

    if (['admin', 'state_admin', 'city_admin', 'district_admin'].includes(role)) {
      adminMenus.push({ key: '/neighborhoods', icon: <EnvironmentOutlined />, label: 'Neighborhood Stations' });
    }

    if (['admin', 'state_admin', 'city_admin', 'district_admin'].includes(role)) {
      adminMenus.push({ key: '/police-officers', icon: <TeamOutlined />, label: 'Police Officers' });
    }

    return [
      { key: 'main', title: 'Main', items: primaryItems },
      ...(adminMenus.length ? [{ key: 'administration', title: 'Administration', items: adminMenus }] : []),
    ];
  }, [dashboardPath, role]);

  const allNavigableItems = useMemo(() => {
    const flatten = (items) => items.flatMap((item) => item.children ? [item, ...flatten(item.children)] : [item]);
    return sections.flatMap((section) => flatten(section.items));
  }, [sections]);

  const selectedKey = useMemo(() => {
    const exact = allNavigableItems.find((item) => item.key === pathname);
    if (exact) return exact.key;

    const prefixMatch = allNavigableItems
      .filter((item) => pathname.startsWith(`${item.key}/`))
      .sort((a, b) => b.key.length - a.key.length)[0];

    return prefixMatch?.key || dashboardPath;
  }, [allNavigableItems, dashboardPath, pathname]);

  const filteredSections = useMemo(() => {
    const normalize = (value) => String(value || '').toLowerCase();
    const needle = normalize(query);

    if (!needle) return sections;

    const filterItems = (items) => items
      .map((item) => {
        const children = item.children ? filterItems(item.children) : undefined;
        const matches = normalize(item.label).includes(needle);
        if (matches || children?.length) {
          return { ...item, children };
        }
        return null;
      })
      .filter(Boolean);

    return sections
      .map((section) => ({ ...section, items: filterItems(section.items) }))
      .filter((section) => section.items.length > 0);
  }, [query, sections]);

  if (!user) return null;

  const handleMenuClick = ({ key }) => {
    if (key === 'logout') {
      logout();
    } else {
      router.push(key);
    }
  };

  return (
    <Sider
      className="police-sidebar"
      trigger={null}
      collapsible
      collapsed={collapsed}
      collapsedWidth={80}
      width={260}
    >
      <div className="police-sidebar-shell">
        <div className="police-sidebar-brand">
          <div className="police-sidebar-mark">
            <Image
              src="/somali-police-logo.png"
              alt="Somali Police Force logo"
              width={35}
              height={28}
              priority
            />
          </div>
          {!collapsed && (
            <div className="police-sidebar-brand-copy">
              <span>Somali Police Force</span>
              <small>Case Management System</small>
            </div>
          )}
        </div>

        {!collapsed && (
          <div className="police-sidebar-role">
            <span>You are signed in as</span>
            <Tag color="blue">{roleLabel}</Tag>
          </div>
        )}

        <div className="police-sidebar-search">
          {collapsed ? (
            <Tooltip title="Search menu" placement="right">
              <div className="police-sidebar-search-icon">
                <SearchOutlined />
              </div>
            </Tooltip>
          ) : (
            <Input
              prefix={<SearchOutlined />}
              placeholder="Search menu..."
              variant="borderless"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              allowClear
            />
          )}
        </div>

        <div className="police-sidebar-menu">
          {filteredSections.map((section) => (
            <div className="police-sidebar-section" key={section.key}>
              {!collapsed && <div className="police-sidebar-section-title">{section.title}</div>}
              <Menu
                theme="dark"
                mode="inline"
                inlineCollapsed={collapsed}
                selectedKeys={[selectedKey]}
                items={section.items}
                onClick={handleMenuClick}
              />
            </div>
          ))}
        </div>

        <div className="police-sidebar-footer">
          <Tooltip title={collapsed ? 'Logout' : ''} placement="right">
            <button type="button" className="police-sidebar-logout" onClick={logout}>
              <LogoutOutlined />
              {!collapsed && <span>Logout</span>}
            </button>
          </Tooltip>
        </div>
      </div>
    </Sider>
  );
};

export default Sidebar;
