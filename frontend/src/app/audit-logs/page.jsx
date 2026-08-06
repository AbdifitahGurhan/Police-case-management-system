'use client';

import { useCallback, useEffect, useState } from 'react';
import { App, Card, Space, Spin, Statistic, Row, Col, Table, Tabs, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import api from '@/services/api';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

const { Title, Text } = Typography;
const safe = value => value === undefined || value === null || value === '' ? '—' : String(value);
const json = value => {
  if (!value) return '—';
  try { return JSON.stringify(typeof value === 'string' ? JSON.parse(value) : value, null, 2); }
  catch { return String(value); }
};
const actionLabels = {
  LOGIN:'Soo galid', CREATE_OB_ENTRY:'OB la abuuray', ASSIGN_CASE:'Kiis la xilsaaray',
  UPDATE_CASE:'Kiis la beddelay', CREATE_SUSPECT:'Eedaysane la abuuray', UPDATE_SUSPECT:'Eedaysane la beddelay',
  TRANSFER_OFFICER:'Askari la wareejiyey', UPDATE_ROLE_PERMISSIONS:'Awoodaha role-ka la beddelay',
  UPDATE_USER_PERMISSIONS:'Awoodaha user-ka la beddelay', PRISON_ADMISSION:'Maxbuus la qaabilay',
};

export default function AuditLogsPage() {
  const { message } = App.useApp();
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const load=useCallback(async()=>{setLoading(true);try{const response=await api.get('/reports/security-audit',{params:{limit:100}});setData(response.data.data)}catch(error){message.error(error.response?.data?.message||'Diiwaanka hawlaha lama soo qaadi karin.')}finally{setLoading(false)}},[message]);
  useEffect(()=>{load()},[load]);
  if(loading&&!data)return <div style={{padding:60,textAlign:'center'}}><Spin size="large"/></div>;
  const time=value=>value?dayjs(value).format('YYYY-MM-DD HH:mm:ss'):'—';
  const activityColumns=[
    {title:'Waqtiga',dataIndex:'created_at',render:time},{title:'Qofka Sameeyey',dataIndex:'user_id',render:safe},
    {title:'Hawsha',dataIndex:'action',render:value=><Tag>{actionLabels[value]||String(value||'').replaceAll('_',' ')}</Tag>},
    {title:'Qaybta',dataIndex:'entity_type',render:safe},{title:'Aqoonsiga Xogta',dataIndex:'entity_id',render:safe},
    {title:'Goobta / IP',render:(_,row)=><>{row.location_name||'Goob lama cayimin'}<br/><Text type="secondary">{row.ip_address||'IP lama hayo'}</Text></>},
    {title:'Xogtii Hore',dataIndex:'old_data',render:value=><pre style={{maxWidth:260,whiteSpace:'pre-wrap'}}>{json(value)}</pre>},
    {title:'Xogta Cusub',dataIndex:'new_data',render:value=><pre style={{maxWidth:260,whiteSpace:'pre-wrap'}}>{json(value)}</pre>},
  ];
  const permissionColumns=[{title:'Waqtiga',dataIndex:'created_at',render:time},{title:'Maamulaha',dataIndex:'actor'},{title:'Nooca',dataIndex:'target_type',render:value=><Tag>{value==='ROLE'?'Role':'User'}</Tag>},{title:'Role-ka / User-ka',dataIndex:'target_name',render:(v,r)=>v||`#${r.target_id}`},{title:'Permission-ka',dataIndex:'permission_key'},{title:'Isbeddelka',dataIndex:'new_effect',render:value=><pre style={{whiteSpace:'pre-wrap'}}>{safe(value)}</pre>}];
  const transferColumns=[{title:'Waqtiga',dataIndex:'transferred_at',render:time},{title:'Askariga',render:(_,r)=><>{r.full_name}<br/><Text type="secondary">{r.force_number}</Text></>},{title:'Laga Wareejiyey',render:(_,r)=>`${safe(r.from_assignment_type)} #${safe(r.from_assignment_id)}`},{title:'Loo Wareejiyey',render:(_,r)=>`${safe(r.to_assignment_type)} #${safe(r.to_assignment_id)}`},{title:'Sababta',dataIndex:'transfer_reason'},{title:'Qofka Wareejiyey',dataIndex:'transferred_by'}];
  const loginColumns=[{title:'Waqtiga',dataIndex:'created_at',render:time},{title:'Username',dataIndex:'username'},{title:'Natiijada',dataIndex:'success',render:value=><Tag color={value?'green':'red'}>{value?'Guulaystay':'Fashilmay'}</Tag>},{title:'Sababta Fashilka',dataIndex:'failure_reason',render:safe},{title:'Goobta / IP',dataIndex:'ip_address',render:safe},{title:'Qalabka',dataIndex:'user_agent',ellipsis:true}];
  const tabs=[
    {key:'activities',label:`Dhammaan Hawlaha (${data?.activities?.length||0})`,children:<Table rowKey="id" columns={activityColumns} dataSource={data?.activities||[]} scroll={{x:1500}}/>},
    {key:'permissions',label:`Isbeddellada Awoodaha (${data?.permissionChanges?.length||0})`,children:<Table rowKey="id" columns={permissionColumns} dataSource={data?.permissionChanges||[]} scroll={{x:900}}/>},
    {key:'transfers',label:`Wareejinta Askarta (${data?.officerTransfers?.length||0})`,children:<Table rowKey="id" columns={transferColumns} dataSource={data?.officerTransfers||[]} scroll={{x:1000}}/>},
    {key:'logins',label:`Isku-dayada Login-ka (${data?.logins?.length||0})`,children:<Table rowKey="id" columns={loginColumns} dataSource={data?.logins||[]} scroll={{x:1000}}/>},
  ];
  return <ProtectedRoute allowedRoles={['admin','sub_admin']} requiredPermissions={['audit_logs.view']}><Space orientation="vertical" size="large" style={{width:'100%'}}><div><Title level={2}>Diiwaanka Hawlaha Nidaamka</Title><Text type="secondary">La soco qofka hawsha qabtay, wixii la beddelay, awoodaha, wareejinta askarta, login-ka, waqtiga iyo goobta.</Text></div><Row gutter={[16,16]}><Col xs={12} md={6}><Card><Statistic title="Login Guulaystay" value={data?.summary?.successful_logins||0}/></Card></Col><Col xs={12} md={6}><Card><Statistic title="Login Fashilmay" value={data?.summary?.failed_logins||0}/></Card></Col><Col xs={12} md={6}><Card><Statistic title="Isbeddellada Kiisaska" value={data?.summary?.case_changes||0}/></Card></Col><Col xs={12} md={6}><Card><Statistic title="Isbeddellada Caddeymaha" value={data?.summary?.evidence_changes||0}/></Card></Col></Row><Card><Tabs items={tabs}/></Card></Space></ProtectedRoute>;
}
