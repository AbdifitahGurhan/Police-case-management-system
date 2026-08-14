'use client';

import React, { useState } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { AuditOutlined, SearchOutlined } from '@ant-design/icons';
import { Scale } from 'lucide-react';
import Link from 'next/link';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';

const { RangePicker } = DatePicker;
const { Text, Title } = Typography;

const courtRoles = ['court', 'court_admin', 'judge', 'prosecutor', 'prosecutor_liaison', 'court_clerk', 'admin'];

const statusMeta = {
  court_received: { label: 'Maxkamaddu Heshay', tone: 'open' },
  arraignment: { label: 'Horgeyn + Qirasho', tone: 'pending' },
  remand_investigation: { label: 'Muddo Baaris', tone: 'pending' },
  remanded_to_investigator: { label: 'Dib loogu celiyay Baaraha', tone: 'warning' },
  returned_from_remand: { label: 'Baaris Soo Noqotay', tone: 'open' },
  assigned_legal_team: { label: 'Xilsaarid', tone: 'open' },
  case_scheduled: { label: 'Mudeyn', tone: 'open' },
  trial_hearing: { label: 'Dhageysi', tone: 'pending' },
  evidence_defense: { label: 'Caddeymo & Difaac', tone: 'pending' },
  judgment: { label: 'Xukun', tone: 'open' },
  sentenced: { label: 'Xukun La Riday', tone: 'warning' },
  appealed: { label: 'Racfaan La Qaatay', tone: 'critical' },
  closed: { label: 'La Xiray', tone: 'closed' },
  archived: { label: 'Kaydsan', tone: 'neutral' },
};

const decisionColor = { convicted: 'red', acquitted: 'green', dismissed: 'default' };

const statusTag = (status) => {
  const meta = statusMeta[status] || { label: status || 'Aan la garanayn', tone: 'neutral' };
  return <Tag className={`status-tag status-tag--${meta.tone}`}>{meta.label}</Tag>;
};

const safe = (value) => value || <Text type="secondary">-</Text>;

export default function CourtSearchPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchCases = async (values = {}) => {
    const params = { ...values, limit: 50 };
    if (values.date_range?.length === 2) {
      params.from_date = values.date_range[0].format('YYYY-MM-DD');
      params.to_date = values.date_range[1].format('YYYY-MM-DD');
    }
    delete params.date_range;
    Object.keys(params).forEach((key) => (params[key] === undefined || params[key] === '') && delete params[key]);

    setLoading(true);
    try {
      const response = await api.get('/court/cases', { params });
      setCases(response.data.data || []);
    } catch (error) {
      message.error(error.response?.data?.message || 'Waa ku guuldareysatay in la baaro kiisaska maxkamadda.');
    } finally {
      setLoading(false);
    }
  };

  const resetSearch = () => {
    form.resetFields();
    setCases([]);
  };

  const columns = [
    {
      title: 'Kiiska Maxkamadda #',
      dataIndex: 'court_case_number',
      render: (value, row) => <Link href={`/dashboard/court/cases?id=${row.id}`}>{value}</Link>,
    },
    { title: 'Kiiska Booliska #', dataIndex: 'police_case_number', render: safe },
    { title: 'OB #', dataIndex: 'ob_number', render: safe },
    { title: 'Cinwaanka', dataIndex: 'case_title', ellipsis: true, render: safe },
    { title: 'Dhibanaha (Complainant)', dataIndex: 'complainant_name', render: safe },
    { title: 'Garsooraha', dataIndex: 'assigned_judge', render: safe },
    { title: 'Heerka', dataIndex: 'status', render: statusTag },
    {
      title: 'Natiijada',
      dataIndex: 'final_outcome',
      render: (value) => value
        ? <Tag color={decisionColor[value]}>{value === 'convicted' ? 'XUKUN LA RIDAY' : value === 'acquitted' ? 'LA Sii DAAYAY' : 'LA LAALAY'}</Tag>
        : <Text type="secondary">Sugaya</Text>,
    },
  ];

  return (
    <ProtectedRoute allowedRoles={courtRoles}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div className="standard-dashboard-hero">
          <div>
            <Text className="dashboard-eyebrow">Diiwaanka Maxkamadaha</Text>
            <Title level={2}>Baaritaan Dheeraad Ah</Title>
            <Text type="secondary">Raadi kiisaska maxkamadda adigoo adeegsanaya lambarka kiiska, OB, eedaysane, dhibane, garsoore ama heerka.</Text>
          </div>
          <Space wrap>
            <Button icon={<AuditOutlined style={{ width: 16 }} />} href="/dashboard/court/cases">Kiisaska Maxkamadda</Button>
            <Button type="primary" icon={<Scale style={{ width: 16 }} />} onClick={() => form.submit()}>Baar</Button>
          </Space>
        </div>

        <Card variant="none" className="standard-panel" title="Baaritaan Dheeraad Ah">
          <Form form={form} layout="vertical" onFinish={searchCases}>
            <Row gutter={12}>
              <Col xs={24} md={8}><Form.Item name="court_case_number" label="Lambarka Kiiska Maxkamadda"><Input /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="police_case_number" label="Lambarka Kiiska Booliska"><Input /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="ob_number" label="Lambarka Diiwaanka (OB #)"><Input /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="suspect_name" label="Magaca Eedaysanaha"><Input /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="complainant_name" label="Magaca Dhibanaha (Complainant)"><Input /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="judge" label="Garsooraha"><Input /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="status" label="Heerka (Status)"><Select allowClear options={Object.entries(statusMeta).map(([value, meta]) => ({ value, label: meta.label }))} /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="date_range" label="Muddada Diiwaangelinta"><RangePicker style={{ width: '100%' }} /></Form.Item></Col>
              <Col xs={24} md={8}>
                <Form.Item label=" ">
                  <Space>
                    <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>Baar</Button>
                    <Button onClick={resetSearch}>Dib u Deji</Button>
                  </Space>
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Card>

        <Card variant="none" className="standard-panel" title="Natiijooyinka Baaritaanka">
          <Table columns={columns} dataSource={cases} rowKey="id" loading={loading} scroll={{ x: 1250 }} />
        </Card>
      </Space>
    </ProtectedRoute>
  );
}
