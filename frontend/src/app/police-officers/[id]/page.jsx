'use client';

import React, { useState, useEffect, use, useCallback } from 'react';
import { Card, Descriptions, Table, Typography, Tag, Space, Button, Modal, Form, Select, Input, message, Avatar, Row, Col, Divider } from 'antd';
import { SwapOutlined, ArrowLeftOutlined, AuditOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';
import dayjs from 'dayjs';
import { requiredRule, textLengthRule } from '@/utils/validation';

const { Title, Text } = Typography;
const { Option } = Select;

export default function OfficerDetailsPage({ params }) {
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
  const [neighborhoods, setNeighborhoods] = useState([]);

  const assignmentType = Form.useWatch('to_assignment_type', transferForm);
  const selectedState = Form.useWatch('state_id', transferForm);
  const selectedRegion = Form.useWatch('region_id', transferForm);
  const selectedCity = Form.useWatch('city_id', transferForm);
  const selectedDistrict = Form.useWatch('district_id', transferForm);

  useEffect(() => {
    if (isTransferModalOpen) {
       api.get('/state-administrations').then(res => setStates(res.data.data)).catch(console.error);
    }
  }, [isTransferModalOpen]);

  useEffect(() => {
    if (selectedState) {
       api.get(`/regions?state_administration_id=${selectedState}`).then(res => setRegions(res.data.data)).catch(console.error);
       transferForm.setFieldsValue({ region_id: undefined, city_id: undefined, district_id: undefined, neighborhood_id: undefined });
    }
  }, [selectedState, transferForm]);

  useEffect(() => {
    if (selectedRegion) {
       api.get(`/cities?region_id=${selectedRegion}`).then(res => setCities(res.data.data)).catch(console.error);
       transferForm.setFieldsValue({ city_id: undefined, district_id: undefined, neighborhood_id: undefined });
    }
  }, [selectedRegion, transferForm]);

  useEffect(() => {
    if (selectedCity) {
       api.get(`/districts?city_id=${selectedCity}`).then(res => setDistricts(res.data.data)).catch(console.error);
       transferForm.setFieldsValue({ district_id: undefined, neighborhood_id: undefined });
    }
  }, [selectedCity, transferForm]);

  useEffect(() => {
    if (selectedDistrict) {
       api.get(`/neighborhoods?district_id=${selectedDistrict}`).then(res => setNeighborhoods(res.data.data)).catch(console.error);
       transferForm.setFieldsValue({ neighborhood_id: undefined });
    }
  }, [selectedDistrict, transferForm]);


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
  }, [id]);

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
      if (values.to_assignment_type === 'Neighborhood') targetId = values.neighborhood_id;

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
    { title: 'Level', dataIndex: 'assignment_type', key: 'type', render: t => <Tag color="geekblue">{t}</Tag> },
    { title: 'Unit Location', dataIndex: 'assignment_name', key: 'name' },
    { title: 'Remarks', dataIndex: 'remarks', key: 'remarks' },
    { title: 'Status', dataIndex: 'is_current', key: 'is_current', render: c => c === 1 ? <Tag color="green">Active</Tag> : <Tag>Past</Tag> },
    { title: 'Assigned At', dataIndex: 'assigned_at', key: 'date', render: d => dayjs(d).format('DD MMM YYYY') }
  ];

  const transferCols = [
    { title: 'From', key: 'from', render: (_, record) => record.from_assignment_type ? `${record.from_assignment_type} (#${record.from_assignment_id})` : 'New Recruit' },
    { title: 'To', key: 'to', render: (_, record) => `${record.to_assignment_type} (#${record.to_assignment_id})` },
    { title: 'Reason', dataIndex: 'transfer_reason', key: 'reason' },
    { title: 'Date', dataIndex: 'transferred_at', key: 'date', render: d => dayjs(d).format('DD MMM YYYY') }
  ];

  return (
    <ProtectedRoute allowedRoles={['admin', 'state_admin', 'region_admin', 'city_admin', 'district_admin', 'neighborhood_admin']}>
      <Card loading={loading} variant="none">
        
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Space align="center" size="large">
              <Button icon={<ArrowLeftOutlined />} shape="circle" onClick={() => router.back()} />
              <Avatar size={80} src={officer?.profile_image ? `http://localhost:5005${officer.profile_image}` : 'https://ui-avatars.com/api/?name=Officer'} />
              <div>
                <Title level={2} style={{ margin: 0 }}>{officer?.full_name}</Title>
                <Text type="secondary"><Tag color="blue">{officer?.force_number}</Tag> {officer?.rank_name}</Text>
              </div>
            </Space>
            
            <Button type="primary" icon={<SwapOutlined />} size="large" onClick={() => setIsTransferModalOpen(true)}>
              Transfer Officer
            </Button>
          </div>

          <Row gutter={[24, 24]}>
            <Col xs={24} lg={16}>
              <Card title="Bio & Contact Information" bordered={false} className="shadow-sm">
                <Descriptions column={{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}>
                  <Descriptions.Item label="Contact Phone">{officer?.phone || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="Primary Email">{officer?.email || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="Gender">{officer?.gender || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="Date of Birth">{officer?.date_of_birth ? dayjs(officer.date_of_birth).format('DD MMM YYYY') : 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="Residential Address" span={2}>{officer?.address || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="Employment Status"><Tag color={officer?.employment_status === 'Active' ? 'green' : 'red'}>{officer?.employment_status}</Tag></Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
            
            <Col xs={24} lg={8}>
              <Card 
                title={<><EnvironmentOutlined /> Current Assignment</>} 
                bordered={false} 
                style={{ height: '100%', background: '#f0f2f5' }}
              >
                {officer?.current_assignment_type === 'Unassigned' ? (
                   <Text type="warning">Currently unassigned</Text>
                ) : (
                  <>
                    <Title level={4} style={{ marginTop: 0 }}>{officer?.current_assignment_name}</Title>
                    <Text type="secondary">{officer?.current_assignment_type}</Text>
                  </>
                )}
              </Card>
            </Col>
          </Row>

          <Card title={<><AuditOutlined /> Career History</>} bordered={false}>
            <Title level={5}>Transfer Logs</Title>
            <Table 
               columns={transferCols} 
               dataSource={officer?.transfers || []} 
               rowKey="id" 
               pagination={{ pageSize: 5 }} 
               size="small"
            />
            
            <Divider />

            <Title level={5}>Assignment Designations</Title>
            <Table 
               columns={assignmentCols} 
               dataSource={officer?.assignments || []} 
               rowKey="id" 
               pagination={{ pageSize: 5 }} 
               size="small"
            />
          </Card>

        </Space>
      </Card>

      <Modal
          title={`Deploy/Transfer: ${officer?.full_name}`}
          open={isTransferModalOpen}
          onCancel={() => setIsTransferModalOpen(false)}
          onOk={handleTransfer}
          okText="Confirm Transfer"
        >
           <Form form={transferForm} layout="vertical">
              <Form.Item name="to_assignment_type" label="Target Level" rules={[requiredRule('Target level')]}>
                 <Select placeholder="e.g. City" onChange={() => transferForm.setFieldsValue({ state_id: undefined, region_id: undefined, city_id: undefined, district_id: undefined, neighborhood_id: undefined })}>
                    <Option value="State Administration">State Administration</Option>
                    <Option value="Region">Region</Option>
                    <Option value="City">City</Option>
                    <Option value="District">District</Option>
                    <Option value="Neighborhood">Neighborhood</Option>
                 </Select>
              </Form.Item>
              
              {assignmentType && (
                <Form.Item name="state_id" label="State Administration" rules={[requiredRule('State administration')]}>
                  <Select placeholder="Select State Administration" showSearch optionFilterProp="children">
                    {states.map(s => <Option key={s.id} value={s.id}>{s.state_name}</Option>)}
                  </Select>
                </Form.Item>
              )}

              {assignmentType && ['Region', 'City', 'District', 'Neighborhood'].includes(assignmentType) && (
                <Form.Item name="region_id" label="Region" rules={[requiredRule('Region')]}>
                  <Select placeholder="Select Region" showSearch optionFilterProp="children" disabled={!selectedState}>
                    {regions.map(r => <Option key={r.id} value={r.id}>{r.region_name}</Option>)}
                  </Select>
                </Form.Item>
              )}

              {assignmentType && ['City', 'District', 'Neighborhood'].includes(assignmentType) && (
                <Form.Item name="city_id" label="City" rules={[requiredRule('City')]}>
                  <Select placeholder="Select City" showSearch optionFilterProp="children" disabled={!selectedRegion}>
                    {cities.map(c => <Option key={c.id} value={c.id}>{c.city_name}</Option>)}
                  </Select>
                </Form.Item>
              )}

              {assignmentType && ['District', 'Neighborhood'].includes(assignmentType) && (
                <Form.Item name="district_id" label="District" rules={[requiredRule('District')]}>
                  <Select placeholder="Select District" showSearch optionFilterProp="children" disabled={!selectedCity}>
                    {districts.map(d => <Option key={d.id} value={d.id}>{d.district_name}</Option>)}
                  </Select>
                </Form.Item>
              )}

              {assignmentType === 'Neighborhood' && (
                <Form.Item name="neighborhood_id" label="Neighborhood / Station" rules={[requiredRule('Neighborhood / station')]}>
                  <Select placeholder="Select Neighborhood" showSearch optionFilterProp="children" disabled={!selectedDistrict}>
                    {neighborhoods.map(n => <Option key={n.id} value={n.id}>{n.neighborhood_name}</Option>)}
                  </Select>
                </Form.Item>
              )}

              <Form.Item name="transfer_reason" label="Reason for Transfer" rules={[requiredRule('Transfer reason'), textLengthRule('Transfer reason', 5, 1000)]}>
                <Input.TextArea rows={2} />
              </Form.Item>
              <Form.Item name="remarks" label="Additional Remarks (Optional)" rules={[textLengthRule('Remarks', 3, 1000)]}>
                <Input.TextArea rows={2} />
              </Form.Item>
           </Form>
      </Modal>

    </ProtectedRoute>
  );
}
