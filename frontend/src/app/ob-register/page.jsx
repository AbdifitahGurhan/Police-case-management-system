'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { App, Button, Card, Col, DatePicker, Form, Input, Modal, Row, Select, Space, Table, Tag, Typography } from 'antd';
import { DownloadOutlined, FileAddOutlined, PrinterOutlined, SearchOutlined } from '@ant-design/icons';
import Link from 'next/link';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import ObCreateForm, { getObInitialValues, normalizeObPayload } from '@/components/ob/ObCreateForm';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';

const { Title, Text } = Typography;
const commanderRoles = ['state_commander', 'region_commander', 'district_commander', 'police_station_commander'];
const allowedRoles = ['admin', 'ob_staff', 'staff', 'officer', 'investigator', 'district_admin', 'cid', 'cid_director', 'cid_supervisor', 'cid_officer', ...commanderRoles];

const statusLabels = {
  REGISTERED: 'La Diiwaangeliyey',
  OB_REGISTERED: 'La Diiwaangeliyey',
  PRELIMINARY_REVIEW: 'Dib-u-eegis Hordhac',
  INVESTIGATION_TRACING: 'Baaritaan',
  ARRESTED_IN_CUSTODY: 'La Qabtay',
  SENT_TO_CID_OR_COURT: 'Maxkamad',
  CONVERTED_TO_CASE: 'Kiis La Furay',
  CLOSED: 'La Xiray',
};

const statusColors = {
  REGISTERED: 'blue',
  OB_REGISTERED: 'blue',
  PRELIMINARY_REVIEW: 'gold',
  INVESTIGATION_TRACING: 'orange',
  ARRESTED_IN_CUSTODY: 'red',
  SENT_TO_CID_OR_COURT: 'purple',
  CONVERTED_TO_CASE: 'green',
  CLOSED: 'green',
};

function ConfirmationSummary({ values }) {
  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      <Card size="small" title="Xogta Dacwadda">
        <Text strong>{values.case_title}</Text>
        <br />
        {values.case_type}
        <br />
        {values.incident_location} - {values.incident_datetime?.format('YYYY-MM-DD HH:mm')}
        <br />
        {values.description}
      </Card>
      <Card size="small" title="Dacwoodaha">
        {values.reported_by} - {values.reporter_phone}
        <br />
        {values.reporter_id_type} {values.reporter_id_number || ''}
      </Card>
      <Card size="small" title={`Dhibbanayaasha (${values.victims?.length || 0})`}>
        {(values.victims || []).map((victim, index) => (
          <div key={`${victim.full_name}-${index}`}>{index + 1}. {victim.full_name} - {victim.phone || 'Telefoon ma leh'} - {victim.details}</div>
        ))}
      </Card>
      <Card size="small" title={`Eedeysanayaasha (${values.accused?.length || 0})`}>
        {(values.accused || []).map((person, index) => (
          <div key={`${person.full_name}-${index}`}>{index + 1}. {person.full_name || 'Magac la aan'} - <Tag color={person.custody_state === 'IN_CUSTODY' ? 'red' : 'orange'}>{person.custody_state === 'IN_CUSTODY' ? 'Gacanta lagu hayo' : 'Lama hayo'}</Tag></div>
        ))}
      </Card>
    </Space>
  );
}

