'use client';

import React, { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Card, Typography, Form, Input, Button, message, Spin, Select } from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useRouter, useParams } from 'next/navigation';
import api from '@/services/api';
import { optionalPasswordRules, requiredRule, textLengthRule } from '@/utils/validation';

const { Title, Text } = Typography;

export default function EditSpecialUserPage() {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [form] = Form.useForm();
  const router = useRouter();
  const params = useParams();
  const { role, id } = params;
  const roleStr = role || 'admin';
  const displayRole = roleStr.toUpperCase();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await api.get(`/special-users/${id}`);
        form.setFieldsValue(res.data.data);
      } catch (err) {
        message.error("Failed to load user data");
        router.push(`/special-users/${roleStr}`);
      } finally {
        setInitialLoading(false);
      }
    };
    fetchUser();
  }, [id, form, roleStr, router]);

  const handleFinish = async (values) => {
    setLoading(true);
    try {
      await api.put(`/special-users/${id}`, values);
      message.success(`User updated successfully`);
      router.push(`/special-users/${roleStr}`);
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to update user");
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return <div style={{ textAlign: 'center', marginTop: '50px' }}><Spin size="large" /></div>;
  }

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <Card variant="none" style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push(`/special-users/${roleStr}`)} />
          <div>
            <Title level={3} style={{ margin: 0 }}>Edit {displayRole} User</Title>
            <Text type="secondary">Update credentials or assignment</Text>
          </div>
        </div>

        <Form layout="vertical" form={form} onFinish={handleFinish}>
          <Form.Item 
            label="Username" 
            name="username" 
          >
            <Input disabled />
          </Form.Item>

          <Form.Item 
            label="New Password" 
            name="password" 
            help="Leave blank to keep current password"
            rules={optionalPasswordRules}
          >
            <Input.Password placeholder="New secure password (optional)" />
          </Form.Item>

          <Form.Item 
            label="Assigned Unit" 
            name="assigned_unit" 
            rules={[textLengthRule('Assigned unit', 2, 255)]}
          >
            <Input placeholder="e.g. Headquarters, High Court, Central Jail" />
          </Form.Item>

          <Form.Item label="Account Status" name="is_active" rules={[requiredRule('Account status')]}>
            <Select>
              <Select.Option value={1}>Active</Select.Option>
              <Select.Option value={0}>Inactive</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />} block size="large">
              Update User
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </ProtectedRoute>
  );
}
