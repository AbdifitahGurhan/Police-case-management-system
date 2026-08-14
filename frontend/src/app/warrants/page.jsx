'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  App,
  Breadcrumb,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  Modal,
  Result,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { PlusOutlined, PrinterOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { disabledFutureDate, nameRules, requiredRule, textLengthRule } from '@/utils/validation';

const { Title, Text } = Typography;
const { TextArea } = Input;

const allowedRoles = [
  'admin',
  'court',
  'court_admin',
  'court_clerk',
  'judge',
  'prosecutor',
  'prosecutor_liaison',
  'officer',
  'cid',
  'cid_director',
  'cid_supervisor',
  'cid_officer',
  'district_admin',
  'district_commander',
  'police_station_commander',
];

const WARRANT_TYPES = [
  { value: 'arrest', label: 'Garan Soo-qabasho (Arrest Warrant)' },
  { value: 'search', label: 'Garan Baaris (Search Warrant)' },
  { value: 'court_summons', label: 'Waraaqda U-yeeridda Maxkamadda (Court Summons)' },
  { value: 'detention', label: 'Garan Xirnaansho (Detention Warrant)' },
  { value: 'other_court_order', label: 'Amarda Kale ee Maxkamadda (Other Court Order)' },
];

export default function WarrantsPage() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [judges, setJudges] = useState([]);
  const [obEntries, setObEntries] = useState([]);
  const [filter, setFilter] = useState({});
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const userPermissions = user?.permissions || [];
  const hasPermission = (permission) => userPermissions.includes('*') || userPermissions.includes(permission);
  const canView = hasPermission('warrants.view');
  const canCreate = hasPermission('warrants.create');
  const canExecute = hasPermission('warrants.execute');
  const canCancel = hasPermission('warrants.cancel');
  const canPrint = hasPermission('warrants.print');

  const loadData = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const [{ data: wRes }, { data: jRes }, { data: obRes }] = await Promise.all([
        api.get('/warrants', { params: filter }),
        canCreate ? api.get('/legal-personnel/options', { params: { type: 'judge' } }) : Promise.resolve({ data: { data: [] } }),
        canCreate ? api.get('/warrants/ob-options') : Promise.resolve({ data: { data: [] } }),
      ]);
      setRows(wRes.data || []);
      setJudges(jRes.data || []);
      setObEntries(obRes.data || []);
    } catch (e) {
      message.error(e.response?.data?.message || 'Warrants could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [canCreate, canView, filter, message]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async () => {
    if (!canCreate) return;
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const payload = {
        ...values,
        issue_date: values.issue_date.format('YYYY-MM-DD'),
        expiry_date: values.expiry_date.format('YYYY-MM-DD'),
      };

      await api.post('/warrants', payload);
      message.success('Warrant issued successfully.');
      setOpen(false);
      form.resetFields();
      loadData();
    } catch (e) {
      if (e.response) {
        message.error(e.response?.data?.message || 'Failed to issue warrant.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const printDocument = async (id) => {
    try {
      const { data } = await api.get(`/warrants/${id}/document`, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const win = window.open(url, '_blank');
      if (!win) message.warning('Allow pop-ups to print the warrant.');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      message.error(e.response?.data?.message || 'Document download failed.');
    }
  };

  const handleAction = async (id, actionName) => {
    try {
      const body = actionName === 'cancel'
        ? { reason: 'Cancelled by authorized officer/judge' }
        : { execution_date: dayjs().format('YYYY-MM-DD'), execution_notes: 'Executed successfully' };

      await api.patch(`/warrants/${id}/${actionName}`, body);
      message.success(`Warrant ${actionName}d successfully.`);
      loadData();
    } catch (e) {
      message.error(e.response?.data?.message || 'Action failed.');
    }
  };

  const handleSelectObEntry = (obId) => {
    const ob = obEntries.find((item) => Number(item.id) === Number(obId));
    if (ob) {
      form.setFieldsValue({
        ob_entry_id: ob.id,
        case_id: ob.case_id || null,
        subject_name: ob.respondent_name || ob.reported_by || '',
        reason: ob.case_title || ob.incident_type || form.getFieldValue('reason') || '',
      });
    }
  };

  return (
    <ProtectedRoute allowedRoles={allowedRoles} requiredPermissions={['warrants.view']}>
      {!canView ? (
        <Result
          status="403"
          title="Access Restricted"
          subTitle="Awoodda loo baahan yahay: warrants.view"
        />
      ) : (
      <Space orientation="vertical" style={{ width: '100%' }} size="large">
        <div className="standard-dashboard-hero">
          <div>
            <Breadcrumb items={[{ title: 'Home' }, { title: 'Warrants' }]} style={{ marginBottom: 4 }} />
            <Title level={2} style={{ fontSize: 20, fontWeight: 500, margin: '4px 0' }}>
              Warrant Management (Maamulka Garannada Maxkamadda)
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Jaridda, la socodka, iyo fulinta garannada soo-qabashada, baarista, iyo u-yeeridda maxkamadda.
            </Text>
          </div>
          {canCreate && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                form.resetFields();
                form.setFieldsValue({
                  warrant_type: 'arrest',
                  status: 'issued',
                  issue_date: dayjs(),
                  expiry_date: dayjs().add(30, 'day'),
                });
                setOpen(true);
              }}
            >
              Bixi Garan Cusub (Create Warrant)
            </Button>
          )}
        </div>

        <Card variant="none" className="standard-panel">
          <Space wrap style={{ marginBottom: 16 }}>
            <Select
              allowClear
              placeholder="Filter by Status"
              style={{ width: 160 }}
              options={['draft', 'pending', 'issued', 'executed', 'expired', 'cancelled'].map((v) => ({
                value: v,
                label: v.toUpperCase(),
              }))}
              onChange={(v) => setFilter((f) => ({ ...f, status: v }))}
            />
            <Select
              allowClear
              placeholder="Filter by Type"
              style={{ width: 220 }}
              options={WARRANT_TYPES}
              onChange={(v) => setFilter((f) => ({ ...f, type: v }))}
            />
            <Input.Search
              allowClear
              placeholder="Search OB / Case number or subject..."
              style={{ width: 300 }}
              onSearch={(v) => setFilter((f) => ({ ...f, case_number: v }))}
            />
          </Space>

          <Table
            rowKey="id"
            loading={loading}
            dataSource={rows}
            pagination={{ pageSize: 15 }}
            locale={{ emptyText: 'Welii wax garan ah lagu ma darin.' }}
            columns={[
              {
                title: 'Warrant #',
                dataIndex: 'warrant_number',
                render: (v) => <Text strong>{v}</Text>,
              },
              {
                title: 'Type',
                dataIndex: 'warrant_type',
                render: (v) => <Tag color="blue">{String(v).toUpperCase().replace('_', ' ')}</Tag>,
              },
              {
                title: 'Case / OB Number',
                render: (_, r) => r.case_number || r.ob_number || '—',
              },
              {
                title: 'Eedaysanaha / Subject',
                dataIndex: 'suspect_name',
                render: (v) => <Text strong>{v || '—'}</Text>,
              },
              {
                title: 'Xaakimka / Judge',
                dataIndex: 'judge_name',
                render: (v) => v || '—',
              },
              {
                title: 'Saldhigga / Station',
                dataIndex: 'police_station',
                render: (v) => v || '—',
              },
              {
                title: 'Issue Date',
                dataIndex: 'issue_date',
                render: (v) => (v ? dayjs(v).format('DD MMM YYYY') : '—'),
              },
              {
                title: 'Expiry Date',
                dataIndex: 'expiry_date',
                render: (v) => (v ? dayjs(v).format('DD MMM YYYY') : '—'),
              },
              {
                title: 'Status',
                dataIndex: 'status',
                render: (v) => (
                  <Tag color={v === 'executed' ? 'green' : v === 'expired' || v === 'cancelled' ? 'red' : 'blue'}>
                    {String(v).toUpperCase()}
                  </Tag>
                ),
              },
              {
                title: 'Ficil',
                key: 'actions',
                render: (_, r) => (
                  <Space>
                    {canPrint && <Button size="small" icon={<PrinterOutlined />} onClick={() => printDocument(r.id)}>
                      Print
                    </Button>}
                    {canExecute && ['issued', 'pending'].includes(r.status) && (
                      <Button size="small" icon={<CheckOutlined />} onClick={() => handleAction(r.id, 'execute')}>
                        Execute
                      </Button>
                    )}
                    {canCancel && !['executed', 'cancelled'].includes(r.status) && (
                      <Button size="small" danger icon={<CloseOutlined />} onClick={() => handleAction(r.id, 'cancel')}>
                        Cancel
                      </Button>
                    )}
                    {!canPrint && !canExecute && !canCancel && <Text type="secondary">-</Text>}
                  </Space>
                ),
              },
            ]}
          />
        </Card>

        <Modal
          title="Bixi Garan Cusub (Create Warrant)"
          open={open}
          onCancel={() => setOpen(false)}
          onOk={handleCreate}
          confirmLoading={submitting}
          width={700}
        >
          <Form form={form} layout="vertical">
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item name="ob_entry_id" label="Dooro OB-ga ama Kiiska (Select OB Entry)" rules={[requiredRule('OB Entry / Case')]}>
                  <Select
                    showSearch
                    placeholder="Search OB Number or Complainant / Respondent name..."
                    optionFilterProp="label"
                    onChange={handleSelectObEntry}
                    options={obEntries.map((ob) => ({
                      value: ob.id,
                      label: `${ob.ob_number} - ${ob.case_title || ob.incident_type || 'Incident'} (${ob.respondent_name || ob.reported_by || 'Unknown'})`,
                    }))}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item name="warrant_type" label="Nooca Garanka (Warrant Type)" rules={[requiredRule('Warrant type')]}>
                  <Select options={WARRANT_TYPES} />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item name="subject_name" label="Qofka Loo Jaray (Suspect / Subject)" rules={nameRules('Magaca qofka garanka loo jaray')}>
                  <Input placeholder="Magaca eedaysanaha ama qofka loo jaray" />
                </Form.Item>
              </Col>

              <Col span={24}>
                <Form.Item name="reason" label="Sababta Garanka Loo Jaray (Reason for Warrant)" rules={[requiredRule('Reason'), textLengthRule('Reason', 5, 2000)]}>
                  <TextArea rows={3} placeholder="Sharax sababta garanka loo jarayo iyo faahfaahinta dambiga..." />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item name="issued_by_judge_id" label="Xaakimka Bixiyay (Issued By Judge)">
                  <Select
                    allowClear
                    showSearch
                    placeholder="Select Judge"
                    optionFilterProp="label"
                    options={judges.map((j) => ({ value: j.value, label: j.label }))}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item name="status" label="Heerka Garanka (Status)" initialValue="issued">
                  <Select
                    options={[
                      { value: 'issued', label: 'Issued (Amoorta Waa Bixi)' },
                      { value: 'pending', label: 'Pending (Waa Dhexdhexaad)' },
                      { value: 'draft', label: 'Draft (Qabyo)' },
                    ]}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item name="issue_date" label="Taariikhda Bixinta (Issue Date)" rules={[requiredRule('Issue date')]}>
                  <DatePicker style={{ width: '100%' }} maxDate={dayjs()} />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  name="expiry_date"
                  label="Taariikhda Dhicitaanka (Expiry Date)"
                  dependencies={['issue_date']}
                  rules={[
                    requiredRule('Expiry date'),
                    {
                      validator: (_, value) => {
                        const issueDate = form.getFieldValue('issue_date');
                        if (!value || !issueDate || value.isAfter(issueDate)) {
                          return Promise.resolve();
                        }
                        return Promise.reject(new Error('Taariikhda dhicitaanku waa inay ka dambeyso taariikhda bixinta garanka.'));
                      },
                    },
                  ]}
                >
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Modal>
      </Space>
      )}
    </ProtectedRoute>
  );
}
