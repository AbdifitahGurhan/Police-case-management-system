'use client';
import React, { useState, useEffect } from 'react';
import { Table, Card, Typography, Space, Button, Modal, Form, Input, Select, App, Upload, Avatar, Tag, DatePicker, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, UploadOutlined, SwapOutlined, EyeOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';
import dayjs from 'dayjs';
import {
  disabledFutureDate,
  emailRule,
  nameRules,
  noFutureDateRule,
  phoneRules,
  requiredRule,
  textLengthRule,
} from '@/utils/validation';

const { Title } = Typography;
const { Option } = Select;

export default function PoliceOfficersPage() {
  const { message } = App.useApp();
  const router = useRouter();
  const [data, setData] = useState([]);
  const [ranks, setRanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [transferRecord, setTransferRecord] = useState(null);
  const [form] = Form.useForm();
  const [transferForm] = Form.useForm();
  const [fileList, setFileList] = useState([]);

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

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resData, resRanks] = await Promise.all([
        api.get('/police-officers'),
        api.get('/ranks')
      ]);
      setData(resData.data.data);
      setRanks(resRanks.data.data);
    } catch (err) {
      if (err.response?.status !== 403) {
        message.error("Failed to load police officers.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (record = null) => {
    if (!record && ranks.length === 0) {
      message.error("Please register ranks first before creating police officers");
      return;
    }
    setEditingRecord(record);
    if (record) {
      form.setFieldsValue({
        ...record,
        date_of_birth: record.date_of_birth ? dayjs(record.date_of_birth) : null
      });
      setFileList(record.profile_image ? [{ uid: '-1', name: 'photo.png', status: 'done', url: `http://localhost:5005${record.profile_image}` }] : []);
    } else {
      form.resetFields();
      setFileList([]);
    }
    setIsModalOpen(true);
  };

  const handleOpenTransferModal = (record) => {
    setTransferRecord(record);
    transferForm.resetFields();
    setIsTransferModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      const formData = new FormData();
      Object.keys(values).forEach(key => {
        if (values[key] !== undefined && values[key] !== null) {
          if (key === 'date_of_birth') {
            formData.append(key, values[key].format('YYYY-MM-DD'));
          } else {
            formData.append(key, values[key]);
          }
        }
      });

      if (fileList.length > 0 && fileList[0].originFileObj) {
        formData.append('profile_image', fileList[0].originFileObj);
      }

      if (editingRecord) {
        await api.put(`/police-officers/${editingRecord.id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
        message.success("Officer updated.");
      } else {
        await api.post('/police-officers', formData, { headers: { 'Content-Type': 'multipart/form-data' }});
        message.success("Officer created.");
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      if (err.errorFields) return; // Validation error
      message.error(err.response?.data?.message || "Save failed.");
    }
  };

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
         officer_id: transferRecord.id,
         to_assignment_type: values.to_assignment_type,
         to_assignment_id: targetId,
         transfer_reason: values.transfer_reason
       });
       message.success("Officer transferred successfully.");
       setIsTransferModalOpen(false);
       fetchData();
     } catch (err) {
       if (err.errorFields) return; // Validation error
       message.error(err.response?.data?.message || "Transfer failed.");
     }
  };

  const uploadProps = {
    onRemove: () => setFileList([]),
    beforeUpload: (file) => {
      setFileList([file]);
      return false; // Prevent auto upload
    },
    fileList,
    maxCount: 1,
  };

  const columns = [
    { title: 'Photo', dataIndex: 'profile_image', key: 'profile_image', render: i => <Avatar src={i ? `http://localhost:5005${i}` : `https://ui-avatars.com/api/?name=Officer`} /> },
    { title: 'Full Name', dataIndex: 'full_name', key: 'full_name' },
    { title: 'Force No.', dataIndex: 'force_number', key: 'force_number', render: f => <Tag color="blue">{f}</Tag> },
    { title: 'Rank', dataIndex: 'rank_name', key: 'rank_name' },
    {
      title: 'Station / Assignment',
      key: 'current_assignment',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text strong>{record.current_assignment_name || 'Headquarters'}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {record.current_assignment_type || 'Unassigned'}
          </Typography.Text>
        </Space>
      ),
    },
    { title: 'Status', dataIndex: 'employment_status', key: 'employment_status', render: s => <Tag color={s === 'Active' ? 'green' : 'red'}>{s}</Tag> },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button icon={<EyeOutlined />} type="primary" onClick={() => router.push(`/police-officers/${record.id}`)}>Details</Button>
          <Button icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
          <Button icon={<SwapOutlined />} type="dashed" onClick={() => handleOpenTransferModal(record)}>Deploy</Button>
        </Space>
      ),
    },
  ];

  return (
    <ProtectedRoute allowedRoles={['admin', 'state_admin', 'region_admin', 'city_admin', 'district_admin']}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2}>Police Officers</Title>
            <Typography.Text type="secondary">Manage personnel profiles, ranks, and photos.</Typography.Text>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>Add Officer</Button>
        </div>

        <Card variant="none">
          <Table columns={columns} dataSource={data} rowKey="id" loading={loading} />
        </Card>

        {/* Create/Edit Modal */}
        <Modal 
          title={editingRecord ? "Edit Officer" : "Register Officer"} 
          open={isModalOpen} 
          width={700}
          onCancel={() => setIsModalOpen(false)} 
          onOk={handleSave}
        >
          <Form form={form} layout="vertical">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="full_name" label="Full Name" rules={nameRules('Officer name')}>
                  <Input placeholder="e.g. John Doe" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="force_number" label="Force Number" rules={[requiredRule('Force number'), textLengthRule('Force number', 2, 50)]}>
                  <Input placeholder="e.g. F-987" disabled={!!editingRecord} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="rank_id" label="Rank" rules={[requiredRule('Rank')]}>
                  <Select placeholder="Select Rank">
                    {ranks.map(r => <Option key={r.id} value={r.id}>{r.rank_name}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="employment_status" label="Status" initialValue="Active">
                  <Select>
                    <Option value="Active">Active</Option>
                    <Option value="Suspended">Suspended</Option>
                    <Option value="Retired">Retired</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label="Profile Photo">
              <Upload {...uploadProps} listType="picture">
                <Button icon={<UploadOutlined />}>Select Image</Button>
              </Upload>
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="phone" label="Phone" rules={phoneRules}><Input /></Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="email" label="Email" rules={[emailRule]}><Input type="email" /></Form.Item>
              </Col>
            </Row>
            <Form.Item name="date_of_birth" label="Date of Birth" rules={[noFutureDateRule('Date of birth')]}>
              <DatePicker style={{ width: '100%' }} disabledDate={disabledFutureDate} />
            </Form.Item>
          </Form>
        </Modal>

        {/* Deployment / Transfer Modal */}
        <Modal
          title={`Deploy ${transferRecord?.full_name}`}
          open={isTransferModalOpen}
          onCancel={() => setIsTransferModalOpen(false)}
          onOk={handleTransfer}
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

              <Form.Item name="transfer_reason" label="Reason for deployment" rules={[requiredRule('Deployment reason'), textLengthRule('Deployment reason', 5, 1000)]}>
                <Input.TextArea rows={3} />
              </Form.Item>
           </Form>
        </Modal>

      </Space>
    </ProtectedRoute>
  );
}
