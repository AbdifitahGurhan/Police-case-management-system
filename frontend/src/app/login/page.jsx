// src/app/login/page.jsx
'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

const { Title } = Typography;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      const roleRedirects = {
        admin: '/dashboard/admin',
        state_admin: '/dashboard/unit',
        region_admin: '/dashboard/unit',
        city_admin: '/dashboard/unit',
        district_admin: '/dashboard/unit',
        neighborhood_admin: '/dashboard/unit',
        officer: '/dashboard/officer',
        ward_commander: '/dashboard/ward_commander',
        cid: '/dashboard/cid',
        court: '/dashboard/court',
        jail: '/dashboard/jail'
      };
      router.replace(roleRedirects[user.role] || '/cases');
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
    <div className="login-art-page">
      <Card className="login-art-card" variant="none">
        <div className="login-art-brand">
          <Image
            src="/somali-police-logo.png"
            alt="Somali Police Force logo"
            width={70}
            height={56}
            priority
            className="login-art-logo"
          />
          <Title level={1}>Soo Gal</Title>
          <Typography.Text type="secondary">Nidaamka Maareynta Kiisaska Booliska Soomaaliyeed</Typography.Text>
        </div>

        {error && (
          <Alert
            title={error}
            type="error"
            showIcon
            className="login-art-alert"
          />
        )}

        <Form
          name="login_form"
          layout="vertical"
          onFinish={onFinish}
          size="large"
          className="login-art-form"
        >
          <Form.Item
            name="identifier"
            rules={[{ required: true, message: 'Fadlan geli username ama email.' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="Username ama Email" variant="borderless" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Fadlan geli furaha sirta.' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Furaha Sirta" variant="borderless" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block className="login-art-button">
              Soo Gal
            </Button>
          </Form.Item>
        </Form>

      </Card>
    </div>
  );
}
