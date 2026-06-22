'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  AuditOutlined,
  BankOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  DashboardOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Gavel, Scale } from 'lucide-react';
import Link from 'next/link';
import dayjs from 'dayjs';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';

const { RangePicker } = DatePicker;
const { Text, Title } = Typography;

const courtRoles = ['court', 'court_admin', 'judge', 'prosecutor', 'prosecutor_liaison', 'court_clerk', 'admin'];

const statusMeta = {
  registered: { label: 'Cusub', color: 'blue', hex: '#3b82f6' },
  awaiting_hearing: { label: 'Sugaya Dhegeysi', color: 'gold', hex: '#eab308' },
  hearing_scheduled: { label: 'Dhegeysi Qorsheysan', color: 'processing', hex: '#60a5fa' },
  in_trial: { label: 'Maxkamadayn Socota', color: 'purple', hex: '#a855f7' },
  judgment_issued: { label: 'Go\'aan La Soo Saaray', color: 'cyan', hex: '#06b6d4' },
  sentenced: { label: 'Xukun La Riday', color: 'volcano', hex: '#f97316' },
  appealed: { label: 'Racfaan La Qaatay', color: 'magenta', hex: '#d946ef' },
  closed: { label: 'La Xiray', color: 'green', hex: '#10b981' },
  archived: { label: 'Kaydsan', color: 'default', hex: '#64748b' },
};

const iconStyle = { width: 24, height: 24, color: '#1e3a8a' };

