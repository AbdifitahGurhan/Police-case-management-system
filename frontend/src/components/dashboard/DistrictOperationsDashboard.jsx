'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Alert, App, Button, Card, Col, DatePicker, Form, Input, Modal, Progress, Radio, Row, Select, Space, Spin, Statistic, Table, Tabs, Tag, Typography } from 'antd';
import { AlertOutlined, CheckCircleOutlined, ClockCircleOutlined, DownloadOutlined, FileDoneOutlined, FolderOpenOutlined, PrinterOutlined, ReloadOutlined, SafetyCertificateOutlined, TeamOutlined, UserSwitchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';

const { Text, Title } = Typography;
const number = (value) => Number(value || 0);
const statusColor = (status) => ({ present: 'green', absent: 'red', leave: 'gold', patrol: 'blue', critical: 'red', high: 'orange' }[String(status).toLowerCase()] || 'default');

export default function DistrictOperationsDashboard({ user, mode = 'summary' }) {
  const hasPermission = key => user?.role === 'admin' || user?.permissions?.includes('*') || user?.permissions?.includes(key);
  const canInvestigate = hasPermission('cases.investigate');
  const canManageOfficers = hasPermission('officers.update');
  const { message } = App.useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviewCase, setReviewCase] = useState(null);
  const [reviewAction, setReviewAction] = useState('confirmed');
  const [reviewNotes, setReviewNotes] = useState('');
  const [assignCase, setAssignCase] = useState(null);
  const [officerId, setOfficerId] = useState(null);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState(dayjs());
  const [shift, setShift] = useState('morning');
  const [attendance, setAttendance] = useState({});
  const [saving, setSaving] = useState(false);
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [manageComplaint, setManageComplaint] = useState(null);
  const [complaintForm] = Form.useForm();
  const [manageForm] = Form.useForm();
  const [crimeFilter, setCrimeFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/district-operations');
      setData(response.data.data);
    } catch (error) {
      message.error(error.response?.data?.message || 'District dashboard-ka lama soo qaadi karin.');
    } finally { setLoading(false); }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const review = async () => {
    if (!reviewNotes.trim() && reviewAction !== 'confirmed') return message.warning('Review notes geli.');
    setSaving(true);
    try {
      await api.post('/confirmations/respond', { case_id: reviewCase.id, status: reviewAction, comments: reviewNotes });
      setReviewCase(null); setReviewNotes(''); await load();
    } finally { setSaving(false); }
  };

  const assign = async () => {
    if (!officerId) return message.warning('Sarkaal dooro.');
    setSaving(true);
    try {
      await api.patch(`/cases/${assignCase.id}/assign`, { officer_id: officerId });
      setAssignCase(null); setOfficerId(null); await load();
    } finally { setSaving(false); }
  };

  const openAttendance = () => {
    const values = {};
    (data?.officers || []).forEach((officer) => { values[officer.id] = 'present'; });
    setAttendance(values); setAttendanceOpen(true);
  };

  const saveAttendance = async () => {
    setSaving(true);
    try {
      await api.post('/district-operations/attendance', {
        attendance_date: attendanceDate.format('YYYY-MM-DD'), shift,
        entries: (data?.officers || []).map((officer) => ({ officer_id: officer.id, status: attendance[officer.id] || 'present' })),
      });
      setAttendanceOpen(false); await load();
    } finally { setSaving(false); }
  };

  const exportCsv = (kind) => {
    const rows = kind === 'officers'
      ? [['Officer','Force number','Total cases','Open','Overdue','Clearance %'], ...(data?.officers || []).map(o => [o.full_name,o.force_number,o.total_cases,o.open_cases,o.overdue_cases,o.clearance_rate])]
      : [['Case','OB','Title','Priority','Status','Officer'], ...(data?.activeCases || []).map(c => [c.case_number,c.ob_number,c.title,c.priority,c.status,c.assigned_officer || 'Unassigned'])];
    const csv = rows.map(row => row.map(cell => `"${String(cell ?? '').replaceAll('"','""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `${kind}-${dayjs().format('YYYY-MM-DD')}.csv`; link.click(); URL.revokeObjectURL(link.href);
  };

  const createComplaint = async () => {
    const values = await complaintForm.validateFields();
    setSaving(true);
    try {
      await api.post('/district-operations/complaints', { ...values, response_deadline: values.response_deadline?.format('YYYY-MM-DD HH:mm:ss') });
      complaintForm.resetFields(); setComplaintOpen(false); await load();
    } finally { setSaving(false); }
  };

  const saveComplaint = async () => {
    const values = await manageForm.validateFields();
    setSaving(true);
    try {
      await api.patch(`/district-operations/complaints/${manageComplaint.id}`, { ...values, response_deadline: values.response_deadline?.format('YYYY-MM-DD HH:mm:ss') });
      setManageComplaint(null); await load();
    } finally { setSaving(false); }
  };

  const openManageComplaint = (record) => {
    setManageComplaint(record);
    manageForm.setFieldsValue({ ...record, response_deadline: record.response_deadline ? dayjs(record.response_deadline) : null });
  };

  const metrics = data?.metrics || {};
  const alerts = [
    { label: 'Cases aan officer lahayn', count: number(metrics.unassigned_cases), color: 'red' },
    { label: 'Cases overdue ah', count: number(metrics.overdue_cases), color: 'orange' },
    { label: 'Wanted / escaped persons', count: (data?.alerts?.wantedPeople || []).length, color: 'red' },
    { label: 'Evidence chain issues', count: (data?.alerts?.evidenceIssues || []).length, color: 'gold' },
    { label: 'Officer workload sare (5+)', count: (data?.alerts?.highWorkload || []).length, color: 'volcano' },
  ];

  const caseColumns = [
    { title: 'Kiiska', dataIndex: 'case_number', render: (v, r) => <><Text strong>{v || r.ob_number}</Text><br/><Text type="secondary">{r.title}</Text></> },
    { title: 'Mudnaanta', dataIndex: 'priority', render: v => <Tag color={statusColor(v)}>{v}</Tag> },
    { title: 'Xaaladda', dataIndex: 'status', render: v => <Tag>{v}</Tag> },
    { title: 'Sarkaalka', dataIndex: 'assigned_officer', render: v => v || <Tag color="red">Lama xilsaarin</Tag> },
    { title: 'Ficil', render: (_, row) => canInvestigate ? <Space><Button size="small" onClick={() => setAssignCase(row)} icon={<UserSwitchOutlined />}>Xil Saar</Button>{data?.pendingCases?.some(c => c.id === row.id) && <Button size="small" type="primary" onClick={() => setReviewCase(row)}>Dib u Eeg</Button>}</Space> : '—' },
  ];
  const investigatorColumns = [
    { title: 'Kiiska', render: (_,r) => <><Text strong>{r.case_number || r.ob_number}</Text><br/><Text type="secondary">{r.title}</Text></> },
    { title: 'Hawsha', dataIndex: 'reason' },
    { title: 'Baaraha', dataIndex: 'assigned_investigator', render: value => value || <Tag color="orange">Lama xilsaarin</Tag> },
    { title: 'Xaaladda', dataIndex: 'status', render: value => <Tag>{value}</Tag> },
    { title: 'Taariikhda', dataIndex: 'referred_at', render: value => value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '—' },
  ];
  const officerColumns = [
    { title: 'Officer', dataIndex: 'full_name', render: (v,r) => <><Text strong>{v}</Text><br/><Text type="secondary">{r.force_number} · {r.rank_name || ''}</Text></> },
    { title: 'Total', dataIndex: 'total_cases' }, { title: 'Open', dataIndex: 'open_cases' },
    { title: 'Overdue', dataIndex: 'overdue_cases', render: v => <Tag color={number(v) ? 'red' : 'green'}>{v || 0}</Tag> },
    { title: 'Clearance', dataIndex: 'clearance_rate', render: v => <Progress percent={number(v)} size="small" style={{ minWidth: 110 }} /> },
  ];
  const complaintColumns = [
    { title: 'Reference', dataIndex: 'reference_number', render: v => <Text strong>{v}</Text> },
    { title: 'Complainant', render: (_,r) => <><Text>{r.complainant_name}</Text><br/><Text type="secondary">{r.phone || 'No phone'}</Text></> },
    { title: 'Complaint', render: (_,r) => <><Text strong>{r.subject}</Text><br/><Text type="secondary">{r.category} · {r.location || 'No location'}</Text></> },
    { title: 'Priority', dataIndex: 'priority', render: v => <Tag color={statusColor(v)}>{v}</Tag> },
    { title: 'Status', dataIndex: 'status', render: (v,r) => <><Tag color={r.overdue ? 'red' : 'blue'}>{v}</Tag>{r.overdue ? <Tag color="red">OVERDUE</Tag> : null}</> },
    { title: 'Officer', dataIndex: 'assigned_officer', render: v => v || <Tag>Unassigned</Tag> },
    { title: 'Ficilka', render: (_,r) => <Button size="small" onClick={() => openManageComplaint(r)}>Maamul</Button> },
  ];
  const filteredHotspots = (data?.hotspots || []).filter(h => crimeFilter === 'all' || String(h.categories || '').toLowerCase().includes(crimeFilter));
  const hotspotCategories = [...new Set((data?.hotspots || []).flatMap(h => String(h.categories || '').split(', ').filter(Boolean)))];
  const pinPosition = (label, index) => {
    const seed = [...String(label)].reduce((sum, char) => sum + char.charCodeAt(0), index * 31);
    return { left: `${8 + (seed * 17) % 82}%`, top: `${12 + (seed * 29) % 70}%` };
  };

  if (loading && !data) return <div style={{ padding: 60, textAlign: 'center' }}><Spin size="large" /></div>;
  const tabs = [
    { key: 'reviews', label: `Dib-u-eegista Taliyaha (${data?.pendingCases?.length || 0})`, children: <Table rowKey="id" columns={caseColumns} dataSource={data?.pendingCases || []} scroll={{ x: 800 }} /> },
    { key: 'investigators', label: `Hawlaha Baarayaasha (${data?.investigatorTasks?.length || 0})`, children: <Table rowKey="id" columns={investigatorColumns} dataSource={data?.investigatorTasks || []} scroll={{ x: 800 }} /> },
    { key: 'workload', label: 'Shaqada Askarta', children: <Table rowKey="id" columns={officerColumns} dataSource={data?.officers || []} scroll={{ x: 700 }} /> },
    { key: 'attendance', label: `Shift & Xaadirinta (${data?.attendance?.length || 0})`, children: <>{canManageOfficers && <Button type="primary" onClick={openAttendance} style={{ marginBottom: 16 }}>Qaado Xaadirinta</Button>}<Table rowKey="id" dataSource={data?.attendance || []} columns={[{title:'Sarkaalka',dataIndex:'full_name'},{title:'Lambarka Ciidanka',dataIndex:'force_number'},{title:'Taariikhda',dataIndex:'attendance_date'},{title:'Shift-ka',dataIndex:'shift'},{title:'Xaaladda',dataIndex:'status',render:v=><Tag color={statusColor(v)}>{v}</Tag>}]} /></> },
    { key: 'alerts', label: 'District Alerts', children: <Row gutter={[12,12]}>{alerts.map(a => <Col xs={24} md={12} xl={8} key={a.label}><Alert type={a.count ? 'warning' : 'success'} showIcon title={a.label} description={`${a.count} record(s)`} /></Col>)}</Row> },
    { key: 'cases', label: 'Xil-saarista Kiisaska', children: <Table rowKey="id" columns={caseColumns} dataSource={data?.activeCases || []} scroll={{ x: 800 }} /> },
    { key: 'crime-map', label: `Crime Map (${data?.hotspots?.length || 0})`, children: <div><Space wrap style={{marginBottom:16}}><Text strong>Crime category:</Text><Select style={{width:220}} value={crimeFilter} onChange={setCrimeFilter} options={[{value:'all',label:'All crime categories'},...hotspotCategories.map(v=>({value:v.toLowerCase(),label:v}))]} /></Space><Row gutter={[16,16]}><Col xs={24} lg={16}><div style={{height:420,position:'relative',overflow:'hidden',borderRadius:16,background:'linear-gradient(145deg,#dce9db,#eef3e9)',border:'1px solid #c8d6c5'}}><div style={{position:'absolute',inset:0,opacity:.35,backgroundImage:'linear-gradient(28deg, transparent 48%, #94a89a 49%, #94a89a 51%, transparent 52%),linear-gradient(118deg, transparent 48%, #b1c1b5 49%, #b1c1b5 51%, transparent 52%)',backgroundSize:'90px 70px'}} />{filteredHotspots.map((h,i)=><div key={h.location} title={`${h.location}: ${h.total} cases`} style={{...pinPosition(h.location,i),position:'absolute',transform:'translate(-50%,-50%)',width:Math.min(58,28+number(h.total)*6),height:Math.min(58,28+number(h.total)*6),borderRadius:'50%',background:number(h.serious)>0?'rgba(220,38,38,.82)':'rgba(245,158,11,.82)',color:'#fff',display:'grid',placeItems:'center',fontWeight:800,border:'3px solid rgba(255,255,255,.85)',boxShadow:'0 5px 16px rgba(0,0,0,.25)',zIndex:2}}>{h.total}</div>)}<Tag color="green" style={{position:'absolute',left:14,top:14}}>District hotspot map</Tag></div></Col><Col xs={24} lg={8}><Card size="small" title="Hotspot ranking" style={{height:420,overflow:'auto'}}>{filteredHotspots.length ? filteredHotspots.map((h,i)=><div key={h.location} style={{padding:'10px 0',borderBottom:'1px solid #eee'}}><Space style={{justifyContent:'space-between',width:'100%'}}><Text strong>{i+1}. {h.location}</Text><Tag color={number(h.serious)?'red':'orange'}>{h.total} cases</Tag></Space><Text type="secondary">{h.categories || 'Uncategorized'}</Text></div>) : <Text type="secondary">No mapped crime locations.</Text>}</Card></Col></Row></div> },
    { key: 'complaints', label: `Miiska Cabashooyinka (${data?.complaints?.length || 0})`, children: <>{canInvestigate && <Button type="primary" onClick={() => setComplaintOpen(true)} style={{marginBottom:16}}>Diiwaangeli Cabasho</Button>}<Table rowKey="id" columns={complaintColumns} dataSource={data?.complaints || []} scroll={{x:1000}} /></> },
    { key: 'reports', label: 'Station Reports', children: <Space wrap><Button icon={<PrinterOutlined />} onClick={() => window.print()}>Daily Situation PDF</Button><Button icon={<PrinterOutlined />} onClick={() => window.print()}>Weekly Crime Summary</Button><Button icon={<DownloadOutlined />} onClick={() => exportCsv('cases')}>Arrest/Case Report Excel</Button><Button icon={<DownloadOutlined />} onClick={() => exportCsv('officers')}>Officer Activity Excel</Button></Space> },
  ];

  return <ProtectedRoute allowedRoles={['district_admin','district_commander','police_station_commander','admin']} requiredPermissions={['cases.view']}>
    <div className="standard-dashboard">
      <div className="standard-dashboard-hero"><div><Text className="dashboard-eyebrow">Dashboard-ka Maamulka Degmada</Text><Title level={2}>{data?.district?.district_name || user?.fullName || 'Degmada'}</Title><Text type="secondary">OB-yada, kiisaska, askarta, maxaabiista, baarayaasha iyo users-ka degmada.</Text></div><Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Cusboonaysii</Button></div>
      {mode === 'summary' && <Row gutter={[16,16]}>
        {[
          ['OB-yada Degmada',metrics.total_ob,<FileDoneOutlined key="ob" />],['Kiisaska Degmada',metrics.total_cases,<FolderOpenOutlined key="total" />],
          ['Askarta Degmada',metrics.total_officers,<TeamOutlined key="officers" />],['Maxaabiista Station Jail',metrics.station_prisoners,<SafetyCertificateOutlined key="jail" />],
          ['Hawlaha Baarayaasha',metrics.investigator_tasks,<ClockCircleOutlined key="tasks" />],['Users-ka Degmada',metrics.district_users,<TeamOutlined key="users" />],
          ['Kiisaska Furan',metrics.open_cases,<ClockCircleOutlined key="open" />],['Kiisaska Xiran',metrics.closed_cases,<CheckCircleOutlined key="closed" />],
        ].map(([title,val,icon]) => <Col xs={12} md={6} xl={3} key={title}><Card variant="none" className="standard-metric-card"><div className="standard-metric-icon">{icon}</div><Statistic title={title} value={number(val)} /></Card></Col>)}
      </Row>}
      {mode === 'operations' && <Card variant="none" className="standard-panel"><Tabs items={tabs} /></Card>}
    </div>

    <Modal title={`${reviewCase?.case_number || ''} - Commander Review`} open={!!reviewCase} onCancel={() => setReviewCase(null)} onOk={review} confirmLoading={saving} okText="Save Review">
      <Form layout="vertical"><Form.Item label="Decision"><Radio.Group value={reviewAction} onChange={e => setReviewAction(e.target.value)}><Radio.Button value="confirmed">Approve</Radio.Button><Radio.Button value="returned">Return</Radio.Button><Radio.Button value="rejected">Reject</Radio.Button></Radio.Group></Form.Item><Form.Item label="Review notes"><Input.TextArea rows={4} value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} /></Form.Item></Form>
    </Modal>
    <Modal title={`Assign ${assignCase?.case_number || ''}`} open={!!assignCase} onCancel={() => setAssignCase(null)} onOk={assign} confirmLoading={saving}>
      <Select showSearch optionFilterProp="label" style={{width:'100%'}} placeholder="Dooro officer" value={officerId} onChange={setOfficerId} options={(data?.officers || []).map(o => ({value:o.id,label:`${o.full_name} (${o.force_number}) - ${o.open_cases || 0} open`}))} />
    </Modal>
    <Modal width={820} title="Daily Shift Attendance" open={attendanceOpen} onCancel={() => setAttendanceOpen(false)} onOk={saveAttendance} confirmLoading={saving} okText="Save Attendance">
      <Space wrap style={{marginBottom:16}}><DatePicker value={attendanceDate} onChange={setAttendanceDate} /><Select value={shift} onChange={setShift} options={['morning','afternoon','night'].map(v=>({value:v,label:v}))} /></Space>
      <Table pagination={false} rowKey="id" dataSource={data?.officers || []} columns={[{title:'Officer',dataIndex:'full_name'},{title:'Force #',dataIndex:'force_number'},{title:'Status',render:(_,o)=><Select value={attendance[o.id] || 'present'} onChange={v=>setAttendance(old=>({...old,[o.id]:v}))} options={['present','absent','leave','patrol'].map(v=>({value:v,label:v}))} style={{width:130}}/>}]} />
    </Modal>
    <Modal width={720} title="Register Community Complaint" open={complaintOpen} onCancel={() => setComplaintOpen(false)} onOk={createComplaint} confirmLoading={saving} okText="Register Complaint">
      <Form form={complaintForm} layout="vertical" initialValues={{priority:'medium'}}><Row gutter={12}><Col span={12}><Form.Item name="complainant_name" label="Complainant name" rules={[{required:true}]}><Input /></Form.Item></Col><Col span={12}><Form.Item name="phone" label="Phone"><Input /></Form.Item></Col><Col span={12}><Form.Item name="category" label="Category" rules={[{required:true}]}><Select options={['Public service','Officer conduct','Crime report','Domestic dispute','Noise/public order','Other'].map(v=>({value:v,label:v}))}/></Form.Item></Col><Col span={12}><Form.Item name="priority" label="Priority"><Select options={['low','medium','high','critical'].map(v=>({value:v,label:v}))}/></Form.Item></Col><Col span={24}><Form.Item name="subject" label="Subject" rules={[{required:true}]}><Input /></Form.Item></Col><Col span={24}><Form.Item name="description" label="Description" rules={[{required:true}]}><Input.TextArea rows={3}/></Form.Item></Col><Col span={12}><Form.Item name="location" label="Location"><Input /></Form.Item></Col><Col span={12}><Form.Item name="response_deadline" label="Response deadline"><DatePicker showTime style={{width:'100%'}} /></Form.Item></Col><Col span={24}><Form.Item name="assigned_officer_id" label="Assign officer"><Select allowClear options={(data?.officers||[]).map(o=>({value:o.id,label:`${o.full_name} (${o.force_number})`}))}/></Form.Item></Col></Row></Form>
    </Modal>
    <Modal width={650} title={`Manage ${manageComplaint?.reference_number || ''}`} open={!!manageComplaint} onCancel={() => setManageComplaint(null)} onOk={saveComplaint} confirmLoading={saving} okText="Update Complaint">
      <Form form={manageForm} layout="vertical"><Row gutter={12}><Col span={12}><Form.Item name="status" label="Status" rules={[{required:true}]}><Select options={['new','assigned','in_progress','escalated','resolved','closed'].map(v=>({value:v,label:v}))}/></Form.Item></Col><Col span={12}><Form.Item name="priority" label="Priority"><Select options={['low','medium','high','critical'].map(v=>({value:v,label:v}))}/></Form.Item></Col><Col span={12}><Form.Item name="assigned_officer_id" label="Assigned officer"><Select allowClear options={(data?.officers||[]).map(o=>({value:o.id,label:o.full_name}))}/></Form.Item></Col><Col span={12}><Form.Item name="response_deadline" label="Response deadline"><DatePicker showTime style={{width:'100%'}} /></Form.Item></Col><Col span={24}><Form.Item name="resolution_notes" label="Response / resolution notes"><Input.TextArea rows={4}/></Form.Item></Col></Row></Form>
    </Modal>
  </ProtectedRoute>;
}
