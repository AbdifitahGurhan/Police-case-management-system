'use client';

import React, { useState } from 'react';
import {
  Breadcrumb,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  Row,
  Select,
  Space,
  Steps,
  Table,
  Tag,
  Typography,
  App,
} from 'antd';
import { ArrowLeftOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';
import {
  disabledFutureDate,
  nameRules,
  noFutureDateTimeRule,
  phoneRules,
  requiredRule,
  textLengthRule,
} from '@/utils/validation';

const { Title, Text } = Typography;
const { TextArea } = Input;

const WRITE_ROLES = [
  'admin', 'officer', 'ob_staff', 'district_admin',
  'state_commander', 'region_commander', 'district_commander', 'police_station_commander',
];

const STEP_ITEMS = [
  { title: 'Complainant' },
  { title: 'Incident' },
  { title: 'Suspects' },
  { title: 'Evidence' },
];

export default function NewCaseWizardPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [current, setCurrent] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [complainantForm] = Form.useForm();
  const [incidentForm] = Form.useForm();
  const [suspectDraftForm] = Form.useForm();
  const [evidenceDraftForm] = Form.useForm();
  const [complainantData, setComplainantData] = useState(null);
  const [incidentData, setIncidentData] = useState(null);
  const [suspects, setSuspects] = useState([]);
  const [evidenceItems, setEvidenceItems] = useState([]);

  const goNext = async () => {
    if (current === 0) {
      const values = await complainantForm.validateFields();
      setComplainantData(values);
      setCurrent(1);
      return;
    }
    if (current === 1) {
      const values = await incidentForm.validateFields();
      setIncidentData(values);
      setCurrent(2);
      return;
    }
    if (current === 2) {
      setCurrent(3);
    }
  };

  const goBack = () => setCurrent((step) => Math.max(step - 1, 0));

  const addSuspectDraft = async () => {
    const values = await suspectDraftForm.validateFields();
    setSuspects((prev) => [...prev, { ...values, _key: `${Date.now()}-${prev.length}` }]);
    suspectDraftForm.resetFields();
    message.success('Suspect added to draft list.');
  };

  const addEvidenceDraft = async () => {
    const values = await evidenceDraftForm.validateFields();
    setEvidenceItems((prev) => [
      ...prev,
      {
        ...values,
        collection_date: values.collection_date
          ? values.collection_date.format('YYYY-MM-DD HH:mm:ss')
          : undefined,
        _key: `${Date.now()}-${prev.length}`,
      },
    ]);
    evidenceDraftForm.resetFields();
    message.success('Evidence item added to draft list.');
  };

  const submitWizard = async () => {
    setSubmitting(true);
    try {
      // Earlier step forms are unmounted by the wizard. Use the validated
      // snapshots captured before advancing instead of reading disconnected forms.
      const complainant = complainantData;
      const incident = incidentData;

      if (!complainant || !incident?.title) {
        throw new Error('Case details are incomplete. Please return to the Incident step.');
      }

      const incidentDate = incident.incident_date
        ? incident.incident_date.format('YYYY-MM-DD HH:mm:ss')
        : undefined;

      const createRes = await api.post('/cases', {
        title: incident.title,
        case_type: incident.case_type,
        incident_type: incident.incident_type || incident.title,
        description: incident.description,
        incident_date: incidentDate,
        incident_location: incident.incident_location,
        priority: incident.priority || 'medium',
        complainant_name: complainant.complainant_name,
        complainant_phone: complainant.complainant_phone,
        victim_name: complainant.victim_name || undefined,
        status: 'draft',
      });

      const caseId = createRes.data.caseId;
      if (!caseId) {
        throw new Error('Case created but no caseId returned.');
      }

      for (const suspect of suspects) {
        await api.post('/criminals', {
          case_id: caseId,
          full_name: suspect.full_name,
          gender: suspect.gender || 'male',
          age: suspect.age,
          phone: suspect.phone,
          id_type: suspect.id_type || 'National ID',
          id_number: suspect.id_number,
          role_in_case: suspect.role_in_case || 'suspect',
          arrest_status: 'not_arrested',
          nationality: 'Somali',
        });
      }

      for (const item of evidenceItems) {
        await api.post('/evidence', {
          case_id: caseId,
          title: item.title,
          type: item.type || 'document',
          description: item.description,
          location_found: item.location_found,
          collection_date: item.collection_date,
        });
      }

      message.success(
        `Case ${createRes.data.caseNumber || caseId} registered successfully.`
      );
      router.push(`/cases/${caseId}`);
    } catch (err) {
      message.error(err.response?.data?.message || err.message || 'Could not create case.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={WRITE_ROLES}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <Breadcrumb
          items={[
            { title: 'Home' },
            { title: <Link href="/cases">Cases</Link> },
            { title: 'New case' },
          ]}
        />

        <div className="standard-dashboard-hero">
          <div>
            <Text className="dashboard-eyebrow">Case registration</Text>
            <Title level={2} style={{ fontSize: 20, fontWeight: 500, margin: '4px 0' }}>
              New case
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Short steps: complainant → incident → suspects → evidence.
            </Text>
          </div>
          <Link href="/cases">
            <Button icon={<ArrowLeftOutlined />}>Back to cases</Button>
          </Link>
        </div>

        <Card variant="none" className="standard-panel">
          <Steps current={current} items={STEP_ITEMS} style={{ marginBottom: 24 }} />

          {current === 0 && (
            <Form form={complainantForm} layout="vertical" requiredMark="optional">
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item name="complainant_name" label="Complainant name" rules={nameRules('Complainant name')}>
                    <Input placeholder="Full name" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="complainant_phone" label="Complainant phone" rules={phoneRules}>
                    <Input placeholder="+252..." />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="victim_name" label="Victim name (optional)" rules={[textLengthRule('Victim name', 2, 150)]}>
                    <Input placeholder="If different from complainant" />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          )}

          {current === 1 && (
            <Form
              form={incidentForm}
              layout="vertical"
              requiredMark="optional"
              initialValues={{
                priority: 'medium',
                incident_date: dayjs().subtract(2, 'hour'),
              }}
            >
              <Row gutter={16}>
                <Col xs={24} md={16}>
                  <Form.Item name="title" label="Case title" rules={[requiredRule('Case title'), textLengthRule('Case title', 3, 255)]}>
                    <Input placeholder="Short case subject" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="priority" label="Priority" rules={[requiredRule('Priority')]}>
                    <Select
                      options={[
                        { value: 'critical', label: 'Critical' },
                        { value: 'high', label: 'High' },
                        { value: 'medium', label: 'Medium' },
                        { value: 'low', label: 'Low' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="incident_type" label="Incident type" rules={[requiredRule('Incident type'), textLengthRule('Incident type', 2, 100)]}>
                    <Input placeholder="e.g. theft, assault" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="case_type" label="Case category" rules={[textLengthRule('Case category', 2, 100)]}>
                    <Input placeholder="Optional category" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="incident_date"
                    label="Incident date/time"
                    rules={[requiredRule('Incident date/time'), noFutureDateTimeRule('Incident date/time')]}
                    extra="Must be at least one hour in the past."
                  >
                    <DatePicker
                      showTime
                      style={{ width: '100%' }}
                      disabledDate={disabledFutureDate}
                      disabledTime={() => ({})}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="incident_location" label="Incident location" rules={[requiredRule('Incident location'), textLengthRule('Incident location', 3, 255)]}>
                    <Input placeholder="Where it happened" />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item name="description" label="Description" rules={[requiredRule('Description'), textLengthRule('Description', 10, 5000)]}>
                    <TextArea rows={4} placeholder="What was reported" />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          )}

          {current === 2 && (
            <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Optional now — you can skip and add suspects later from the case detail page.
              </Text>
              <Form form={suspectDraftForm} layout="vertical" requiredMark="optional">
                <Row gutter={16}>
                  <Col xs={24} md={10}>
                    <Form.Item name="full_name" label="Full name" rules={nameRules('Suspect name')}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item name="gender" label="Gender" initialValue="male">
                      <Select options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item name="role_in_case" label="Role in case" initialValue="suspect" rules={[requiredRule('Role in case')]}>
                      <Select
                        options={[
                          { value: 'suspect', label: 'Suspect' },
                          { value: 'Principal Offender', label: 'Principal offender' },
                          { value: 'Accomplice', label: 'Accomplice' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item name="phone" label="Phone" rules={phoneRules}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item name="id_type" label="ID type" initialValue="National ID">
                      <Select options={[{ value: 'National ID', label: 'National ID' }, { value: 'Passport', label: 'Passport' }]} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item name="id_number" label="ID number" rules={[textLengthRule('ID number', 2, 100)]}>
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>
                <Button icon={<PlusOutlined />} onClick={addSuspectDraft}>
                  Add suspect to list
                </Button>
              </Form>

              <Table
                size="small"
                rowKey="_key"
                pagination={false}
                dataSource={suspects}
                locale={{ emptyText: 'No suspects drafted yet' }}
                columns={[
                  { title: 'Name', dataIndex: 'full_name' },
                  { title: 'Role', dataIndex: 'role_in_case' },
                  { title: 'Phone', dataIndex: 'phone', render: (v) => v || '—' },
                  {
                    title: '',
                    key: 'remove',
                    width: 64,
                    render: (_, record) => (
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => setSuspects((prev) => prev.filter((s) => s._key !== record._key))}
                      />
                    ),
                  },
                ]}
              />
            </Space>
          )}

          {current === 3 && (
            <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Optional now — skip if no evidence is ready. Files can be uploaded later from case detail.
              </Text>
              <Form form={evidenceDraftForm} layout="vertical" requiredMark="optional">
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item name="title" label="Evidence title" rules={[requiredRule('Evidence title'), textLengthRule('Evidence title', 3, 255)]}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="type" label="Type" initialValue="document">
                      <Select
                        options={[
                          { value: 'document', label: 'Document' },
                          { value: 'physical', label: 'Physical' },
                          { value: 'photo', label: 'Photo' },
                          { value: 'video', label: 'Video' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="location_found" label="Location found" rules={[textLengthRule('Location found', 2, 255)]}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="collection_date" label="Collection date">
                      <DatePicker showTime style={{ width: '100%' }} disabledDate={disabledFutureDate} />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Form.Item name="description" label="Description" rules={[textLengthRule('Description', 3, 2000)]}>
                      <TextArea rows={3} />
                    </Form.Item>
                  </Col>
                </Row>
                <Button icon={<PlusOutlined />} onClick={addEvidenceDraft}>
                  Add evidence to list
                </Button>
              </Form>

              <Table
                size="small"
                rowKey="_key"
                pagination={false}
                dataSource={evidenceItems}
                locale={{ emptyText: 'No evidence drafted yet' }}
                columns={[
                  { title: 'Title', dataIndex: 'title' },
                  { title: 'Type', dataIndex: 'type', render: (t) => <Tag className="status-tag status-tag--neutral">{t}</Tag> },
                  { title: 'Location', dataIndex: 'location_found', render: (v) => v || '—' },
                  {
                    title: '',
                    key: 'remove',
                    width: 64,
                    render: (_, record) => (
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => setEvidenceItems((prev) => prev.filter((e) => e._key !== record._key))}
                      />
                    ),
                  },
                ]}
              />

              <Card size="small" className="standard-panel" title="Summary before submit">
                <Space orientation="vertical" size={4}>
                  <Text style={{ fontSize: 13 }}>
                    Complainant: <strong>{complainantForm.getFieldValue('complainant_name') || '—'}</strong>
                  </Text>
                  <Text style={{ fontSize: 13 }}>
                    Incident: <strong>{incidentForm.getFieldValue('title') || '—'}</strong>
                  </Text>
                  <Text style={{ fontSize: 13 }}>
                    Suspects drafted: <strong>{suspects.length}</strong>
                  </Text>
                  <Text style={{ fontSize: 13 }}>
                    Evidence drafted: <strong>{evidenceItems.length}</strong>
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Incident time used: {incidentForm.getFieldValue('incident_date')
                      ? dayjs(incidentForm.getFieldValue('incident_date')).format('DD MMM YYYY HH:mm')
                      : '—'}
                  </Text>
                </Space>
              </Card>
            </Space>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <Button disabled={current === 0 || submitting} onClick={goBack}>
              Back
            </Button>
            <Space>
              {current < 3 && (
                <Button type="primary" onClick={goNext}>
                  Continue
                </Button>
              )}
              {current === 3 && (
                <Button type="primary" loading={submitting} onClick={submitWizard}>
                  Create case
                </Button>
              )}
              {current === 2 && (
                <Button onClick={() => setCurrent(3)}>
                  Skip suspects
                </Button>
              )}
              {current === 3 && (
                <Button loading={submitting} onClick={submitWizard}>
                  Skip evidence & create
                </Button>
              )}
            </Space>
          </div>
        </Card>
      </Space>
    </ProtectedRoute>
  );
}