export default function CourtDashboard() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [calendarItems, setCalendarItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calendarFilters, setCalendarFilters] = useState({});
  const [calendarForm] = Form.useForm();

  const loadDashboard = useCallback(async (nextCalendarFilters = {}) => {
    setLoading(true);
    try {
      const [dashboardRes, notificationsRes, calendarRes] = await Promise.all([
        api.get('/court/dashboard'),
        api.get('/court/notifications'),
        api.get('/court/calendar', { params: nextCalendarFilters }),
      ]);
      setDashboard(dashboardRes.data.data);
      setNotifications(notificationsRes.data.data || []);
      setCalendarItems(calendarRes.data.data || []);
    } catch (error) {
      message.error(error.response?.data?.message || 'Waa ku guuldareysatay in la soo raro xogta dashboard-ka maxkamadda.');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    loadDashboard(calendarFilters);
    const timer = setInterval(() => loadDashboard(calendarFilters), 30000);
    return () => clearInterval(timer);
  }, [calendarFilters, loadDashboard]);

  const applyCalendarFilters = async (values) => {
    const next = { ...values };
    if (values.date_range?.length === 2) {
      next.from_date = values.date_range[0].format('YYYY-MM-DD');
      next.to_date = values.date_range[1].format('YYYY-MM-DD');
    }
    delete next.date_range;
    Object.keys(next).forEach((key) => (next[key] === undefined || next[key] === '') && delete next[key]);
    setCalendarFilters(next);
    await loadDashboard(next);
  };

  const uniqueRooms = useMemo(() => {
    const rooms = calendarItems.map(item => item.court_room).filter(Boolean);
    return [...new Set(rooms)];
  }, [calendarItems]);

  const stats = dashboard?.stats || {};
  
  const metrics = [
    { title: 'Kiisaska Guud ee Maxkamadda', value: stats.total_court_cases || 0, icon: <BankOutlined style={iconStyle} />, color: 'blue' },
    { title: 'Kiisaska Sugaya Go\'aanka', value: stats.pending_cases || 0, icon: <FileTextOutlined style={iconStyle} />, color: 'gold' },
    { title: 'Dhegeysiyada Firfircoon', value: stats.active_hearings || 0, icon: <CalendarOutlined style={iconStyle} />, color: 'processing' },
    { title: 'Kiisaska La Dhammaystiray', value: stats.completed_cases || 0, icon: <FileDoneOutlined style={iconStyle} />, color: 'green' },
    { title: 'Xukunada La Riday', value: stats.convicted_cases || 0, icon: <Gavel style={iconStyle} />, color: 'volcano' },
    { title: 'La Sii Daayay (Acquitted)', value: stats.acquitted_cases || 0, icon: <CheckCircleOutlined style={iconStyle} />, color: 'cyan' },
    { title: 'Racfaannada La Gudbiyey', value: stats.appeals_filed || 0, icon: <AuditOutlined style={iconStyle} />, color: 'magenta' },
    { title: 'Garsoorayaal / Xeer-ilaaliyayaal', value: `${stats.judges || 0} / ${stats.prosecutors || 0}`, icon: <TeamOutlined style={iconStyle} />, color: 'default' },
  ];

  const totalCases = stats.total_court_cases || 1;

  return (
    <ProtectedRoute allowedRoles={courtRoles}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        
        {/* HERO TITLE SECTION */}
        <div className="standard-dashboard-hero">
          <div>
            <Text className="dashboard-eyebrow">Maamulka Guud ee Maxkamadda</Text>
            <Title level={2}>Kormeerka Guud (Dashboard)</Title>
            <Text type="secondary">Guudmarka kiisaska, tirakoobyada dhegeysiyada, jaartiyada falanqaynta, iyo ogeysiisyada dacwadaha maxkamadda.</Text>
          </div>
          <Space wrap>
            <Link href="/dashboard/court/cases">
              <Button type="primary" icon={<BankOutlined style={{ width: 16 }} />}>Eeg Kiisaska Maxkamadda</Button>
            </Link>
            <Button onClick={() => loadDashboard(calendarFilters)}>Cusbooneysii Xogta</Button>
          </Space>
        </div>

        {/* NOTIFICATIONS SECTION */}
        {notifications.length > 0 && (
          <Row gutter={[16, 16]}>
            {notifications.slice(0, 4).map((item, index) => (
              <Col xs={24} md={12} key={`${item.type}-${item.court_case_id}-${index}`}>
                <Alert
                  showIcon
                  type={item.type === 'new_case' ? 'info' : 'warning'}
                  title={<Text strong>{item.title}</Text>}
                  description={
                    <Space orientation="vertical" size={2}>
                      <Text>{item.message}</Text>
                      <Link href={`/dashboard/court/cases?id=${item.court_case_id}`}>
                        <Button type="link" size="small" style={{ padding: 0 }}>Eeg kiiskan</Button>
                      </Link>
                    </Space>
                  }
                />
              </Col>
            ))}
          </Row>
        )}

        {/* STATS METRICS GRID */}
        <Row gutter={[16, 16]}>
          {metrics.map((metric) => (
            <Col xs={24} sm={12} xl={6} key={metric.title}>
              <Card variant="none" className="standard-metric-card" style={{ height: '100%', borderLeft: `4px solid ${metric.color === 'blue' ? '#3b82f6' : (metric.color === 'gold' ? '#eab308' : (metric.color === 'green' ? '#10b981' : '#64748b'))}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <Text type="secondary" style={{ fontSize: '14px', marginBottom: '4px' }}>{metric.title}</Text>
                    <Title level={3} style={{ margin: 0 }}>{loading ? '...' : metric.value}</Title>
                  </div>
                  <div style={{ padding: '12px', background: '#f1f5f9', borderRadius: '8px' }}>
                    {metric.icon}
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>

        {/* INTERACTIVE ROW: CHARTS & CALENDAR */}
        <Row gutter={[16, 16]}>
          
          {/* ANALYTICS CHARTS (CSS Progress based) */}
          <Col xs={24} lg={10}>
            <Space orientation="vertical" style={{ width: '100%' }} size="middle">
              
              <Card variant="none" className="standard-panel" title="Kiisaska marka loo eego Heerarkooda (Status)">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {dashboard?.byStatus?.length ? (
                    dashboard.byStatus.map((row) => {
                      const percentage = Math.round((row.value / totalCases) * 100);
                      const meta = statusMeta[row.label] || { label: row.label, hex: '#64748b' };
                      return (
                        <div key={row.label}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <Text strong>{meta.label}</Text>
                            <Text type="secondary">{row.value} ({percentage}%)</Text>
                          </div>
                          <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${percentage}%`, height: '100%', background: meta.hex, borderRadius: '4px' }} />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <Empty description="Ma jiraan xog ku saabsan heerarka kiisaska." />
                  )}
                </div>
              </Card>

              <Card variant="none" className="standard-panel" title="Qaybaha Dambiyada ee ugu Badan">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {dashboard?.byCrime?.length ? (
                    dashboard.byCrime.slice(0, 5).map((row) => {
                      const percentage = Math.round((row.value / totalCases) * 100);
                      return (
                        <div key={row.label}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <Text strong style={{ textTransform: 'capitalize' }}>{row.label.replaceAll('_', ' ')}</Text>
                            <Text type="secondary">{row.value} ({percentage}%)</Text>
                          </div>
                          <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${percentage}%`, height: '100%', background: '#1e3b8a', borderRadius: '4px' }} />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <Empty description="Ma jiraan xog ku saabsan qaybaha dambiyada." />
                  )}
                </div>
              </Card>

            </Space>
          </Col>

          {/* UPCOMING HEARINGS LIST & FILTER */}
          <Col xs={24} lg={14}>
            <Card
              variant="none"
              className="standard-panel"
              title="Dhegeysiyada Soo Socda ee Maxkamadda (Calendar Queue)"
              style={{ height: '100%' }}
            >
              <Form form={calendarForm} layout="inline" onFinish={applyCalendarFilters} style={{ marginBottom: '20px' }}>
                <Form.Item name="date_range" label="Muddada">
                  <RangePicker size="small" style={{ width: '220px' }} />
                </Form.Item>
                <Form.Item name="court_room" label="Qolka">
                  <Select size="small" allowClear style={{ width: '120px' }} placeholder="Dhammaan" options={uniqueRooms.map(room => ({ value: room, label: room }))} />
                </Form.Item>
                <Form.Item>
                  <Space>
                    <Button type="primary" size="small" htmlType="submit">Sifeey</Button>
                    <Button size="small" onClick={() => { calendarForm.resetFields(); setCalendarFilters({}); loadDashboard({}); }}>Deji</Button>
                  </Space>
                </Form.Item>
              </Form>

              <Table
                size="small"
                loading={loading}
                dataSource={calendarItems}
                rowKey="id"
                pagination={{ pageSize: 8 }}
                scroll={{ x: 950 }}
                columns={[
                  {
                    title: 'Kiiska Maxkamadda',
                    dataIndex: 'court_case_number',
                    width: 170,
                    render: (v, row) => (
                      <Link href={`/dashboard/court/cases?id=${row.court_case_id}`}>
                        <Button type="link" size="small" style={{ padding: 0, fontWeight: 500 }}>
                          {v}
                        </Button>
                      </Link>
                    )
                  },
                  {
                    title: 'Cinwaanka',
                    dataIndex: 'case_title',
                    width: 250,
                    ellipsis: true,
                  },
                  {
                    title: 'Nooca Dhegeysiga',
                    dataIndex: 'hearing_type',
                    width: 130,
                    render: (type) => {
                      const typeLabels = {
                        preliminary: 'Hordhac',
                        evidence: 'Caddeymo',
                        witness: 'Markhaati',
                        final: 'Kama-dambays',
                        appeal: 'Racfaan',
                      };
                      return <Tag color="blue">{typeLabels[type] || type}</Tag>;
                    }
                  },
                  {
                    title: 'Taariikhda & Saacadda',
                    width: 180,
                    render: (_, row) => `${row.hearing_date} ${row.hearing_time || ''}`,
                  },
                  {
                    title: 'Qolka Maxkamadda',
                    dataIndex: 'court_room',
                    width: 150,
                    render: (v) => v || 'Aan cayinnayn',
                  },
                  {
                    title: 'Garsooraha',
                    dataIndex: 'assigned_judge',
                    width: 150,
                    render: (v) => v || 'Aan la xilsaarin',
                  }
                ]}
              />
            </Card>
          </Col>

        </Row>

      </Space>
    </ProtectedRoute>
  );
}
