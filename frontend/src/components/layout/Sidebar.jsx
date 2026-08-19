// src/components/layout/Sidebar.jsx
'use client';

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import { Avatar, Input, Layout, Menu, Tooltip } from 'antd';
import {
  DashboardOutlined,
  FileSearchOutlined,
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
  FileDoneOutlined,
  SafetyCertificateOutlined,
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
    admin: '/dashboard/operations',
    sub_admin: '/police-officers',
    personnel_registry: '/police-officers',
    investigator: '/dashboard/investigator',
    station_jail: '/dashboard/jail',
    officer: '/dashboard/officer',
    cid: '/dashboard/cid',
    cid_director: '/dashboard/cid',
    cid_supervisor: '/dashboard/cid',
    cid_officer: '/dashboard/cid',
    state_admin: '/dashboard/operations',
    region_admin: '/dashboard/operations',
    district_admin: '/dashboard/operations',
    state_commander: '/dashboard/operations',
    region_commander: '/dashboard/operations',
    district_commander: '/dashboard/operations',
    police_station_commander: '/dashboard/operations',
    ob_staff: '/ob-register',
    staff: '/cases',
    court: '/dashboard/court',
    court_admin: '/dashboard/court',
    judge: '/dashboard/court',
    prosecutor: '/dashboard/court',
    prosecutor_liaison: '/dashboard/cid',
    court_clerk: '/dashboard/court',
    jail: '/dashboard/central-jail',
  };
  const dashboardPath = dashboardPathMap[role] || '/cases';

  const roleNames = {
    admin: 'Dawladda Dhexe (Taliska Guud)',
    sub_admin: 'Maamul Hoose (Sub-Admin)',
    personnel_registry: 'Diiwaanka Ciidanka',
    investigator: 'Baare',
    station_jail: 'Xabsiga Saldhigga',
    officer: 'Sarkaalka Booliska',
    cid: 'Baaraha CID-da',
    cid_director: 'Agaasimaha CID-da',
    cid_supervisor: 'Kormeeraha CID-da',
    cid_officer: 'Baaraha CID-da',
    court: 'Maxkamadda',
    court_admin: 'Maamulaha Maxkamadda',
    judge: 'Garsoore',
    prosecutor: 'Xeer-ilaaliye',
    prosecutor_liaison: 'Liaison-ka Xeer-ilaalinta',
    court_clerk: 'Kaaliyaha Maxkamadda',
    jail: 'Maamulka Xabsiga Dhexe',
    state_admin: 'Maamulaha Dawlad Goboleedka',
    region_admin: 'Maamulaha Gobolka',
    district_admin: 'Maamulaha Degmada',
    state_commander: 'Taliyaha Dawlad Goboleedka',
    region_commander: 'Taliyaha Gobolka',
    district_commander: 'Taliyaha Degmada',
    police_station_commander: 'Taliyaha Saldhigga Booliska',
    ob_staff: 'Diiwaangeliyaha OB-da',
    staff: 'Shaqaalaha Hawlgalka',
  };
  const roleLabel = roleNames[role] || 'Isticmaale';

  const sections = useMemo(() => {
    if (!role) return [];
    const hasPermission = key => role === 'admin' || (user?.permissions || []).includes('*') || (user?.permissions || []).includes(key);

    const courtRoles = ['court', 'court_admin', 'judge', 'prosecutor', 'prosecutor_liaison', 'court_clerk'];
    const isCourtRole = courtRoles.includes(role);
    const canViewOffenders = hasPermission('suspects.view') || hasPermission('suspects.manage');
    const canViewReports = hasPermission('reports.view') || hasPermission('reports.export');
    const canViewStations = hasPermission('stations.view') || hasPermission('stations.manage');
    const canViewCases = hasPermission('cases.view') || hasPermission('cases.investigate');
    const canViewOb = hasPermission('ob.view') || hasPermission('ob.create') || hasPermission('ob.update') || hasPermission('ob.print');
    const canViewStationJail = hasPermission('station_jail.view') || hasPermission('station_jail.intake') || hasPermission('station_jail.assign_cell');
    const canViewCentralJail = hasPermission('jail.view') || role === 'jail';

    const primaryItems = [
      ...(role !== 'personnel_registry' && role !== 'sub_admin' && dashboardPath !== '/cases' ? [{
        key: dashboardPath,
        icon: dashboardPath === '/ob-register' ? <DatabaseOutlined /> : <DashboardOutlined />,
        label: role === 'investigator' ? 'Hawlaha Baaraha' : (isCourtRole ? 'Dashboard-ka Maxkamadda' : (dashboardPath === '/ob-register' ? 'Diiwaanka OB-da' : 'Bogga Hore ee Hawlgalka')),
      }] : []),
      ...(role === 'district_admin' && hasPermission('cases.view') && dashboardPath !== '/dashboard/cid' ? [{
        key: '/dashboard/cid',
        icon: <FileSearchOutlined />,
        label: 'Hawlaha Baaritaanka',
      }] : []),
      ...(isCourtRole ? [{
        key: '/dashboard/court/cases',
        icon: <BankOutlined />,
        label: 'Kiisaska Maxkamadda',
      }, {
        key: '/dashboard/court/search',
        icon: <FileSearchOutlined />,
        label: 'Baaritaan Dheeraad Ah',
      }] : []),
      ...(canViewStationJail ? [{
        key: 'station_jail_operations',
        icon: <BankOutlined />,
        label: 'Xabsiga Saldhigga',
        children: [
          { key: '/dashboard/jail/admissions', label: 'Maxaabiista Hadda Ku Jira' },
          ...(hasPermission('station_jail.intake') ? [{ key: '/dashboard/jail?action=admit', label: 'Qaabilaadda Xabsiga' }] : []),
          ...(hasPermission('station_jail.assign_cell') ? [{ key: '/dashboard/jail?action=capacity', label: 'Awoodda Seliyaasha' }] : []),
          ...(hasPermission('station_jail.intake') ? [{ key: '/dashboard/jail?action=bulk_roll', label: 'Tirada Maafada Maalinlaha' }] : []),
        ],
      }] : []),
      ...(canViewCentralJail ? [{
        key: 'central_jail_operations',
        icon: <SafetyCertificateOutlined />,
        label: 'Xabsiga Dhexe',
        children: [
          { key: 'central_jail_incoming_transfers', path: '/dashboard/central-jail', label: 'Maxaabiista la Soo Wareejiyey' },
        ],
      }] : []),
      ...(canViewCases ? [{
        key: '/search',
        icon: <SearchOutlined />,
        label: 'Raadinta Guud ee Kiisaska',
      }] : []),
      ...(canViewCases ? [{
        key: '/cases',
        icon: <FileSearchOutlined />,
        label: 'Kiisaska Dacwadaha',
      }] : []),
      ...(canViewOb && dashboardPath !== '/ob-register' ? [{
        key: '/ob-register',
        icon: <DatabaseOutlined />,
        label: 'Diiwaanka OB-da',
      }] : []),
      ...(canViewOffenders && dashboardPath !== '/offenders' ? [{
        key: '/offenders',
        icon: <IdcardOutlined />,
        label: 'Eedeysanayaasha & Dambiilayaasha',
      }] : []),
      ...(hasPermission('warrants.view') ? [{
        key: '/warrants',
        icon: <FileDoneOutlined />,
        label: 'Waaranada Qabashada & Baarista',
      }] : []),
    ];

    const adminMenus = [];

    if (hasPermission('users.manage')) adminMenus.push({ key: '/users', icon: <UserOutlined />, label: 'Maamulka Isticmaalayaasha' });
    if (hasPermission('permissions.manage') || hasPermission('roles.manage')) adminMenus.push({ key: '/permissions', icon: <SafetyCertificateOutlined />, label: 'Maamulka Awoodaha' });
    if (hasPermission('audit_logs.view')) adminMenus.push({ key: '/audit-logs', icon: <FileDoneOutlined />, label: 'Diiwaanka Raadraaca Hawlaha' });
    if (hasPermission('ranks.manage') || hasPermission('ranks.assign')) adminMenus.push({ key: '/ranks', icon: <StarOutlined />, label: 'Darajooyinka Booliska' });
    if (hasPermission('officers.view') || hasPermission('officers.create') || hasPermission('officers.approve')) adminMenus.push({ key: '/police-officers', icon: <TeamOutlined />, label: 'Saraakiisha Booliska' });
    if (canViewStations && !['region_admin', 'region_commander'].includes(role)) adminMenus.push({ key: '/stations', icon: <BankOutlined />, label: 'Saldhigyada Booliska' });
    if (role === 'admin') { adminMenus.push({ key: '/legal-personnel', icon: <TeamOutlined />, label: 'Garsoorayaasha & Xeer-ilaaliyaasha' }); adminMenus.push({ key: '/state-administrations', icon: <BankOutlined />, label: 'Dawlad Goboleedyada' }); }
    if (['court','court_admin'].includes(role)) {
      adminMenus.push({ key: '/legal-personnel', icon: <TeamOutlined />, label: 'Garsoorayaasha & Xeer-ilaaliyaasha' });
    }

    if (canViewReports && role !== 'sub_admin') {
      adminMenus.push({
        key: 'reports_menu',
        icon: <BarChartOutlined />,
        label: 'Warbixinnada Rasmiga ah',
        children: [
          { key: '/reports', label: 'Dhammaan Warbixinnada' },
        ],
      });
    }

    if (['region_admin', 'region_commander'].includes(role)) {
      adminMenus.push({
        key: 'region_police_stations',
        icon: <BankOutlined />,
        label: 'Saldhigyada Booliska',
        children: [
          { key: '/districts', label: 'Degmooyinka' },
          ...(canViewStations ? [{ key: '/stations', label: 'Saldhigyada Booliska' }] : []),
          { key: '/reports?section=station-performance', label: 'Waxqabadka Saldhigga' },
        ],
      });
    }

    if (['admin', 'state_admin'].includes(role)) {
      adminMenus.push({ key: '/regions', icon: <ApartmentOutlined />, label: 'Gobollada' });
    }

    if (role === 'admin') {
      adminMenus.push({ key: '/districts', icon: <EnvironmentOutlined />, label: 'Degmooyinka' });
    }

    return [
      ...(primaryItems.length ? [{ key: 'main', title: 'Qaybaha Hawlgalka', items: primaryItems }] : []),
      ...(adminMenus.length ? [{ key: 'administration', title: 'Maamulka & Nidaamka', items: adminMenus }] : []),
    ];
  }, [dashboardPath, role, user]);

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
      const item = allNavigableItems.find((entry) => entry.key === key);
      router.push(item?.path || key);
    }
  };

  return (
    <Sider
      className="police-sidebar"
      trigger={null}
      collapsible
      collapsed={collapsed}
      collapsedWidth={64}
      width={252}
    >
      <div className="police-sidebar-shell">
        <div className="police-sidebar-brand">
          <div className="police-sidebar-mark">
            <Image
              src="/somali-police-logo.png"
              alt="Somali Police Force logo"
              width={58}
              height={58}
              priority
            />
          </div>
          {!collapsed && (
            <div className="police-sidebar-brand-copy">
              <span>Ciidanka Booliska</span>
              <small>Nidaamka Maamulka Dacwadaha</small>
            </div>
          )}
        </div>

        <div className="police-sidebar-search">
          {collapsed ? (
            <Tooltip title="Raadi qaybaha" placement="right">
              <div className="police-sidebar-search-icon">
                <SearchOutlined />
              </div>
            </Tooltip>
          ) : (
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Raadi qaybaha menu-ga..."
              prefix={<SearchOutlined />}
              allowClear
              className="police-sidebar-search-input"
            />
          )}
        </div>

        <div className="police-sidebar-nav">
          {filteredSections.map((section) => (
            <div key={section.key} className="police-sidebar-section">
              {!collapsed && section.title && (
                <div className="police-sidebar-section-title">{section.title}</div>
              )}
              <Menu
                mode="inline"
                selectedKeys={[selectedKey]}
                onClick={handleMenuClick}
                items={section.items}
                className="police-sidebar-menu"
                inlineIndent={16}
              />
            </div>
          ))}
        </div>

        <div className="police-sidebar-footer">
          <div className="police-sidebar-user">
            <Avatar icon={<UserOutlined />} className="police-sidebar-user-avatar" />
            {!collapsed && (
              <div className="police-sidebar-user-copy">
                <span className="police-sidebar-user-name">
                  {user.fullName || user.username}
                </span>
                <span className="police-sidebar-user-role">{roleLabel}</span>
              </div>
            )}
          </div>
          <button
            type="button"
            className="police-sidebar-logout"
            onClick={logout}
            title="Ka bax nidaamka"
          >
            <LogoutOutlined />
            {!collapsed && <span>Ka Bax</span>}
          </button>
        </div>
      </div>
    </Sider>
  );
};

export default Sidebar;
