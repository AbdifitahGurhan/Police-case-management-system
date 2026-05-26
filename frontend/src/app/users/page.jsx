// src/app/users/page.jsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Table, Card, Typography, Space, Button, Tag, Modal, Form, Input, Select, Popconfirm, Row, Col, App } from 'antd';
import { UserAddOutlined, EditOutlined, DeleteOutlined, ShieldOutlined } from '@ant-design/icons';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';
import { emailRule, nameRules, optionalPasswordRules, passwordRules, phoneRules, requiredRule, textLengthRule, usernameRules } from '@/utils/validation';

const { Title, Text } = Typography;
const { Option } = Select;

export default function UserManagementPage() {
  const { message } = App.useApp();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [states, setStates] = useState([]);
  const [regions, setRegions] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [waaxUnits, setWaaxUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form] = Form.useForm();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, rRes, stateRes, regionRes, districtRes, waaxRes] = await Promise.allSettled([
        api.get('/users'),
        api.get('/users/roles'),
        api.get('/state-administrations'),
        api.get('/regions'),
        api.get('/districts'),
        api.get('/neighborhoods')
      ]);
      if (uRes.status === 'rejected' || rRes.status === 'rejected') {
        throw uRes.reason || rRes.reason;
      }
      setUsers(uRes.value.data.data);
      setRoles(rRes.value.data.data);
      setStates(stateRes.status === 'fulfilled' ? stateRes.value.data.data : []);
      setRegions(regionRes.status === 'fulfilled' ? regionRes.value.data.data : []);
      setDistricts(districtRes.status === 'fulfilled' ? districtRes.value.data.data : []);
      setWaaxUnits(waaxRes.status === 'fulfilled' ? waaxRes.value.data.data : []);
    } catch (err) {
      console.error(err);
      message.error("Failed to load user data.");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenModal = (user = null) => {
    setEditingUser(user);
    if (user) {
      form.setFieldsValue({
        ...user,
        role_id: roles.find(r => r.name === user.role)?.id,
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

  const roleColors = { admin: 'magenta', officer: 'blue', cid: 'purple', OB_STAFF: 'cyan', STAFF: 'green', POLICE_STATION_COMMANDER: 'gold' };

  const columns = [
    { title: 'Full Name', dataIndex: 'full_name', key: 'full_name', render: (t) => <Typography.Text strong>{t}</Typography.Text> },
    { title: 'Badge/ID', dataIndex: 'badge_number', key: 'badge_number' },
    { title: 'Rank', dataIndex: 'rank', key: 'rank' },
    { title: 'User Type', dataIndex: 'user_type', key: 'user_type', render: (v) => <Tag>{v || 'STAFF'}</Tag> },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Role', dataIndex: 'role', key: 'role', render: (r) => <Tag color={roleColors[r]}>{String(r).toUpperCase()}</Tag> },
    { title: 'State', dataIndex: 'state_name', key: 'state_name' },
    { title: 'Region', dataIndex: 'region_name', key: 'region_name' },
    { title: 'District / Police Station', dataIndex: 'district_police_station_name', key: 'district_police_station_name' },
    { title: 'Waax', dataIndex: 'waax_name', key: 'waax_name' },
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
    <ProtectedRoute allowedRoles={['admin', 'region_admin']}>
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
                <Form.Item name="full_name" label="Full Name" rules={nameRules('Full name')}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="email" label="Email Address" rules={[requiredRule('Email address'), emailRule]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="username" label="Username" rules={usernameRules}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="rank" label="Rank" rules={[requiredRule('Rank'), textLengthRule('Rank', 2, 100)]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="role_id" label="System Role" rules={[requiredRule('System role')]}>
                  <Select>
                    {roles.map(r => <Option key={r.id} value={r.id}>{r.name.toUpperCase()}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="user_type" label="User Type" rules={[requiredRule('User type')]}>
                  <Select>
                    <Option value="COMMANDER">Commander</Option>
                    <Option value="OB_STAFF">OB Staff</Option>
                    <Option value="STAFF">Staff</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="phone" label="Phone Number" rules={phoneRules}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="assigned_level" label="Assigned Level">
                  <Select allowClear>
                    <Option value="STATE">State</Option>
                    <Option value="REGION">Region</Option>
                    <Option value="DISTRICT_POLICE_STATION">District / Police Station</Option>
                    <Option value="WAAX">Waax</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="state_administration_id" label="Assigned State">
                  <Select allowClear showSearch optionFilterProp="children">
                    {states.map(s => <Option key={s.id} value={s.id}>{s.state_name}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="region_id" label="Assigned Region">
                  <Select allowClear showSearch optionFilterProp="children">
                    {regions.map(r => <Option key={r.id} value={r.id}>{r.region_name}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="district_id" label="Assigned District / Police Station">
                  <Select allowClear showSearch optionFilterProp="children">
                    {districts.map(d => <Option key={d.id} value={d.id}>{d.district_name}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="neighborhood_id" label="Assigned Waax">
                  <Select allowClear showSearch optionFilterProp="children">
                    {waaxUnits.map(w => <Option key={w.id} value={w.id}>{w.neighborhood_name}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="is_commander" label="Commander Status">
                  <Select>
                    <Option value={1}>Yes</Option>
                    <Option value={0}>No</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item name="password" label={editingUser ? "Change Password (optional)" : "Password"} rules={editingUser ? optionalPasswordRules : passwordRules}>
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
