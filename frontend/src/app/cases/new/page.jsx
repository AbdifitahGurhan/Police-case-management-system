'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { Form, Input, Button, Card, Row, Col, Typography, Select, DatePicker, Breadcrumb, Space, App, Tag, Descriptions } from 'antd';
import {
  SaveOutlined,
  ArrowLeftOutlined,
  SafetyOutlined,
  FileAddOutlined,
  UserOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dayjs from 'dayjs';
import { nameRules, noFutureDateTimeRule, phoneRules, requiredRule, textLengthRule } from '@/utils/validation';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

function NewCasePageContent() {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const obEntryId = searchParams.get('ob_entry_id');
  const [loading, setLoading] = useState(false);
  const [obEntry, setObEntry] = useState(null);
  const [officers, setOfficers] = useState([]);
  const minimumIncidentTime = () => dayjs().subtract(1, 'hour');

  useEffect(() => {
    const loadSetup = async () => {
      try {
        const [officerRes, obRes] = await Promise.all([
          api.get('/police-officers'),
          obEntryId ? api.get(`/ob-entries/${obEntryId}`) : Promise.resolve(null),
        ]);
        setOfficers(officerRes.data.data || []);
        if (obRes) {
          const ob = obRes.data.data;
          setObEntry(ob);
          form.setFieldsValue({
            ob_entry_id: ob.id,
            ob_number: ob.ob_number,
            title: ob.incident_type,
            case_type: 'General',
            incident_type: ob.incident_type,
            incident_location: ob.incident_location,
            description: ob.description,
            complainant_name: ob.reported_by,
            complainant_phone: ob.reporter_phone,
            priority: ob.priority || 'medium',
            status: 'CASE_REGISTERED',
          });
        }
      } catch (error) {
        message.error(error.response?.data?.message || 'Failed to load case registration context.');
      }
    };
    loadSetup();
  }, [form, message, obEntryId]);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const payload = {
        ...values,
        ob_entry_id: obEntry?.id || values.ob_entry_id || null,
        incident_date: values.incident_date ? values.incident_date.format('YYYY-MM-DD HH:mm:ss') : null,
      };

      const res = await api.post('/cases', payload);
      message.success(`Case registered successfully: ${res.data.caseNumber}`);
      router.push(`/cases/${res.data.caseId}`);
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to register case.');
    } finally {
      setLoading(false);
    }
  };

  const converted = obEntry?.linked_case_id || ['CONVERTED_TO_CASE', 'CASE_OPENED'].includes(obEntry?.status);

  return (
    <ProtectedRoute allowedRoles={['admin', 'officer', 'district_admin', 'neighborhood_admin']}>
      <div className="case-register-page">
        <Breadcrumb items={[{ title: 'Home' }, { title: 'Cases', href: '/cases' }, { title: 'Register New' }]} />

        <div className="case-register-hero">
          <div>
            <Text className="dashboard-eyebrow">{obEntry ? 'Create Case from OB' : 'Case Registration'}</Text>
            <Title level={2}>New Case Registration</Title>
            <Typography.Text type="secondary">Register case information first. Suspects and face capture are added later from the Case Detail Page.</Typography.Text>
          </div>
          <Space wrap>
            <Tag color={obEntry ? 'blue' : 'default'}>{obEntry ? `Linked ${obEntry.ob_number}` : 'Direct case'}</Tag>
            <Link href={obEntry ? `/ob-register/${obEntry.id}` : '/cases'}>
              <Button icon={<ArrowLeftOutlined />}>{obEntry ? 'Back to OB' : 'Back to Cases'}</Button>
            </Link>
          </Space>
        </div>

        {converted && (
          <Card variant="none" style={{ marginBottom: 16 }}>
            <Text type="danger">This OB has already been converted to a case.</Text>
            {obEntry?.linked_case_id && (
              <Link href={`/cases/${obEntry.linked_case_id}`} style={{ marginLeft: 12 }}>
                Open linked case
              </Link>
            )}
          </Card>
        )}

        {obEntry && (
          <Card title="Linked OB Information" variant="none" className="case-register-card">
            <Descriptions column={{ xs: 1, md: 2 }} size="small">
              <Descriptions.Item label="OB Number">{obEntry.ob_number}</Descriptions.Item>
              <Descriptions.Item label="Registered By">{obEntry.registered_by_name}</Descriptions.Item>
              <Descriptions.Item label="Reporter">{obEntry.reported_by}</Descriptions.Item>
              <Descriptions.Item label="Reporter Phone">{obEntry.reporter_phone}</Descriptions.Item>
              <Descriptions.Item label="State">{obEntry.state_name}</Descriptions.Item>
              <Descriptions.Item label="Region">{obEntry.region_name}</Descriptions.Item>
              <Descriptions.Item label="District / Police Station">{obEntry.district_police_station_name}</Descriptions.Item>
              <Descriptions.Item label="Waax">{obEntry.waax_name}</Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ priority: 'medium', case_type: 'General', status: 'draft' }}
          disabled={Boolean(converted)}
        >
          <Row gutter={24}>
            <Col xs={24} lg={16}>
              <Card
                title={<Space><FileAddOutlined />Case Information</Space>}
                variant="none"
                className="case-register-card"
              >
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item name="ob_number" label="OB Number">
                      <Input disabled placeholder="Generated or copied from OB" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="case_number" label="Case Number">
                      <Input disabled placeholder="Auto-generated after save" />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Form.Item name="title" label="Case Title / Nature of Complaint" rules={[requiredRule('Case title'), textLengthRule('Case title', 3, 255)]}>
                      <Input placeholder="e.g. Armed Robbery, Physical Assault, Theft" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="case_type" label="Case Type">
                      <Select>
                        <Option value="Theft">Theft</Option>
                        <Option value="Robbery">Robbery</Option>
                        <Option value="Assault">Assault</Option>
                        <Option value="Narcotics">Narcotics</Option>
                        <Option value="Fraud">Fraud</Option>
                        <Option value="Homicide">Homicide</Option>
                        <Option value="Traffic">Traffic Accident</Option>
                        <Option value="General">General/Other</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="incident_type" label="Incident Type" rules={[requiredRule('Incident type'), textLengthRule('Incident type', 2, 100)]}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="priority" label="Priority Level">
                      <Select>
                        <Option value="low">Low</Option>
                        <Option value="medium">Medium</Option>
                        <Option value="high">High</Option>
                        <Option value="critical">Critical</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="status" label="Case Status">
                      <Select>
                        <Option value="draft">Draft</Option>
                        <Option value="CASE_REGISTERED">Case Registered</Option>
                        <Option value="pending_commander_review">Pending Commander Review</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="incident_date"
                      label="Incident Date & Time"
                      rules={[
                        {
                          validator: (_, value) => {
                            if (!value) return Promise.resolve();
                            if (value.isAfter(minimumIncidentTime())) {
                              return Promise.reject(new Error('Incident time must be at least one hour in the past.'));
                            }
                            return Promise.resolve();
                          },
                        },
                        noFutureDateTimeRule('Incident date'),
                      ]}
                    >
                      <DatePicker
                        showTime={{ format: 'HH:mm' }}
                        format="YYYY-MM-DD HH:mm"
                        style={{ width: '100%' }}
                        disabledDate={(current) => current && current.isAfter(minimumIncidentTime(), 'day')}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="assigned_officer_id" label="Assigned Officer">
                      <Select allowClear showSearch optionFilterProp="children">
                        {officers.map((officer) => (
                          <Option key={officer.id} value={officer.id}>{officer.full_name} ({officer.force_number})</Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Form.Item name="incident_location" label="Incident Location" rules={[requiredRule('Incident location'), textLengthRule('Incident location', 3, 255)]}>
                      <Input prefix={<EnvironmentOutlined />} placeholder="Street name, house number, or known landmark" />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Form.Item name="description" label="Case Description" rules={[requiredRule('Case description'), textLengthRule('Case description', 10, 5000)]}>
                      <TextArea rows={5} placeholder="Provide case details..." />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </Col>

            <Col xs={24} lg={8}>
              <div className="case-register-side">
                <Card title={<Space><UserOutlined />Complainant / Reporter</Space>} variant="none" className="case-register-card">
                  <Form.Item name="complainant_name" label="Full Name" rules={nameRules('Complainant name')}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="complainant_phone" label="Phone Number" rules={phoneRules}>
                    <Input placeholder="+252..." />
                  </Form.Item>
                  <Form.Item name="victim_name" label="Victim if available" rules={[textLengthRule('Victim name', 2, 150)]}>
                    <Input />
                  </Form.Item>
                </Card>

                <Card variant="none" className="case-register-submit">
                  <Typography.Paragraph>
                    <SafetyOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                    <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                      Suspect details and face capture are added after this case is created.
                    </Typography.Text>
                  </Typography.Paragraph>
                  <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading} block size="large" disabled={Boolean(converted)}>
                    Register Case
                  </Button>
                </Card>
              </div>
            </Col>
          </Row>
        </Form>
      </div>
    </ProtectedRoute>
  );
}

export default function NewCasePage() {
  return (
    <Suspense fallback={<Card loading={true} />}>
      <NewCasePageContent />
    </Suspense>
  );
}
