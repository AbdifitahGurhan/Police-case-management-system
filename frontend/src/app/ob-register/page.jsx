'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { App, Button, Card, Col, DatePicker, Form, Input, Modal, Row, Select, Space, Table, Tag, Typography } from 'antd';
import { FileAddOutlined, MinusCircleOutlined, PlusOutlined, PrinterOutlined } from '@ant-design/icons';
import Link from 'next/link';
import dayjs from 'dayjs';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { disabledFutureDate, noFutureDateTimeRule, phoneRules, requiredRule, textLengthRule } from '@/utils/validation';

const { Title, Text } = Typography;
const { TextArea } = Input;
const commanderRoles = ['state_commander', 'region_commander', 'district_commander', 'police_station_commander'];
const allowedRoles = ['admin', 'ob_staff', 'staff', 'officer', 'investigator', 'district_admin', 'cid', 'cid_director', 'cid_supervisor', 'cid_officer', ...commanderRoles];
const idTypes = ['Aqoonsiga Qaranka', 'Baasaboor', 'Laysanka Darawalnimada', 'Aqoonsiga Booliska/Milatariga', 'Kale'];
const complaintTypes = ['Dambi', 'Madani', 'Qoys', 'Ganacsi', 'Maamul', 'Kale'];
const statusLabels = {
  REGISTERED: 'La Diiwaangeliyey', OB_REGISTERED: 'La Diiwaangeliyey', PRELIMINARY_REVIEW: 'Dib-u-eegis Hordhac',
  INVESTIGATION_TRACING: 'Baaritaan / Baadi-goob', ARRESTED_IN_CUSTODY: 'La Qabtay / Xabsi Ku Jira',
  SENT_TO_CID_OR_COURT: 'Loo Gudbiyey CID ama Maxkamad', CONVERTED_TO_CASE: 'OB iyo Kiis La Diiwaangeliyey', CLOSED: 'La Xiray',
};
const statusColors = { REGISTERED: 'blue', OB_REGISTERED: 'blue', PRELIMINARY_REVIEW: 'gold', INVESTIGATION_TRACING: 'orange', ARRESTED_IN_CUSTODY: 'red', SENT_TO_CID_OR_COURT: 'purple', CLOSED: 'green' };
const custodyOptions = [{ value: 'IN_CUSTODY', label: 'Xabsi Ku Jira' }, { value: 'NOT_IN_CUSTODY', label: 'Xabsi Kuma Jiro' }];

const Section = ({ title, children }) => (
  <Card size="small" title={title} style={{ marginBottom: 16 }}><Row gutter={[16, 4]}>{children}</Row></Card>
);

function AccusedFields({ field, remove, form }) {
  const custody = Form.useWatch(['accused', field.name, 'custody_state'], form);
  const { key, name, ...rest } = field;
  return (
    <Card key={key} size="small" style={{ marginBottom: 10 }}>
      <Row gutter={12}>
        <Col xs={24} md={6}><Form.Item {...rest} name={[name, 'full_name']} label="Magaca oo Buuxa" rules={[{ validator: (_, value) => custody !== 'IN_CUSTODY' || value?.trim() ? Promise.resolve() : Promise.reject(new Error('Magaca eedaysanaha xabsiga ku jira geli.')) }]}><Input /></Form.Item></Col>
        <Col xs={12} md={4}><Form.Item {...rest} name={[name, 'phone']} label="Telefoonka" rules={phoneRules}><Input /></Form.Item></Col>
        <Col xs={12} md={4}><Form.Item {...rest} name={[name, 'gender']} label="Jinsiga"><Select options={[{value:'Male',label:'Lab'},{value:'Female',label:'Dhedig'}]} /></Form.Item></Col>
        <Col xs={20} md={5}><Form.Item {...rest} name={[name, 'custody_state']} label="Xaaladda Qabashada" rules={[{ required: true, message: 'Xaaladda dooro.' }]}><Select options={custodyOptions} /></Form.Item></Col>
        <Col xs={4} md={1}><Button danger type="text" aria-label="Ka saar eedaysanaha" icon={<MinusCircleOutlined />} onClick={() => remove(name)} style={{ marginTop: 30 }} /></Col>
        <Col xs={24} md={8}><Form.Item {...rest} name={[name, 'address']} label="Cinwaanka"><Input /></Form.Item></Col>
        {custody !== 'IN_CUSTODY' && <>
          <Col xs={24} md={8}><Form.Item {...rest} name={[name, 'description']} label="Sharaxaadda"><Input /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item {...rest} name={[name, 'identifying_information']} label="Astaamaha Lagu Garto"><Input /></Form.Item></Col>
        </>}
        {custody === 'IN_CUSTODY' && <>
          <Col xs={24} md={8}><Form.Item {...rest} name={[name, 'arrest_date']} label="Taariikhda iyo Waqtiga Qabashada" rules={[{ required: true, message: 'Waqtiga qabashada geli.' }]}><DatePicker showTime style={{ width: '100%' }} disabledDate={disabledFutureDate} /></Form.Item></Col>
          <Col xs={12} md={8}><Form.Item {...rest} name={[name, 'arrest_location']} label="Goobta Lagu Qabtay" rules={[{ required: true, message: 'Goobta qabashada geli.' }]}><Input /></Form.Item></Col>
          <Col xs={12} md={8}><Form.Item {...rest} name={[name, 'arresting_officer']} label="Sarkaalka Qabtay" rules={[{ required: true, message: 'Sarkaalka qabtay geli.' }]}><Input /></Form.Item></Col>
        </>}
      </Row>
    </Card>
  );
}

