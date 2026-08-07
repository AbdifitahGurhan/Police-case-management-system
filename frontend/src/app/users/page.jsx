// src/app/users/page.jsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, Card, Typography, Space, Button, Tag, Modal, Form, Input, Select, Popconfirm, Row, Col, App, Avatar, Descriptions } from 'antd';
import { UserAddOutlined, EditOutlined, DeleteOutlined, LockOutlined, EyeOutlined } from '@ant-design/icons';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { emailRule, nameRules, optionalPasswordRules, passwordRules, phoneRules, requiredRule, textLengthRule, usernameRules } from '@/utils/validation';

const { Title, Text } = Typography;
const { Option } = Select;



export default function UserManagementPage() {
  const { user } = useAuth();
  const { message } = App.useApp();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [states, setStates] = useState([]);
  const [regions, setRegions] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [allOfficers, setAllOfficers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [viewingUser, setViewingUser] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [regionalForm] = Form.useForm();
  const [regionalOpen, setRegionalOpen] = useState(false);
  const regionalRoleId = Form.useWatch('role_id', regionalForm);
  const selectedRegionalRole = roles.find((role) => role.id === regionalRoleId);
  const isDistrictCreate = user?.role === 'district_admin' && !editingUser;

  const selectedRoleId = Form.useWatch('role_id', form);
  const selectedRoleName = useMemo(() => {
    const found = roles.find((r) => r.id === selectedRoleId);
    return found ? String(found.name).toLowerCase() : '';
  }, [roles, selectedRoleId]);

  const generalLevelOfficers = useMemo(() => {
    const allowedCodes = new Set(['SGT', 'SGS', 'SG']);
    return (allOfficers || []).filter((o) => {
      if (editingUser && (Number(o.id) === Number(editingUser.police_officer_id) || Number(o.id) === Number(editingUser.officer_id))) {
        return true;
      }
      const code = String(o.rank_code || '').trim().toUpperCase();
      const name = String(o.rank_name || '').toLowerCase();
      return allowedCodes.has(code) || name.includes('sareeye');
    });
  }, [allOfficers, editingUser]);

  const districtOfficers = useMemo(() => {
    return (allOfficers || []).filter((o) => {
      if (editingUser && (Number(o.id) === Number(editingUser.police_officer_id) || Number(o.id) === Number(editingUser.officer_id))) {
        return true;
      }
      const isApproved = String(o.approval_status || '').toUpperCase() === 'APPROVED';
      const isActive = String(o.employment_status || '').toLowerCase() === 'active';
      return isApproved && isActive;
    });
  }, [allOfficers, editingUser]);

  const operationalRoleLabel = (role) => ({
    investigator: 'Baare',
    station_jail: 'Station Jail',
  }[String(role?.name || '').toLowerCase()] || role?.name);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, rRes, stateRes, regionRes, districtRes, officerRes] = await Promise.allSettled([
        api.get('/users'),
        api.get('/users/roles'),
        api.get('/state-administrations'),
        api.get('/regions'),
        api.get('/districts'),
        api.get('/police-officers'),
      ]);
      if (uRes.status === 'rejected' || rRes.status === 'rejected') {
        throw uRes.reason || rRes.reason;
      }
      setUsers(uRes.value.data.data);
      setRoles(rRes.value.data.data);
      setStates(stateRes.status === 'fulfilled' ? stateRes.value.data.data : []);
      setRegions(regionRes.status === 'fulfilled' ? regionRes.value.data.data : []);
      setDistricts(districtRes.status === 'fulfilled' ? districtRes.value.data.data : []);
      setAllOfficers(officerRes.status === 'fulfilled' ? officerRes.value.data.data : []);
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

  const handleOpenView = async (record) => {
    const hide = message.loading("Fetching user details...", 0);
    try {
      const res = await api.get(`/users/${record.id}`);
      hide();
      if (res.data?.success) {
        setViewingUser(res.data.data);
        setIsViewModalOpen(true);
      } else {
        message.error("Failed to load user details.");
      }
    } catch (err) {
      hide();
      console.error(err);
      message.error(err.response?.data?.message || "Failed to fetch user details.");
    }
  };

  const handleOpenEdit = async (record) => {
    const hide = message.loading("Fetching user details...", 0);
    try {
      if (!allOfficers.length) {
        api.get('/police-officers').then((res) => setAllOfficers(res.data.data || [])).catch(() => {});
      }
      const res = await api.get(`/users/${record.id}`);
      hide();
      if (res.data?.success) {
        const fullUser = res.data.data;
        setEditingUser(fullUser);
        form.setFieldsValue({
          ...fullUser,
          role_id: fullUser.role_id || roles.find(r => r.name === fullUser.role)?.id,
          police_officer_id: fullUser.police_officer_id || undefined,
          password: '********', // Show dummy placeholder indicating a password is set
        });
        setIsModalOpen(true);
      } else {
        message.error("Failed to load user details.");
      }
    } catch (err) {
      hide();
      console.error(err);
      message.error(err.response?.data?.message || "Failed to fetch user details.");
    }
  };

  const handleOpenAdd = () => {
    setEditingUser(null);
    form.resetFields();
    if (!allOfficers.length) {
      api.get('/police-officers').then((res) => setAllOfficers(res.data.data || [])).catch(() => {});
    }
    setIsModalOpen(true);
  };

  const roleLabel=role=>String(role?.name).toLowerCase()==='jail'?'Jail-ka Sare':String(role?.name).toLowerCase()==='district_admin'?'District Administration':'Diiwaanka Ciidanka';
  const saveRegionalAccount=async values=>{try{const role=roles.find(r=>r.id===values.role_id);await api.post('/users',values);message.success(`${roleLabel(role)} waa la abuuray.`);setRegionalOpen(false);regionalForm.resetFields();fetchData()}catch(error){message.error(error.response?.data?.message||'Account-ka lama abuuri karin.')}};

  const handleSave = async (values) => {
    try {
      const payload = { ...values };
      // If the password is still the dummy placeholder, remove it from the payload to keep the current password.
      if (payload.password === '********') {
        delete payload.password;
      }
      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, payload);
        message.success("User updated successfully.");
      } else {
        await api.post('/users', payload);
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

  const roleColors = { 
    admin: 'magenta', 
    officer: 'blue', 
    cid: 'purple', 
    OB_STAFF: 'cyan', 
    STAFF: 'green', 
    POLICE_STATION_COMMANDER: 'gold',
    court: 'volcano',
    jail: 'red'
  };

  const columns = [
    { 
      title: 'Full Name', 
      dataIndex: 'full_name', 
      key: 'full_name', 
      render: (t, record) => (
        <Space>
          <Avatar 
            src={record.profile_image}
            style={{ 
              background: 'linear-gradient(135deg, var(--ui-primary-2), var(--ui-primary))',
              verticalAlign: 'middle' 
            }}
          >
            {t ? t.charAt(0).toUpperCase() : '?'}
          </Avatar>
          <Typography.Text strong>{t}</Typography.Text>
        </Space>
      )
    },
    { 
      title: 'Username', 
      dataIndex: 'username', 
      key: 'username',
      render: (u) => <Typography.Text type="secondary">{u}</Typography.Text>
    },
    { title: 'Rank', dataIndex: 'rank', key: 'rank' },
    { title: 'User Type', dataIndex: 'user_type', key: 'user_type', render: (v) => <Tag>{v || 'STAFF'}</Tag> },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Role', dataIndex: 'role', key: 'role', render: (r) => <Tag color={roleColors[r]}>{String(r).toUpperCase()}</Tag> },
    { title: 'State', dataIndex: 'state_name', key: 'state_name' },
    { title: 'Region', dataIndex: 'region_name', key: 'region_name' },
    { title: 'District / Police Station', dataIndex: 'district_police_station_name', key: 'district_police_station_name' },

    { title: 'Status', dataIndex: 'is_active', key: 'is_active', render: (a) => a ? <Tag color="success">ACTIVE</Tag> : <Tag color="error">INACTIVE</Tag> },
    {
      title: 'Ficillada',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => handleOpenView(record)} />
          <Button icon={<EditOutlined />} onClick={() => handleOpenEdit(record)} />
          <Popconfirm title="Deactivate user?" onConfirm={() => handleDeactivate(record.id)}>
            <Button icon={<DeleteOutlined />} danger disabled={!record.is_active} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <ProtectedRoute allowedRoles={['admin', 'sub_admin', 'region_admin', 'district_admin']}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '8px' }}>
          <div style={{ minWidth: '280px', flex: '1 1 auto' }}>
            <Title level={2} style={{ margin: 0 }}>Access Control Center</Title>
            <Typography.Text type="secondary">Manage police staff, assigned ranks, and system access levels.</Typography.Text>
          </div>
          {user?.role==='region_admin'?<Button type="primary" icon={<UserAddOutlined/>} onClick={()=>{regionalForm.resetFields();setRegionalOpen(true)}}>Abuur User Gobol</Button>:<Button 
            type="primary" 
            icon={<UserAddOutlined />} 
            onClick={handleOpenAdd}
            style={{ flex: '0 0 auto' }}
          >
            {user?.role === 'district_admin' ? 'Abuur User Degmo' : 'Add New Staff'}
          </Button>}
        </div>

        <Card variant="none">
          <Table columns={columns} dataSource={(users || []).filter(u => String(u.id) !== String(user?.id) && String(u.username).toLowerCase() !== String(user?.username || '').toLowerCase())} rowKey="id" loading={loading} scroll={{ x: 'max-content' }} />
        </Card>

        {/* View Details Modal */}
        <Modal
          title={
            <Space>
              <LockOutlined style={{ color: '#1677ff' }} />
              <span>Staff Account Details</span>
            </Space>
          }
          open={isViewModalOpen}
          onCancel={() => setIsViewModalOpen(false)}
          footer={[
            <Button key="close" type="primary" onClick={() => setIsViewModalOpen(false)}>
              Close
            </Button>
          ]}
          width={650}
        >
          {viewingUser && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #f0f0f0' }}>
                <Avatar
                  size={72}
                  src={viewingUser.profile_image}
                  style={{
                    background: 'linear-gradient(135deg, var(--ui-primary-2), var(--ui-primary))',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                    fontSize: 32
                  }}
                >
                  {viewingUser.full_name ? viewingUser.full_name.charAt(0).toUpperCase() : '?'}
                </Avatar>
                <div>
                  <Title level={4} style={{ margin: 0 }}>{viewingUser.full_name}</Title>
                  <Text type="secondary">{viewingUser.rank || 'No Rank'} • {viewingUser.user_type || 'STAFF'}</Text>
                  <div style={{ marginTop: 6 }}>
                    <Tag color={roleColors[viewingUser.role]}>{String(viewingUser.role || '').toUpperCase()}</Tag>
                    {viewingUser.is_active ? (
                      <Tag color="success">ACTIVE</Tag>
                    ) : (
                      <Tag color="error">INACTIVE</Tag>
                    )}
                  </div>
                </div>
              </div>

              <Descriptions column={2} bordered size="small" layout="horizontal">
                <Descriptions.Item label="Username" span={2}>{viewingUser.username}</Descriptions.Item>
                <Descriptions.Item label="Assigned Level" span={2}>
                  <Tag color="blue">{viewingUser.assigned_level || 'ADMINISTRATION'}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="State" span={2}>{viewingUser.state_name || 'All States'}</Descriptions.Item>
                <Descriptions.Item label="Region" span={2}>{viewingUser.region_name || 'All Regions'}</Descriptions.Item>
                <Descriptions.Item label="District / Station" span={2}>{viewingUser.district_police_station_name || 'All Districts'}</Descriptions.Item>
                <Descriptions.Item label="Created By" span={2}>{viewingUser.created_by || 'System'}</Descriptions.Item>
                <Descriptions.Item label="Last Login" span={2}>
                  {viewingUser.last_login ? new Date(viewingUser.last_login).toLocaleString() : 'Never'}
                </Descriptions.Item>
              </Descriptions>
            </div>
          )}
        </Modal>
        <Modal title="Abuur User-ka Gobolka" open={regionalOpen} onCancel={()=>setRegionalOpen(false)} footer={null}>
          <Form form={regionalForm} layout="vertical" onFinish={saveRegionalAccount}>
            <Form.Item name="role_id" label="Role-ka" rules={[{required:true,message:'Dooro role-ka.'}]}><Select options={roles.map(role=>({value:role.id,label:roleLabel(role)}))}/></Form.Item>
            {String(selectedRegionalRole?.name).toLowerCase()==='district_admin'&&<Form.Item name="district_id" label="Degmada uu Maamulayo" rules={[{required:true,message:'Dooro degmada.'}]}><Select showSearch optionFilterProp="label" options={districts.filter(d=>!d.region_id||Number(d.region_id)===Number(user?.location?.regionId)).map(d=>({value:d.id,label:d.district_name}))}/></Form.Item>}
            <Form.Item name="username" label="Username" rules={usernameRules}><Input/></Form.Item>
            <Form.Item name="password" label="Password" rules={passwordRules}><Input.Password/></Form.Item>
            <Typography.Text type="secondary">Magaca iyo gobolka system-ka ayaa si otomaatig ah u gelinaya.</Typography.Text>
            <Space style={{width:'100%',justifyContent:'flex-end',marginTop:16}}><Button onClick={()=>setRegionalOpen(false)}>Jooji</Button><Button type="primary" htmlType="submit">Abuur Account</Button></Space>
          </Form>
        </Modal>
        {/* Create/Edit Modal */}
        <Modal 
          title={editingUser ? "Wax ka Beddel User-ka" : isDistrictCreate ? "Abuur User Degmo" : "Onboard New Staff"} 
          open={isModalOpen} 
          onCancel={() => setIsModalOpen(false)} 
          onOk={() => form.submit()}
          okText={editingUser ? 'Kaydi' : 'Abuur Account'}
          cancelText="Jooji"
          width={600}
        >
          <Form form={form} layout="vertical" onFinish={handleSave}>
            {isDistrictCreate && <>
              <Form.Item name="role_id" label="Role-ka Shaqada" rules={[{required:true,message:'Dooro role-ka shaqada.'}]}>
                <Select placeholder="Dooro role-ka" options={roles.map(role=>({value:role.id,label:operationalRoleLabel(role)}))}/>
              </Form.Item>
              <Form.Item
                name="police_officer_id"
                label="Sarkaalka / Askariga Loo Deploy Gareeynayo (Ikhtiyaari)"
              >
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Dooro sarkaalka (ikhtiyaari)"
                  options={districtOfficers.map((o) => ({
                    value: o.id,
                    label: `${o.full_name} · ${o.rank_name || 'Darajo la’aan'} (${o.force_number})`,
                  }))}
                />
              </Form.Item>
              <Form.Item name="username" label="Username" rules={usernameRules}><Input /></Form.Item>
              <Form.Item name="password" label="Password" rules={passwordRules}><Input.Password /></Form.Item>
              <Typography.Text type="secondary">Account-kan wuxuu si otomaatig ah ugu xirnaanayaa degmada aad maamusho.</Typography.Text>
            </>}
            {!isDistrictCreate && (
              <Row gutter={16}>
                <Col xs={24}>
                  <Form.Item name="role_id" label="Select Role" rules={[requiredRule('Select role')]}>
                    <Select placeholder="Dooro role-ka">
                      {roles.map((r) => (
                        <Option key={r.id} value={r.id}>
                          {r.name.toUpperCase()}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>

                {selectedRoleName === 'sub_admin' ? (
                  <Col xs={24}>
                    <Form.Item
                      name="police_officer_id"
                      label="Sarkaalka Booliska (Sareeye Guuto iyo wuxi ka sareeya)"
                      rules={[{ required: true, message: 'Dooro sarkaalka Booliska.' }]}
                    >
                      <Select
                        showSearch
                        optionFilterProp="label"
                        placeholder="Dooro sarkaalka (Sareeye Guuto+)"
                        options={generalLevelOfficers.map((o) => ({
                          value: o.id,
                          label: `${o.full_name} · ${o.rank_name || 'Darajo la’aan'} (${o.rank_code || ''}) · ${o.force_number}`,
                        }))}
                      />
                    </Form.Item>
                  </Col>
                ) : (
                  <Col xs={24}>
                    <Form.Item
                      name="police_officer_id"
                      label="Sarkaalka / Askariga Loo Deploy Gareeynayo (Ikhtiyaari)"
                    >
                      <Select
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        placeholder="Dooro sarkaalka Booliska (ikhtiyaari)"
                        options={districtOfficers.map((o) => ({
                          value: o.id,
                          label: `${o.full_name} · ${o.rank_name || 'Darajo la’aan'} (${o.force_number})`,
                        }))}
                      />
                    </Form.Item>
                  </Col>
                )}

                <Col xs={24}>
                  <Form.Item name="username" label="Username" rules={usernameRules}>
                    <Input placeholder="Qor username" />
                  </Form.Item>
                </Col>

                <Col xs={24}>
                  <Form.Item
                    name="password"
                    label={editingUser ? 'Change Password (optional)' : 'Password'}
                    rules={editingUser ? optionalPasswordRules : passwordRules}
                  >
                    <Input.Password placeholder="Qor password-ka" />
                  </Form.Item>
                </Col>

                {editingUser && (
                  <Col xs={24}>
                    <Form.Item name="is_active" label="Status" valuePropName="checked">
                      <Select>
                        <Option value={1}>ACTIVE</Option>
                        <Option value={0}>INACTIVE</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                )}
              </Row>
            )}
          </Form>
        </Modal>
      </Space>
    </ProtectedRoute>
  );
}
