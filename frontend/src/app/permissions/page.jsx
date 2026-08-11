'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, Card, Checkbox, Col, Form, Input, Modal, Row, Space, Table, Tag, Typography } from 'antd';
import { PlusOutlined, SaveOutlined } from '@ant-design/icons';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';

const { Title, Text } = Typography;
const ROLE_LABELS = {
  admin: 'Admin', sub_admin: 'Sub Admin', state_admin: 'State Administration',
  region_admin: 'Region Administration', district_admin: 'District Administration',
  personnel_registry: 'Diiwaanka Ciidanka', ob_staff: 'Diiwaangeliyaha OB-da',
  investigator: 'Baare', station_jail: 'Xabsiga Saldhigga', jail: 'Xabsiga Dhexe',
  court: 'Maxkamad', court_admin: 'Maamulka Maxkamadda', judge: 'Garsoore',
  prosecutor: 'Xeer-ilaaliye', prosecutor_liaison: 'Xiriiriyaha Xeer-ilaalinta',
  court_clerk: 'Kaaliyaha Maxkamadda', state_commander: 'Taliyaha Maamul-Goboleedka',
  region_commander: 'Taliyaha Gobolka', district_commander: 'Taliyaha Degmada',
  police_station_commander: 'Taliyaha Saldhigga',
};
const HIERARCHY_ROLES = ['admin', 'sub_admin', 'state_admin', 'region_admin', 'district_admin'];
const PERMISSION_GROUPS = [
  { key: 'system', title: 'Nidaamka & Maamulka', prefixes: ['permissions.', 'roles.', 'users.', 'audit_logs.'], danger: true },
  { key: 'officers', title: 'Saraakiisha & Darajooyinka', prefixes: ['officers.', 'ranks.'] },
  { key: 'ob', title: 'Diiwaanka OB', prefixes: ['ob.'] },
  { key: 'cases', title: 'Kiisaska & Baaritaanka', prefixes: ['cases.', 'evidence.'] },
  { key: 'suspects', title: 'Eedaysanayaasha', prefixes: ['suspects.'] },
  { key: 'station_jail', title: 'Xabsiga Saldhigga', prefixes: ['station_jail.'] },
  { key: 'central_jail', title: 'Xabsiga Dhexe', prefixes: ['jail.'] },
  { key: 'locations', title: 'Goobaha & Maamulka', prefixes: ['locations.'] },
  { key: 'reports', title: 'Warbixinada', prefixes: ['reports.'] },
];
const IMPLIED_PERMISSIONS = {
  'suspects.manage': ['suspects.view', 'suspects.create', 'suspects.update'],
};
const HIGH_RISK_PERMISSIONS = new Set([
  'permissions.manage',
  'roles.manage',
  'users.manage',
  'officers.delete',
  'audit_logs.view',
]);

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

  useEffect(() => {
    const timer = setTimeout(() => load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

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
  const groupedPermissions = useMemo(() => {
    const used = new Set();
    const groups = PERMISSION_GROUPS.map(group => {
      const items = permissions.filter(permission => (
        group.prefixes.some(prefix => permission.permission_key.startsWith(prefix))
      ));
      items.forEach(item => used.add(item.permission_key));
      return { ...group, items };
    }).filter(group => group.items.length);
    const other = permissions.filter(permission => !used.has(permission.permission_key));
    return other.length ? [...groups, { key: 'other', title: 'Kale', prefixes: [], items: other }] : groups;
  }, [permissions]);
  const selectedCount = values.length;
  const setModule = (items, checked) => {
    const keys = items.map(item => item.permission_key);
    setValues(current => checked
      ? [...new Set([...current, ...keys])]
      : current.filter(key => !keys.includes(key)));
  };
  const onPermissionChange = nextValues => {
    const expanded = new Set(nextValues);
    Object.entries(IMPLIED_PERMISSIONS).forEach(([parent, children]) => {
      if (expanded.has(parent)) children.forEach(child => expanded.add(child));
    });
    setValues([...expanded]);
  };

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
                <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                  {locked && <Alert type="warning" showIcon message="Admin role lama dhimi karo." />}
                  <Text type="secondary">{selectedCount} / {permissions.length} awood ayaa la doortay.</Text>
                  <Checkbox.Group style={{ width: '100%' }} value={values} onChange={onPermissionChange} disabled={locked}>
                    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                      {groupedPermissions.map(group => {
                        const groupKeys = group.items.map(item => item.permission_key);
                        const checkedCount = groupKeys.filter(key => values.includes(key)).length;
                        return (
                          <Card
                            key={group.key}
                            size="small"
                            title={<Space><span>{group.title}</span><Tag>{checkedCount}/{group.items.length}</Tag>{group.danger && <Tag color="red">High risk</Tag>}</Space>}
                            extra={
                              <Space>
                                <Button size="small" onClick={() => setModule(group.items, true)} disabled={locked}>Dooro dhammaan</Button>
                                <Button size="small" onClick={() => setModule(group.items, false)} disabled={locked}>Ka saar dhammaan</Button>
                              </Space>
                            }
                          >
                            <Row gutter={[12, 12]}>
                              {group.items.map(permission => {
                                const impliedBy = Object.entries(IMPLIED_PERMISSIONS)
                                  .find(([parent, children]) => children.includes(permission.permission_key) && values.includes(parent))?.[0];
                                return (
                                  <Col xs={24} md={12} key={permission.id}>
                                    <Checkbox value={permission.permission_key}>
                                      <Space orientation="vertical" size={0}>
                                        <Space wrap>
                                          <b>{permission.permission_key}</b>
                                          {HIGH_RISK_PERMISSIONS.has(permission.permission_key) && <Tag color="red">xasaasi</Tag>}
                                          {impliedBy && <Tag color="blue">wuxuu ka yimaadaa {impliedBy}</Tag>}
                                        </Space>
                                        <Text type="secondary">{permission.description}</Text>
                                      </Space>
                                    </Checkbox>
                                  </Col>
                                );
                              })}
                            </Row>
                          </Card>
                        );
                      })}
                    </Space>
                </Checkbox.Group>
                  <Button type="primary" icon={<SaveOutlined />} onClick={save} disabled={locked}>Kaydi Awoodaha</Button>
                </Space>
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
