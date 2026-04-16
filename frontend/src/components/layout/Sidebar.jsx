// src/components/layout/Sidebar.jsx
'use client';

import React from 'react';
import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  FileSearchOutlined,
  PlusCircleOutlined,
  UserOutlined,
  DatabaseOutlined,
  FileProtectOutlined,
  LogoutOutlined,
  EnvironmentOutlined,
  TeamOutlined,
  BankOutlined,
  ApartmentOutlined,
  StarOutlined
} from '@ant-design/icons';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const { Sider } = Layout;

const Sidebar = ({ collapsed }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  if (!user) return null;

  const getMenuItems = () => {
    const items = [
      {
        key: ['state_admin', 'region_admin', 'city_admin', 'district_admin', 'neighborhood_admin'].includes(user.role) 
          ? '/dashboard/unit' 
          : `/dashboard/${user.role}`,
        icon: <DashboardOutlined />,
        label: 'Dashboard',
      },
      {
        key: '/cases',
        icon: <FileSearchOutlined />,
        label: 'Cases List',
      },
    ];

    if (!['cid', 'prosecutor'].includes(user.role)) {
      items.push({
        key: '/cases/new',
        icon: <PlusCircleOutlined />,
        label: 'Register Case',
      });
    }

    const adminMenus = [];

    if (user.role === 'admin') {
      adminMenus.push({ key: '/users', icon: <UserOutlined />, label: 'System Users' });
      adminMenus.push({
        key: 'special_users',
        icon: <UserOutlined />,
        label: 'Special Users',
        children: [
          { key: '/special-users/admin', label: 'Admin Users' },
          { key: '/special-users/cid', label: 'CID Users' },
          { key: '/special-users/prosecutor', label: 'Prosecutor Users' },
          { key: '/special-users/court', label: 'Court Users' },
          { key: '/special-users/jail', label: 'Jail Users' },
        ],
      });
      adminMenus.push({ key: '/ranks', icon: <StarOutlined />, label: 'Ranks' });
      adminMenus.push({ key: '/state-administrations', icon: <BankOutlined />, label: 'State Admins' });
    }

    if (['admin', 'state_admin'].includes(user.role)) {
      adminMenus.push({ key: '/regions', icon: <ApartmentOutlined />, label: 'Regions' });
    }

    if (['admin', 'state_admin', 'region_admin'].includes(user.role)) {
      adminMenus.push({ key: '/cities', icon: <EnvironmentOutlined />, label: 'Cities' });
    }

    if (['admin', 'state_admin', 'region_admin', 'city_admin'].includes(user.role)) {
      adminMenus.push({ key: '/districts', icon: <EnvironmentOutlined />, label: 'Districts' });
    }

    if (['admin', 'state_admin', 'region_admin', 'city_admin', 'district_admin'].includes(user.role)) {
      adminMenus.push({ key: '/neighborhoods', icon: <EnvironmentOutlined />, label: 'Neighborhoods' });
    }

    if (['admin', 'state_admin', 'region_admin', 'city_admin', 'district_admin'].includes(user.role)) {
      adminMenus.push({ key: '/police-officers', icon: <TeamOutlined />, label: 'Police Officers' });
    }

    if (adminMenus.length > 0) {
      items.push({
        key: 'administration',
        icon: <BankOutlined />,
        label: 'Administration',
        children: adminMenus
      });
    }

    items.push(
      {
        key: '/evidence',
        icon: <DatabaseOutlined />,
        label: 'Evidence',
      },
      {
        key: '/reports',
        icon: <FileProtectOutlined />,
        label: 'Reports',
      },
      { type: 'divider' },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: 'Logout',
        danger: true,
      }
    );

    return items;
  };

  const handleMenuClick = ({ key }) => {
    if (key === 'logout') {
      logout();
    } else if (key !== 'administration') {
      router.push(key);
    }
  };

  return (
    <Sider trigger={null} collapsible collapsed={collapsed} width={260} style={{ height: '100vh', position: 'fixed', left: 0, top: 0, bottom: 0 }}>
      <div style={{ padding: '16px', color: '#fff', fontSize: '18px', fontWeight: 'bold', textAlign: 'center', background: '#002140', marginBottom: '8px' }}>
        {collapsed ? 'CMS' : 'POLICE CMS'}
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[pathname]}
        items={getMenuItems()}
        onClick={handleMenuClick}
      />
    </Sider>
  );
};

export default Sidebar;
