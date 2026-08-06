'use client';

import React, { useState, useEffect, use, useCallback } from 'react';
import { Card, Descriptions, Table, Typography, Tag, Space, Button, Modal, Form, Select, Input, App, Avatar, Row, Col, Divider, Image } from 'antd';
import { SwapOutlined, ArrowLeftOutlined, AuditOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';
import dayjs from 'dayjs';
import { requiredRule, textLengthRule } from '@/utils/validation';
import { useAuth } from '@/contexts/AuthContext';

const { Title, Text } = Typography;
const { Option } = Select;
const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

const getImageUrl = (pathStr) => {
  if (!pathStr) return null;
  if (pathStr.startsWith('http://') || pathStr.startsWith('https://') || pathStr.startsWith('data:')) {
    return pathStr;
  }
  const cleanPath = pathStr.startsWith('/') ? pathStr : `/${pathStr}`;
  return `${API_ORIGIN}${cleanPath}`;
};

export default function OfficerDetailsPage({ params }) {
  const { message } = App.useApp();
  const { user } = useAuth();
  const canViewLocations = user?.role === 'admin' || user?.permissions?.includes('*') || user?.permissions?.includes('locations.view');
  const canTransfer = (user?.role === 'admin' || user?.permissions?.includes('*') || user?.permissions?.includes('officers.transfer')) && canViewLocations;
  const router = useRouter();
  const { id } = use(params);
  const [officer, setOfficer] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferForm] = Form.useForm();
  
  const [states, setStates] = useState([]);
  const [regions, setRegions] = useState([]);
  const [cities, setCities] = useState([]);
  const [districts, setDistricts] = useState([]);

  const assignmentType = Form.useWatch('to_assignment_type', transferForm);
  const selectedState = Form.useWatch('state_id', transferForm);
  const selectedRegion = Form.useWatch('region_id', transferForm);
  const selectedCity = Form.useWatch('city_id', transferForm);
  const selectedDistrict = Form.useWatch('district_id', transferForm);

  useEffect(() => {
    if (isTransferModalOpen && canViewLocations && user?.role !== 'district_admin') {
       api.get('/state-administrations').then(res => setStates(res.data.data)).catch(console.error);
    }
  }, [isTransferModalOpen, canViewLocations, user?.role]);

  useEffect(() => {
    if (canViewLocations && selectedState) {
       api.get(`/regions?state_administration_id=${selectedState}`).then(res => setRegions(res.data.data)).catch(console.error);
       transferForm.setFieldsValue({ region_id: undefined, city_id: undefined, district_id: undefined });
    }
  }, [selectedState, transferForm, canViewLocations]);

  useEffect(() => {
    if (canViewLocations && selectedRegion) {
       api.get(`/cities?region_id=${selectedRegion}`).then(res => setCities(res.data.data)).catch(console.error);
       transferForm.setFieldsValue({ city_id: undefined, district_id: undefined });
    }
  }, [selectedRegion, transferForm, canViewLocations]);

  useEffect(() => {
    if (canViewLocations && selectedCity) {
       api.get(`/districts?city_id=${selectedCity}`).then(res => setDistricts(res.data.data)).catch(console.error);
       transferForm.setFieldsValue({ district_id: undefined });
    }
  }, [selectedCity, transferForm, canViewLocations]);


  const fetchOfficerDetails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/police-officers/${id}`);
      setOfficer(res.data.data);
    } catch (err) {
      if (err.response?.status !== 403) {
        message.error("Failed to load officer details.");
      }
    } finally {
      setLoading(false);
    }
  }, [id, message]);

  useEffect(() => {
    if (id) fetchOfficerDetails();
  }, [fetchOfficerDetails, id]);

  const handleTransfer = async () => {
    try {
      const values = await transferForm.validateFields();
      
      let targetId = null;
      if (values.to_assignment_type === 'State Administration') targetId = values.state_id;
      if (values.to_assignment_type === 'Region') targetId = values.region_id;
      if (values.to_assignment_type === 'City') targetId = values.city_id;
      if (values.to_assignment_type === 'District') targetId = values.district_id;
      if (values.to_assignment_type === 'District Station') targetId = values.district_id;
      if (user?.role === 'district_admin' && ['District', 'District Station'].includes(values.to_assignment_type)) {
        targetId = user.scopeId;
      }

      if (!targetId) {
        return message.error("Please complete the unit selection dropdowns.");
      }

      await api.post('/officer-transfers', {
        officer_id: officer.id,
        to_assignment_type: values.to_assignment_type,
        to_assignment_id: targetId,
        transfer_reason: values.transfer_reason,
        remarks: values.remarks
      });
      message.success("Officer successfully transferred.");
      setIsTransferModalOpen(false);
      transferForm.resetFields();
      fetchOfficerDetails(); // Reload data to show updated histories
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || "Transfer failed.");
    }
  };

  if (!officer && !loading) {
    return <Card><h2>Officer not found or you do not have access.</h2><Button onClick={() => router.back()}>Go Back</Button></Card>;
  }

  const assignmentCols = [
    { title: 'Heerka', dataIndex: 'assignment_type', key: 'type', render: t => <Tag color="geekblue">{t}</Tag> },
    { title: 'Goobta Shaqada', dataIndex: 'assignment_name', key: 'name' },
    { title: 'Faallooyinka', dataIndex: 'remarks', key: 'remarks' },
    { title: 'Xaaladda', dataIndex: 'is_current', key: 'is_current', render: c => c === 1 ? <Tag color="green">Hadda</Tag> : <Tag>Hore</Tag> },
    { title: 'Taariikhda Qoondeynta', dataIndex: 'assigned_at', key: 'date', render: d => dayjs(d).format('DD MMM YYYY') }
  ];

  const transferCols = [
    { title: 'Laga soo Wareejiyey', key: 'from', render: (_, record) => record.from_assignment_type ? `${record.from_assignment_name || record.from_assignment_type} · ${record.from_assignment_type}` : 'Diiwaangelin Cusub' },
    { title: 'Loo Wareejiyey', key: 'to', render: (_, record) => `${record.to_assignment_name || record.to_assignment_type} · ${record.to_assignment_type}` },
    { title: 'Sababta', dataIndex: 'transfer_reason', key: 'reason' },
    { title: 'Taariikhda', dataIndex: 'transferred_at', key: 'date', render: d => dayjs(d).format('DD MMM YYYY') }
  ];

  return (
    <ProtectedRoute allowedRoles={['admin', 'state_admin', 'region_admin', 'region_commander', 'city_admin', 'district_admin', 'neighborhood_admin']}>
      <Card loading={loading} variant="none">
        
        <Space orientation="vertical" size="large" style={{ width: '100%' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Space align="center" size="large">
              <Button icon={<ArrowLeftOutlined />} shape="circle" onClick={() => router.back()} />
              <Image
                src={getImageUrl(officer?.profile_image)}
                alt={officer?.full_name}
                width={84}
                height={84}
                style={{ objectFit: 'cover', borderRadius: '50%', border: '2px solid #1677ff' }}
                fallback={`https://ui-avatars.com/api/?name=${encodeURIComponent(officer?.full_name || 'Officer')}&background=0D8ABC&color=fff&size=128`}
              />
              <div>
                <Title level={2} style={{ margin: 0 }}>{officer?.full_name}</Title>
                <Text type="secondary"><Tag color="blue">{officer?.force_number}</Tag> {officer?.rank_name}</Text>
              </div>
            </Space>
            
            {canTransfer && <Button type="primary" icon={<SwapOutlined />} size="large" onClick={() => setIsTransferModalOpen(true)}>
              Wareeji Askariga
            </Button>}
          </div>

          <Row gutter={[24, 24]}>
            <Col xs={24} lg={16}>
              <Card title="Xogta Askariga" variant="borderless" className="shadow-sm">
                <Descriptions column={2}>
                  <Descriptions.Item label="Darajada"><Tag color="blue">{officer?.rank_name || 'Darajo lama siin'}</Tag></Descriptions.Item>
                  <Descriptions.Item label="Lambarka Ciidanka">{officer?.force_number}</Descriptions.Item>
                  <Descriptions.Item label="Lambarka Telefoonka">{officer?.phone || 'Ma jiro'}</Descriptions.Item>
                  <Descriptions.Item label="Email-ka">{officer?.email || 'Ma jiro'}</Descriptions.Item>
                  <Descriptions.Item label="Jinsiga">{officer?.gender || 'Ma jiro'}</Descriptions.Item>
                  <Descriptions.Item label="Taariikhda Dhalashada">{officer?.date_of_birth ? dayjs(officer.date_of_birth).format('DD MMM YYYY') : 'Ma jiro'}</Descriptions.Item>
                  <Descriptions.Item label="Cinwaanka Hoyga" span={2}>{officer?.address || 'Ma jiro'}</Descriptions.Item>
                  <Descriptions.Item label="Xaaladda Shaqada"><Tag color={String(officer?.employment_status).toLowerCase() === 'active' ? 'green' : 'red'}>{officer?.employment_status}</Tag></Descriptions.Item>
                </Descriptions>
                <Divider />
                <Title level={5}>Goobtii Laga Diiwaangeliyey</Title>
                <Descriptions column={3}>
                  <Descriptions.Item label="Dawlad-goboleedka">{officer?.registration_state_name || '—'}</Descriptions.Item>
                  <Descriptions.Item label="Gobolka">{officer?.registration_region_name || '—'}</Descriptions.Item>
                  <Descriptions.Item label="Degmada">{officer?.registration_district_name || '—'}</Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
            
            <Col xs={24} lg={8}>
              <Card 
                title={<><EnvironmentOutlined /> Goobta Hadda</>} 
                variant="borderless"
                style={{ height: '100%', background: '#f0f2f5' }}
              >
                {officer?.current_assignment_type === 'Unassigned' ? (
                   <Text type="warning">Weli goob shaqo looma qoondeyn</Text>
                ) : (
                  <>
                    <Title level={4} style={{ marginTop: 0 }}>{officer?.current_assignment_name}</Title>
                    <Text type="secondary">{officer?.current_assignment_type}</Text>
                    <Divider />
                    <Space orientation="vertical" size={4}>
                      <Text><strong>Dawlad-goboleedka:</strong> {officer?.current_state_name || '—'}</Text>
                      <Text><strong>Gobolka:</strong> {officer?.current_region_name || '—'}</Text>
                      <Text><strong>Degmada:</strong> {officer?.current_district_name || '—'}</Text>
                    </Space>
                  </>
                )}
              </Card>
            </Col>
          </Row>

          <Card title={<><AuditOutlined /> Taariikhda Shaqada</>} variant="borderless">
            <Title level={5}>Taariikhda Wareejinta</Title>
            <Table 
               columns={transferCols} 
               dataSource={officer?.transfers || []} 
               rowKey="id" 
               pagination={{ pageSize: 5 }} 
               size="small"
               scroll={{ x: 'max-content' }}
            />
            
            <Divider />

            <Title level={5}>Taariikhda Goobaha Shaqada</Title>
            <Table 
               columns={assignmentCols} 
               dataSource={officer?.assignments || []} 
               rowKey="id" 
               pagination={{ pageSize: 5 }} 
               size="small"
               scroll={{ x: 'max-content' }}
            />
          </Card>

        </Space>
      </Card>

      <Modal
          title={`Wareeji Askariga: ${officer?.full_name}`}
          open={isTransferModalOpen}
          onCancel={() => setIsTransferModalOpen(false)}
          onOk={handleTransfer}
          okText="Xaqiiji Wareejinta"
        >
           <Form form={transferForm} layout="vertical">
              <Form.Item name="to_assignment_type" label="Heerka Loo Wareejinayo" rules={[requiredRule('Heerka loo wareejinayo')]}>
                  <Select placeholder="e.g. City" onChange={() => transferForm.setFieldsValue({ state_id: undefined, region_id: undefined, city_id: undefined, district_id: undefined })}>
                      {user?.role !== 'district_admin' && <Option value="State Administration">State Administration</Option>}
                      {user?.role !== 'district_admin' && <Option value="Region">Region</Option>}
                      {user?.role !== 'district_admin' && <Option value="City">City</Option>}
                      <Option value="District">District</Option>
                      <Option value="District Station">District Station</Option>
                  </Select>
               </Form.Item>
              
              {assignmentType && user?.role !== 'district_admin' && (
                <Form.Item name="state_id" label="State Administration" rules={[requiredRule('State administration')]}>
                  <Select placeholder="Select State Administration" showSearch optionFilterProp="children">
                    {states.map(s => <Option key={s.id} value={s.id}>{s.state_name}</Option>)}
                  </Select>
                </Form.Item>
              )}

               {user?.role !== 'district_admin' && assignmentType && ['Region', 'City', 'District', 'District Station'].includes(assignmentType) && (
                 <Form.Item name="region_id" label="Region" rules={[requiredRule('Region')]}>
                   <Select placeholder="Select Region" showSearch optionFilterProp="children" disabled={!selectedState}>
                     {regions.map(r => <Option key={r.id} value={r.id}>{r.region_name}</Option>)}
                   </Select>
                 </Form.Item>
               )}
 
               {user?.role !== 'district_admin' && assignmentType && ['City', 'District', 'District Station'].includes(assignmentType) && (
                 <Form.Item name="city_id" label="City" rules={[requiredRule('City')]}>
                   <Select placeholder="Select City" showSearch optionFilterProp="children" disabled={!selectedRegion}>
                     {cities.map(c => <Option key={c.id} value={c.id}>{c.city_name}</Option>)}
                   </Select>
                 </Form.Item>
               )}
 
               {user?.role !== 'district_admin' && assignmentType && ['District', 'District Station'].includes(assignmentType) && (
                 <Form.Item name="district_id" label="District Station" rules={[requiredRule('District Station')]}>
                   <Select placeholder="Select District Station" showSearch optionFilterProp="children" disabled={!selectedCity}>
                     {districts.map(d => <Option key={d.id} value={d.id}>{d.district_name}</Option>)}
                   </Select>
                 </Form.Item>
               )}

              <Form.Item name="transfer_reason" label="Sababta Wareejinta" rules={[requiredRule('Sababta wareejinta'), textLengthRule('Sababta wareejinta', 5, 1000)]}>
                <Input.TextArea rows={2} />
              </Form.Item>
              <Form.Item name="remarks" label="Faallo Dheeraad ah (Ikhtiyaari)" rules={[textLengthRule('Faallooyinka', 3, 1000)]}>
                <Input.TextArea rows={2} />
              </Form.Item>
           </Form>
      </Modal>

    </ProtectedRoute>
  );
}
