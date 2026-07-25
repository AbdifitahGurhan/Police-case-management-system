'use client';
import { useCallback, useEffect, useState } from 'react';
import { App, Button, Card, Form, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/services/api';

export default function LegalPersonnelPage(){
  const {message}=App.useApp();const [rows,setRows]=useState([]);const [loading,setLoading]=useState(true);const [open,setOpen]=useState(false);const [editing,setEditing]=useState(null);const [filter,setFilter]=useState({});const [form]=Form.useForm();
  const load=useCallback(async()=>{setLoading(true);try{const {data}=await api.get('/legal-personnel',{params:{...filter,limit:100}});setRows(data.data||[]);}catch(e){message.error(e.response?.data?.message||'Legal personnel could not be loaded.');}finally{setLoading(false);}},[filter,message]);
  useEffect(()=>{load();},[load]);
  const save=async()=>{try{const values=await form.validateFields();if(editing)await api.put(`/legal-personnel/${editing.id}`,values);else await api.post('/legal-personnel',values);message.success('Record saved.');setOpen(false);setEditing(null);form.resetFields();load();}catch(e){if(e.response)message.error(e.response?.data?.message||'Save failed.');}};
  const edit=(row)=>{setEditing(row);form.setFieldsValue(row);setOpen(true);};
  return <ProtectedRoute allowedRoles={['admin','court','court_admin']}><Card title={<Typography.Title level={3}>Judges & Prosecutors</Typography.Title>} extra={<Button type="primary" onClick={()=>{setEditing(null);form.resetFields();form.setFieldsValue({status:'active'});setOpen(true);}}>Add Personnel</Button>}>
    <Space wrap style={{marginBottom:16}}><Select allowClear placeholder="Type" style={{width:180}} options={[{value:'judge',label:'Judge'},{value:'prosecutor',label:'Prosecutor'}]} onChange={v=>setFilter(f=>({...f,type:v}))}/><Select allowClear placeholder="Status" style={{width:160}} options={[{value:'active',label:'Active'},{value:'inactive',label:'Inactive'}]} onChange={v=>setFilter(f=>({...f,status:v}))}/><Input.Search allowClear placeholder="Search name, ID, court…" onSearch={v=>setFilter(f=>({...f,search:v}))}/></Space>
    <Table rowKey="id" loading={loading} dataSource={rows} pagination={{pageSize:15}} locale={{emptyText:'No judges or prosecutors registered.'}} columns={[
      {title:'Type',dataIndex:'personnel_type',render:v=><Tag color={v==='judge'?'blue':'purple'}>{v}</Tag>},{title:'Full Name',dataIndex:'full_name'},{title:'Identification #',dataIndex:'identification_number'},{title:'Phone',dataIndex:'phone_number'},{title:'Email',dataIndex:'email'},{title:'Court / Office',dataIndex:'court_or_office'},{title:'Position',dataIndex:'position'},{title:'Status',dataIndex:'status',render:v=><Tag color={v==='active'?'green':'default'}>{v}</Tag>},{title:'Action',render:(_,r)=><Button onClick={()=>edit(r)}>Edit</Button>}
    ]}/>
    <Modal title={editing?'Edit Legal Personnel':'Register Legal Personnel'} open={open} onCancel={()=>setOpen(false)} onOk={save} destroyOnHidden>
      <Form form={form} layout="vertical"><Form.Item name="personnel_type" label="Type" rules={[{required:true}]}><Select options={[{value:'judge',label:'Judge'},{value:'prosecutor',label:'Prosecutor'}]}/></Form.Item><Form.Item name="full_name" label="Full Name" rules={[{required:true}]}><Input/></Form.Item><Form.Item name="identification_number" label="Identification Number" rules={[{required:true}]}><Input/></Form.Item><Form.Item name="phone_number" label="Phone Number"><Input/></Form.Item><Form.Item name="email" label="Email" rules={[{type:'email'}]}><Input/></Form.Item><Form.Item name="court_or_office" label="Court or Office" rules={[{required:true}]}><Input/></Form.Item><Form.Item name="position" label="Position" rules={[{required:true}]}><Input/></Form.Item><Form.Item name="status" label="Status" rules={[{required:true}]}><Select options={[{value:'active',label:'Active'},{value:'inactive',label:'Inactive'}]}/></Form.Item></Form>
    </Modal>
  </Card></ProtectedRoute>;
}