function ConfirmationSummary({ values }) {
  return <Space orientation="vertical" style={{ width: '100%' }}>
    <Card size="small" title="Xogta Dacwadda"><b>{values.case_title}</b><br />{values.case_type}<br />{values.incident_location} · {values.incident_datetime?.format('YYYY-MM-DD HH:mm')}<br />{values.description}</Card>
    <Card size="small" title="Dacwoodaha">{values.reported_by} {values.reporter_gender ? `(${values.reporter_gender})` : ''} · {values.reporter_phone}<br />{values.reporter_id_type} {values.reporter_id_number || ''}<br />{values.reporter_address || ''}</Card>
    <Card size="small" title={`Dhibbanayaasha (${values.victims?.length || 0})`}>{values.victims?.map((v, i) => <div key={i}>{i + 1}. {v.full_name} · {v.phone || 'Telefoon ma leh'} · {v.details}</div>)}</Card>
    <Card size="small" title={`Eedaysanayaasha (${values.accused?.length || 0})`}>{values.accused?.map((a, i) => <div key={i}>{i + 1}. {a.full_name} · <Tag color={a.custody_state === 'IN_CUSTODY' ? 'red' : 'orange'}>{a.custody_state === 'IN_CUSTODY' ? 'Xabsi Ku Jira' : 'La Raadinayo'}</Tag></div>)}</Card>
  </Space>;
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

  const loadEntries = useCallback(async (next = filters) => {
    setLoading(true);
    try { const response = await api.get('/ob-entries', { params: next }); setEntries(response.data.data || []); }
    catch (error) { message.error(error.response?.data?.message || 'Diiwaannada OB-ga lama soo qaadi karin.'); }
    finally { setLoading(false); }
  }, [filters, message]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const openNew = () => {
    form.resetFields();
    form.setFieldsValue({ reporter_id_type: idTypes[0], incident_datetime: dayjs().subtract(1, 'minute'), victims: [], accused: [] });
    setOpen(true);
  };

  const saveEntry = async () => {
    setSaving(true);
    try {
      const victims = (review.victims || []).filter(v => Object.values(v || {}).some(value => value !== undefined && value !== null && String(value).trim() !== ''));
      const accused = (review.accused || []).filter(a => Object.entries(a || {}).some(([key, value]) => key !== 'custody_state' && key !== 'status' && value !== undefined && value !== null && String(value).trim() !== '')).map(a => ({
        ...a,
        arrest_date: a.arrest_date ? (a.arrest_date.format ? a.arrest_date.format('YYYY-MM-DD HH:mm:ss') : String(a.arrest_date).slice(0, 19).replace('T', ' ')) : null
      }));
      const payload = { ...review, incident_datetime: review.incident_datetime.format('YYYY-MM-DD HH:mm:ss'), victims, accused };
      const response = await api.post('/ob-entries', payload);
      message.success(`Waa la diiwaangeliyey: OB ${response.data.obNumber} · Kiis ${response.data.caseNumber}`);
      setReview(null); setOpen(false); form.resetFields(); loadEntries();
    } catch (error) { message.error(error.response?.data?.message || 'Diiwaangelinta OB-ga way fashilantay.'); }
    finally { setSaving(false); }
  };

  const applyFilters = values => {
    const next = { ...values, incident_date: values.incident_date?.format('YYYY-MM-DD') };
    Object.keys(next).forEach(key => !next[key] && delete next[key]);
    setFilters(next);
  };

  const columns = [
    { title: 'Lambarka OB', dataIndex: 'ob_number', render: value => <Text strong>{value}</Text> },
    { title: 'Cinwaanka Dacwadda', dataIndex: 'case_title' }, { title: 'Nooca', dataIndex: 'case_type' },
    { title: 'Dacwoodaha', dataIndex: 'reported_by' },
    { title: 'Saldhigga', dataIndex: 'district_police_station_name' },
    { title: 'Xaaladda', dataIndex: 'status', render: value => <Tag color={statusColors[value] || 'blue'}>{statusLabels[value] || value}</Tag> },
    { title: 'Ficil', render: (_, record) => <Link href={`/ob-register/${record.id}`}><Button size="small" type="primary">Fur Faahfaahinta</Button></Link> },
  ];

  return <ProtectedRoute allowedRoles={allowedRoles} requiredPermissions={['ob.view', 'ob.create', 'ob.update', 'ob.print']}><Space orientation="vertical" size="large" style={{ width: '100%' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div><Title level={2}>Diiwaangelinta Kiisaska OB-ga</Title><Text type="secondary">Buugga Dhacdooyinka Saldhigga Booliska Degmada · {location.districtName || 'Saldhigga laguu qoondeeyey'}</Text></div>
      <Space><Button icon={<PrinterOutlined />} onClick={() => window.print()}>Daabac / Dhoofso</Button>{['admin', 'ob_staff', 'officer', 'district_admin', ...commanderRoles].includes(user?.role) && <Button type="primary" icon={<FileAddOutlined />} onClick={openNew}>Diiwaangeli OB Cusub</Button>}</Space>
    </div>
    <Card size="small"><Form layout="vertical" onFinish={applyFilters}><Row gutter={12}>
      <Col xs={24} md={6}><Form.Item name="search" label="OB / Cinwaan / Dacwoode"><Input allowClear /></Form.Item></Col>
      <Col xs={12} md={4}><Form.Item name="complaint_type" label="Nooca Dacwadda"><Input allowClear placeholder="Qor nooca" /></Form.Item></Col>
      <Col xs={12} md={4}><Form.Item name="status" label="Xaaladda"><Select allowClear options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))} /></Form.Item></Col>
      <Col xs={12} md={4}><Form.Item name="arrest_status" label="Xaaladda Eedaysanaha"><Select allowClear options={[{value:'WANTED',label:'La Raadinayo'},{value:'UNDER_TRACING',label:'Baadi-goob Ku Jira'},{value:'ARRESTED',label:'La Qabtay'}]} /></Form.Item></Col>
      <Col xs={12} md={4}><Form.Item name="incident_date" label="Taariikhda Dhacdada"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
      <Col><Button htmlType="submit" type="primary">Raadi / Kala Saar</Button></Col>
    </Row></Form></Card>
    <Card><Table rowKey="id" columns={columns} dataSource={entries} loading={loading} scroll={{ x: 1000 }} /></Card>

    <Modal title="Diiwaangeli OB Cusub" open={open} onCancel={() => setOpen(false)} width={1150} footer={null}>
      <Form form={form} layout="vertical" onFinish={setReview}>
        <Section title="1. Xogta Dacwadda">
          <Col xs={24} md={12}><Form.Item name="case_title" label="Cinwaanka Dacwadda" rules={[requiredRule('Cinwaanka dacwadda'), textLengthRule('Cinwaanka', 3, 255)]}><Input /></Form.Item></Col>
          <Col xs={12} md={6}><Form.Item name="case_type" label="Nooca Dacwadda" rules={[requiredRule('Nooca dacwadda'), textLengthRule('Nooca dacwadda', 2, 100)]}><Input placeholder="Qor nooca dacwadda" /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="incident_type" label="Nooca Dhacdada" rules={[requiredRule('Nooca dhacdada')]}><Input /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="incident_location" label="Goobta Dhacdada" rules={[requiredRule('Goobta dhacdada')]}><Input /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="incident_datetime" label="Taariikhda iyo Waqtiga Dhacdada" rules={[requiredRule('Taariikhda dhacdada'), noFutureDateTimeRule('Taariikhda dhacdada')]}><DatePicker showTime disabledDate={disabledFutureDate} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={24}><Form.Item name="description" label="Sharaxaadda Dacwadda" rules={[requiredRule('Sharaxaadda'), textLengthRule('Sharaxaadda', 10, 5000)]}><TextArea rows={4} /></Form.Item></Col>
        </Section>
        <Section title="2. Xogta Dacwoodaha">
          <Col xs={24} md={6}><Form.Item name="reported_by" label="Magaca oo Buuxa" rules={[requiredRule('Magaca')]}><Input /></Form.Item></Col>
          <Col xs={12} md={6}><Form.Item name="reporter_phone" label="Lambarka Telefoonka" rules={[requiredRule('Telefoonka'), ...phoneRules]}><Input /></Form.Item></Col>
          <Col xs={12} md={4}><Form.Item name="reporter_gender" label="Jinsiga"><Select options={[{value:'Male',label:'Lab'},{value:'Female',label:'Dhedig'}]} /></Form.Item></Col>
          <Col xs={12} md={4}><Form.Item name="reporter_id_type" label="Nooca Aqoonsiga" rules={[requiredRule('Nooca aqoonsiga')]}><Select options={idTypes.map(value => ({ value, label: value }))} /></Form.Item></Col>
          <Col xs={12} md={4}><Form.Item name="reporter_id_number" label="Lambarka Aqoonsiga (Ikhtiyaari)"><Input /></Form.Item></Col>
          <Col xs={24} md={24}><Form.Item name="reporter_address" label="Cinwaanka (Ikhtiyaari)"><Input /></Form.Item></Col>
        </Section>
        <Card size="small" title="3. Xogta Dhibbanayaasha" style={{ marginBottom: 16 }}><Form.List name="victims">{(fields, { add, remove }) => <>
          {fields.map(({ key, name, ...rest }) => <Card key={key} size="small" style={{ marginBottom: 10 }}><Row gutter={12}>
            <Col xs={24} md={7}><Form.Item {...rest} name={[name, 'full_name']} label="Magaca oo Buuxa" rules={[{ required: true, message: 'Magaca geli.' }]}><Input /></Form.Item></Col>
            <Col xs={12} md={5}><Form.Item {...rest} name={[name, 'phone']} label="Telefoonka" rules={phoneRules}><Input /></Form.Item></Col>
            <Col xs={24} md={7}><Form.Item {...rest} name={[name, 'details']} label="Faahfaahinta / Sharaxaadda" rules={[{ required: true, message: 'Faahfaahinta geli.' }]}><Input /></Form.Item></Col>
            <Col xs={20} md={4}><Form.Item {...rest} name={[name, 'address']} label="Cinwaanka"><Input /></Form.Item></Col>
            <Col xs={4} md={1}><Button danger type="text" aria-label="Ka saar dhibbanaha" icon={<MinusCircleOutlined />} onClick={() => remove(name)} style={{ marginTop: 30 }} /></Col>
          </Row></Card>)}
          <Button block type="dashed" icon={<PlusOutlined />} onClick={() => add({})}>Ku Dar Dhibbane Kale</Button>
        </>}</Form.List></Card>
        <Card size="small" title="4. Xogta Eedaysanayaasha" style={{ marginBottom: 16 }}><Form.List name="accused">{(fields, { add, remove }) => <>
          {fields.map(field => <AccusedFields key={field.key} field={field} remove={remove} form={form} />)}
          <Button block type="dashed" icon={<PlusOutlined />} onClick={() => add({ custody_state: 'NOT_IN_CUSTODY', status: 'WANTED' })}>Ku Dar Eedaysane Kale</Button>
        </>}</Form.List></Card>
        <Card size="small" title="5. Xogta Si Toos ah Loo Diiwaangelinayo" style={{ marginBottom: 16 }}><Row gutter={12}>
          <Col span={8}><Text type="secondary">Lambarka OB</Text><br /><b>Si toos ah · gaar ah</b></Col>
          <Col span={8}><Text type="secondary">Saldhigga / Degmada</Text><br /><b>{location.districtName || 'Waxaa laga qaadayaa koontada'}</b></Col>
          <Col span={8}><Text type="secondary">Sarkaalka Diiwaangelinaya</Text><br /><b>{user?.fullName || user?.username}</b></Col>
        </Row></Card>
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}><Button onClick={() => setOpen(false)}>Jooji</Button><Button type="primary" htmlType="submit">Dib u Eeg Ka Hor Kaydinta</Button></Space>
      </Form>
    </Modal>
    <Modal title="Xaqiiji Diiwaangelinta OB-ga" open={!!review} onCancel={() => setReview(null)} width={850} footer={<Space><Button onClick={() => setReview(null)}>Ku Laabo Wax-ka-beddelka</Button><Button type="primary" loading={saving} onClick={saveEntry}>Xaqiiji oo Diiwaangeli</Button></Space>}>{review && <ConfirmationSummary values={review} />}</Modal>
  </Space></ProtectedRoute>;
}
