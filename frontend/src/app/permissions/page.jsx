'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, Card, Checkbox, Col, Form, Input, Modal, Row, Select, Space, Table, Tag, Typography } from 'antd';
import { HomeOutlined, PlusOutlined, SaveOutlined, SearchOutlined, TeamOutlined } from '@ant-design/icons';
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
  { key: 'warrants', title: 'Garannada Maxkamadda', prefixes: ['warrants.'] },
  { key: 'suspects', title: 'Eedaysanayaasha', prefixes: ['suspects.'] },
  { key: 'station_jail', title: 'Xabsiga Saldhigga', prefixes: ['station_jail.'] },
  { key: 'stations', title: 'Xarumaha Boliiska', prefixes: ['stations.'] },
  { key: 'central_jail', title: 'Xabsiga Dhexe', prefixes: ['jail.'] },
  { key: 'locations', title: 'Goobaha & Maamulka', prefixes: ['locations.'] },
  { key: 'reports', title: 'Warbixinada', prefixes: ['reports.'] },
];
const IMPLIED_PERMISSIONS = {
  'suspects.manage': ['suspects.view', 'suspects.create', 'suspects.update'],
  'stations.manage': ['stations.view'],
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
  const [targetSearch, setTargetSearch] = useState('');
  const [permissionSearch, setPermissionSearch] = useState('');
  const [category, setCategory] = useState('all');
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
  const visibleTargets = targets.filter(target => {
    const label = target.targetType === 'user' ? target.name : (ROLE_LABELS[String(target.name).toLowerCase()] || target.name);
    return String(label || '').toLowerCase().includes(targetSearch.trim().toLowerCase());
  });
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
  const visibleGroups = groupedPermissions.map(group => ({
    ...group,
    items: group.items.filter(item => {
      const term = permissionSearch.trim().toLowerCase();
      return (!term || `${item.permission_key} ${item.description || ''}`.toLowerCase().includes(term))
        && (category === 'all' || category === group.key);
    }),
  })).filter(group => group.items.length);
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
      <div className="permissions-admin-page">
        <header className="permissions-page-head">
          <div><Title level={2}>Maamulka Awoodaha</Title><Text>Roles-ka iyo user kasta awoodihiisa si gaar ah u maamul.</Text></div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Abuur Role Cusub</Button>
        </header>
        <div className="permissions-breadcrumb"><HomeOutlined /><span>Dashboard</span><b>›</b><strong>Maamulka Awoodaha</strong></div>
        <div className="permissions-workspace">
          <Card className="permissions-target-card" title="Roles-ka iyo Users-ka">
            <Input prefix={<SearchOutlined />} placeholder="Raadi role..." value={targetSearch} onChange={e => setTargetSearch(e.target.value)} allowClear />
            <Table rowKey="targetKey" size="small" pagination={{pageSize:12,showSizeChanger:false}} dataSource={visibleTargets}
              onRow={row => ({onClick:()=>choose(row)})}
              rowClassName={row => selected?.targetKey === row.targetKey ? 'permission-target-selected' : ''}
              columns={[
                {title:'Magaca',render:(_,row)=><span className="permission-target-name"><TeamOutlined />{row.targetType==='user'?row.name:(ROLE_LABELS[String(row.name).toLowerCase()]||row.name)}</span>},
                {title:'Nooca',width:82,render:(_,row)=><Tag color={row.targetType==='user'?'green':'blue'}>{row.targetType==='user'?'User':'Role'}</Tag>},
              ]}/>
          </Card>
          <section className="permissions-detail-card">
            {selected ? <>
              <div className="permissions-detail-head">
                <div><h3>Awoodaha: {selectedLabel}</h3><Text>{selectedCount} / {permissions.length} awood ayaa la doortay</Text><div className="permissions-progress"><i style={{width:`${permissions.length ? selectedCount/permissions.length*100 : 0}%`}} /></div></div>
                <div className="permissions-tools"><Input prefix={<SearchOutlined />} placeholder="Raadi awood..." value={permissionSearch} onChange={e=>setPermissionSearch(e.target.value)} allowClear/><Select value={category} onChange={setCategory} options={[{value:'all',label:'Dhammaan qaybaha'},...groupedPermissions.map(g=>({value:g.key,label:g.title}))]}/><Button onClick={()=>setModule(permissions,true)} disabled={locked}>Dooro dhammaan</Button><Button onClick={()=>setValues([])} disabled={locked}>Ka saar dhammaan</Button></div>
              </div>
              {locked&&<Alert type="warning" showIcon message="Admin role lama dhimi karo."/>}
              <div className="permissions-groups-scroll">
                <Checkbox.Group value={values} onChange={onPermissionChange} disabled={locked}>
                  {visibleGroups.map(group=>{const checkedCount=group.items.filter(item=>values.includes(item.permission_key)).length;return <div className="permission-module-card" key={group.key}>
                    <div className="permission-module-title"><strong>{group.title}</strong><span>{checkedCount}/{group.items.length}</span>{group.danger&&<Tag color="red">Xasaasi</Tag>}</div>
                    <Row gutter={[28,12]}>{group.items.map(permission=>{const impliedBy=Object.entries(IMPLIED_PERMISSIONS).find(([parent,children])=>children.includes(permission.permission_key)&&values.includes(parent))?.[0];return <Col xs={24} md={12} key={permission.id}><Checkbox value={permission.permission_key}><span className="permission-copy"><span><b>{permission.permission_key}</b>{HIGH_RISK_PERMISSIONS.has(permission.permission_key)&&<Tag color="red">Xasaasi</Tag>}{impliedBy&&<Tag color="blue">{impliedBy}</Tag>}</span><small>{permission.description}</small></span></Checkbox></Col>})}</Row>
                  </div>})}
                </Checkbox.Group>
              </div>
              <footer className="permissions-actions"><Button>Ka noqo</Button><Button type="primary" icon={<SaveOutlined/>} onClick={save} disabled={locked}>Kaydi Isbeddelada</Button></footer>
            </>:<div className="permissions-empty"><TeamOutlined/><h3>Dooro role ama user</h3><Text>Awoodaha aad maamulayso ka dooro liiska bidix.</Text></div>}
          </section>
        </div>
        <Modal title="Abuur Role Cusub" open={open} onCancel={() => setOpen(false)} footer={null}>
          <Form form={form} layout="vertical" onFinish={create}>
            <Form.Item name="name" label="Magaca Role-ka" rules={[{ required: true }]}><Input placeholder="tusaale: traffic_officer" /></Form.Item>
            <Form.Item name="description" label="Sharaxaadda"><Input.TextArea /></Form.Item>
            <Button type="primary" htmlType="submit">Abuur Role</Button>
          </Form>
        </Modal>
      </div>
    </ProtectedRoute>
  );
}
