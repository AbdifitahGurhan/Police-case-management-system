// src/components/layout/AppLayout.jsx
'use client';

import React, { useState } from 'react';
import { Layout, ConfigProvider, App } from 'antd';
import Sidebar from './Sidebar';
import TopNavbar from './TopNavbar';
import { lightTheme, darkTheme } from '@/theme/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { usePathname } from 'next/navigation';

const { Content } = Layout;

const AppLayout = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  const pathname = usePathname();

  // Pages that don't use the sidebar layout (like login)
  const isAuthPage = pathname === '/login' || pathname === '/';

  const currentTheme = theme === 'dark' ? darkTheme : lightTheme;

  if (isAuthPage) {
    return (
      <ConfigProvider theme={currentTheme}>
        <App>
          {children}
        </App>
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider theme={currentTheme}>
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
