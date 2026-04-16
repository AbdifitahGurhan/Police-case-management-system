// src/app/cases/new/page.jsx
'use client';

import React, { useState } from 'react';
import { Form, Input, Button, Card, Row, Col, Typography, Select, DatePicker, Breadcrumb, Divider, Space, App } from 'antd';
import { SaveOutlined, ArrowLeftOutlined, SafetyOutlined } from '@ant-design/icons';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

export default function NewCasePage() {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  React.useEffect(() => {
    // Component mounted
  }, []);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const payload = {
        ...values,
        incident_date: values.incident_date ? values.incident_date.format('YYYY-MM-DD') : null,
        complainant: {
          full_name: values.complainant_name,
          phone: values.complainant_phone,
          gender: values.complainant_gender
        }
      };
      
      const res = await api.post('/cases', payload);
      message.success(`Case registered successfully! OB Number: ${res.data.obNumber}`);
      router.push(`/cases/${res.data.caseId}`);
    } catch (err) {
      console.error(err);
      message.error(err.response?.data?.message || 'Failed to register case.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['admin', 'officer']}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <Breadcrumb items={[{ title: 'Home' }, { title: 'Cases', href: '/cases' }, { title: 'Register New' }]} />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2}>New Case Registration</Title>
            <Typography.Text type="secondary">Electronic Occurrence Book (OB) Entry</Typography.Text>
          </div>
          <Link href="/cases">
            <Button icon={<ArrowLeftOutlined />}>Back to Cases</Button>
          </Link>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ priority: 'medium', case_type: 'General' }}
        >
          <Row gutter={24}>
            <Col xs={24} lg={16}>
              <Card title="Incident Information" variant="none" style={{ marginBottom: 24 }}>
                <Row gutter={16}>
                  <Col span={24}>
                    <Form.Item name="title" label="Case Title / Nature of Complaint" rules={[{ required: true }]}>
                      <Input placeholder="e.g. Armed Robbery, Physical Assault, Theft" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="case_type" label="Category">
                      <Select>
                        <Option value="Theft">Theft</Option>
                        <Option value="Robbery">Robbery</Option>
                        <Option value="Assault">Assault</Option>
                        <Option value="Narcotics">Narcotics</Option>
                        <Option value="Fraud">Fraud</Option>
                        <Option value="Murder">Homicide</Option>
                        <Option value="Traffic">Traffic Accident</Option>
                        <Option value="General">General/Other</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="priority" label="Priority Level">
                      <Select>
                        <Option value="low">Low</Option>
                        <Option value="medium">Medium</Option>
                        <Option value="high">High</Option>
                        <Option value="critical">Critical</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="incident_date" label="Date of Occurrence">
                      <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  
                  <Col span={24}>
                    <Card size="small" style={{ marginBottom: 16, backgroundColor: '#f0f5ff', borderColor: '#adc6ff' }}>
                      <Typography.Text type="secondary">
                        <SafetyOutlined style={{ color: '#1890ff', marginRight: 8 }} />
                        Case jurisdiction is automatically bound to your administrative tier profile.
                      </Typography.Text>
                    </Card>
                  </Col>

                  <Col span={24}>
                    <Form.Item name="incident_location" label="Specific Address / Landmark" rules={[{ required: true }]}>
                      <Input placeholder="Street name, house number, or known landmark" />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Form.Item name="description" label="Detailed Description of Incident" rules={[{ required: true }]}>
                      <TextArea rows={5} placeholder="Provide full details of what happened..." />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </Col>

            <Col xs={24} lg={8}>
              <Card title="Complainant Details" variant="none" style={{ marginBottom: 24 }}>
                <Form.Item name="complainant_name" label="Full Name" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="complainant_gender" label="Gender">
                  <Select>
                    <Option value="male">Male</Option>
                    <Option value="female">Female</Option>
                    <Option value="other">Other</Option>
                  </Select>
                </Form.Item>
                <Form.Item name="complainant_phone" label="Phone Number" rules={[{ required: true }]}>
                  <Input placeholder="+252..." />
                </Form.Item>
              </Card>

              <Card variant="none">
                <Typography.Paragraph>
                  <SafetyOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                  <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                    Cases start as <b>DRAFT</b> and must be reviewed by the Ward Commander. 
                    Blockchain integrity proof will be generated upon Commander's confirmation.
                  </Typography.Text>
                </Typography.Paragraph>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading} block size="large">
                  Register & Generate OB
                </Button>
              </Card>
            </Col>
          </Row>
        </Form>
      </Space>
    </ProtectedRoute>
  );
}