export default function ObRegisterPage() {
  const { user } = useAuth();
  const location = user?.location || {};
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState(null);
  const [filters, setFilters] = useState({});

  const canCreate = ['admin', 'ob_staff', 'officer', 'district_admin', ...commanderRoles].includes(user?.role);

  const loadEntries = useCallback(async (next = filters) => {
    setLoading(true);
    try {
      const response = await api.get('/ob-entries', { params: next });
      setEntries(response.data.data || []);
    } catch (error) {
      message.error(error.response?.data?.message || 'Diiwaannada OB-ga lama soo qaadi karin.');
    } finally {
      setLoading(false);
    }
  }, [filters, message]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const openNew = () => {
    form.resetFields();
    form.setFieldsValue(getObInitialValues());
    setOpen(true);
  };

  const saveEntry = async () => {
    setSaving(true);
    try {
      const response = await api.post('/ob-entries', normalizeObPayload(review));
      message.success(`Waa la diiwaangeliyey: OB ${response.data.obNumber} - Kiis ${response.data.caseNumber}`);
      setReview(null);
      setOpen(false);
      form.resetFields();
      loadEntries();
    } catch (error) {
      message.error(error.response?.data?.message || 'Diiwaangelinta OB-ga way fashilantay.');
    } finally {
      setSaving(false);
    }
  };

  const applyFilters = (values) => {
    const next = { ...values, incident_date: values.incident_date?.format('YYYY-MM-DD') };
    Object.keys(next).forEach((key) => !next[key] && delete next[key]);
    setFilters(next);
    loadEntries(next);
  };

  const columns = [
    { title: 'OB Number', dataIndex: 'ob_number', render: (value) => <Text strong>{value}</Text> },
    { title: 'Cinwaanka Dacwadda', dataIndex: 'case_title' },
    { title: 'Nooca Dacwadda', dataIndex: 'case_type' },
    { title: 'Dacwoodaha', dataIndex: 'reported_by' },
    { title: 'Taariikhda', dataIndex: 'incident_datetime', render: (value) => value || 'N/A' },
    { title: 'Saldhigga', dataIndex: 'district_police_station_name', render: (value) => value || location.districtName || 'N/A' },
    { title: 'Xaaladda', dataIndex: 'status', render: (value) => <Tag color={statusColors[value] || 'blue'}>{statusLabels[value] || value}</Tag> },
    { title: 'Ficil', render: (_, record) => <Link href={`/ob-register/${record.id}`}><Button size="small" type="primary">Faahfaahin</Button></Link> },
  ];

  return (
    <ProtectedRoute allowedRoles={allowedRoles} requiredPermissions={['ob.view', 'ob.create', 'ob.update', 'ob.print']}>
      <div className="ob-page">
        <div className="ob-page-header">
          <div>
            <div className="ob-breadcrumb">Diiwaanka OB-da</div>
            <Title level={1}>Diiwaanka OB-da</Title>
            <Text>Raadi, kala saar, ama fur faahfaahinta OB-ga degmada.</Text>
          </div>
          <Space wrap>
            <Button icon={<DownloadOutlined />}>Soo Deji</Button>
            <Button icon={<PrinterOutlined />} onClick={() => window.print()}>Daabac</Button>
            {canCreate && (
              <Button type="primary" icon={<FileAddOutlined />} onClick={openNew}>Diiwaangeli OB Cusub</Button>
            )}
          </Space>
        </div>

        <Card className="ob-card ob-filter-card">
          <Form layout="vertical" onFinish={applyFilters}>
            <Row gutter={[14, 4]}>
              <Col xs={24} md={7}>
                <Form.Item name="search" label="Raadi kiis ama OB">
                  <Input allowClear prefix={<SearchOutlined />} placeholder="Raadi OB, cinwaan, dacwoode..." />
                </Form.Item>
              </Col>
              <Col xs={24} md={4}>
                <Form.Item name="complaint_type" label="Nooca Dacwadda">
                  <Input allowClear placeholder="Nooca" />
                </Form.Item>
              </Col>
              <Col xs={24} md={5}>
                <Form.Item name="status" label="Xaaladda">
                  <Select allowClear options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))} />
                </Form.Item>
              </Col>
              <Col xs={24} md={4}>
                <Form.Item name="incident_date" label="Taariikhda">
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={4}>
                <Form.Item label=" ">
                  <Button block htmlType="submit" type="primary">Raadi</Button>
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Card>

        <Card className="ob-card">
          <Table rowKey="id" columns={columns} dataSource={entries} loading={loading} scroll={{ x: 1000 }} />
        </Card>

        <Modal
          className="ob-create-modal"
          maskClassName="ob-create-modal-mask"
          title={null}
          open={open}
          onCancel={() => setOpen(false)}
          width={930}
          footer={null}
        >
          <div className="ob-modal-head">
            <div className="ob-modal-icon"><FileAddOutlined /></div>
            <div>
              <h2>Diiwaangeli OB Cusub</h2>
              <p>Fadlan buuxi dhammaan macluumaadka lagama maarmaanka ah</p>
            </div>
          </div>
          <ObCreateForm
            form={form}
            location={location}
            user={user}
            modal
            saving={saving}
            submitLabel="Dib u Eeg Ka Hor Kaydinta"
            onFinish={setReview}
            onCancel={() => setOpen(false)}
            onDraft={() => message.info('Qabyo client-side ah: foomka lama dirin backend-ka.')}
          />
        </Modal>

        <Modal
          title="Xaqiiji Diiwaangelinta OB-ga"
          open={!!review}
          onCancel={() => setReview(null)}
          width={850}
          footer={(
            <Space>
              <Button onClick={() => setReview(null)}>Ku Laabo Wax-ka-beddelka</Button>
              <Button type="primary" loading={saving} onClick={saveEntry}>Xaqiiji oo Diiwaangeli</Button>
            </Space>
          )}
        >
          {review && <ConfirmationSummary values={review} />}
        </Modal>
      </div>
    </ProtectedRoute>
  );
}
