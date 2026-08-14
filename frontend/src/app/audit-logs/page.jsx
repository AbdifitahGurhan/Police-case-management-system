'use client';

import { useCallback, useEffect, useState } from 'react';
import { App, Button, Space, Spin, Statistic, Table, Tabs, Tag, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '@/services/api';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

const { Text, Title } = Typography;

const safe = (value) => (
  value === undefined || value === null || value === '' ? '-' : String(value)
);

const json = (value) => {
  if (!value || value === '-') return null;
  try {
    return JSON.stringify(typeof value === 'string' ? JSON.parse(value) : value, null, 2);
  } catch {
    return String(value);
  }
};

const hasValue = (value) => value !== undefined && value !== null && value !== '';

const numberOr = (value, fallback = 0) => {
  if (!hasValue(value)) return fallback;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const actionLabels = {
  LOGIN: 'Soo galid',
  CREATE_OB_ENTRY: 'OB la abuuray',
  ASSIGN_CASE: 'Kiis la xilsaaray',
  UPDATE_CASE: 'Kiis la beddelay',
  CREATE_SUSPECT: 'Eedaysane la abuuray',
  UPDATE_SUSPECT: 'Eedaysane la beddelay',
  TRANSFER_OFFICER: 'Askari la wareejiyey',
  UPDATE_ROLE_PERMISSIONS: 'Awoodaha role-ka la beddelay',
  UPDATE_USER_PERMISSIONS: 'Awoodaha user-ka la beddelay',
  PRISON_ADMISSION: 'Maxbuus la qaabilay',
};

const actionText = (value) => actionLabels[value] || String(value || '').replaceAll('_', ' ');

const actionTone = (action) => {
  if (action === 'LOGIN') return 'ok';
  if (String(action || '').includes('PERMISSION')) return 'neutral';
  if (String(action || '').includes('FAIL')) return 'fail';
  return 'info';
};

const AuditActionBadge = ({ action }) => {
  const tone = actionTone(action);
  const seal = tone === 'ok' ? 'OK' : tone === 'fail' ? '!' : 'i';

  return (
    <span className={`audit-ledger-task audit-ledger-task--${tone}`}>
      <span className="audit-ledger-task-seal">{seal}</span>
      {actionText(action)}
    </span>
  );
};

const AuditJsonToggle = ({ value, label = 'Fiiri xogta cusub' }) => {
  const [open, setOpen] = useState(false);
  const formatted = json(value);

  if (!formatted) return <span className="audit-ledger-dash">-</span>;

  return (
    <span className="audit-ledger-diff">
      <button className="audit-ledger-diff-toggle" type="button" onClick={() => setOpen((current) => !current)}>
        {open ? '▾ Qari xogta' : `▸ ${label}`}
      </button>
      {open && (
        <pre className="audit-ledger-diff-panel">
          <span className="audit-ledger-diff-stamp">Xogta - JSON</span>
          {formatted}
        </pre>
      )}
    </span>
  );
};

const LocationCell = ({ place, ip }) => (
  <span className="audit-ledger-location">
    <span>{place || 'Goob lama cayimin'}</span>
    <Text className="audit-ledger-location-ip">{ip || 'IP lama hayo'}</Text>
  </span>
);

const ResultBadge = ({ success }) => (
  <span className={`audit-ledger-task audit-ledger-task--${success ? 'ok' : 'fail'}`}>
    <span className="audit-ledger-task-seal">{success ? 'OK' : '!'}</span>
    {success ? 'Guulaystay' : 'Fashilmay'}
  </span>
);

const AuditTabLabel = ({ title, count }) => (
  <span className="audit-ledger-tab-button">
    <span>{title}</span>
    <span className="audit-ledger-tab-count">{count}</span>
  </span>
);

const AssignmentCell = ({ name, type, id, emptyLabel = '-' }) => {
  if (!hasValue(type) && !hasValue(id) && !hasValue(name)) {
    return <span className="audit-ledger-dash">{emptyLabel}</span>;
  }

  if (hasValue(name)) {
    return (
      <span className="audit-ledger-assignment">
        <strong>{name}</strong>
        {hasValue(type) && <Text>{type}</Text>}
      </span>
    );
  }

  return <span className="audit-ledger-chip">{hasValue(type) ? `${type} #${safe(id)}` : safe(id)}</span>;
};

export default function AuditLogsPage() {
  const { message } = App.useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/reports/security-audit', { params: { limit: 100 } });
      setData(response.data.data);
    } catch (error) {
      message.error(error.response?.data?.message || 'Diiwaanka hawlaha lama soo qaadi karin.');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="audit-ledger-loading">
        <Spin size="large" />
      </div>
    );
  }

  const summary = data?.summary || {};
  const activityLoaded = data?.activities?.length || 0;
  const permissionLoaded = data?.permissionChanges?.length || 0;
  const transferLoaded = data?.officerTransfers?.length || 0;
  const loginLoaded = data?.logins?.length || 0;
  const successfulLogins = numberOr(summary.successful_logins);
  const failedLogins = numberOr(summary.failed_logins);
  const auditTotal = numberOr(summary.audit_log_total, activityLoaded);
  const permissionTotal = numberOr(summary.permission_change_total, permissionLoaded);
  const transferTotal = numberOr(summary.officer_transfer_total, transferLoaded);
  const loginTotal = numberOr(summary.login_attempt_total, successfulLogins + failedLogins || loginLoaded);
  const loadedText = (loaded, total, showTotal = true) => (
    `Muujinaya ${loaded || 0} ee ugu dambeeyay${showTotal ? ` / guud ahaan ${total}` : ''}`
  );
  const time = (value) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-');

  const activityColumns = [
    { title: 'Waqtiga', dataIndex: 'created_at', render: time, className: 'audit-ledger-time' },
    { title: 'Qofka Sameeyey', render: (_, row) => row.user_email || safe(row.user_id), className: 'audit-ledger-actor' },
    { title: 'Hawsha', dataIndex: 'action', render: (value) => <AuditActionBadge action={value} /> },
    { title: 'Qaybta', dataIndex: 'entity_type', render: (value) => <span className="audit-ledger-chip">{safe(value)}</span> },
    { title: 'Aqoonsiga Xogta', dataIndex: 'entity_id', render: safe, className: 'audit-ledger-record-id' },
    { title: 'Goobta / IP', render: (_, row) => <LocationCell place={row.location_name} ip={row.ip_address} /> },
    { title: 'Xogtii Hore', dataIndex: 'old_data', render: (value) => <AuditJsonToggle value={value} label="Fiiri xogtii hore" /> },
    { title: 'Xogta Cusub', dataIndex: 'new_data', render: (value) => <AuditJsonToggle value={value} /> },
  ];

  const permissionColumns = [
    { title: 'Waqtiga', dataIndex: 'created_at', render: time, className: 'audit-ledger-time' },
    { title: 'Maamulaha', dataIndex: 'actor', render: safe, className: 'audit-ledger-actor' },
    { title: 'Nooca', dataIndex: 'target_type', render: (value) => <Tag>{value === 'ROLE' ? 'Role' : 'User'}</Tag> },
    { title: 'Role-ka / User-ka', dataIndex: 'target_name', render: (value, row) => value || `#${row.target_id}` },
    { title: 'Permission-ka', dataIndex: 'permission_key', render: (value) => <span className="audit-ledger-chip">{safe(value)}</span> },
    { title: 'Isbeddelka', dataIndex: 'new_effect', render: (value) => <AuditJsonToggle value={value} /> },
  ];

  const transferColumns = [
    { title: 'Waqtiga', dataIndex: 'transferred_at', render: time, className: 'audit-ledger-time' },
    {
      title: 'Askariga',
      render: (_, row) => (
        <span className="audit-ledger-person">
          <strong>{safe(row.full_name)}</strong>
          <Text>{safe(row.force_number)}</Text>
        </span>
      ),
    },
    {
      title: 'Laga Wareejiyey',
      render: (_, row) => (
        <AssignmentCell
          name={row.from_assignment_name}
          type={row.from_assignment_type}
          id={row.from_assignment_id}
          emptyLabel="Diiwaan cusub"
        />
      ),
    },
    {
      title: 'Loo Wareejiyey',
      render: (_, row) => (
        <AssignmentCell
          name={row.to_assignment_name}
          type={row.to_assignment_type}
          id={row.to_assignment_id}
        />
      ),
    },
    { title: 'Sababta', dataIndex: 'transfer_reason', render: safe },
    { title: 'Qofka Wareejiyey', dataIndex: 'transferred_by', render: safe },
  ];

  const loginColumns = [
    { title: 'Waqtiga', dataIndex: 'created_at', render: time, className: 'audit-ledger-time' },
    { title: 'Username', dataIndex: 'username', render: safe, className: 'audit-ledger-actor' },
    { title: 'Natiijada', dataIndex: 'success', render: (value) => <ResultBadge success={Boolean(value)} /> },
    { title: 'Sababta Fashilka', dataIndex: 'failure_reason', render: safe },
    { title: 'Goobta / IP', dataIndex: 'ip_address', render: safe, className: 'audit-ledger-record-id' },
    { title: 'Qalabka', dataIndex: 'user_agent', render: safe, ellipsis: true },
  ];

  const tableProps = {
    className: 'audit-ledger-table',
    pagination: { pageSize: 10, showSizeChanger: false },
  };

  const tabs = [
    {
      key: 'activities',
      label: <AuditTabLabel title="Hawlaha Audit-ka" count={activityLoaded} />,
      children: (
        <Space orientation="vertical" size="small" style={{ width: '100%' }}>
          <Text className="audit-ledger-loaded">{loadedText(activityLoaded, auditTotal, hasValue(summary.audit_log_total))}</Text>
          <Table {...tableProps} rowKey="id" columns={activityColumns} dataSource={data?.activities || []} scroll={{ x: 1500 }} />
        </Space>
      ),
    },
    {
      key: 'permissions',
      label: <AuditTabLabel title="Isbeddellada Awoodaha" count={permissionLoaded} />,
      children: (
        <Space orientation="vertical" size="small" style={{ width: '100%' }}>
          <Text className="audit-ledger-loaded">{loadedText(permissionLoaded, permissionTotal, hasValue(summary.permission_change_total))}</Text>
          <Table {...tableProps} rowKey="id" columns={permissionColumns} dataSource={data?.permissionChanges || []} scroll={{ x: 900 }} />
        </Space>
      ),
    },
    {
      key: 'transfers',
      label: <AuditTabLabel title="Wareejinta Askarta" count={transferLoaded} />,
      children: (
        <Space orientation="vertical" size="small" style={{ width: '100%' }}>
          <Text className="audit-ledger-loaded">{loadedText(transferLoaded, transferTotal, hasValue(summary.officer_transfer_total))}</Text>
          <Table {...tableProps} rowKey="id" columns={transferColumns} dataSource={data?.officerTransfers || []} scroll={{ x: 1000 }} />
        </Space>
      ),
    },
    {
      key: 'logins',
      label: <AuditTabLabel title="Isku-dayada Login-ka" count={loginLoaded} />,
      children: (
        <Space orientation="vertical" size="small" style={{ width: '100%' }}>
          <Text className="audit-ledger-loaded">{loadedText(loginLoaded, loginTotal, hasValue(summary.login_attempt_total))}</Text>
          <Table {...tableProps} rowKey="id" columns={loginColumns} dataSource={data?.logins || []} scroll={{ x: 1000 }} />
        </Space>
      ),
    },
  ];

  return (
    <ProtectedRoute allowedRoles={['admin', 'sub_admin']} requiredPermissions={['audit_logs.view']}>
      <section className="audit-ledger-page">
        <div className="audit-ledger-wrap">
          <header className="audit-ledger-masthead">
            <div>
              <Text className="audit-ledger-eyebrow">
                <span className="audit-ledger-seal">S</span>
                Diiwaanka la xayirin karo
              </Text>
              <Title className="audit-ledger-title" level={1}>Diiwaanka Hawlaha Nidaamka</Title>
              <Text className="audit-ledger-subtitle">
                La soco qofka hawsha qabtay, wixii la beddelay, awoodaha, wareejinta askarta, login-ka, waqtiga iyo goobta.
              </Text>
            </div>
            <Space wrap>
              <div className="audit-ledger-live">
                <span className="audit-ledger-live-dot" />
                DIB U CUSBOONEYSIIN - TOOS
              </div>
              <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>Cusbooneysii</Button>
            </Space>
          </header>

          <div className="audit-ledger-tally">
            <div className="audit-ledger-tally-item audit-ledger-tally-item--ok">
              <Statistic title="Audit Logs" value={auditTotal} />
              <Text>{loadedText(activityLoaded, auditTotal, hasValue(summary.audit_log_total))}</Text>
            </div>
            <div className="audit-ledger-tally-item audit-ledger-tally-item--fail">
              <Statistic title="Isku-dayada Login-ka" value={loginTotal} />
              <Text>{successfulLogins} guulaystay, {failedLogins} fashilmay</Text>
            </div>
            <div className="audit-ledger-tally-item audit-ledger-tally-item--case">
              <Statistic title="Isbeddellada Awoodaha" value={permissionTotal} />
              <Text>{loadedText(permissionLoaded, permissionTotal, hasValue(summary.permission_change_total))}</Text>
            </div>
            <div className="audit-ledger-tally-item audit-ledger-tally-item--evidence">
              <Statistic title="Wareejinta Askarta" value={transferTotal} />
              <Text>{loadedText(transferLoaded, transferTotal, hasValue(summary.officer_transfer_total))}</Text>
            </div>
          </div>

          <div className="audit-ledger-panel">
            <Tabs className="audit-ledger-tabs" items={tabs} />
          </div>

          <footer className="audit-ledger-footer">
            <span>Xog walba waxay ku egtahay 100 record ee ugu dambeeyay.</span>
            <span className="audit-ledger-page-size">10 / bogga</span>
          </footer>
        </div>
      </section>
    </ProtectedRoute>
  );
}
