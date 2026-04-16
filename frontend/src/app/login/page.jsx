// src/app/login/page.jsx
'use client';

import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Space, Divider } from 'antd';
import { UserOutlined, LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

const { Title, Text, Paragraph } = Typography;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      const roleRedirects = {
        admin: '/dashboard/admin',
        state_admin: '/dashboard/state_administration',
        region_admin: '/dashboard/region',
        city_admin: '/dashboard/city',
        district_admin: '/dashboard/district',
        neighborhood_admin: '/dashboard/neighborhood',
        cid: '/dashboard/cid',
        prosecutor: '/dashboard/prosecutor'
      };
      router.replace(roleRedirects[user.role] || '/dashboard');
    }
  }, [user, router]);

  const onFinish = async (values) => {
    setLoading(true);
    setError('');
    const result = await login(values.identifier, values.password);
    if (!result.success) {
      setError(result.message);
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh', 
      background: '#f0f2f5',
      backgroundImage: 'linear-gradient(135deg, #001529 0%, #002140 100%)'
    }}>
      <Card 
        style={{ width: 400, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}
        styles={{ body: { padding: '32px' } }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <SafetyCertificateOutlined style={{ fontSize: 48, color: '#1677ff', marginBottom: 16 }} />
          <Title level={2} style={{ marginBottom: 0 }}>Police CMS</Title>
          <Typography.Text type="secondary">Criminal Case Management System</Typography.Text>
        </div>

        {error && (
          <Alert
            title={error}
            type="error"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        <Form
          name="login_form"
          layout="vertical"
          initialValues={{ remember: true }}
          onFinish={onFinish}
          size="large"
        >
          <Form.Item
            name="identifier"
            rules={[
              { required: true, message: 'Please input your username or email!' }
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="Username or Email" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Please input your password!' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Password" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              Log in
            </Button>
          </Form.Item>
        </Form>

        <Divider style={{ margin: '16px 0' }} />
        
        <div style={{ textAlign: 'center' }}>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
              Secure Access — Unauthorized entry is prohibited.
            </Typography.Text>
          </Typography.Paragraph>
          <Typography.Text type="secondary" style={{ fontSize: '11px' }}>
            Somalia Police Force | Case Mgmt v1.0
          </Typography.Text>
        </div>
      </Card>
    </div>
  );
}
