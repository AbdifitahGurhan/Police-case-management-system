'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { App, Button, Card, Col, DatePicker, Form, Input, InputNumber, Modal, Row, Select, Space, Table, Tag, Typography, Upload } from 'antd';
import { DeleteOutlined, FileAddOutlined, InboxOutlined, LoginOutlined } from '@ant-design/icons';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import Link from 'next/link';
import { emailRule, noFutureDateTimeRule, disabledFutureDate, dynamicIdNumberRule, nameRules, phoneRules, requiredRule, textLengthRule } from '@/utils/validation';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

const commanderRoles = ['state_commander', 'region_commander', 'district_commander', 'police_station_commander'];
const ObSection = ({ number, title, children }) => <Card size="small" title={<Space><Tag color="blue">{number}</Tag><Text strong>{title}</Text></Space>} style={{marginBottom:16}}><Row gutter={[16,0]}>{children}</Row></Card>;

export default function ObRegisterPage() {
  const { user } = useAuth();
  const location = user?.location || {};
  const { message } = App.useApp();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [form] = Form.useForm();

  const [deployedOfficers, setDeployedOfficers] = useState([]);
  const [deployedOfficer, setDeployedOfficer] = useState(null);

  const fetchDeployedOfficers = useCallback(async () => {
    try {
      const res = await api.get('/police-officers');
      if (res.data?.success && Array.isArray(res.data.data)) {
        const allOfficers = res.data.data;
        const userLocName = location.districtName || location.regionName || location.stateName || '';

        // Filter officers matching the user's deployed location or active status
        const matchedOfficers = allOfficers.filter(o => {
          if (userLocName && o.current_assignment_name) {
            return String(o.current_assignment_name).toLowerCase() === String(userLocName).toLowerCase();
          }
          return o.employment_status === 'Active';
        });

        const activeList = matchedOfficers.length > 0 ? matchedOfficers : allOfficers;
        const primary = activeList.find(o => 
          (user?.email && String(o.email).toLowerCase() === String(user.email).toLowerCase()) ||
          (user?.fullName && String(o.full_name).toLowerCase() === String(user.fullName).toLowerCase())
        ) || (activeList.length > 0 ? activeList[0] : null);

        setDeployedOfficers(activeList);
        setDeployedOfficer(primary);

        if (primary) {
          form.setFieldsValue({
            registered_by_name: primary.full_name,
            registered_by_rank: primary.rank_name || ''
          });
        } else {
          form.setFieldsValue({
            registered_by_name: user?.fullName || user?.username,
            registered_by_rank: user?.rank || ''
          });
        }
      } else {
        form.setFieldsValue({
          registered_by_name: user?.fullName || user?.username,
          registered_by_rank: user?.rank || ''
        });
      }
    } catch (err) {
      form.setFieldsValue({
        registered_by_name: user?.fullName || user?.username,
        registered_by_rank: user?.rank || ''
      });
    }
  }, [form, user, location]);

  const handleOpenModal = () => {
    form.resetFields();
    setFiles([]);
    fetchDeployedOfficers();
    setOpen(true);
  };

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/ob-entries');
      setEntries(response.data.data || []);
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to load OB entries.');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const createEntry = async (values) => {
    setSaving(true);
    try {
      const payload = new FormData();
      Object.entries(values).forEach(([key,value]) => {
        if (value === undefined || value === null || value === '') return;
        payload.append(key, key === 'incident_datetime' ? value.format('YYYY-MM-DD HH:mm:ss') : value);
      });
      files.forEach(file => payload.append('attachments', file.originFileObj));
      const response = await api.post('/ob-entries', payload);
      message.success(`OB registered: ${response.data.obNumber}`);
      form.resetFields();
      setFiles([]);
      setOpen(false);
      loadEntries();
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to register OB entry.');
    } finally {
      setSaving(false);
    }
  };

  const canCreate = ['admin', 'ob_staff', 'officer', 'district_admin', ...commanderRoles].includes(user?.role);

  const columns = [
    { title: 'OB Number', dataIndex: 'ob_number', key: 'ob_number', render: (value) => <Text strong>{value}</Text> },
    { title: 'Case Title', dataIndex: 'case_title', key: 'case_title', render: (val) => val || 'N/A' },
    { title: 'Incident Type', dataIndex: 'incident_type', key: 'incident_type' },
    { title: 'Reported By', dataIndex: 'reported_by', key: 'reported_by' },
    { title: 'Registered By', dataIndex: 'registered_by_name', key: 'registered_by_name' },
    { title: 'District / Police Station', dataIndex: 'district_police_station_name', key: 'district_police_station_name' },
    { title: 'Date', dataIndex: 'registration_date', key: 'registration_date' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (value) => <Tag color={['CONVERTED_TO_CASE', 'CASE_OPENED'].includes(value) ? 'green' : 'blue'}>{value}</Tag> },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Link href={`/ob-register/${record.id}`}>
          <Button type="primary" size="small">Eeg Faahfaahinta</Button>
        </Link>
      ),
    },
  ];

  return (
    <ProtectedRoute allowedRoles={['admin', 'ob_staff', 'staff', 'officer', 'district_admin', 'cid', 'cid_director', 'cid_supervisor', 'cid_officer', ...commanderRoles]}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <Title level={2}>OB Register</Title>
            <Text type="secondary">Every OB entry records who registered it, when it was registered, and where it was registered.</Text>
          </div>
          {canCreate && (
            <Button type="primary" icon={<FileAddOutlined />} onClick={handleOpenModal}>
              Register OB Entry
            </Button>
          )}
        </div>

        <Card variant="none">
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}><Text type="secondary">Logged in as</Text><br /><Text strong>{user?.fullName || user?.username}</Text></Col>
            <Col xs={24} md={8}><Text type="secondary">Role</Text><br /><Tag color="blue">{user?.roleCode || user?.role}</Tag></Col>
            <Col xs={24} md={8}><Text type="secondary">District / Police Station</Text><br /><Text strong>{location.districtName || 'System level'}</Text></Col>
          </Row>
        </Card>

        <Card variant="none">
          <Table columns={columns} dataSource={entries} rowKey="id" loading={loading} scroll={{ x: 1100 }} />
        </Card>

        <Modal
          title="Register OB Entry"
          open={open}
          onCancel={() => setOpen(false)}
          footer={null}
          width={1100}
        >
          <Card size="small" variant="none" style={{ marginBottom: 16 }}>
            <Space orientation="vertical" size={2}>
              <Text><LoginOutlined /> Location is captured automatically from your user profile.</Text>
              <Text type="secondary">{location.stateName || 'Administration'} → {location.regionName || 'Region'} → {location.districtName || 'District / Police Station'}</Text>
            </Space>
          </Card>
          <Form form={form} layout="vertical" onFinish={createEntry} initialValues={{case_level:'normal',reporter_id_type:'National ID',respondent_id_type:'National ID',incident_datetime:dayjs().subtract(1,'hour')}}>
            <ObSection number="1" title="Xogta Dacwadda"><Col xs={24} md={16}><Form.Item name="case_title" label="Cinwaanka dacwadda" rules={[requiredRule('Cinwaanka'),textLengthRule('Cinwaanka',3,255)]}><Input/></Form.Item></Col><Col xs={24} md={8}><Form.Item name="case_type" label="Nooca dacwadda" rules={[requiredRule('Nooca dacwadda')]}><Select options={['Criminal','Civil','Family','Commercial','Administrative','Other'].map(v=>({value:v,label:v}))}/></Form.Item></Col><Col xs={24} md={8}><Form.Item name="case_level" label="Heerka"><Select options={[{value:'normal',label:'Caadi'},{value:'urgent',label:'Degdeg'},{value:'critical',label:'Halis'}]}/></Form.Item></Col><Col xs={24} md={8}><Form.Item name="incident_type" label="Nooca dhacdada" rules={[requiredRule('Nooca dhacdada')]}><Select options={['Theft','Robbery','Assault','Fraud','Traffic','General'].map(v=>({value:v,label:v}))}/></Form.Item></Col><Col xs={24} md={8}><Form.Item label="OB Number"><Input disabled value="Automatic — unique"/></Form.Item></Col></ObSection>
            <ObSection number="2" title="Dacwoodaha"><Col xs={24} md={12}><Form.Item name="reported_by" label="Magaca oo buuxa" rules={nameRules('Magaca dacwoodaha')}><Input/></Form.Item></Col><Col xs={12} md={6}><Form.Item name="reporter_id_type" label="Aqoonsiga"><Select options={['National ID','Passport'].map(v=>({value:v,label:v}))}/></Form.Item></Col><Col xs={12} md={6}><Form.Item name="reporter_id_number" label="Lambarka aqoonsiga" dependencies={['reporter_id_type']} rules={[requiredRule('Lambarka aqoonsiga'), dynamicIdNumberRule('reporter_id_type')]}><Input/></Form.Item></Col><Col xs={24} md={8}><Form.Item name="reporter_phone" label="Telefoon" rules={[requiredRule('Telefoon'),...phoneRules]}><Input/></Form.Item></Col><Col xs={24} md={8}><Form.Item name="reporter_email" label="Email" rules={[emailRule]}><Input/></Form.Item></Col><Col xs={24} md={8}><Form.Item name="reporter_address" label="Cinwaan"><Input/></Form.Item></Col></ObSection>
            <ObSection number="3" title="Laga Dacwooday"><Col xs={24} md={12}><Form.Item name="respondent_name" label="Magaca oo buuxa" rules={nameRules('Magaca laga dacwooday')}><Input/></Form.Item></Col><Col xs={12} md={6}><Form.Item name="respondent_id_type" label="Aqoonsiga"><Select options={['National ID','Passport'].map(v=>({value:v,label:v}))}/></Form.Item></Col><Col xs={12} md={6}><Form.Item name="respondent_id_number" label="Lambarka aqoonsiga" dependencies={['respondent_id_type']} rules={[dynamicIdNumberRule('respondent_id_type')]}><Input/></Form.Item></Col><Col xs={24} md={8}><Form.Item name="respondent_phone" label="Telefoon" rules={phoneRules}><Input/></Form.Item></Col><Col xs={24} md={8}><Form.Item name="respondent_email" label="Email" rules={[emailRule]}><Input/></Form.Item></Col><Col xs={24} md={8}><Form.Item name="respondent_address" label="Cinwaan"><Input/></Form.Item></Col></ObSection>
            <ObSection number="4" title="Faahfaahinta Dacwadda"><Col xs={24} md={12}><Form.Item name="incident_location" label="Goobta dhacdada" rules={[requiredRule('Goobta'),textLengthRule('Goobta',3,255)]}><Input/></Form.Item></Col><Col xs={24} md={12}><Form.Item name="incident_datetime" label="Taariikhda iyo waqtiga" rules={[requiredRule('Taariikhda'),noFutureDateTimeRule('Taariikhda')]}><DatePicker showTime style={{width:'100%'}} disabledDate={disabledFutureDate}/></Form.Item></Col><Col xs={24} md={12}><Form.Item name="claim_value" label="Qiimaha dacwadda (USD)" rules={[{validator:(_,v)=>v===undefined||v===null||v===''||Number(v)>=0?Promise.resolve():Promise.reject(new Error('Amount cannot be negative.'))}]}><InputNumber min={0} precision={2} step={0.01} stringMode prefix="$" style={{width:'100%'}}/></Form.Item></Col><Col span={24}><Form.Item name="description" label="Sharaxaad faahfaahsan" rules={[requiredRule('Sharaxaadda'),textLengthRule('Sharaxaadda',10,5000)]}><TextArea rows={5} showCount maxLength={5000}/></Form.Item></Col></ObSection>
            <ObSection number="5" title="Caddeymaha"><Col span={24}><Upload.Dragger multiple accept=".pdf,image/*,video/*" fileList={files} beforeUpload={file=>{if(file.size>10*1024*1024){message.error('File-ku waa inuu ka yaraadaa 10MB.');return Upload.LIST_IGNORE}setFiles(old=>[...old,{...file,originFileObj:file,status:'done'}]);return false}} onRemove={file=>setFiles(old=>old.filter(x=>x.uid!==file.uid))}><p className="ant-upload-drag-icon"><InboxOutlined/></p><p>PDF, sawir ama fiidiyow halkan ku jiid</p><p className="ant-upload-hint">Ugu badnaan 10 files, midkiiba 10MB</p></Upload.Dragger></Col></ObSection>
            <ObSection number="6" title="Xogta Diiwaangelinta">
              <Col xs={24} md={6}><Form.Item label="Xafiiska"><Input readOnly value={location.districtName||location.regionName||'System'}/></Form.Item></Col>
              <Col xs={24} md={6}>
                <Form.Item name="registered_by_name" label="Shaqaalaha / Sarkaal" rules={[requiredRule('Shaqaalaha')]}>
                  {deployedOfficers.length > 1 ? (
                    <Select
                      showSearch
                      placeholder="Dooro Sarkaalka Diiwaangelinaya"
                      onChange={(val) => {
                        const selected = deployedOfficers.find(o => o.full_name === val);
                        if (selected) {
                          form.setFieldsValue({ registered_by_rank: selected.rank_name || '' });
                        }
                      }}
                      options={deployedOfficers.map(o => ({
                        value: o.full_name,
                        label: `${o.full_name}${o.rank_name ? ` (${o.rank_name})` : ''}${o.force_number ? ` - ${o.force_number}` : ''}`
                      }))}
                    />
                  ) : (
                    <Input placeholder="Sarkaalka Diiwaangelinaya" />
                  )}
                </Form.Item>
              </Col>
              <Form.Item name="registered_by_rank" hidden><Input /></Form.Item>
              <Col xs={24} md={6}><Form.Item label="Taariikhda"><Input readOnly value={dayjs().format('YYYY-MM-DD')}/></Form.Item></Col>
              <Col xs={24} md={6}><Form.Item label="Waqtiga"><Input readOnly value={dayjs().format('HH:mm:ss')}/></Form.Item></Col>
            </ObSection>
            <div style={{display:'flex',justifyContent:'flex-end',gap:8}}><Button onClick={()=>setOpen(false)}>Jooji</Button><Button icon={<DeleteOutlined/>} onClick={()=>{form.resetFields();setFiles([])}}>Nadiifi</Button><Button type="primary" htmlType="submit" loading={saving}>Kaydi</Button></div>
          </Form>
        </Modal>
      </Space>
    </ProtectedRoute>
  );
}
