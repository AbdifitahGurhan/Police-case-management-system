'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  TimePicker,
  Typography,
} from 'antd';
import {
  AuditOutlined,
  BankOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  PrinterOutlined,
  SearchOutlined,
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
const { TextArea } = Input;

const courtRoles = ['court', 'court_admin', 'judge', 'prosecutor', 'prosecutor_liaison', 'court_clerk', 'admin'];

const statusMeta = {
  registered: { label: 'Cusub', color: 'blue' },
  awaiting_hearing: { label: 'Sugaya Dhegeysi', color: 'gold' },
  hearing_scheduled: { label: 'Dhegeysi Qorsheysan', color: 'processing' },
  in_trial: { label: 'Maxkamadayn Socota', color: 'purple' },
  judgment_issued: { label: 'Go\'aan La Soo Saaray', color: 'cyan' },
  sentenced: { label: 'Xukun La Riday', color: 'volcano' },
  appealed: { label: 'Racfaan La Qaatay', color: 'magenta' },
  closed: { label: 'La Xiray', color: 'green' },
  archived: { label: 'Kaydsan', color: 'default' },
};

const decisionColor = { convicted: 'red', acquitted: 'green', dismissed: 'default' };

const roleConfig = {
  admin: { title: 'Maamulka Sare - Maxkamadda', actions: ['assign', 'hearing', 'proceeding', 'judgment', 'sentence', 'appeal', 'close', 'documents'] },
  court: { title: 'Maamulka Guud ee Maxkamadda', actions: ['assign', 'hearing', 'proceeding', 'judgment', 'sentence', 'appeal', 'close', 'documents'] },
  court_admin: { title: 'Maamulaha Maxkamadda', actions: ['assign', 'hearing', 'proceeding', 'close', 'documents'] },
  judge: { title: 'Dashboard-ka Garsooraha', actions: ['proceeding', 'judgment', 'sentence', 'documents'] },
  prosecutor: { title: 'Dashboard-ka Xeer-ilaaliyaha', actions: ['appeal', 'documents'] },
  prosecutor_liaison: { title: 'Xiriiriyaha Xeer-ilaalinta', actions: ['appeal', 'documents'] },
  court_clerk: { title: 'Kaaliyaha Maxkamadda', actions: ['hearing', 'proceeding', 'documents'] },
};

const statusTag = (status) => {
  const meta = statusMeta[status] || { label: status?.replaceAll('_', ' ') || 'Unknown', color: 'default' };
  return <Tag color={meta.color}>{meta.label}</Tag>;
};

const safe = (value) => value || 'N/A';

export default function CourtCasesPage() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const [cases, setCases] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [activeHearing, setActiveHearing] = useState(null);
  const [filters, setFilters] = useState({});
  const [form] = Form.useForm();
  const [searchForm] = Form.useForm();

  const role = user?.role || 'court';
  const config = roleConfig[role] || roleConfig.court;
  const can = (action) => config.actions.includes(action);

  const loadCases = useCallback(async (nextFilters = {}) => {
    setLoading(true);
    try {
      const casesRes = await api.get('/court/cases', { params: { limit: 50, ...nextFilters } });
      setCases(casesRes.data.data || []);
    } catch (error) {
      message.error(error.response?.data?.message || 'Waa ku guuldareysatay in la soo raro kiisaska.');
    } finally {
      setLoading(false);
    }
  }, [message]);

  const loadDetail = useCallback(async (courtCaseId) => {
    setDetailLoading(true);
    try {
      const response = await api.get(`/court/cases/${courtCaseId}`);
      setSelected(response.data.data);
      setDetailOpen(true);
    } catch (error) {
      message.error(error.response?.data?.message || 'Waa ku guuldareysatay in la soo raro faahfaahinta kiiska.');
    } finally {
      setDetailLoading(false);
    }
  }, [message]);

  useEffect(() => {
    loadCases(filters);
    const timer = setInterval(() => loadCases(filters), 30000);
    return () => clearInterval(timer);
  }, [filters, loadCases]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const caseId = params.get('id');
      if (caseId) {
        loadDetail(caseId);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [loadDetail]);

  const openModal = (type, initial = {}) => {
    setModalType(type);
    setActiveHearing(initial.hearing || null);
    form.resetFields();
    form.setFieldsValue(initial.values || {});
  };

  const closeModal = () => {
    setModalType(null);
    setActiveHearing(null);
    form.resetFields();
  };

  const refreshAfterAction = async () => {
    const id = selected?.courtCase?.id;
    await loadCases(filters);
    if (id) await loadDetail(id);
  };

  const submitModal = async (values) => {
    try {
      const id = selected?.courtCase?.id;
      if (modalType === 'assign') await api.patch(`/court/cases/${id}/assign`, values);
      if (modalType === 'hearing') {
        await api.post(`/court/cases/${id}/hearings`, {
          ...values,
          hearing_date: values.hearing_date.format('YYYY-MM-DD'),
          hearing_time: values.hearing_time.format('HH:mm:ss'),
        });
      }
      if (modalType === 'proceeding') await api.post(`/court/hearings/${activeHearing.id}/proceedings`, values);
      if (modalType === 'judgment') {
        await api.post(`/court/cases/${id}/judgments`, {
          ...values,
          decision_date: values.decision_date ? values.decision_date.format('YYYY-MM-DD') : null,
        });
      }
      if (modalType === 'sentence') {
        await api.post(`/court/cases/${id}/sentences`, {
          ...values,
          sentence_date: values.sentence_date ? values.sentence_date.format('YYYY-MM-DD') : null,
        });
      }
      if (modalType === 'appeal') {
        await api.post(`/court/cases/${id}/appeals`, {
          ...values,
          filing_date: values.filing_date ? values.filing_date.format('YYYY-MM-DD') : null,
        });
      }
      if (modalType === 'close') await api.patch(`/court/cases/${id}/close`, values);
      message.success('Diiwaanka maxkamadda waa la cusbooneysiiyey.');
      closeModal();
      await refreshAfterAction();
    } catch (error) {
      message.error(error.response?.data?.message || 'Ficilka maxkamaddu waa ku guuldareystay.');
    }
  };

  const applySearch = async (values) => {
    const next = { ...values };
    if (values.date_range?.length === 2) {
      next.from_date = values.date_range[0].format('YYYY-MM-DD');
      next.to_date = values.date_range[1].format('YYYY-MM-DD');
    }
    delete next.date_range;
    Object.keys(next).forEach((key) => (next[key] === undefined || next[key] === '') && delete next[key]);
    setFilters(next);
    await loadCases(next);
  };

  const printCourtDocument = (type) => {
    if (!selected?.courtCase) return;
    const cc = selected.courtCase;
    const latestHearing = selected.hearings?.[0];
    const latestJudgment = selected.judgments?.[0];
    const latestSentence = selected.sentences?.[0];
    const latestAppeal = selected.appeals?.[0];
    const titles = {
      summons: 'Summons (U-yeerid Maxkamadeed)',
      hearing_notice: 'Ogeysiiska Dhegeysiga',
      judgment_order: 'Go\'aanka Maxkamadda',
      sentence_order: 'Warqadda Xukunka',
      appeal_receipt: 'Rasiidhka Racfaanka',
      closure_certificate: 'Shahaadada Xiritaanka',
    };
    const rows = [
      ['Lambarka Kiiska Maxkamadda', cc.court_case_number],
      ['Lambarka Kiiska Booliska', cc.police_case_number],
      ['Lambarka Diiwaanka (OB #)', cc.ob_number],
      ['Cinwaanka Kiiska', cc.case_title],
      ['Garsooraha loo Xilsaaray', cc.assigned_judge],
      ['Xeer-ilaaliyaha loo Xilsaaray', cc.assigned_prosecutor],
      ['Heerka (Status)', statusMeta[cc.status]?.label || cc.status],
      ['Dhegeysiga', latestHearing ? `${latestHearing.hearing_date} ${latestHearing.hearing_time || ''} - ${safe(latestHearing.court_room)}` : 'Ma jiraan dhageysi loo qorsheeyay'],
      ['Go\'aanka', latestJudgment ? `${latestJudgment.decision_type}: ${latestJudgment.judgment_summary}` : 'Sugaya'],
      ['Xukunka', latestSentence ? `${latestSentence.sentence_type} ${latestSentence.duration || ''}` : 'Sugaya'],
      ['Racfaanka', latestAppeal ? `${latestAppeal.filed_by}: ${latestAppeal.appeal_reason}` : 'Ma jiraan racfaan la diiwaangeliyey'],
    ];
    const html = `
      <html><head><title>${titles[type]}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:36px;color:#111827}
        h1{font-size:24px;margin-bottom:4px} h2{font-size:16px;color:#4b5563;margin-top:0}
        table{width:100%;border-collapse:collapse;margin-top:24px}td{border:1px solid #d1d5db;padding:10px;vertical-align:top}
        td:first-child{width:220px;font-weight:700;background:#f3f4f6}.sign{margin-top:56px;display:flex;justify-content:space-between}
      </style></head><body>
      <h1>${titles[type]}</h1><h2>Waaxda Booliska Gobolka - Qaybta Maamulka Maxkamadda</h2>
      <table>${rows.map(([label, value]) => `<tr><td>${label}</td><td>${safe(value)}</td></tr>`).join('')}</table>
      <div class="sign"><span>Loo diyaariyey: ${safe(user?.fullName || user?.username)}</span><span>Taariikhda: ${dayjs().format('YYYY-MM-DD HH:mm')}</span></div>
      </body></html>`;
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const caseColumns = [
    { title: 'Kiiska Maxkamadda #', dataIndex: 'court_case_number', render: (value, row) => <Button type="link" onClick={() => loadDetail(row.id)}>{value}</Button> },
    { title: 'Kiiska Booliska #', dataIndex: 'police_case_number' },
    { title: 'OB #', dataIndex: 'ob_number' },
    { title: 'Cinwaanka', dataIndex: 'case_title', ellipsis: true },
    { title: 'Dhibanaha (Complainant)', dataIndex: 'complainant_name', render: safe },
    { title: 'Garsooraha', dataIndex: 'assigned_judge', render: (value) => value || <Text type="secondary">Aan la xilsaarin</Text> },
    { title: 'Heerka', dataIndex: 'status', render: statusTag },
    { title: 'Natiijada', dataIndex: 'final_outcome', render: (value) => value ? <Tag color={decisionColor[value]}>{value === 'convicted' ? 'XUKUN LA RIDAY' : value === 'acquitted' ? 'LA Sii DAAYAY' : 'LA LAALAY'}</Tag> : <Text type="secondary">Sugaya</Text> },
  ];

  const courtCase = selected?.courtCase;

  return (
    <ProtectedRoute allowedRoles={courtRoles}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div className="standard-dashboard-hero">
          <div>
            <Text className="dashboard-eyebrow">Diiwaanka Maxkamadaha</Text>
            <Title level={2}>Kiisaska Maxkamadda (Court Cases)</Title>
            <Text type="secondary">Maamul kiisaska, dhageysiyada, go'aannada iyo xukunada maxkamadda.</Text>
          </div>
          <Space wrap>
            {role === 'admin' && <Button icon={<AuditOutlined style={{ width: 16 }} />} href="/reports">Warbixinada</Button>}
            <Button type="primary" icon={<Scale style={{ width: 16 }} />} onClick={() => loadCases(filters)}>Cusbooneysii</Button>
          </Space>
        </div>

        <Card variant="none" className="standard-panel" title="Baaritaan Dheeraad Ah">
          <Form form={searchForm} layout="vertical" onFinish={applySearch}>
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
                    <Button onClick={() => { searchForm.resetFields(); setFilters({}); loadCases({}); }}>Dib u Deji</Button>
                  </Space>
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Card>

        <Card variant="none" className="standard-panel" title="Diiwaanka Kiisaska Maxkamadda">
          <Table columns={caseColumns} dataSource={cases} rowKey="id" loading={loading || detailLoading} scroll={{ x: 1250 }} />
        </Card>

        <Drawer
          title="Faahfaahinta Kiiska Maxkamadda (Court Case Profile)"
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
          size="large"
        >
          {courtCase ? (
            <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
              <div style={{
                background: '#f8fafc',
                padding: '16px 24px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                marginBottom: '10px'
              }}>
                <Row align="middle" justify="space-between" gutter={[16, 16]}>
                  <Col xs={24} lg={14}>
                    <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                      <Text type="secondary" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Faylka Kiiska ee Firfircoon
                      </Text>
                      <Title level={4} style={{ margin: 0, color: '#1e293b' }}>
                        {courtCase.court_case_number}
                      </Title>
                      <Text strong style={{ fontSize: '15px', color: '#475569', display: 'block' }}>
                        {courtCase.case_title}
                      </Text>
                      <Space style={{ marginTop: 6 }}>
                        {statusTag(courtCase.status)}
                        {courtCase.final_outcome && <Tag color="green">{courtCase.final_outcome === 'convicted' ? 'XUKUN LA RIDAY' : courtCase.final_outcome === 'acquitted' ? 'LA Sii DAAYAY' : 'LA LAALAY'}</Tag>}
                      </Space>
                    </Space>
                  </Col>
                  <Col xs={24} lg={10} style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                    <Space wrap style={{ justifyContent: 'flex-end' }}>
                      {can('assign') && <Button onClick={() => openModal('assign', { values: { assigned_judge: courtCase.assigned_judge, assigned_prosecutor: courtCase.assigned_prosecutor } })}>U Xilsaar</Button>}
                      {can('hearing') && <Button type="primary" onClick={() => openModal('hearing')}>Qorshee Dhegeysi</Button>}
                      {can('judgment') && <Button onClick={() => openModal('judgment')}>Go'aanka Maxkamadda</Button>}
                      {can('sentence') && <Button onClick={() => openModal('sentence')}>Xukunka</Button>}
                      {can('appeal') && <Button onClick={() => openModal('appeal')}>Appeal</Button>}
                      {can('close') && <Button danger onClick={() => openModal('close')}>Xir Kiiska</Button>}
                    </Space>
                  </Col>
                </Row>
              </div>
              {can('documents') && (
                <Card size="small" title="Soo Saaraha Dukumentiyada Maxkamadda">
                  <Space wrap>
                    {[
                      ['summons', 'Yeerid Maxkamadeed (Summons)'],
                      ['hearing_notice', 'Ogeysiiska Dhegeysiga'],
                      ['judgment_order', 'Go\'aanka Maxkamadda'],
                      ['sentence_order', 'Amar Xukun'],
                      ['appeal_receipt', 'Rasiidhka Racfaanka'],
                      ['closure_certificate', 'Shahaadada Xiritaanka'],
                    ].map(([type, label]) => (
                      <Button key={type} icon={<PrinterOutlined />} onClick={() => printCourtDocument(type)}>{label}</Button>
                    ))}
                  </Space>
                </Card>
              )}

              <Tabs
                defaultActiveKey="court_activity"
                items={[
                  {
                    key: 'court_activity',
                    label: 'Hawlaha Maxkamadda (Court Activity)',
                    children: (
                      <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                        <Card title="Dhegeysiyada Maxkamadda (Hearings)" size="small">
                          <Table
                            size="small"
                            rowKey="id"
                            dataSource={selected.hearings}
                            pagination={false}
                            columns={[
                              { title: 'Nooca', dataIndex: 'hearing_type' },
                              { title: 'Taariikhda', dataIndex: 'hearing_date' },
                              { title: 'Saacadda', dataIndex: 'hearing_time' },
                              { title: 'Qolka Maxkamadda', dataIndex: 'court_room', render: safe },
                              { title: 'Garsooraha', dataIndex: 'assigned_judge', render: safe },
                              { title: 'Heerka', dataIndex: 'status', render: (v) => <Tag>{v}</Tag> },
                              { title: 'Ficil', render: (_, row) => can('proceeding') ? <Button size="small" onClick={() => openModal('proceeding', { hearing: row })}>Ku dar Qoraalka Dacwadda</Button> : null },
                            ]}
                          />
                        </Card>

                        <Card title="Qoraallada Fadhiyada Maxkamadda (Proceedings)" size="small">
                          <Table
                            size="small"
                            rowKey="id"
                            dataSource={selected.proceedings}
                            pagination={false}
                            columns={[
                              { title: 'Taariikhda', dataIndex: 'proceeding_date' },
                              { title: 'Dhegeysiga', dataIndex: 'hearing_type', render: safe },
                              { title: 'Qoraalka Fadhiga', dataIndex: 'notes', ellipsis: true },
                              { title: 'Hadallada Garsooraha', dataIndex: 'judge_remarks', ellipsis: true },
                              { title: 'Hadallada Xeer-ilaaliyaha', dataIndex: 'prosecutor_remarks', ellipsis: true },
                              { title: 'Hadallada Qareenka Difaaca', dataIndex: 'defense_remarks', ellipsis: true },
                            ]}
                          />
                        </Card>

                        <Card title="Go'aannada, Xukunnada & Racfaannada" size="small">
                          {selected.judgments?.length > 0 && (
                            <div style={{ marginBottom: 20 }}>
                              <Typography.Text strong style={{ display: 'block', marginBottom: 8, fontSize: '14px' }}>Go'aannada Maxkamadda (Judgments):</Typography.Text>
                              <Table
                                size="small"
                                rowKey="id"
                                dataSource={selected.judgments}
                                pagination={false}
                                columns={[
                                  { title: 'Taariikhda', dataIndex: 'decision_date' },
                                  { title: 'Garsooraha', dataIndex: 'judge_name', render: safe },
                                  { title: 'Go\'aanka', dataIndex: 'decision_type', render: (v) => <Tag color={decisionColor[v]}>{v === 'convicted' ? 'XUKUN LA RIDAY' : v === 'acquitted' ? 'LA Sii DAAYAY' : 'LA LAALAY'}</Tag> },
                                  { title: 'Koobsiga Go\'aanka', dataIndex: 'judgment_summary', ellipsis: true },
                                ]}
                              />
                            </div>
                          )}

                          {selected.sentences?.length > 0 && (
                            <div style={{ marginBottom: 20 }}>
                              <Typography.Text strong style={{ display: 'block', marginBottom: 8, fontSize: '14px' }}>Xukunnada La Riday (Sentences):</Typography.Text>
                              <Table
                                size="small"
                                rowKey="id"
                                dataSource={selected.sentences}
                                pagination={false}
                                columns={[
                                  { title: 'Eedaysanaha', dataIndex: 'defendant_name' },
                                  { title: 'Nooca Xukunka', dataIndex: 'sentence_type' },
                                  { title: 'Muddada', dataIndex: 'duration', render: safe },
                                  { title: 'Ganaaxa', dataIndex: 'fine_amount', render: safe },
                                  { title: 'Taariikhda', dataIndex: 'sentence_date' },
                                ]}
                              />
                            </div>
                          )}

                          {selected.appeals?.length > 0 && (
                            <div>
                              <Typography.Text strong style={{ display: 'block', marginBottom: 8, fontSize: '14px' }}>Racfaannada La Qaatay (Appeals):</Typography.Text>
                              <Table
                                size="small"
                                rowKey="id"
                                dataSource={selected.appeals}
                                pagination={false}
                                columns={[
                                  { title: 'Ciddii Gudbisay', dataIndex: 'filed_by' },
                                  { title: 'Sababta', dataIndex: 'appeal_reason', ellipsis: true },
                                  { title: 'Taariikhda', dataIndex: 'filing_date' },
                                  { title: 'Heerka', dataIndex: 'status', render: (v) => <Tag>{v}</Tag> },
                                ]}
                              />
                            </div>
                          )}

                          {(!selected.judgments?.length && !selected.sentences?.length && !selected.appeals?.length) && (
                            <Empty description="Ma jiraan wax go'aanno, xukunno, ama racfaanno ah oo weli la diiwaangeliyey." />
                          )}
                        </Card>
                      </Space>
                    ),
                  },
                  {
                    key: 'overview',
                    label: 'Guudmar & Faahfaahin (Overview)',
                    children: (
                      <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                        <Descriptions title="Macluumaadka Kiiska & Maxkamadda" bordered column={2}>
                          <Descriptions.Item label="Kiiska Maxkamadda">{courtCase.court_case_number}</Descriptions.Item>
                          <Descriptions.Item label="Kiiska Booliska">
                            {role === 'admin' ? <Link href={`/cases/${courtCase.police_case_id}`}>{courtCase.police_case_number}</Link> : courtCase.police_case_number}
                          </Descriptions.Item>
                          <Descriptions.Item label="OB Number">{courtCase.ob_number}</Descriptions.Item>
                          <Descriptions.Item label="Qaybta Dambiga">{courtCase.crime_category}</Descriptions.Item>
                          <Descriptions.Item label="Garsooraha">{safe(courtCase.assigned_judge)}</Descriptions.Item>
                          <Descriptions.Item label="Xeer-ilaaliyaha">{safe(courtCase.assigned_prosecutor)}</Descriptions.Item>
                          <Descriptions.Item label="Heerka">{statusTag(courtCase.status)}</Descriptions.Item>
                          <Descriptions.Item label="Natiijada">{safe(courtCase.final_outcome)}</Descriptions.Item>
                          <Descriptions.Item label="Sharaxaad" span={2}>{courtCase.case_description || 'Faahfaahin lama diiwaangelin.'}</Descriptions.Item>
                        </Descriptions>

                        <Descriptions title="Faahfaahinta Baarista Booliska" bordered column={2}>
                          <Descriptions.Item label="Dhibanaha (Complainant)">{safe(courtCase.complainant_name)}</Descriptions.Item>
                          <Descriptions.Item label="Telefoonka">{safe(courtCase.complainant_phone)}</Descriptions.Item>
                          <Descriptions.Item label="Goobta Dhacdada">{safe(courtCase.incident_location)}</Descriptions.Item>
                          <Descriptions.Item label="Muhiimadda">{safe(courtCase.priority)}</Descriptions.Item>
                          <Descriptions.Item label="Sarkaalka Baaraha ah">{safe(courtCase.officer_name)}</Descriptions.Item>
                          <Descriptions.Item label="Diiwaanka Xarigga">{selected.arrests?.length || 0}</Descriptions.Item>
                        </Descriptions>
                      </Space>
                    ),
                  },
                  {
                    key: 'police_evidence',
                    label: `Faylka Booliska & Caddeymaha`,
                    children: (
                      <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                        <Card title={`Eedaysanayaasha Kiiska Ku Xiran (Offenders) (${selected.criminals.length})`} size="small">
                          <Table
                            size="small"
                            rowKey="id"
                            dataSource={selected.criminals}
                            pagination={false}
                            columns={[
                              { title: 'Magaca', dataIndex: 'full_name' },
                              { title: 'Telefoonka', dataIndex: 'phone', render: safe },
                              { title: 'Aqoonsiga (National ID)', dataIndex: 'national_id', render: safe },
                              { title: 'Doorka Kiiska', dataIndex: 'role_in_case', render: safe },
                              { title: 'Heerka Xarigga', dataIndex: 'arrest_status', render: (v) => <Tag>{safe(v)}</Tag> },
                            ]}
                          />
                        </Card>

                        <Card title={`Hadallada Markhaatiyaasha (Witnesses) (${selected.witnesses.length})`} size="small">
                          <Table
                            size="small"
                            rowKey="id"
                            dataSource={selected.witnesses}
                            pagination={false}
                            columns={[
                              { title: 'Magaca', dataIndex: 'full_name' },
                              { title: 'Telefoonka', dataIndex: 'phone', render: safe },
                              { title: 'Cinwaanka', dataIndex: 'address', render: safe },
                              { title: 'Heerka Maxkamadda', dataIndex: 'court_status', render: (v) => <Tag>{v || 'pending'}</Tag> },
                              { title: 'Hadalka Markhaatiga', dataIndex: 'statement', ellipsis: true },
                            ]}
                          />
                        </Card>

                        <Card title={`Caddeymaha Kiiska (Evidence) (${selected.evidence.length})`} size="small">
                          <Table
                            size="small"
                            rowKey="id"
                            dataSource={selected.evidence}
                            pagination={false}
                            columns={[
                              { title: 'Lambarka Caddeynta', dataIndex: 'evidence_number', render: safe },
                              { title: 'Cinwaanka', dataIndex: 'title', render: safe },
                              { title: 'Nooca', dataIndex: 'type', render: safe },
                              { title: 'Ciddii Soo Ururisay', dataIndex: 'collected_by', render: safe },
                              { title: 'Faylka', dataIndex: 'file_url', render: (url) => url ? <Button size="small" href={`http://localhost:5001${url}`} target="_blank">Soo Degso</Button> : 'N/A' },
                              { title: 'Xusuus-qorka Maxkamadda', dataIndex: 'court_notes', ellipsis: true },
                            ]}
                          />
                        </Card>
                      </Space>
                    ),
                  },
                  {
                    key: 'audit',
                    label: `Dabagalka Nidaamka (Audit Trail) (${selected.auditTrail?.length || 0})`,
                    children: selected.auditTrail?.length ? (
                      <Table
                        size="small"
                        rowKey={(row) => `${row.entity_type}-${row.entity_id}-${row.created_at}-${row.action}`}
                        dataSource={selected.auditTrail}
                        columns={[
                          { title: 'Ciddii Beddesay', dataIndex: 'performed_by', render: safe },
                          { title: 'Wixii Isbeddelay', dataIndex: 'action', render: (v) => v?.replaceAll('_', ' ') },
                          { title: 'Taariikhda/Saacadda', dataIndex: 'created_at', render: (v) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : 'N/A' },
                          { title: 'Qiimihii Hore', dataIndex: 'previous_value', ellipsis: true, render: (v) => v ? JSON.stringify(v) : 'N/A' },
                          { title: 'Qiimaha Cusub', dataIndex: 'new_value', ellipsis: true, render: (v) => v ? JSON.stringify(v) : 'N/A' },
                        ]}
                      />
                    ) : (
                      <Empty description="Weli ma jiraan wax dabagal ah oo la diiwaangeliyey." />
                    ),
                  },
                ]}
              />
            </Space>
          ) : <Empty />}
        </Drawer>

        <Modal
          title={modalType ? (() => {
            const titles = {
              assign: 'U-xilsaar Garsoore / Xeer-ilaaliye (Assign)',
              hearing: 'Qorshee Dhegeysi Cusub (Schedule Hearing)',
              proceeding: 'Qoraalka Dacwadda (Add Proceedings)',
              judgment: 'Go\'aanka Maxkamadda (Judgment)',
              sentence: 'Xukun Ridis (Sentence)',
              appeal: 'Gudbi Racfaan (Appeal)',
              close: 'Xiridda Kiiska Maxkamadda (Close)',
            };
            return titles[modalType] || 'Ficilka Maxkamadda';
          })() : 'Ficilka Maxkamadda'}
          open={Boolean(modalType)}
          onCancel={closeModal}
          onOk={() => form.submit()}
          destroyOnHidden
          forceRender
          width={720}
          zIndex={1050}
        >
          <Form form={form} layout="vertical" onFinish={submitModal}>
            {modalType === 'assign' && (
              <Row gutter={16}>
                <Col span={12}><Form.Item name="assigned_judge" label="Garsooraha Kiiska loo Xilsaaray"><Input /></Form.Item></Col>
                <Col span={12}><Form.Item name="assigned_prosecutor" label="Xeer-ilaaliyaha Kiiska"><Input /></Form.Item></Col>
              </Row>
            )}
            {modalType === 'hearing' && (
              <Row gutter={16}>
                <Col span={12}><Form.Item name="hearing_type" label="Nooca Dhegeysiga" rules={[{ required: true }]}><Select options={[
                  { value: 'preliminary', label: 'Dhegeysiga Hordhaca Ah' },
                  { value: 'evidence', label: 'Dhegeysiga Caddeymaha' },
                  { value: 'witness', label: 'Dhegeysiga Markhaatiyaasha' },
                  { value: 'final', label: 'Dhegeysiga kama dambaysta ah' },
                  { value: 'appeal', label: 'Racfaanka' },
                ]} /></Form.Item></Col>
                <Col span={12}><Form.Item name="court_room" label="Qolka Maxkamadda"><Input /></Form.Item></Col>
                <Col span={12}><Form.Item name="hearing_date" label="Taariikhda Dhegeysiga" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={12}><Form.Item name="hearing_time" label="Saacadda Dhegeysiga" rules={[{ required: true }]}><TimePicker style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={24}><Form.Item name="assigned_judge" label="Garsooraha Kiiska loo Xilsaaray"><Input /></Form.Item></Col>
              </Row>
            )}
            {modalType === 'proceeding' && (
              <>
                <Form.Item name="notes" label="Qoraalka Fadhiga"><TextArea rows={3} /></Form.Item>
                <Form.Item name="judge_remarks" label="Hadallada Garsooraha"><TextArea rows={2} /></Form.Item>
                <Form.Item name="prosecutor_remarks" label="Hadallada Xeer-ilaaliyaha"><TextArea rows={2} /></Form.Item>
                <Form.Item name="defense_remarks" label="Hadallada Qareenka Difaaca"><TextArea rows={2} /></Form.Item>
              </>
            )}
            {modalType === 'judgment' && (
              <>
                <Form.Item name="judge_name" label="Magaca Garsooraha"><Input /></Form.Item>
                <Form.Item name="decision_date" label="Taariikhda Go'aanka"><DatePicker style={{ width: '100%' }} /></Form.Item>
                <Form.Item name="decision_type" label="Go'aanka" rules={[{ required: true }]}><Select options={[
                  { value: 'convicted', label: 'Eedaysanaha la Xukumay (Convicted)' },
                  { value: 'acquitted', label: 'Eedaysanaha la Sii Daayay (Acquitted)' },
                  { value: 'dismissed', label: 'Kiiska la Laalay (Dismissed)' },
                ]} /></Form.Item>
                <Form.Item name="judgment_summary" label="Koobsiga Go'aanka Maxkamadda" rules={[{ required: true }]}><TextArea rows={4} /></Form.Item>
              </>
            )}
            {modalType === 'sentence' && (
              <Row gutter={16}>
                <Col span={24}><Form.Item name="defendant_name" label="Magaca Eedaysanaha" rules={[{ required: true }]}><Input /></Form.Item></Col>
                <Col span={12}><Form.Item name="sentence_type" label="Nooca Xukunka" rules={[{ required: true }]}><Select options={[
                  { value: 'imprisonment', label: 'Xabsi' },
                  { value: 'fine', label: 'Ganaax Lacageed' },
                  { value: 'probation', label: 'Dabagal (Probation)' },
                  { value: 'community_service', label: 'Adeeg Bulsho' },
                ]} /></Form.Item></Col>
                <Col span={12}><Form.Item name="sentence_date" label="Taariikhda Xukunka"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={12}><Form.Item name="duration" label="Muddada Xukunka"><Input placeholder="tusaale. 2 sano, 6 bilood..." /></Form.Item></Col>
                <Col span={12}><Form.Item name="fine_amount" label="Cadadka Ganaaxa (Fine Amount)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
              </Row>
            )}
            {modalType === 'appeal' && (
              <>
                <Form.Item name="filed_by" label="Ciddii Racfaanka Qaadatay" rules={[{ required: true }]}><Input /></Form.Item>
                <Form.Item name="filing_date" label="Taariikhda Racfaanka"><DatePicker style={{ width: '100%' }} /></Form.Item>
                <Form.Item name="appeal_reason" label="Sababta Racfaanka" rules={[{ required: true }]}><TextArea rows={4} /></Form.Item>
              </>
            )}
            {modalType === 'close' && (
              <>
                <Form.Item name="final_outcome" label="Natiijada kama dambaysta ah"><Select options={[
                  { value: 'convicted', label: 'Eedaysanaha la Xukumay (Convicted)' },
                  { value: 'acquitted', label: 'Eedaysanaha la Sii Daayay (Acquitted)' },
                  { value: 'dismissed', label: 'Kiiska la Laalay (Dismissed)' },
                ]} /></Form.Item>
                <Form.Item name="closure_reason" label="Sababta Kiiska loo Xiray"><TextArea rows={4} /></Form.Item>
                <Form.Item name="archive" label="Kaydi Kiiska" initialValue={false}><Select options={[
                  { value: false, label: 'Xir Keliya' },
                  { value: true, label: 'Xir oo Kaydi' },
                ]} /></Form.Item>
              </>
            )}
          </Form>
        </Modal>
      </Space>
    </ProtectedRoute>
  );
}
