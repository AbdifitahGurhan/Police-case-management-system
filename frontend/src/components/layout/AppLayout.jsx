// src/components/layout/AppLayout.jsx
'use client';

import React, { useState } from 'react';
import { Layout, ConfigProvider, App } from 'antd';
import Sidebar from './Sidebar';
import TopNavbar from './TopNavbar';
import policeTheme from '@/theme/theme';
import { useAuth } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';

const { Content } = Layout;

const AppLayout = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, loading } = useAuth();
  const pathname = usePathname();

  // Pages that don't use the sidebar layout (like login)
  const isAuthPage = pathname === '/login' || pathname === '/';

  if (isAuthPage) {
    return (
      <ConfigProvider theme={policeTheme}>
        <App>
          {children}
        </App>
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider theme={policeTheme}>
      <App>
        <Layout className="app-shell">
          <Sidebar collapsed={collapsed} />
          <Layout className={`app-main ${collapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}>
            <TopNavbar collapsed={collapsed} setCollapsed={setCollapsed} />
            <Content className="app-content">
              {children}
            </Content>
          </Layout>
        </Layout>
      </App>
    </ConfigProvider>
  );
};

export default AppLayout;
