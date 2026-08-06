'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { App, Button, Card, Checkbox, Col, Form, Input, Modal, Row, Space, Table, Tag, Typography } from 'antd';
import { PlusOutlined, SaveOutlined } from '@ant-design/icons';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';

const { Title, Text } = Typography;
const ROLE_LABELS = {
  admin: 'Admin', sub_admin: 'Sub Admin', state_admin: 'State Administration',
  region_admin: 'Region Administration', district_admin: 'District Administration',
  personnel_registry: 'Diiwaanka Ciidanka', investigator: 'Baare', station_jail: 'Station Jail',
};
const HIERARCHY_ROLES = ['admin', 'sub_admin', 'state_admin', 'region_admin', 'district_admin'];

export default function PermissionsPage() {
  const { message } = App.useApp();
  const [permissions, setPermissions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [values, setValues] = useState([]);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/permissions');
      setPermissions(data.data.permissions || []);
      setRoles((data.data.roles || []).map(role => ({
        ...role, targetType: 'role', targetKey: `role-${role.id}`,
        permissions: Array.isArray(role.permissions) ? role.permissions : JSON.parse(role.permissions || '[]'),
      })).sort((a, b) => {
        const ai = HIERARCHY_ROLES.indexOf(String(a.name).toLowerCase());
        const bi = HIERARCHY_ROLES.indexOf(String(b.name).toLowerCase());
        if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        return String(a.name).localeCompare(String(b.name));
      }));
      setAccounts((data.data.users || []).map(user => ({ ...user, targetType: 'user', targetKey: `user-${user.id}` })));
    } catch (error) {
      message.error(error.response?.data?.message || 'Awoodaha lama soo qaadi karin.');
    }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const choose = target => {
    setSelected(target);
    setValues((target.permissions || []).filter(Boolean));
  };

  const save = async () => {
    const endpoint = selected.targetType === 'user'
      ? `/permissions/users/${selected.id}`
      : `/permissions/roles/${selected.id}`;
    await api.put(endpoint, { permissions: values });
    message.success('Awoodaha waa la kaydiyey. User-ku waa inuu dib u login sameeyaa.');
    load();
  };

  const create = async valuesToCreate => {
    try {
      await api.post('/permissions/roles', valuesToCreate);
      setOpen(false);
      form.resetFields();
      message.success('Role cusub waa la abuuray.');
      load();
    } catch (error) {
      message.error(error.response?.data?.message || 'Role-ka lama abuuri karin.');
    }
  };

  const targets = [
    ...roles,
    ...accounts.map(account => ({ ...account, name: account.full_name || account.username })),
  ];
  const selectedRoleName = String(selected?.role_name || selected?.name || '').toLowerCase();
  const locked = selectedRoleName === 'admin';
  const selectedLabel = selected?.targetType === 'user'
    ? `${selected.full_name || selected.username} (${ROLE_LABELS[String(selected.role_name).toLowerCase()] || selected.role_name})`
    : ROLE_LABELS[String(selected?.name).toLowerCase()] || selected?.name;

  return (
    <ProtectedRoute allowedRoles={['admin']} requiredPermissions={['permissions.manage', 'roles.manage']}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div><Title level={2}>Maamulka Awoodaha</Title><Text type="secondary">Roles-ka iyo user kasta awoodihiisa si gaar ah u maamul.</Text></div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Abuur Role Cusub</Button>
        </div>
        <Row gutter={16}>
          <Col xs={24} md={9}>
            <Card title="Roles-ka iyo Users-ka">
              <Table rowKey="targetKey" pagination={{ pageSize: 12 }} dataSource={targets} columns={[
                { title: 'Magaca', render: (_, row) => <Button type="link" onClick={() => choose(row)}>{row.targetType === 'user' ? row.name : (ROLE_LABELS[String(row.name).toLowerCase()] || row.name)}</Button> },
                { title: 'Nooca', render: (_, row) => <Tag color={row.targetType === 'user' ? 'green' : 'blue'}>{row.targetType === 'user' ? (ROLE_LABELS[String(row.role_name).toLowerCase()] || row.role_name) : 'Role'}</Tag> },
              ]} />
            </Card>
          </Col>
          <Col xs={24} md={15}>
            <Card title={selected ? `Awoodaha: ${selectedLabel}` : 'Dooro role ama user'}>
              {selected && <>
                <Checkbox.Group style={{ width: '100%' }} value={values} onChange={setValues} disabled={locked}>
                  <Row gutter={[12, 12]}>{permissions.map(permission => <Col xs={24} md={12} key={permission.id}><Checkbox value={permission.permission_key}><b>{permission.permission_key}</b><br /><Text type="secondary">{permission.description}</Text></Checkbox></Col>)}</Row>
                </Checkbox.Group>
                <Button type="primary" icon={<SaveOutlined />} onClick={save} disabled={locked} style={{ marginTop: 20 }}>Kaydi Awoodaha</Button>
              </>}
            </Card>
          </Col>
        </Row>
        <Modal title="Abuur Role Cusub" open={open} onCancel={() => setOpen(false)} footer={null}>
          <Form form={form} layout="vertical" onFinish={create}>
            <Form.Item name="name" label="Magaca Role-ka" rules={[{ required: true }]}><Input placeholder="tusaale: traffic_officer" /></Form.Item>
            <Form.Item name="description" label="Sharaxaadda"><Input.TextArea /></Form.Item>
            <Button type="primary" htmlType="submit">Abuur Role</Button>
          </Form>
        </Modal>
      </Space>
    </ProtectedRoute>
  );
}
