'use client';

import React, { useState } from 'react';
import { App, Button, Card, Col, DatePicker, Form, Input, Row, Select, Space, Table, Tag, Typography, Upload } from 'antd';
import { SearchOutlined, UploadOutlined } from '@ant-design/icons';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';
import dayjs from 'dayjs';
import { disabledFutureDate, noFutureDateRule, phoneRules, textLengthRule } from '@/utils/validation';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function SearchMatchingPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [globalForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [globalResults, setGlobalResults] = useState([]);
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
      const res = await api.post('/criminals/match-search', payload);
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
      title: 'Qofka / Eedeysanaha',
      dataIndex: 'full_name',
      render: (value, row) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text type="secondary">Hooyada: {row.mother_name || '—'}</Text>
        </Space>
      ),
    },
    { title: 'Telefoonka', dataIndex: 'phone', render: (value) => value || '—' },
    { title: 'Aqoonsiga Qaranka', dataIndex: 'id_number', render: (value) => value || '—' },
    { title: 'Dhalashada', dataIndex: 'date_of_birth', render: (value) => value ? dayjs(value).format('DD/MM/YYYY') : '—' },
    { title: 'Kiisaskii Hore', dataIndex: 'previous_case_numbers', render: (value) => value || '—' },
    { title: 'Saldhigga Booliska', dataIndex: 'police_stations', render: (value) => value || '—' },
    { title: 'Kiisaska', dataIndex: 'case_count', align: 'center' },
    { title: 'Xarigga', dataIndex: 'arrest_count', align: 'center' },
    {
      title: 'Is-waafaqidda',
      dataIndex: 'match_reasons',
      render: (items = []) => <Space wrap>{items.map((item) => <Tag color="blue" key={item}>{item}</Tag>)}</Space>,
    },
  ];

  const handleGlobalSearch = async (values) => {
    setGlobalLoading(true);
    try {
      const params = {
        q: values.q,
        status: values.status,
        priority: values.priority,
        station: values.station,
      };
      if (values.date_range?.[0] && values.date_range?.[1]) {
        params.from_date = values.date_range[0].format('YYYY-MM-DD');
        params.to_date = values.date_range[1].format('YYYY-MM-DD');
      }
      const res = await api.get('/search', { params });
      setGlobalResults(res.data.data || []);
      message.success(`${res.data.data?.length || 0} xog ah ayaa la helay.`);
    } catch (err) {
      message.error(err.response?.data?.message || 'Raadinta way fashilantay.');
    } finally {
      setGlobalLoading(false);
    }
  };

  const globalColumns = [
    {
      title: 'Nooca',
      dataIndex: 'result_type',
      render: (value) => <Tag color={value === 'case' ? 'blue' : 'purple'}>{value === 'case' ? 'KIIS' : 'OB'}</Tag>,
    },
    {
      title: 'Cinwaanka & Lambarka',
      dataIndex: 'title',
      render: (value, row) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{value || row.case_number || row.ob_number}</Text>
          <Text type="secondary">{row.case_number || row.ob_number || `ID ${row.id}`}</Text>
        </Space>
      ),
    },
    { title: 'Xaaladda', dataIndex: 'status', render: (value) => value ? <Tag>{String(value).replaceAll('_', ' ')}</Tag> : '—' },
    { title: 'Mudnaanta', dataIndex: 'priority', render: (value) => value ? <Tag color={value === 'critical' ? 'red' : value === 'high' ? 'volcano' : 'blue'}>{String(value)}</Tag> : '—' },
    { title: 'Saldhigga', dataIndex: 'station_name', render: (value) => value || '—' },
    { title: 'Goobta', dataIndex: 'incident_location', render: (value) => value || '—' },
    { title: 'Taariikhda', dataIndex: 'created_at', render: (value) => value ? dayjs(value).format('DD/MM/YYYY') : '—' },
    {
      title: 'Ficilka',
      dataIndex: 'href',
      render: (href) => <Button type="link" href={href}>Fur Gal-kiiseedka</Button>,
    },
  ];

  return (
    <ProtectedRoute allowedRoles={['admin', 'region_admin', 'region_commander', 'officer', 'cid', 'court', 'jail', 'district_admin']} requiredPermissions={['cases.view', 'cases.investigate']}>
      <div className="reports-page">
        <div className="reports-hero">
          <div>
            <Text className="dashboard-eyebrow">Xarunta Raadinta</Text>
            <Title level={2}>Raadinta Guud & Is-waafajinta Xogta</Title>
            <Text type="secondary">Ka raadi eedeysanayaasha iyo kiisaska adigoo adeegsanaya aqoonsiga, taariikhda kiiska, saldhigga, ama sawirka wajiga.</Text>
          </div>
        </div>

        <Card variant="none" className="report-panel">
          <Form form={globalForm} layout="vertical" onFinish={handleGlobalSearch}>
            <Row gutter={16}>
              <Col xs={24} md={8}><Form.Item name="q" label="Keyword"><Input placeholder="Case #, OB #, suspect, phone, victim..." /></Form.Item></Col>
              <Col xs={24} md={4}><Form.Item name="status" label="Status"><Select allowClear options={[
                { value: 'draft', label: 'Draft' },
                { value: 'CASE_REGISTERED', label: 'Registered' },
                { value: 'under_investigation', label: 'Under Investigation' },
                { value: 'referred_cid', label: 'Referred CID' },
                { value: 'referred_to_court', label: 'Referred Court' },
                { value: 'closed', label: 'Closed' },
              ]} /></Form.Item></Col>
              <Col xs={24} md={4}><Form.Item name="priority" label="Priority"><Select allowClear options={[
                { value: 'critical', label: 'Critical' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' },
              ]} /></Form.Item></Col>
              <Col xs={24} md={4}><Form.Item name="station" label="Station"><Input placeholder="Hodan" /></Form.Item></Col>
              <Col xs={24} md={4}><Form.Item name="date_range" label="Date Range"><RangePicker style={{ width: '100%' }} disabledDate={disabledFutureDate} /></Form.Item></Col>
              <Col xs={24}>
                <Space>
                  <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={globalLoading}>Global Search</Button>
                  <Button onClick={() => { globalForm.resetFields(); setGlobalResults([]); }}>Clear</Button>
                </Space>
              </Col>
            </Row>
          </Form>
        </Card>

        <Card variant="none" className="report-panel" title="Global Results">
          <Table columns={globalColumns} dataSource={globalResults} rowKey={(record) => `${record.result_type}-${record.id}`} loading={globalLoading} scroll={{ x: 1100 }} />
        </Card>

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
