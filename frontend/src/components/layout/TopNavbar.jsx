// src/components/layout/TopNavbar.jsx
'use client';

import React, { useState } from 'react';
import { Layout, Button, Avatar, Dropdown, Space, Typography, Tag, Modal, Upload, App as AntApp, Form, Input, Divider } from 'antd';
import {
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  UserOutlined,
  LogoutOutlined,
  BellOutlined,
  CameraOutlined,
  UploadOutlined
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { emailRule, nameRules, optionalPasswordRules, usernameRules } from '@/utils/validation';

const { Header } = Layout;
const { Text } = Typography;

const TopNavbar = ({ collapsed, setCollapsed }) => {
  const { user, logout, updateUser } = useAuth();
  const { message } = AntApp.useApp();
  const [profileForm] = Form.useForm();
  const [profileOpen, setProfileOpen] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

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
    court: 'cyan',
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
        <Button className="topbar-icon-button" type="text" icon={<BellOutlined />} />
        
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
