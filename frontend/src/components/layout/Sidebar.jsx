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
    admin: 'Dawladda Dhexe',
    sub_admin: 'Maamule Hoosaad',
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
    court_clerk: 'Kalaarkha Maxkamadda',
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

    const stationOperationRoles = ['district_admin'];
    const commanderRoles = ['state_commander', 'region_commander', 'district_commander', 'police_station_commander'];
    const stationWorkflowRoles = ['ob_staff', 'staff', 'officer', 'investigator', 'district_admin', 'region_commander', 'district_commander', 'police_station_commander', 'cid', 'cid_director', 'cid_supervisor', 'cid_officer'];
    const courtRoles = ['court', 'court_admin', 'judge', 'prosecutor', 'prosecutor_liaison', 'court_clerk'];
    const cidRoles = ['cid', 'cid_director', 'cid_supervisor', 'cid_officer'];
    const isCourtRole = courtRoles.includes(role);
    // Role visibility aligned to Part 5 permission matrix
    const canViewOffenders = hasPermission('suspects.view') || hasPermission('suspects.manage');
    const canViewReports = hasPermission('reports.view') || hasPermission('reports.export');
    const canViewStations = hasPermission('stations.view') || hasPermission('stations.manage');

    const caseReadRoles = [
      'admin', 'sub_admin', 'officer', 'staff', 'investigator', 'station_jail', 'region_admin', 'district_admin',
      'cid', 'cid_director', 'cid_supervisor', 'cid_officer',
      'state_commander', 'region_commander', 'district_commander', 'police_station_commander',
      'prosecutor', 'judge', 'court_clerk', 'jail',
    ];
    const canViewCases = hasPermission('cases.view') || hasPermission('cases.investigate');
    const canViewOb = hasPermission('ob.view') || hasPermission('ob.create') || hasPermission('ob.update') || hasPermission('ob.print');
    const canViewStationJail = hasPermission('station_jail.view') || hasPermission('station_jail.intake') || hasPermission('station_jail.assign_cell');
    const canViewCentralJail = hasPermission('jail.view') || role === 'jail';

    const primaryItems = [
      ...(role !== 'personnel_registry' && role !== 'sub_admin' && dashboardPath !== '/cases' ? [{
        key: dashboardPath,
        icon: dashboardPath === '/ob-register' ? <DatabaseOutlined /> : <DashboardOutlined />,
        label: role === 'investigator' ? 'Hawlaha Baaraha' : (isCourtRole ? 'Dashboard-ka Maxkamadda' : (dashboardPath === '/ob-register' ? 'Diiwaanka OB-da' : 'Dashboard-ka Guud')),
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
          { key: 'central_jail_incoming_transfers', path: '/dashboard/central-jail', label: 'Incoming Transfers' },
        ],
      }] : []),
      ...(canViewCases ? [{
        key: '/search',
        icon: <SearchOutlined />,
        label: 'Raadinta Kiisaska',
      }] : []),
      ...(canViewCases ? [{
        key: '/cases',
        icon: <FileSearchOutlined />,
        label: 'Galal-kiiseedka (Cases)',
      }] : []),
      ...(canViewOb && dashboardPath !== '/ob-register' ? [{
        key: '/ob-register',
        icon: <DatabaseOutlined />,
        label: 'Diiwaanka OB-da',
      }] : []),
      ...(canViewOffenders && dashboardPath !== '/offenders' ? [{
        key: '/offenders',
        icon: <IdcardOutlined />,
        label: 'Dambiilayaasha & Eedeysanayaasha',
      }] : []),
      ...(hasPermission('warrants.view') ? [{
        key: '/warrants',
        icon: <FileDoneOutlined />,
        label: 'Waraaqaha Qabashada (Warrants)',
      }] : []),
    ];

    const adminMenus = [];

    if (hasPermission('users.manage')) adminMenus.push({ key: '/users', icon: <UserOutlined />, label: 'Maamulka Isticmaalayaasha' });
    if (hasPermission('permissions.manage') || hasPermission('roles.manage')) adminMenus.push({ key: '/permissions', icon: <SafetyCertificateOutlined />, label: 'Maamulka Awoodaha' });
    if (hasPermission('audit_logs.view')) adminMenus.push({ key: '/audit-logs', icon: <FileDoneOutlined />, label: 'Diiwaanka Hawlaha' });
    if (hasPermission('ranks.manage') || hasPermission('ranks.assign')) adminMenus.push({ key: '/ranks', icon: <StarOutlined />, label: 'Darajooyinka Booliska' });
    if (hasPermission('officers.view') || hasPermission('officers.create') || hasPermission('officers.approve')) adminMenus.push({ key: '/police-officers', icon: <TeamOutlined />, label: 'Saraakiisha Booliska' });
    if (canViewStations && !['region_admin', 'region_commander'].includes(role)) adminMenus.push({ key: '/stations', icon: <BankOutlined />, label: 'Xarumaha Boliiska' });
    if (role === 'admin') { adminMenus.push({ key: '/legal-personnel', icon: <TeamOutlined />, label: 'Garsoorayaasha & Xeer-ilaaliyaasha' }); adminMenus.push({ key: '/state-administrations', icon: <BankOutlined />, label: 'Maamul-goboleedyada' }); }
    if (['court','court_admin'].includes(role)) {
      adminMenus.push({ key: '/legal-personnel', icon: <TeamOutlined />, label: 'Garsoorayaasha & Xeer-ilaaliyaasha' });
    }

    if (canViewReports && role !== 'sub_admin') {
      adminMenus.push({
        key: 'reports_menu',
        icon: <BarChartOutlined />,
        label: 'Warbixinada Rasmiga Ah',
        children: [
          { key: '/reports', label: 'Dhammaan Warbixinada' },
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
          ...(canViewStations ? [{ key: '/stations', label: 'Xarumaha Boliiska' }] : []),
          { key: '/reports?section=station-performance', label: 'Warbixinada Saldhigga' },
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
      ...(primaryItems.length ? [{ key: 'main', title: 'Nidaamka Waaweyn', items: primaryItems }] : []),
      ...(adminMenus.length ? [{ key: 'administration', title: 'Maamulka & Hantida', items: adminMenus }] : []),
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
              <span>Somali Police Force</span>
              <small>Case Management System</small>
            </div>
          )}
        </div>

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
          <div className="police-sidebar-user">
            <Avatar className="police-sidebar-avatar">
              {(user?.full_name || user?.username || 'U').split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}
            </Avatar>
            {!collapsed && (
              <div className="police-sidebar-user-copy">
                <strong>{user?.full_name || user?.username || 'Isticmaale'}</strong>
                <span>{roleLabel}</span>
              </div>
            )}
          </div>
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
