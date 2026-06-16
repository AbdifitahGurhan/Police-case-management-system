'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Table, Card, Typography, Space, Button, App, Popconfirm, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { useRouter, useParams } from 'next/navigation';
import api from '@/services/api';

const { Title, Text } = Typography;

export default function SpecialUserListPage() {
  const { message } = App.useApp();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const params = useParams();
  const roleStr = params.role || 'admin';
  const displayRole = roleStr.toUpperCase();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/special-users?role=${displayRole}`);
      setData(res.data.data);
    } catch (err) {
      if (err.response?.status !== 403) {
        message.error("Failed to load users.");
      }
    } finally {
      setLoading(false);
    }
  }, [displayRole]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/special-users/${id}`);
      message.success("User deactivated successfully");
      fetchUsers();
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to deactivate user.");
    }
  };

  const columns = [
    { 
      title: 'Username', 
      dataIndex: 'username', 
      key: 'username',
      render: (text) => <Text strong>{text}</Text>
    },
    { 
      title: 'Assigned Unit', 
      dataIndex: 'assigned_unit', 
      key: 'assigned_unit',
      render: (u) => u ? <Tag color="blue">{u}</Tag> : '-'
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active) => <Tag color={active ? 'green' : 'red'}>{active ? 'Active' : 'Inactive'}</Tag>
    },
    {
      title: 'Created By',
      dataIndex: 'created_by',
      key: 'created_by'
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (val) => new Date(val).toLocaleDateString()
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button 
            type="text" 
            icon={<EyeOutlined />} 
            onClick={() => router.push(`/special-users/${roleStr}/${record.id}`)}
          >
            View
          </Button>
          <Button 
            type="text" 
            icon={<EditOutlined />} 
            onClick={() => router.push(`/special-users/${roleStr}/${record.id}/edit`)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Deactivate this user?"
            description="Are you sure you want to disable login for this user?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="text" danger icon={<DeleteOutlined />} disabled={!record.is_active}>
              Deactivate
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <Card variant="none">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Title level={2} style={{ margin: 0 }}>{displayRole} Users</Title>
              <Text type="secondary">Manage system access for {displayRole}</Text>
            </div>
            
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={() => router.push(`/special-users/${roleStr}/new`)} 
              size="large"
            >
              Add New User
            </Button>
          </div>

          <Table 
            columns={columns} 
            dataSource={data} 
            rowKey="id" 
            loading={loading} 
            pagination={{ pageSize: 10 }}
          />

        </div>
      </Card>
    </ProtectedRoute>
  );
}
