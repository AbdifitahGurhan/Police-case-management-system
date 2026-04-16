// src/app/users/page.jsx
'use client';

import React, { useState, useEffect } from 'react';
import { Table, Card, Typography, Space, Button, Tag, Modal, Form, Input, Select, Popconfirm, Row, Col, App } from 'antd';
import { UserAddOutlined, EditOutlined, DeleteOutlined, ShieldOutlined } from '@ant-design/icons';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';

const { Title, Text } = Typography;
const { Option } = Select;

export default function UserManagementPage() {
  const { message } = App.useApp();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [uRes, rRes, sRes] = await Promise.all([
        api.get('/users'),
        api.get('/users/roles'),
        api.get('/stations')
      ]);
      setUsers(uRes.data.data);
      setRoles(rRes.data.data);
      setStations(sRes.data.data);
    } catch (err) {
      console.error(err);
      message.error("Failed to load user data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (user = null) => {
    setEditingUser(user);
    if (user) {
      form.setFieldsValue({
        ...user,
        role_id: roles.find(r => r.name === user.role)?.id,
        station_id: stations.find(s => s.name === user.station_name)?.id
      });
    } else {
      form.resetFields();
    }
    setIsModalOpen(true);
  };

  const handleSave = async (values) => {
    try {
      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, values);
        message.success("User updated successfully.");
      } else {
        await api.post('/users', values);
        message.success("User created successfully.");
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.message || "Save failed.");
    }
  };

  const handleDeactivate = async (id) => {
    try {
      await api.delete(`/users/${id}`);
      message.success("User deactivated.");
      fetchData();
    } catch (err) {
      message.error("Action failed.");
    }
  };

  const roleColors = { admin: 'magenta', officer: 'blue', cid: 'purple', prosecutor: 'gold' };

  const columns = [
    { title: 'Full Name', dataIndex: 'full_name', key: 'full_name', render: (t) => <Typography.Text strong>{t}</Typography.Text> },
    { title: 'Badge/ID', dataIndex: 'badge_number', key: 'badge_number' },
    { title: 'Rank', dataIndex: 'rank', key: 'rank' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Role', dataIndex: 'role', key: 'role', render: (r) => <Tag color={roleColors[r]}>{r.toUpperCase()}</Tag> },
    { title: 'Station', dataIndex: 'station_name', key: 'station_name' },
    { title: 'Status', dataIndex: 'is_active', key: 'is_active', render: (a) => a ? <Tag color="success">ACTIVE</Tag> : <Tag color="error">INACTIVE</Tag> },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
          <Popconfirm title="Deactivate user?" onConfirm={() => handleDeactivate(record.id)}>
            <Button icon={<DeleteOutlined />} danger disabled={!record.is_active} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2}>Access Control Center</Title>
            <Typography.Text type="secondary">Manage police staff, assigned ranks, and system access levels.</Typography.Text>
          </div>
          <Button type="primary" icon={<UserAddOutlined />} onClick={() => handleOpenModal()}>Add New Staff</Button>
        </div>

        <Card variant="none">
          <Table columns={columns} dataSource={users} rowKey="id" loading={loading} />
        </Card>

        <Modal 
          title={editingUser ? "Edit Staff Profile" : "Onboard New Staff"} 
          open={isModalOpen} 
          onCancel={() => setIsModalOpen(false)} 
          onOk={() => form.submit()}
          width={600}
        >
          <Form form={form} layout="vertical" onFinish={handleSave}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="full_name" label="Full Name" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="email" label="Email Address" rules={[{ required: true, type: 'email' }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="badge_number" label="Badge Number/ID" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="rank" label="Rank" rules={[{ required: true }]}>
                  <Select>
                    <Option value="General">General</Option>
                    <Option value="Colonel">Colonel</Option>
                    <Option value="Major">Major</Option>
                    <Option value="Inspector">Inspector</Option>
                    <Option value="Sergeant">Sergeant</Option>
                    <Option value="Officer">Officer</Option>
                    <Option value="Prosecutor">Prosecutor</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="role_id" label="System Role" rules={[{ required: true }]}>
                  <Select>
                    {roles.map(r => <Option key={r.id} value={r.id}>{r.name.toUpperCase()}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="station_id" label="Assigned Station">
                  <Select>
                    {stations.map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item name="password" label={editingUser ? "Change Password (optional)" : "Password"} rules={editingUser ? [] : [{ required: true }]}>
                  <Input.Password />
                </Form.Item>
              </Col>
              {editingUser && (
                <Col span={24}>
                  <Form.Item name="is_active" label="Status" valuePropName="checked">
                    <Select>
                       <Option value={1}>ACTIVE</Option>
                       <Option value={0}>INACTIVE</Option>
                    </Select>
                  </Form.Item>
                </Col>
              )}
            </Row>
          </Form>
        </Modal>
      </Space>
    </ProtectedRoute>
  );
}
