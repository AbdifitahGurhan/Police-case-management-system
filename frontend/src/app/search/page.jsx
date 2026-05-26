'use client';

import React, { useState } from 'react';
import { App, Button, Card, Col, DatePicker, Form, Input, Row, Space, Table, Tag, Typography, Upload } from 'antd';
import { SearchOutlined, UploadOutlined } from '@ant-design/icons';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';
import dayjs from 'dayjs';
import { disabledFutureDate, noFutureDateRule, phoneRules, textLengthRule } from '@/utils/validation';

const { Title, Text } = Typography;

export default function SearchMatchingPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [faceImage, setFaceImage] = useState('');

  const beforeFaceUpload = (file) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      message.error('Use JPG, PNG, or WEBP face image.');
      return Upload.LIST_IGNORE;
    }
    const reader = new FileReader();
    reader.onload = () => setFaceImage(reader.result);
    reader.readAsDataURL(file);
    return false;
  };

  const handleSearch = async (values) => {
    setLoading(true);
    try {
      const payload = {
        ...values,
        date_of_birth: values.date_of_birth ? values.date_of_birth.format('YYYY-MM-DD') : undefined,
        face_image: faceImage || undefined,
      };
      const res = await api.post('/suspects/match-search', payload);
      setResults(res.data.data || []);
      message.success(`${res.data.data?.length || 0} match(es) found.`);
    } catch (err) {
      message.error(err.response?.data?.message || 'Search failed.');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Person',
      dataIndex: 'full_name',
      render: (value, row) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text type="secondary">Mother: {row.mother_name || 'N/A'}</Text>
        </Space>
      ),
    },
    { title: 'Phone', dataIndex: 'phone', render: (value) => value || 'N/A' },
    { title: 'National ID', dataIndex: 'id_number', render: (value) => value || 'N/A' },
    { title: 'DOB', dataIndex: 'date_of_birth', render: (value) => value ? dayjs(value).format('YYYY-MM-DD') : 'N/A' },
    { title: 'Previous Cases', dataIndex: 'previous_case_numbers', render: (value) => value || 'N/A' },
    { title: 'Police Station', dataIndex: 'police_stations', render: (value) => value || 'N/A' },
    { title: 'Cases', dataIndex: 'case_count', align: 'center' },
    { title: 'Arrests', dataIndex: 'arrest_count', align: 'center' },
    {
      title: 'Match',
      dataIndex: 'match_reasons',
      render: (items = []) => <Space wrap>{items.map((item) => <Tag color="blue" key={item}>{item}</Tag>)}</Space>,
    },
  ];

  return (
    <ProtectedRoute allowedRoles={['admin', 'region_admin', 'officer', 'cid', 'court', 'jail', 'district_admin', 'neighborhood_admin']}>
      <div className="reports-page">
        <div className="reports-hero">
          <div>
            <Text className="dashboard-eyebrow">Search and Matching</Text>
            <Title level={2}>Person Matching</Title>
            <Text type="secondary">Search offenders by identity, case history, station, or face image.</Text>
          </div>
        </div>

        <Card variant="none" className="report-panel">
          <Form form={form} layout="vertical" onFinish={handleSearch}>
            <Row gutter={16}>
              <Col xs={24} md={8}><Form.Item name="name" label="Name" rules={[textLengthRule('Name', 2, 150)]}><Input /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="mother_name" label="Mother's Name" rules={[textLengthRule("Mother's name", 2, 150)]}><Input /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="phone" label="Phone" rules={phoneRules}><Input /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="national_id" label="National ID" rules={[textLengthRule('National ID', 2, 100)]}><Input /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="previous_case_number" label="Previous Case Number" rules={[textLengthRule('Previous case number', 2, 100)]}><Input placeholder="OB-HDN-2026-001" /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="police_station" label="Police Station" rules={[textLengthRule('Police station', 2, 150)]}><Input placeholder="Hodan" /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="date_of_birth" label="Date of Birth" rules={[noFutureDateRule('Date of birth')]}><DatePicker style={{ width: '100%' }} disabledDate={disabledFutureDate} /></Form.Item></Col>
              <Col xs={24} md={8}>
                <Form.Item label="Face Image">
                  <Upload beforeUpload={beforeFaceUpload} maxCount={1} accept="image/png,image/jpeg,image/webp">
                    <Button icon={<UploadOutlined />}>Upload Face</Button>
                  </Upload>
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label=" ">
                  <Space>
                    <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={loading}>Search</Button>
                    <Button onClick={() => { form.resetFields(); setFaceImage(''); setResults([]); }}>Clear</Button>
                  </Space>
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Card>

        <Card variant="none" className="report-panel" title="Matching Results">
          <Table columns={columns} dataSource={results} rowKey="id" loading={loading} scroll={{ x: 1100 }} />
        </Card>
      </div>
    </ProtectedRoute>
  );
}
