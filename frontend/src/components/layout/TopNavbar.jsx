// src/components/layout/TopNavbar.jsx
'use client';

import React from 'react';
import { Layout, Button, Avatar, Dropdown, Space, Typography, Tag } from 'antd';
import {
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  UserOutlined,
  LogoutOutlined,
  BellOutlined
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';

const { Header } = Layout;
const { Text } = Typography;

const TopNavbar = ({ collapsed, setCollapsed }) => {
  const { user, logout } = useAuth();

  if (!user) return null;

  const roleColors = {
    admin: 'magenta',
    officer: 'blue',
    cid: 'purple',
    prosecutor: 'gold'
  };

  const menuItems = [
    {
      key: 'profile',
      label: 'My Profile',
      icon: <UserOutlined />,
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      label: 'Logout',
      icon: <LogoutOutlined />,
      danger: true,
      onClick: logout
    },
  ];

  return (
    <Header style={{ padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, zIndex: 1, width: '100%' }}>
      <Button
        type="text"
        icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        onClick={() => setCollapsed(!collapsed)}
        style={{ fontSize: '16px', width: 64, height: 64 }}
      />
      
      <Space size="large">
        <Button type="text" icon={<BellOutlined />} style={{ fontSize: '18px' }} />
        
        <Dropdown menu={{ items: menuItems }} placement="bottomRight">
          <Space style={{ cursor: 'pointer' }}>
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
              <Text strong style={{ lineHeight: '1.2' }}>{user.fullName}</Text>
              <Tag color={roleColors[user.role] || 'default'} style={{ margin: 0, fontSize: '10px', height: '16px', lineHeight: '14px', alignSelf: 'flex-end' }}>
                {user.role?.toUpperCase()}
              </Tag>
            </div>
            <Avatar style={{ backgroundColor: '#1677ff' }} icon={<UserOutlined />} />
          </Space>
        </Dropdown>
      </Space>
    </Header>
  );
};

export default TopNavbar;
