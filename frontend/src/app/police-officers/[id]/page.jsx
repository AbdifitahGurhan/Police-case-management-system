'use client';

import React, { useState, useEffect, use, useCallback } from 'react';
import { Card, Descriptions, Table, Typography, Tag, Space, Button, Modal, Form, Select, Input, App, Avatar, Row, Col, Divider, Image } from 'antd';
import { SwapOutlined, ArrowLeftOutlined, AuditOutlined, EnvironmentOutlined, StarOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';
import dayjs from 'dayjs';
import { requiredRule, textLengthRule } from '@/utils/validation';
import { useAuth } from '@/contexts/AuthContext';

const { Title, Text } = Typography;
const { Option } = Select;
const COMMISSIONED_CODES = new Set(['SG', 'SGS', 'SGT', 'GSH-S', 'GSH-DH', 'GSH', 'DHM', 'LXDG', 'XDG']);
const STATE_ADMIN_RANK_CODES = new Set(['AL', 'SA', 'XDH', 'LXDH', 'LA', 'SXD']);
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
  const canUpdateEmploymentStatus = ['admin', 'state_admin', 'sub_admin'].includes(String(user?.role || '').toLowerCase());
  const canViewLocations = user?.role === 'admin' || user?.permissions?.includes('*') || user?.permissions?.includes('locations.view');
  const canTransfer = (user?.role === 'admin' || user?.permissions?.includes('*') || user?.permissions?.includes('officers.transfer')) && canViewLocations;
  const router = useRouter();
  const { id } = use(params);
  const [officer, setOfficer] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isRankModalOpen, setIsRankModalOpen] = useState(false);
  const [employmentStatusDraft, setEmploymentStatusDraft] = useState('active');
  const [ranks, setRanks] = useState([]);
  const [transferForm] = Form.useForm();
  const [rankForm] = Form.useForm();
  
  const [states, setStates] = useState([]);
  const [regions, setRegions] = useState([]);
  const [districts, setDistricts] = useState([]);

  const assignmentType = Form.useWatch('to_assignment_type', transferForm);
  const selectedState = Form.useWatch('state_id', transferForm);
  const selectedRegion = Form.useWatch('region_id', transferForm);

  useEffect(() => {
    if (isTransferModalOpen && canViewLocations && user?.role !== 'district_admin') {
       api.get('/state-administrations').then(res => setStates(res.data.data)).catch(console.error);
    }
  }, [isTransferModalOpen, canViewLocations, user?.role]);

  useEffect(() => {
    if (canViewLocations && selectedState) {
       api.get(`/regions?state_administration_id=${selectedState}`).then(res => setRegions(res.data.data)).catch(console.error);
       transferForm.setFieldsValue({ region_id: undefined, district_id: undefined });
    }
  }, [selectedState, transferForm, canViewLocations]);

  useEffect(() => {
    if (canViewLocations && selectedRegion) {
       api.get(`/districts?region_id=${selectedRegion}`).then(res => setDistricts(res.data.data)).catch(console.error);
       transferForm.setFieldsValue({ district_id: undefined });
    }
  }, [selectedRegion, transferForm, canViewLocations]);


  const fetchOfficerDetails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/police-officers/${id}`);
      setOfficer(res.data.data);
      setEmploymentStatusDraft(String(res.data.data?.employment_status || 'active').toLowerCase());
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
        remarks: values.remarks
      });
      message.success("Officer successfully transferred.");
      setIsTransferModalOpen(false);
      transferForm.resetFields();
      fetchOfficerDetails();
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || "Transfer failed.");
    }
  };

  const handleOpenRankModal = () => {
    rankForm.setFieldsValue({ rank_id: officer?.rank_id });
    if (!ranks.length) {
      api.get('/ranks').then((res) => setRanks(res.data.data || [])).catch(() => {});
    }
    setIsRankModalOpen(true);
  };

  const handleSaveRank = async () => {
    try {
      const values = await rankForm.validateFields();
      await api.post(`/police-officers/${officer.id}/rank`, values);
      message.success("Darajada sarkaalka waa la badalay.");
      setIsRankModalOpen(false);
      fetchOfficerDetails();
    } catch (err) {
      if (!err.errorFields) {
        message.error(err.response?.data?.message || "Badalaadda darajada waa ay guuldarraysatay.");
      }
    }
  };

  const handleSaveStatus = async () => {
    try {
      const response = await api.patch(`/police-officers/${officer.id}/employment-status`, {
        employment_status: employmentStatusDraft,
      });
      message.success(response.data?.message || 'Xaaladda shaqada waa la beddelay.');
      fetchOfficerDetails();
    } catch (err) {
      message.error(err.response?.data?.message || 'Xaaladda shaqada lama beddeli karin.');
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
    { title: 'Taariikhda', dataIndex: 'transferred_at', key: 'date', render: d => dayjs(d).format('DD MMM YYYY') }
  ];

  return (
    <ProtectedRoute requiredPermissions={['officers.update']}>
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
                <Space wrap style={{ marginTop: 6 }}>
                  <Tag color="cyan" style={{ fontSize: 13, padding: '2px 10px', fontWeight: 600 }}>{officer?.force_number}</Tag>
                  <Tag color="gold" style={{ fontSize: 13, padding: '2px 10px', fontWeight: 600 }}>
                    {officer?.rank_name ? `${officer.rank_name}${officer.rank_code ? ` (${officer.rank_code})` : ''}` : 'Darajo lama siin'}
                  </Tag>
                </Space>
              </div>
            </Space>
            
            <Space>
              {(user?.role === 'admin' || user?.role === 'state_admin') && (
                <Button icon={<StarOutlined />} size="large" onClick={handleOpenRankModal}>
                  Darajo
                </Button>
              )}
              {canTransfer && <Button type="primary" icon={<SwapOutlined />} size="large" onClick={() => setIsTransferModalOpen(true)}>
                Wareeji Askariga
              </Button>}
            </Space>
          </div>

          <Row gutter={[24, 24]}>
            <Col xs={24} lg={16}>
              <Card title="Xogta Askariga" variant="borderless" className="shadow-sm">
                <Descriptions column={2} bordered size="small">
                  <Descriptions.Item label="Magaca oo Buuxa"><Typography.Text strong>{officer?.full_name}</Typography.Text></Descriptions.Item>
                  <Descriptions.Item label="Magaca Hooyada">{officer?.mother_name || '—'}</Descriptions.Item>
                  <Descriptions.Item label="Darajada"><Tag color="gold" style={{ fontWeight: 600 }}>{officer?.rank_name ? `${officer.rank_name}${officer.rank_code ? ` (${officer.rank_code})` : ''}` : 'Darajo lama siin'}</Tag></Descriptions.Item>
                  <Descriptions.Item label="Lambarka Ciidanka"><Tag color="cyan">{officer?.force_number}</Tag></Descriptions.Item>
                  <Descriptions.Item label="Jinsiga">{String(officer?.gender).toLowerCase() === 'male' || officer?.gender === 'Lab' ? 'Lab' : String(officer?.gender).toLowerCase() === 'female' || officer?.gender === 'Dhedig' ? 'Dhedig' : (officer?.gender || '—')}</Descriptions.Item>
                  <Descriptions.Item label="Taariikhda Dhalashada / Da’da">
                    {officer?.date_of_birth ? `${dayjs(officer.date_of_birth).format('DD MMM YYYY')} (${officer?.age || dayjs().diff(officer.date_of_birth, 'year')} sano)` : '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Lambarka Telefoonka">{officer?.phone || 'Ma jiro'}</Descriptions.Item>
                  <Descriptions.Item label="National ID">{officer?.national_id || 'Ma jiro'}</Descriptions.Item>
                  <Descriptions.Item label="Cinwaanka Hoyga" span={2}>{officer?.address || 'Ma jiro'}</Descriptions.Item>
                  <Descriptions.Item label="Xaaladda Shaqada">
                    <Space wrap align="center">
                      <Tag color={String(officer?.employment_status).toLowerCase() === 'active' ? 'green' : 'red'}>
                        {officer?.employment_status || 'Active'}
                      </Tag>
                      {canUpdateEmploymentStatus && (
                        <>
                          <Select
                            size="small"
                            value={employmentStatusDraft}
                            onChange={setEmploymentStatusDraft}
                            style={{ width: 150 }}
                            options={[
                              { value: 'active', label: 'Active' },
                              { value: 'suspended', label: 'Suspended' },
                              { value: 'retired', label: 'Retired' },
                              { value: 'inactive', label: 'Inactive' },
                            ]}
                          />
                          <Button
                            size="small"
                            type="primary"
                            onClick={handleSaveStatus}
                            disabled={employmentStatusDraft === String(officer?.employment_status || 'active').toLowerCase()}
                          >
                            Kaydi
                          </Button>
                        </>
                      )}
                    </Space>
                  </Descriptions.Item>
                </Descriptions>
                <Divider style={{ margin: '16px 0' }} />
                <Title level={5} style={{ marginBottom: 12 }}>Goobtii Laga Diiwaangeliyey</Title>
                {String(officer?.created_by).toLowerCase() === 'admin' || !officer?.registration_state_administration_id ? (
                  <Tag color="gold" style={{ fontSize: 13, padding: '6px 14px', fontWeight: 600, borderRadius: 6 }}>
                    Dawladda Dhexe (Taliska Guud)
                  </Tag>
                ) : (
                  <Descriptions column={3} size="small" bordered>
                    <Descriptions.Item label="Dawlad-goboleedka">{officer?.registration_state_name || '—'}</Descriptions.Item>
                    <Descriptions.Item label="Gobolka">{officer?.registration_region_name || '—'}</Descriptions.Item>
                    <Descriptions.Item label="Degmada">{officer?.registration_district_name || '—'}</Descriptions.Item>
                  </Descriptions>
                )}
              </Card>
            </Col>
            
            <Col xs={24} lg={8}>
              <Card 
                title={<><EnvironmentOutlined /> Goobta Hadda (Deployment)</>} 
                variant="borderless"
                style={{ height: '100%', background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)', border: '1px solid #e2e8f0', borderRadius: 8 }}
              >
                {officer?.current_assignment_type === 'Unassigned' ? (
                   <Text type="warning" strong>Weli goob shaqo looma qoondeyn</Text>
                ) : (
                  <>
                    <Title level={4} style={{ marginTop: 0, color: '#1e293b' }}>{officer?.current_assignment_name}</Title>
                    <Tag color="geekblue" style={{ marginBottom: 12 }}>{officer?.current_assignment_type}</Tag>
                    <Divider style={{ margin: '12px 0' }} />
                    <Space orientation="vertical" size={6} style={{ width: '100%' }}>
                      {officer?.current_state_name && <Text><strong>Dawlad-goboleedka:</strong> {officer.current_state_name}</Text>}
                      {officer?.current_region_name && <Text><strong>Gobolka:</strong> {officer.current_region_name}</Text>}
                      {officer?.current_district_name && <Text><strong>Degmada:</strong> {officer.current_district_name}</Text>}
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
                  <Select placeholder="Dooro heerka" onChange={() => transferForm.setFieldsValue({ state_id: undefined, region_id: undefined, district_id: undefined })}>
                      {user?.role !== 'district_admin' && <Option value="State Administration">State Administration</Option>}
                      {user?.role !== 'district_admin' && <Option value="Region">Region</Option>}
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

               {user?.role !== 'district_admin' && assignmentType && ['Region', 'District', 'District Station'].includes(assignmentType) && (
                 <Form.Item name="region_id" label="Region" rules={[requiredRule('Region')]}>
                   <Select placeholder="Select Region" showSearch optionFilterProp="children" disabled={!selectedState}>
                     {regions.map(r => <Option key={r.id} value={r.id}>{r.region_name}</Option>)}
                   </Select>
                 </Form.Item>
               )}

               {user?.role !== 'district_admin' && assignmentType && ['District', 'District Station'].includes(assignmentType) && (
                 <Form.Item name="district_id" label="District Station" rules={[requiredRule('District Station')]}>
                   <Select placeholder="Select District Station" showSearch optionFilterProp="children" disabled={!selectedRegion}>
                     {districts.map(d => <Option key={d.id} value={d.id}>{d.district_name}</Option>)}
                   </Select>
                 </Form.Item>
               )}

              <Form.Item name="remarks" label="Faallo Dheeraad ah (Ikhtiyaari)" rules={[textLengthRule('Faallooyinka', 3, 1000)]}>
                <Input.TextArea rows={2} />
              </Form.Item>
           </Form>
      </Modal>

      {/* Change Rank Modal */}
      <Modal
        title={`Darajo: ${officer?.full_name}`}
        open={isRankModalOpen}
        onCancel={() => setIsRankModalOpen(false)}
        onOk={handleSaveRank}
        okText="Kaydi Darajada"
        cancelText="Jooji"
      >
        <Form form={rankForm} layout="vertical">
          <Form.Item name="rank_id" label="Dooro Darajada" rules={[{ required: true, message: 'Dooro darajada.' }]}>
            <Select
              placeholder="Dooro darajada"
              options={(ranks || [])
                .filter(r => {
                  const code = String(r.rank_code || '').trim().toUpperCase();
                  const name = String(r.rank_name || '').toLowerCase();
                  const isCommissioned = COMMISSIONED_CODES.has(code) || name.includes('sareeye') || name.includes('gaashaanle') || name.includes('dhamme') || name.includes('xiddigle');
                  if (user?.role === 'admin') {
                    return isCommissioned;
                  }
                  return STATE_ADMIN_RANK_CODES.has(code) || !isCommissioned;
                })
                .map(r => ({ value: r.id, label: `${r.rank_name} (${r.rank_code || ''})` }))
              }
            />
          </Form.Item>
        </Form>
      </Modal>

    </ProtectedRoute>
  );
}
