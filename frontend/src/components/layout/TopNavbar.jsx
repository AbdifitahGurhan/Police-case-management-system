// src/components/layout/TopNavbar.jsx
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Layout,
  Button,
  Avatar,
  Dropdown,
  Space,
  Typography,
  Tag,
  Modal,
  Upload,
  App as AntApp,
  Form,
  Input,
  Divider,
  Badge,
  Empty,
  Spin,
  Tooltip,
} from 'antd';
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
  SunOutlined,
  MoonOutlined,
  CalendarOutlined,
  SearchOutlined,
  EnvironmentOutlined,
  SettingOutlined,
  KeyOutlined,
  RightOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import api from '@/services/api';
import { emailRule, nameRules, optionalPasswordRules } from '@/utils/validation';

const { Header } = Layout;
const { Text, Title } = Typography;

// ─── Notification helpers ───────────────────────────────────────────────────

const typeIcon = (type = '') => {
  if (type.startsWith('CID')) return <SafetyOutlined style={{ color: '#A855F7' }} />;
  if (type.startsWith('audit')) return <AuditOutlined style={{ color: '#38BDF8' }} />;
  if (type.includes('CASE')) return <FileTextOutlined style={{ color: '#22C55E' }} />;
  if (type.includes('ALERT')) return <AlertOutlined style={{ color: '#EF4444' }} />;
  return <ClockCircleOutlined style={{ color: '#9CA3AF' }} />;
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Hadda';
  if (m < 60) return `${m}m ka hor`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ka hor`;
  return `${Math.floor(h / 24)}d ka hor`;
}

// ─── Notification Dropdown Content ──────────────────────────────────────────

function NotificationPanel({ notifications, loading, onMarkAllRead, unreadCount, onItemClick }) {
  return (
    <div className="topbar-notification-popover">
      {/* Header */}
      <div className="topbar-notification-header">
        <Space>
          <Text strong style={{ fontSize: 13.5, color: '#F5F5F5' }}>Ogaysiisyada</Text>
          {unreadCount > 0 && (
            <Tag color="cyan" style={{ borderRadius: 12, margin: 0, fontSize: 11, fontWeight: 600 }}>
              {unreadCount} cusub
            </Tag>
          )}
        </Space>
        {unreadCount > 0 && (
          <Button
            type="text"
            size="small"
            icon={<CheckOutlined />}
            onClick={onMarkAllRead}
            className="topbar-mark-read-btn"
          >
            Dhammaan Akhri
          </Button>
        )}
      </div>

      {/* Body */}
      <div className="topbar-notification-list">
        {loading && notifications.length === 0 ? (
          <div className="topbar-notification-loading">
            <Spin size="small" />
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: '28px 0' }}>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Wax ogaysiis cusub ah ma jiraan" />
          </div>
        ) : (
          notifications.map((item) => (
            <div
              className={`topbar-notification-item${item.is_read ? '' : ' unread'}`}
              key={item.id || `${item.type}-${item.created_at}`}
              onClick={() => onItemClick && onItemClick(item)}
            >
              <div className="topbar-notification-icon">
                {typeIcon(item.type)}
              </div>
              <div className="topbar-notification-body">
                <Text strong className="topbar-notification-title">
                  {item.title}
                </Text>
                <Text className="topbar-notification-msg">
                  {item.message}
                </Text>
                <span className="topbar-notification-time">
                  <ClockCircleOutlined style={{ fontSize: 10, marginRight: 4 }} />
                  {timeAgo(item.created_at)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="topbar-notification-footer">
          <Text style={{ fontSize: 11.5, color: '#737373' }}>
            Muujinaya {notifications.length} ogaysiis ee ugu dambeeyey
          </Text>
        </div>
      )}
    </div>
  );
}

// ─── Main TopNavbar ──────────────────────────────────────────────────────────

const TopNavbar = ({ collapsed, setCollapsed }) => {
  const router = useRouter();
  const { user, logout, updateUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { message } = AntApp.useApp();
  const [profileForm] = Form.useForm();
  const [profileOpen, setProfileOpen] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentTime, setCurrentTime] = useState(dayjs().format('HH:mm:ss'));

  // Notification state
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState(new Set());
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const timerRef = useRef(null);

  // Live clock tick
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(dayjs().format('HH:mm:ss'));
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  const fetchNotifications = useCallback(async () => {
    setNotificationLoading(true);
    try {
      const response = await api.get('/notifications', { params: { limit: 15 } });
      setNotifications(response.data.data || []);
    } catch (error) {
      if (error.response?.status === 401) setNotifications([]);
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

  const handleDropdownOpenChange = (open) => {
    setDropdownOpen(open);
    if (open) {
      fetchNotifications();
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
    message.success('Dhammaan ogaysiisyada waxaa loo calaamadeeyay in la akhriyey.');
  };

  const handleNotificationClick = (item) => {
    setDropdownOpen(false);
    if (item.case_id || item.link?.includes('/cases/')) {
      router.push(item.link || `/cases/${item.case_id}`);
    } else if (item.ob_id || item.link?.includes('/ob-register/')) {
      router.push(item.link || `/ob-register/${item.ob_id}`);
    }
  };

  const handleSearchSubmit = (e) => {
    if (e && e.key && e.key !== 'Enter') return;
    const query = searchTerm.trim();
    if (!query) return;
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  const enrichedNotifications = notifications.map((n) => ({
    ...n,
    is_read: readIds.has(n.id) ? 1 : n.is_read,
  }));

  const unreadCount = enrichedNotifications.filter((n) => !n.is_read).length;

  if (!user) return null;

  const apiOrigin = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
  const profileImageUrl = user.profileImage ? `${apiOrigin}${user.profileImage}` : null;
  const displayName = user.fullName || user.username || 'Isticmaale';
  const isDarkMode = theme === 'dark';
  const themeToggleLabel = isDarkMode ? 'Habka Iftiinka (Light)' : 'Habka Mugdiga (Dark)';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  const roleLabels = {
    admin: 'Dawladda Dhexe (Taliska Guud)',
    sub_admin: 'Maamul Hoose (Sub-Admin)',
    state_admin: 'Maamulka Dawlad Goboleedka',
    region_admin: 'Maamulka Gobolka',
    district_admin: 'Maamulka Degmada',
    personnel_registry: 'Diiwaanka Ciidanka',
    ob_staff: 'Diiwaangeliyaha OB-da',
    investigator: 'Baaraha Kiiska',
    station_jail: 'Xabsiga Saldhigga',
    jail: 'Xabsiga Dhexe',
    court: 'Maxkamadda',
    cid: 'Baaraha CID-da',
    officer: 'Sarkaalka Booliska',
    judge: 'Garsoore',
    prosecutor: 'Xeer-ilaaliye',
  };

  const locationBadge = user.location?.name || user.district_name || user.region_name || user.state_name || (user.role === 'admin' ? 'Taliska Guud ee Ciidanka' : null);

  const menuItems = [
    {
      key: 'user_info',
      label: (
        <div className="topbar-user-dropdown-header">
          <div style={{ fontWeight: 600, color: '#F5F5F5', fontSize: 13 }}>{displayName}</div>
          <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>{user.email || user.username}</div>
          <div style={{ marginTop: 4 }}>
            <Tag color="cyan" style={{ fontSize: 10.5, borderRadius: 4, margin: 0 }}>
              {roleLabels[user.role] || user.role}
            </Tag>
          </div>
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'profile',
      label: 'Xogta Koontadayda',
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
      label: 'Ka Bax Nidaamka',
      icon: <LogoutOutlined />,
      danger: true,
      onClick: logout,
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
      message.warning('Fadlan marka hore dooro sawirka.');
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
      message.success('Sawirka profile-ka waa la cusboonaysiiyey.');
    } catch (error) {
      message.error(error.response?.data?.message || 'Sawirka lama gelin karin.');
    } finally {
      setUploading(false);
    }
  };

  const handleProfileSave = async (values) => {
    setSavingProfile(true);
    try {
      const payload = {
        full_name: values.full_name,
      };

      if (!user.scopeType) payload.email = values.email;

      if (values.password) {
        payload.password = values.password;
      }

      const response = await api.put('/users/me', payload);
      updateUser(response.data.user);
      profileForm.setFieldsValue({
        password: '',
        confirm_password: '',
      });
      message.success('Xogta profile-ka waa la kaydiyey.');
      setProfileOpen(false);
    } catch (error) {
      message.error(error.response?.data?.message || 'Xogta lama kaydin karin.');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <Header className="app-topbar-modern">
      {/* Left: Sidebar toggle + Global Quick Search */}
      <div className="topbar-left-zone">
        <Button
          className="topbar-toggle-btn"
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={() => setCollapsed(!collapsed)}
        />

        <div className="topbar-search-box">
          <Input
            prefix={<SearchOutlined style={{ color: '#737373', fontSize: 13 }} />}
            placeholder="Raadi kiis, OB, eedaysane..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearchSubmit}
            allowClear
            suffix={
              <span className="topbar-search-shortcut" onClick={handleSearchSubmit}>
                ↵ Raadi
              </span>
            }
            className="topbar-search-input"
          />
        </div>
      </div>

      {/* Right: Date/Clock + Location Badge + Theme + Notifications + User Menu */}
      <div className="topbar-right-zone">
        {/* Date & Live Clock */}
        <div className="topbar-datetime-pill">
          <CalendarOutlined style={{ color: 'var(--ui-primary, #A8FF4D)' }} />
          <span className="topbar-date-text">{dayjs().format('ddd, D MMM YYYY')}</span>
          <span className="topbar-clock-sep">•</span>
          <span className="topbar-clock-text">{currentTime}</span>
        </div>

        {/* Location Scope Badge */}
        {locationBadge && (
          <Tooltip title={`Xarunta/Goobta: ${locationBadge}`}>
            <div className="topbar-location-pill">
              <EnvironmentOutlined style={{ color: '#38BDF8' }} />
              <span className="topbar-location-text">{locationBadge}</span>
            </div>
          </Tooltip>
        )}

        {/* Theme Toggle */}
        <Tooltip title={themeToggleLabel}>
          <Button
            aria-label={themeToggleLabel}
            className="topbar-action-btn"
            type="text"
            icon={isDarkMode ? <SunOutlined style={{ color: 'var(--ui-primary, #A8FF4D)' }} /> : <MoonOutlined />}
            onClick={toggleTheme}
          />
        </Tooltip>

        {/* Notifications */}
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
              onItemClick={handleNotificationClick}
            />
          )}
        >
          <Badge count={unreadCount} size="small" offset={[-2, 2]}>
            <Button
              className={`topbar-action-btn${dropdownOpen ? ' active' : ''}`}
              type="text"
              icon={<BellOutlined />}
            />
          </Badge>
        </Dropdown>

        {/* User Menu */}
        <Dropdown menu={{ items: menuItems }} placement="bottomRight" trigger={['click']}>
          <div className="topbar-user-pill">
            <Avatar
              className="topbar-user-avatar"
              src={profileImageUrl}
              icon={!profileImageUrl && <UserOutlined />}
            >
              {!profileImageUrl && initials}
            </Avatar>
            <div className="topbar-user-meta">
              <span className="topbar-user-name">{displayName}</span>
              <span className="topbar-user-role">
                {roleLabels[user.role] || user.role || 'User'}
              </span>
            </div>
            <RightOutlined className="topbar-user-chevron" />
          </div>
        </Dropdown>
      </div>

      {/* Edit Profile Modal */}
      <Modal
        title={
          <Space>
            <SettingOutlined style={{ color: 'var(--ui-primary, #A8FF4D)' }} />
            <span>Xogta Profile-kayga (My Profile)</span>
          </Space>
        }
        open={profileOpen}
        onCancel={() => {
          setProfileOpen(false);
          setFileList([]);
        }}
        footer={null}
        forceRender
        className="topbar-profile-modal"
        centered
        width={560}
      >
        <div className="profile-upload-panel">
          <Avatar
            size={80}
            className="profile-upload-avatar"
            src={profileImageUrl}
            icon={!profileImageUrl && <UserOutlined />}
          >
            {!profileImageUrl && initials}
          </Avatar>
          <div className="profile-upload-copy">
            <Title level={4} style={{ margin: 0, color: '#F5F5F5' }}>{displayName}</Title>
            <Text type="secondary">{user.email || user.username}</Text>
            <div style={{ marginTop: 4 }}>
              <Tag color="cyan">{roleLabels[user.role] || user.role}</Tag>
            </div>
          </div>
        </div>

        <Form
          form={profileForm}
          layout="vertical"
          onFinish={handleProfileSave}
          className="profile-edit-form"
        >
          <Form.Item name="full_name" label="Magaca oo Dhammaystiran" rules={nameRules('Magaca')}>
            <Input placeholder="Magacaaga oo buuxa" />
          </Form.Item>
          <Form.Item name="username" label="Username-ka Login-ka">
            <Input disabled readOnly />
          </Form.Item>
          {!user.scopeType && (
            <>
              <Form.Item name="email" label="Email Address" rules={[emailRule]}>
                <Input placeholder="Email-kaaga" />
              </Form.Item>
              <Form.Item name="password" label="Password Cusub (Ikhtiyaari)" rules={optionalPasswordRules}>
                <Input.Password placeholder="Ka tag bannaanka haddii aadan beddelayn" />
              </Form.Item>
              <Form.Item
                name="confirm_password"
                label="Xaqiiji Password-ka Cusub"
                dependencies={['password']}
                rules={[
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!getFieldValue('password') || getFieldValue('password') === value) return Promise.resolve();
                      return Promise.reject(new Error('Password-yadu iskuma mid ma aha.'));
                    },
                  }),
                ]}
              >
                <Input.Password placeholder="Dib u qor password-ka cusub" />
              </Form.Item>
            </>
          )}
          <Button type="primary" htmlType="submit" loading={savingProfile} block style={{ height: 40, fontWeight: 600 }}>
            Kaydi Profile-ka
          </Button>
        </Form>

        <Divider style={{ borderColor: '#262626' }} />
        <Upload.Dragger {...uploadProps} className="profile-upload-dropzone">
          <p className="ant-upload-drag-icon"><CameraOutlined style={{ color: 'var(--ui-primary, #A8FF4D)' }} /></p>
          <p className="ant-upload-text" style={{ color: '#E0E0E0' }}>Dooro Sawir Cusub oo Profile ah</p>
          <p className="ant-upload-hint" style={{ color: '#737373' }}>PNG, JPG, ama WEBP ilaa 3MB.</p>
        </Upload.Dragger>
        <Button
          icon={<UploadOutlined />}
          loading={uploading}
          onClick={handleProfileUpload}
          block
          style={{ marginTop: 12, height: 38 }}
        >
          Geli Sawirka
        </Button>
      </Modal>
    </Header>
  );
};

export default TopNavbar;
