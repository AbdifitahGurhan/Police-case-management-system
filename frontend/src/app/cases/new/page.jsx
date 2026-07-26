'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Steps,
  Table,
  Tag,
  Typography,
  Upload,
  App,
} from 'antd';
import { ArrowLeftOutlined, CheckOutlined, DeleteOutlined, EditOutlined, FileSearchOutlined, PlusOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import dayjs from 'dayjs';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';
import {
  disabledFutureDate,
  disabledUnder8DobDate,
  dynamicIdNumberRule,
  emailRule,
  getEvidenceUploadConfig,
  minimumAge8Rule,
  nameRules,
  noFutureDateTimeRule,
  phoneRules,
  positiveIntegerRule,
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

function NewCaseWizardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const obEntryIdParam = searchParams.get('ob_entry_id');
  const obNumberParam = searchParams.get('ob_number');

  const { message } = App.useApp();
  const [current, setCurrent] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [obData, setObData] = useState(null);
  const [loadingOb, setLoadingOb] = useState(false);

  const [complainantForm] = Form.useForm();
  const [incidentForm] = Form.useForm();
  const [suspectDraftForm] = Form.useForm();
  const [evidenceDraftForm] = Form.useForm();
  const [complainantData, setComplainantData] = useState(null);
  const [incidentData, setIncidentData] = useState(null);
  const [suspects, setSuspects] = useState([]);
  const [evidenceItems, setEvidenceItems] = useState([]);

  useEffect(() => {
    const fetchObData = async () => {
      const targetId = obEntryIdParam || obNumberParam;
      if (!targetId) return;
      setLoadingOb(true);
      try {
        const res = await api.get(`/ob-entries/${targetId}`);
        const ob = res.data.data;
        if (!ob) return;
        setObData(ob);

        // Pre-fill Complainant form
        complainantForm.setFieldsValue({
          complainant_name: ob.reported_by || '',
          complainant_phone: ob.reporter_phone || '',
          complainant_id_type: ob.reporter_id_type || 'National ID',
          complainant_id_number: ob.reporter_id_number || '',
          complainant_email: ob.reporter_email || '',
          complainant_address: ob.reporter_address || '',
        });

        // Pre-fill Incident form
        incidentForm.setFieldsValue({
          title: ob.case_title || ob.incident_type || '',
          case_type: ob.case_type || 'General',
          incident_type: ob.incident_type || '',
          priority: ob.case_level === 'critical' ? 'critical' : ob.case_level === 'urgent' ? 'high' : 'medium',
          incident_date: ob.incident_datetime ? dayjs(ob.incident_datetime) : ob.created_at ? dayjs(ob.created_at) : dayjs(),
          incident_location: ob.incident_location || '',
          description: ob.description || '',
          claim_value: ob.claim_value != null ? String(ob.claim_value) : '',
        });

        // Pre-fill Suspects if respondent exists
        if (ob.respondent_name) {
          setSuspects((prev) => {
            if (prev.length > 0) return prev;
            return [{
              full_name: ob.respondent_name,
              phone: ob.respondent_phone || '',
              id_type: ob.respondent_id_type || 'National ID',
              id_number: ob.respondent_id_number || '',
              role_in_case: 'suspect',
              gender: 'male',
              _key: `ob-suspect-${Date.now()}`,
            }];
          });
        }

        // Pre-fill Evidence if attachments exist
        if (ob.attachments && ob.attachments.length > 0) {
          setEvidenceItems((prev) => {
            if (prev.length > 0) return prev;
            return ob.attachments.map((att, idx) => ({
              title: att.file_name,
              type: att.mime_type?.startsWith('image') ? 'photo' : att.mime_type?.startsWith('video') ? 'video' : 'document',
              location_found: ob.incident_location || 'Attached to OB',
              description: `Caddeyn ka timid OB: ${ob.ob_number}`,
              _key: `ob-att-${idx}-${Date.now()}`,
            }));
          });
        }
        message.info(`Xogta OB ${ob.ob_number} waa lagu sii diyaariyay foomka. Waad ku laaban kartaa ama beddeli kartaa.`);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingOb(false);
      }
    };
    fetchObData();
  }, [obEntryIdParam, obNumberParam, complainantForm, incidentForm, message]);

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

  const [editingSuspectKey, setEditingSuspectKey] = useState(null);

  const handleEditSuspectDraft = (record) => {
    setEditingSuspectKey(record._key);
    suspectDraftForm.setFieldsValue({
      full_name: record.full_name || '',
      alias: record.alias || '',
      gender: record.gender || 'male',
      age: record.age || '',
      date_of_birth: record.date_of_birth ? (dayjs.isDayjs(record.date_of_birth) ? record.date_of_birth : dayjs(record.date_of_birth)) : null,
      nationality: record.nationality || 'Somali',
      id_type: record.id_type || 'National ID',
      id_number: record.id_number || '',
      phone: record.phone || '',
      address: record.address || '',
      role_in_case: record.role_in_case || 'suspect',
      arrest_status: record.arrest_status || 'not_arrested',
      description: record.description || '',
    });
  };

  const cancelEditSuspectDraft = () => {
    setEditingSuspectKey(null);
    suspectDraftForm.resetFields();
  };

  const addSuspectDraft = async () => {
    const values = await suspectDraftForm.validateFields();
    if (editingSuspectKey) {
      setSuspects((prev) => prev.map((s) => (s._key === editingSuspectKey ? { ...values, _key: editingSuspectKey } : s)));
      setEditingSuspectKey(null);
      message.success('Xogta eedaysanaha waa la cusboonaysiiyay.');
    } else {
      setSuspects((prev) => [...prev, { ...values, _key: `${Date.now()}-${prev.length}` }]);
      message.success('Eedaysanaha waa lagu daray liiska.');
    }
    suspectDraftForm.resetFields();
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
      const complainant = complainantData || (await complainantForm.validateFields());
      const incident = incidentData || (await incidentForm.validateFields());

      if (!complainant || !incident?.title) {
        throw new Error('Case details are incomplete. Please return to the Incident step.');
      }

      const incidentDate = incident.incident_date
        ? incident.incident_date.format('YYYY-MM-DD HH:mm:ss')
        : undefined;

      const createRes = await api.post('/cases', {
        ob_entry_id: obData?.id || obEntryIdParam || undefined,
        ob_number: obData?.ob_number || obNumberParam || undefined,
        title: incident.title,
        case_type: incident.case_type || 'General',
        incident_type: incident.incident_type || incident.title,
        description: incident.description,
        incident_date: incidentDate,
        incident_location: incident.incident_location,
        priority: incident.priority || 'medium',
        claim_value: incident.claim_value || undefined,
        complainant_name: complainant.complainant_name,
        complainant_phone: complainant.complainant_phone,
        complainant_id_type: complainant.complainant_id_type || undefined,
        complainant_id_number: complainant.complainant_id_number || undefined,
        complainant_email: complainant.complainant_email || undefined,
        complainant_address: complainant.complainant_address || undefined,
        victim_name: complainant.victim_name || undefined,
        status: 'under_investigation',
      });

      const caseId = createRes.data.caseId;
      if (!caseId) {
        throw new Error('Case created but no caseId returned.');
      }

      for (const suspect of suspects) {
        await api.post('/criminals', {
          case_id: caseId,
          full_name: suspect.full_name,
          alias: suspect.alias || undefined,
          gender: suspect.gender || 'male',
          age: suspect.age || undefined,
          date_of_birth: suspect.date_of_birth ? (typeof suspect.date_of_birth.format === 'function' ? suspect.date_of_birth.format('YYYY-MM-DD') : suspect.date_of_birth) : undefined,
          nationality: suspect.nationality || 'Somali',
          id_type: suspect.id_type || 'National ID',
          id_number: suspect.id_number || undefined,
          phone: suspect.phone || undefined,
          address: suspect.address || undefined,
          role_in_case: suspect.role_in_case || 'suspect',
          arrest_status: suspect.arrest_status || 'not_arrested',
          description: suspect.description || undefined,
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
              Foomka Kiiska Buuxa (Detailed Case Registration)
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Diiwaangeli kiiska oo ku dar dacwoodaha, dhacdada, eedaysanayaasha, iyo caddeymaha.
            </Text>
          </div>
          <Link href="/cases">
            <Button icon={<ArrowLeftOutlined />}>Dib ugu laab kiisaska</Button>
          </Link>
        </div>

        {obData && (
          <Alert
            type="info"
            showIcon
            icon={<FileSearchOutlined />}
            message={`Xogta waxaa lagu sii pre-fill gareeyay OB Number: ${obData.ob_number}`}
            description="Dhammaan xogtii aad horay ugu soo qortay OB Registration waa ku sii diyaarsan tahay foomka. Waad beddeli kartaa ama meelaha bannaan ayaad ku dari kartaa xog dheeraad ah."
            style={{ borderRadius: 8 }}
          />
        )}

        <Card variant="none" className="standard-panel" loading={loadingOb}>
          <Steps current={current} items={STEP_ITEMS} style={{ marginBottom: 24 }} />

          {current === 0 && (
            <Form form={complainantForm} layout="vertical" requiredMark="optional">
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item name="complainant_name" label="Magaca dacwoodaha (Complainant name)" rules={nameRules('Magaca dacwoodaha')}>
                    <Input placeholder="Full name" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="complainant_phone" label="Telefoonka dacwoodaha" rules={phoneRules}>
                    <Input placeholder="+252..." />
                  </Form.Item>
                </Col>
                <Col xs={12} md={6}>
                  <Form.Item name="complainant_id_type" label="Nooca Aqoonsiga">
                    <Select options={[{ value: 'National ID', label: 'National ID' }, { value: 'Passport', label: 'Passport' }]} />
                  </Form.Item>
                </Col>
                <Col xs={12} md={6}>
                  <Form.Item name="complainant_id_number" label="Lambarka Aqoonsiga" dependencies={['complainant_id_type']} rules={[dynamicIdNumberRule('complainant_id_type')]}>
                    <Input placeholder="14 digits (National ID) / 9 chars (Passport)" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="complainant_email" label="Email-ka (optional)" rules={[emailRule]}>
                    <Input placeholder="email@example.com" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="complainant_address" label="Cinwaanka (optional)">
                    <Input placeholder="Address" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="victim_name" label="Magaca dhibanaha / Victim (haddii uu ka duwan yahay dacwoodaha)" rules={[textLengthRule('Victim name', 2, 150)]}>
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
                case_type: 'General',
                incident_date: dayjs().subtract(1, 'hour'),
              }}
            >
              <Row gutter={16}>
                <Col xs={24} md={16}>
                  <Form.Item name="title" label="Cinwaanka kiiska (Case title)" rules={[requiredRule('Cinwaanka kiiska'), textLengthRule('Cinwaanka kiiska', 3, 255)]}>
                    <Input placeholder="Short case subject" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="priority" label="Heerka Muhiimada (Priority)" rules={[requiredRule('Priority')]}>
                    <Select
                      options={[
                        { value: 'critical', label: 'Halis (Critical)' },
                        { value: 'high', label: 'Baan (High)' },
                        { value: 'medium', label: 'Dhexdhexaad (Medium)' },
                        { value: 'low', label: 'Hoose (Low)' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="case_type" label="Qeybta Kiiska (Category)" rules={[requiredRule('Category')]}>
                    <Select
                      options={['Criminal', 'Civil', 'Family', 'Commercial', 'Administrative', 'General', 'Other'].map((v) => ({
                        value: v,
                        label: v,
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="incident_type" label="Nooca dhacdada (Incident type)" rules={[requiredRule('Incident type'), textLengthRule('Incident type', 2, 100)]}>
                    <Select
                      options={['Theft', 'Robbery', 'Assault', 'Fraud', 'Traffic', 'General'].map((v) => ({
                        value: v,
                        label: v,
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="claim_value" label="Qiimaha dacwadda USD (Claim Value)">
                    <InputNumber min={0} precision={2} step={0.01} stringMode prefix="$" style={{ width: '100%' }} placeholder="0.00" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="incident_date"
                    label="Taariikhda iyo waqtiga dhacdada (Incident date)"
                    rules={[requiredRule('Incident date/time'), noFutureDateTimeRule('Incident date/time')]}
                  >
                    <DatePicker
                      showTime
                      style={{ width: '100%' }}
                      disabledDate={disabledFutureDate}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="incident_location" label="Goobta dhacdada (Incident location)" rules={[requiredRule('Incident location'), textLengthRule('Incident location', 3, 255)]}>
                    <Input placeholder="Where it happened" />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item name="description" label="Sharaxaad faahfaahsan (Description)" rules={[requiredRule('Description'), textLengthRule('Description', 10, 5000)]}>
                    <TextArea rows={4} placeholder="What was reported" />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          )}

          {current === 2 && (
            <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Foomka Buuxa ee Eedaysanaha (Full Suspect Form Blueprint - Criminals Table Linked). Haddii OB-ga uu ku jirey Laga-dacwooday waa lagu sii diyaariyay liiska.
              </Text>

              {editingSuspectKey && (
                <Alert
                  type="warning"
                  showIcon
                  message={`Waxaa socda beddelidda xogta eedaysanaha`}
                  description="Fadlan ku sameey wax ka beddelka foomka hoose oo guji 'Cusboonaysii Eedaysanaha'."
                  action={
                    <Button size="small" danger onClick={cancelEditSuspectDraft}>
                      Jooji Beddelidda
                    </Button>
                  }
                  style={{ marginBottom: 12, borderRadius: 8 }}
                />
              )}

              <Form
                form={suspectDraftForm}
                layout="vertical"
                requiredMark="optional"
                onValuesChange={(changedValues) => {
                  if (changedValues.date_of_birth) {
                    const dob = dayjs(changedValues.date_of_birth);
                    if (dob.isValid()) {
                      const calculatedAge = dayjs().diff(dob, 'year');
                      if (calculatedAge >= 0) {
                        suspectDraftForm.setFieldsValue({ age: calculatedAge });
                      }
                    }
                  }
                }}
              >
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item name="full_name" label="Magaca oo buuxa (Full Name)" rules={nameRules('Magaca eedaysanaha')}>
                      <Input placeholder="Full name" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item name="alias" label="Naanays (Alias)" rules={[textLengthRule('Alias', 2, 150)]}>
                      <Input placeholder="Nickname/Alias" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item name="gender" label="Jinsiga (Gender)" initialValue="male">
                      <Select options={[{ value: 'male', label: 'Male (Rag)' }, { value: 'female', label: 'Female (Dumar)' }]} />
                    </Form.Item>
                  </Col>

                  <Col xs={12} md={4}>
                    <Form.Item name="age" label="Da'da (Age)" rules={[positiveIntegerRule("Da'da", 8, 120)]}>
                      <Input type="number" min={8} max={120} placeholder="e.g. 28" />
                    </Form.Item>
                  </Col>
                  <Col xs={12} md={8}>
                    <Form.Item name="date_of_birth" label="Taariikhda Dhalashada" rules={[minimumAge8Rule()]}>
                      <DatePicker style={{ width: '100%' }} disabledDate={disabledUnder8DobDate} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="nationality" label="Waddaniyadda (Nationality)" initialValue="Somali" rules={[textLengthRule('Nationality', 2, 100)]}>
                      <Input placeholder="Somali" />
                    </Form.Item>
                  </Col>

                  <Col xs={12} md={6}>
                    <Form.Item name="id_type" label="Nooca Aqoonsiga" initialValue="National ID">
                      <Select options={[{ value: 'National ID', label: 'National ID' }, { value: 'Passport', label: 'Passport' }, { value: 'Police File', label: 'Police File' }]} />
                    </Form.Item>
                  </Col>
                  <Col xs={12} md={6}>
                    <Form.Item name="id_number" label="Lambarka Aqoonsiga" dependencies={['id_type']} rules={[dynamicIdNumberRule('id_type')]}>
                      <Input placeholder="14 digits (National ID) / 9 chars (Passport)" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item name="phone" label="Telefoonka" rules={phoneRules}>
                      <Input placeholder="+252..." />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item name="address" label="Cinwaanka" rules={[textLengthRule('Address', 3, 255)]}>
                      <Input placeholder="District / Neighborhood" />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item name="role_in_case" label="Doorka Kiiska (Role in Case)" initialValue="suspect" rules={[requiredRule('Role in case')]}>
                      <Select
                        options={[
                          { value: 'suspect', label: 'Suspect (Eedaysane)' },
                          { value: 'Principal Offender', label: 'Principal Offender (Dambiilaha Koowaad)' },
                          { value: 'Accomplice', label: 'Accomplice (Gacanyare / Caawiye)' },
                          { value: 'Conspirator', label: 'Conspirator (Shiraqi / Kicin)' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="arrest_status" label="Heerka Xiritaanka (Arrest Status)" initialValue="not_arrested">
                      <Select
                        options={[
                          { value: 'not_arrested', label: 'Aan Xirnayn (Not Arrested)' },
                          { value: 'arrested', label: 'Xiran (Arrested)' },
                          { value: 'released', label: 'Lagu Daayay (Released)' },
                          { value: 'wanted', label: 'La Raadinayo (Wanted)' },
                        ]}
                      />
                    </Form.Item>
                  </Col>

                  <Col span={24}>
                    <Form.Item name="description" label="Faahfaahin / Note dheeraad ah" rules={[textLengthRule('Description', 3, 2000)]}>
                      <TextArea rows={2} placeholder="Sifada ama faahfaahinta eedaysanaha..." />
                    </Form.Item>
                  </Col>
                </Row>
                <Space>
                  <Button type="primary" icon={editingSuspectKey ? <CheckOutlined /> : <PlusOutlined />} onClick={addSuspectDraft}>
                    {editingSuspectKey ? 'Cusboonaysii Eedaysanaha' : 'Ku dar eedaysanaha liiska'}
                  </Button>
                  {editingSuspectKey && (
                    <Button onClick={cancelEditSuspectDraft}>
                      Jooji
                    </Button>
                  )}
                </Space>
              </Form>

              <Table
                size="small"
                rowKey="_key"
                pagination={false}
                dataSource={suspects}
                locale={{ emptyText: 'Welii wax eedaysane ah lagu ma darin' }}
                columns={[
                  { title: 'Magaca', dataIndex: 'full_name', render: (v, r) => <Space><Text strong>{v}</Text>{r.alias ? <Text type="secondary">({r.alias})</Text> : null}</Space> },
                  { title: 'Aqoonsiga', dataIndex: 'id_number', render: (v, r) => v ? `${r.id_type || 'ID'}: ${v}` : '—' },
                  { title: 'Doorka', dataIndex: 'role_in_case', render: (v) => <Tag color="blue">{v}</Tag> },
                  { title: 'Xaaladda', dataIndex: 'arrest_status', render: (v) => <Tag color={v === 'arrested' ? 'red' : v === 'wanted' ? 'orange' : 'green'}>{v}</Tag> },
                  { title: 'Telefoon', dataIndex: 'phone', render: (v) => v || '—' },
                  {
                    title: 'Ficil',
                    key: 'actions',
                    width: 100,
                    render: (_, record) => (
                      <Space size="small">
                        <Button
                          type="text"
                          icon={<EditOutlined />}
                          onClick={() => handleEditSuspectDraft(record)}
                        />
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => {
                            if (editingSuspectKey === record._key) {
                              cancelEditSuspectDraft();
                            }
                            setSuspects((prev) => prev.filter((s) => s._key !== record._key));
                          }}
                        />
                      </Space>
                    ),
                  },
                ]}
              />
            </Space>
          )}

          {current === 3 && (
            <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Ku dar caddeymaha (Haddii OB-ga ay ku jireen attachments waa lagu sii diyaariyay liiska).
              </Text>
              <Form form={evidenceDraftForm} layout="vertical" requiredMark="optional" initialValues={{ type: 'document' }}>
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item name="title" label="Magaca Caddeynta" rules={[requiredRule('Evidence title'), textLengthRule('Evidence title', 3, 255)]}>
                      <Input placeholder="e.g. Heshiis, Warqad, ama Sawir" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="type" label="Nooca Caddeynta" rules={[requiredRule('Type')]}>
                      <Select
                        options={[
                          { value: 'document', label: 'Dokumiinti (PDF, DOC, DOCX, TXT, XLS)' },
                          { value: 'photo', label: 'Sawir (JPG, JPEG, PNG, WEBP)' },
                          { value: 'video', label: 'Fiidiyow (MP4, MOV, AVI, WEBM)' },
                          { value: 'physical', label: 'Physical Evidence (Fayl Guud)' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="location_found" label="Goobta laga helay" rules={[textLengthRule('Location found', 2, 255)]}>
                      <Input placeholder="Where it was found" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="collection_date" label="Taariikhda la soo helay">
                      <DatePicker showTime style={{ width: '100%' }} disabledDate={disabledFutureDate} />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Form.Item name="description" label="Sharaxaadda Caddeynta" rules={[textLengthRule('Description', 3, 2000)]}>
                      <TextArea rows={2} placeholder="Faahfaahin dheeraad ah..." />
                    </Form.Item>
                  </Col>

                  <Col span={24}>
                    <Form.Item
                      noStyle
                      shouldUpdate={(prevValues, currentValues) => prevValues.type !== currentValues.type}
                    >
                      {({ getFieldValue }) => {
                        const currentType = getFieldValue('type') || 'document';
                        const config = getEvidenceUploadConfig(currentType);

                        return (
                          <Form.Item
                            name="file"
                            label={config.label}
                            valuePropName="fileList"
                            getValueFromEvent={(event) => event?.fileList || []}
                          >
                            <Upload
                              beforeUpload={(file) => {
                                const errorMsg = config.validate(file);
                                if (errorMsg) {
                                  message.error(errorMsg);
                                  return Upload.LIST_IGNORE;
                                }
                                return false;
                              }}
                              accept={config.accept}
                              maxCount={1}
                            >
                              <Button icon={<PlusOutlined />}>{config.buttonText}</Button>
                            </Upload>
                          </Form.Item>
                        );
                      }}
                    </Form.Item>
                  </Col>
                </Row>
                <Button type="primary" icon={<PlusOutlined />} onClick={addEvidenceDraft}>
                  Ku dar caddeynta liiska
                </Button>
              </Form>

              <Table
                size="small"
                rowKey="_key"
                pagination={false}
                dataSource={evidenceItems}
                locale={{ emptyText: 'Welii wax caddeyn ah lagu ma darin' }}
                columns={[
                  { title: 'Caddeynta', dataIndex: 'title' },
                  { title: 'Nooca', dataIndex: 'type', render: (t) => <Tag color="blue">{t}</Tag> },
                  { title: 'Goobta', dataIndex: 'location_found', render: (v) => v || '—' },
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

              <Card size="small" className="standard-panel" title="Soo koobidda Kiiska Kahor Kaydinta">
                <Space orientation="vertical" size={4}>
                  <Text style={{ fontSize: 13 }}>
                    Dacwoodaha: <strong>{complainantForm.getFieldValue('complainant_name') || '—'}</strong>
                  </Text>
                  <Text style={{ fontSize: 13 }}>
                    Cinwaanka Kiiska: <strong>{incidentForm.getFieldValue('title') || '—'}</strong>
                  </Text>
                  <Text style={{ fontSize: 13 }}>
                    Category: <strong>{incidentForm.getFieldValue('case_type') || '—'}</strong>
                  </Text>
                  <Text style={{ fontSize: 13 }}>
                    Eedaysanayaasha: <strong>{suspects.length}</strong>
                  </Text>
                  <Text style={{ fontSize: 13 }}>
                    Caddeymaha: <strong>{evidenceItems.length}</strong>
                  </Text>
                </Space>
              </Card>
            </Space>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <Button disabled={current === 0 || submitting} onClick={goBack}>
              Dib ugu laab
            </Button>
            <Space>
              {current < 3 && (
                <Button type="primary" onClick={goNext}>
                  Sii wad
                </Button>
              )}
              {current === 3 && (
                <Button type="primary" loading={submitting} onClick={submitWizard}>
                  Sameey Kiis Buuxa
                </Button>
              )}
            </Space>
          </div>
        </Card>
      </Space>
    </ProtectedRoute>
  );
}

export default function NewCaseWizardPage() {
  return (
    <Suspense fallback={<Card loading variant="none" />}>
      <NewCaseWizardContent />
    </Suspense>
  );
}

