// src/components/layout/TopNavbar.jsx
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Layout, Button, Avatar, Dropdown, Space, Typography, Tag, Modal, Upload, App as AntApp, Form, Input, Divider, Badge, Empty, Spin, Tooltip } from 'antd';
import {
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  UserOutlined,
  LogoutOutlined,
  BellOutlined,
  CameraOutlined,
  UploadOutlined,
  CheckOutlined,
  FileTextOutlined,
  SafetyOutlined,
  AuditOutlined,
  AlertOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { emailRule, nameRules, optionalPasswordRules, usernameRules } from '@/utils/validation';

const { Header } = Layout;
const { Text } = Typography;

// ─── Notification helpers ───────────────────────────────────────────────────

const typeIcon = (type = '') => {
  if (type.startsWith('CID'))    return <SafetyOutlined  style={{ color: '#7c3aed' }} />;
  if (type.startsWith('audit'))  return <AuditOutlined   style={{ color: '#0284c7' }} />;
  if (type.includes('CASE'))     return <FileTextOutlined style={{ color: '#0891b2' }} />;
  if (type.includes('ALERT'))    return <AlertOutlined   style={{ color: '#dc2626' }} />;
  return                                <ClockCircleOutlined style={{ color: '#6b7280' }} />;
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Notification Dropdown Content ──────────────────────────────────────────

function NotificationPanel({ notifications, loading, onMarkAllRead, unreadCount }) {
  return (
    <div className="notification-popover">
      {/* Header */}
      <div className="notification-popover-header">
        <Space>
          <Text strong style={{ fontSize: 14 }}>Notifications</Text>
          {unreadCount > 0 && (
            <Tag color="blue" style={{ borderRadius: 99, margin: 0 }}>{unreadCount} new</Tag>
          )}
        </Space>
        {unreadCount > 0 && (
          <Tooltip title="Mark all as read">
            <Button
              type="text"
              size="small"
              icon={<CheckOutlined />}
              onClick={onMarkAllRead}
              style={{ color: '#2563eb', fontSize: 12 }}
            >
              Mark all read
            </Button>
          </Tooltip>
        )}
      </div>

      {/* Body */}
      <div className="notification-list">
        {loading && notifications.length === 0 ? (
          <div className="notification-loading">
            <Spin size="small" />
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: '32px 0' }}>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No recent activity" />
          </div>
        ) : (
          notifications.map((item) => (
            <div
              className={`notification-item${item.is_read ? '' : ' notification-item--unread'}`}
              key={item.id || `${item.type}-${item.created_at}`}
            >
              <div className="notification-item-icon">
                {typeIcon(item.type)}
              </div>
              <div className="notification-item-body">
                <Text strong style={{ fontSize: 13, display: 'block', lineHeight: '1.4' }}>
                  {item.title}
                </Text>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', lineHeight: '1.4' }}>
                  {item.message}
                </Text>
                <Text type="secondary" style={{ fontSize: 11, marginTop: 2, display: 'block' }}>
                  {timeAgo(item.created_at)}
                </Text>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="notification-popover-footer">
          <Text type="secondary" style={{ fontSize: 12 }}>
            Showing {notifications.length} recent event{notifications.length !== 1 ? 's' : ''}
          </Text>
        </div>
      )}
    </div>
  );
}

// ─── Main TopNavbar ──────────────────────────────────────────────────────────

const TopNavbar = ({ collapsed, setCollapsed }) => {
  const { user, logout, updateUser } = useAuth();
  const { message } = AntApp.useApp();
  const [profileForm] = Form.useForm();
  const [profileOpen, setProfileOpen] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Notification state
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState(new Set());
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const timerRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    setNotificationLoading(true);
    try {
      const response = await api.get('/notifications', { params: { limit: 15 } });
      setNotifications(response.data.data || []);
    } catch (error) {
      console.error('Notifications failed to load', error);
    } finally {
      setNotificationLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    timerRef.current = setInterval(fetchNotifications, 60000);
    return () => clearInterval(timerRef.current);
  }, [user, fetchNotifications]);

  // When dropdown opens, refresh and mark visible items as read
  const handleDropdownOpenChange = (open) => {
    setDropdownOpen(open);
    if (open) {
      fetchNotifications();
      // Mark current notifications as read locally
      setReadIds((prev) => {
        const next = new Set(prev);
        notifications.forEach((n) => n.id && next.add(n.id));
        return next;
      });
    }
  };

  const handleMarkAllRead = () => {
    setReadIds((prev) => {
      const next = new Set(prev);
      notifications.forEach((n) => n.id && next.add(n.id));
      return next;
    });
  };

  const enrichedNotifications = notifications.map((n) => ({
    ...n,
    is_read: readIds.has(n.id) ? 1 : n.is_read,
  }));

  const unreadCount = enrichedNotifications.filter((n) => !n.is_read).length;

  if (!user) return null;

  const apiOrigin = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api').replace(/\/api\/?$/, '');
  const profileImageUrl = user.profileImage ? `${apiOrigin}${user.profileImage}` : null;
  const displayName = user.fullName || user.username || 'User';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  const roleColors = {
    admin: 'magenta',
    officer: 'blue',
    cid: 'purple',
    cid_director: 'purple',
    cid_supervisor: 'purple',
    cid_officer: 'purple',
    court: 'cyan',
    court_admin: 'cyan',
    judge: 'geekblue',
    prosecutor: 'gold',
    prosecutor_liaison: 'gold',
    court_clerk: 'lime',
    jail: 'volcano'
  };

  const menuItems = [
    {
      key: 'profile',
      label: 'My Profile',
      icon: <UserOutlined />,
      onClick: () => {
        profileForm.setFieldsValue({
          full_name: user.fullName,
          username: user.username,
          email: user.email,
          password: '',
          confirm_password: '',
        });
        setProfileOpen(true);
      },
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

  const uploadProps = {
    accept: 'image/*',
    maxCount: 1,
    fileList,
    beforeUpload: (file) => {
      setFileList([file]);
      return false;
    },
    onRemove: () => setFileList([]),
  };

  const handleProfileUpload = async () => {
    if (!fileList.length) {
      message.warning('Please choose a profile image first.');
      return;
    }

    const formData = new FormData();
    formData.append('profile_image', fileList[0]);
    setUploading(true);

    try {
      const response = await api.post('/users/me/profile-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      updateUser(response.data.user);
      setFileList([]);
      setProfileOpen(false);
      message.success('Profile image updated.');
    } catch (error) {
      message.error(error.response?.data?.message || 'Could not upload profile image.');
    } finally {
      setUploading(false);
    }
  };

  const handleProfileSave = async (values) => {
    setSavingProfile(true);
    try {
      const payload = {
        full_name: values.full_name,
        username: values.username,
        email: values.email,
      };

      if (values.password) {
        payload.password = values.password;
      }

      const response = await api.put('/users/me', payload);
      updateUser(response.data.user);
      profileForm.setFieldsValue({
        password: '',
        confirm_password: '',
      });
      message.success('Profile updated.');
    } catch (error) {
      message.error(error.response?.data?.message || 'Could not update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <Header className="app-topbar">
      <Button
        className="topbar-toggle"
        type="text"
        icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        onClick={() => setCollapsed(!collapsed)}
      />

      <Space size="large">
        {/* ── Notification bell ── */}
        <Dropdown
          open={dropdownOpen}
          onOpenChange={handleDropdownOpenChange}
          trigger={['click']}
          placement="bottomRight"
          popupRender={() => (
            <NotificationPanel
              notifications={enrichedNotifications}
              loading={notificationLoading}
              unreadCount={unreadCount}
              onMarkAllRead={handleMarkAllRead}
            />
          )}
        >
          <Badge count={unreadCount} size="small" offset={[-2, 2]}>
            <Button
              className={`topbar-icon-button${dropdownOpen ? ' topbar-icon-button--active' : ''}`}
              type="text"
              icon={<BellOutlined />}
            />
          </Badge>
        </Dropdown>

        {/* ── User menu ── */}
        <Dropdown menu={{ items: menuItems }} placement="bottomRight">
          <Space className="topbar-user">
            <div className="topbar-user-copy">
              <Text strong>{displayName}</Text>
              <Tag color={roleColors[user.role] || 'default'}>
                {user.role?.toUpperCase()}
              </Tag>
            </div>
            <Avatar className="topbar-avatar" src={profileImageUrl} icon={!profileImageUrl && <UserOutlined />}>
              {!profileImageUrl && initials}
            </Avatar>
          </Space>
        </Dropdown>
      </Space>

      <Modal
        title="My Profile"
        open={profileOpen}
        onCancel={() => {
          setProfileOpen(false);
          setFileList([]);
        }}
        footer={null}
        forceRender
      >
        <div className="profile-upload-panel">
          <Avatar
            size={88}
            className="profile-upload-avatar"
            src={profileImageUrl}
            icon={!profileImageUrl && <UserOutlined />}
          >
            {!profileImageUrl && initials}
          </Avatar>
          <div className="profile-upload-copy">
            <Text strong>{displayName}</Text>
            <Text type="secondary">{user.email || user.username}</Text>
          </div>
        </div>

        <Form
          form={profileForm}
          layout="vertical"
          onFinish={handleProfileSave}
          className="profile-edit-form"
        >
          <Form.Item name="full_name" label="Full name" rules={nameRules('Full name')}>
            <Input placeholder="Full name" />
          </Form.Item>
          <Form.Item name="username" label="Username" rules={usernameRules}>
            <Input placeholder="Username" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[emailRule]}>
            <Input placeholder="Email address" />
          </Form.Item>
          <Form.Item name="password" label="New password" rules={optionalPasswordRules}>
            <Input.Password placeholder="Leave blank to keep current password" />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label="Confirm new password"
            dependencies={['password']}
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!getFieldValue('password') || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Passwords do not match.'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="Confirm new password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={savingProfile} block>
            Save profile
          </Button>
        </Form>

        <Divider />
        <Upload.Dragger {...uploadProps} className="profile-upload-dropzone">
          <p className="ant-upload-drag-icon"><CameraOutlined /></p>
          <p className="ant-upload-text">Choose a new profile image</p>
          <p className="ant-upload-hint">PNG, JPG, or WEBP up to 3MB.</p>
        </Upload.Dragger>
        <Button
          icon={<UploadOutlined />}
          loading={uploading}
          onClick={handleProfileUpload}
          block
          style={{ marginTop: 12 }}
        >
          Upload photo
        </Button>
      </Modal>
    </Header>
  );
};

export default TopNavbar;
