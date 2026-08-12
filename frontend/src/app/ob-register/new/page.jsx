'use client';

import React, { useState } from 'react';
import { App, Button, Card, Form, Modal, Space, Typography } from 'antd';
import { CloseOutlined, FileAddOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import ObCreateForm, { normalizeObPayload } from '@/components/ob/ObCreateForm';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';

const { Text } = Typography;
const commanderRoles = ['state_commander', 'region_commander', 'district_commander', 'police_station_commander'];
const allowedRoles = ['admin', 'ob_staff', 'staff', 'officer', 'investigator', 'district_admin', 'cid', 'cid_director', 'cid_supervisor', 'cid_officer', ...commanderRoles];

function ConfirmationSummary({ values }) {
  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      <Card size="small" title="Xogta Dacwadda">
        <Text strong>{values.case_title}</Text>
        <br />
        {values.case_type} - {values.incident_location}
        <br />
        {values.incident_datetime?.format('YYYY-MM-DD HH:mm')}
      </Card>
      <Card size="small" title="Dacwoodaha">
        {values.reported_by} - {values.reporter_phone}
      </Card>
      <Card size="small" title="Tirada Ku Lugta Leh">
        Dhibbanayaal: {values.victims?.length || 0} - Eedeysanayaal: {values.accused?.length || 0}
      </Card>
    </Space>
  );
}

export default function NewObPage() {
  const router = useRouter();
  const { user } = useAuth();
  const location = user?.location || {};
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [review, setReview] = useState(null);
  const [saving, setSaving] = useState(false);

  const saveEntry = async () => {
    setSaving(true);
    try {
      const response = await api.post('/ob-entries', normalizeObPayload(review));
      message.success(`Waa la diiwaangeliyey: OB ${response.data.obNumber} - Kiis ${response.data.caseNumber}`);
      router.push(response.data.obEntryId ? `/ob-register/${response.data.obEntryId}` : '/ob-register');
    } catch (error) {
      message.error(error.response?.data?.message || 'Diiwaangelinta OB-ga way fashilantay.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={allowedRoles} requiredPermissions={['ob.create']}>
      <div className="ob-page ob-new-modal-page">
        <div className="ob-new-modal-shell">
          <div className="ob-modal-head">
            <div className="ob-modal-icon"><FileAddOutlined /></div>
            <div>
              <h2>Diiwaangeli OB Cusub</h2>
              <p>Fadlan buuxi dhammaan macluumaadka lagama maarmaanka ah</p>
            </div>
            <Button className="ob-modal-close-btn" type="text" icon={<CloseOutlined />} onClick={() => router.push('/ob-register')} />
          </div>

          <ObCreateForm
            form={form}
            location={location}
            user={user}
            modal
            saving={saving}
            onFinish={setReview}
            onCancel={() => router.push('/ob-register')}
            onDraft={() => message.info('Qabyo client-side ah: foomka lama dirin backend-ka.')}
          />
        </div>

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
