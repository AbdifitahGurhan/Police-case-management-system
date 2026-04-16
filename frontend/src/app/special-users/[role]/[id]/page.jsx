'use client';

import React, { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Card, Typography, Button, message, Spin, Descriptions, Tag, Space } from 'antd';
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import { useRouter, useParams } from 'next/navigation';
import api from '@/services/api';

const { Title, Text } = Typography;

export default function ViewSpecialUserPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const params = useParams();
  const { role, id } = params;
  const roleStr = role || 'admin';
  const displayRole = roleStr.toUpperCase();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await api.get(`/special-users/${id}`);
        setUser(res.data.data);
      } catch (err) {
        message.error("Failed to load user data");
        router.push(`/special-users/${roleStr}`);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [id, roleStr, router]);

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: '50px' }}><Spin size="large" /></div>;
  }

  if (!user) return null;

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <Card variant="none" style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => router.push(`/special-users/${roleStr}`)} />
            <Title level={3} style={{ margin: 0 }}>View {displayRole} User</Title>
          </Space>
          <Button 
            type="primary" 
            icon={<EditOutlined />} 
            onClick={() => router.push(`/special-users/${roleStr}/${id}/edit`)}
          >
            Edit User
          </Button>
        </div>

        <Descriptions bordered column={1}>
          <Descriptions.Item label="ID">{user.id}</Descriptions.Item>
          <Descriptions.Item label="Username">{user.username}</Descriptions.Item>
          <Descriptions.Item label="Role">
            <Tag color="purple">{user.role}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Assigned Unit">
            {user.assigned_unit || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={user.is_active ? 'green' : 'red'}>
              {user.is_active ? 'Active' : 'Inactive'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Created By">{user.created_by}</Descriptions.Item>
          <Descriptions.Item label="Created At">
            {new Date(user.created_at).toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label="Last Updated">
            {new Date(user.updated_at).toLocaleString()}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </ProtectedRoute>
  );
}
