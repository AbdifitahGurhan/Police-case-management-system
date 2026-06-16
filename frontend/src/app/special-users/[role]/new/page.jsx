'use client';

import React, { useState } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Card, Typography, Form, Input, Button, App } from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useRouter, useParams } from 'next/navigation';
import api from '@/services/api';
import { passwordRules, textLengthRule, usernameRules } from '@/utils/validation';

const { Title, Text } = Typography;

export default function NewSpecialUserPage() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const router = useRouter();
  const params = useParams();
  const roleStr = params.role || 'admin';
  const displayRole = roleStr.toUpperCase();

  const handleFinish = async (values) => {
    setLoading(true);
    try {
      await api.post('/special-users', {
        ...values,
        role: displayRole
      });
      message.success(`${displayRole} User created successfully`);
      router.push(`/special-users/${roleStr}`);
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <Card variant="none" style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push(`/special-users/${roleStr}`)} />
          <div>
            <Title level={3} style={{ margin: 0 }}>Add New {displayRole} User</Title>
            <Text type="secondary">Provide credentials and unit assignment for this user</Text>
          </div>
        </div>

        <Form layout="vertical" form={form} onFinish={handleFinish}>
          <Form.Item 
            label="Username or Email" 
            name="username" 
            rules={usernameRules}
          >
            <Input placeholder="Unique username or email" />
          </Form.Item>

          <Form.Item 
            label="Password" 
            name="password" 
            rules={passwordRules}
          >
            <Input.Password placeholder="Secure password" />
          </Form.Item>

          <Form.Item 
            label="Assigned Unit (Optional)" 
            name="assigned_unit" 
            rules={[textLengthRule('Assigned unit', 2, 255)]}
          >
            <Input placeholder="e.g. Headquarters, High Court, Central Jail" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />} block size="large">
              Save User
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </ProtectedRoute>
  );
}
