'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  EyeOutlined,
  FileDoneOutlined,
  GlobalOutlined,
  HistoryOutlined,
  HomeOutlined,
  KeyOutlined,
  LockOutlined,
  ReloadOutlined,
  SearchOutlined,
  SafetyCertificateOutlined,
  SwapOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import api from '@/services/api';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;

const ACTION_MAP = {
  LOGIN: { label: 'Soo Galid', color: 'green', icon: <LockOutlined /> },
  LOGOUT: { label: 'Ka Baxid', color: 'default', icon: <LockOutlined /> },
  CREATE_CASE: { label: 'Kiis Cusub', color: 'blue', icon: <FileDoneOutlined /> },
  UPDATE_CASE: { label: 'Kiis la Beddelay', color: 'geekblue', icon: <FileDoneOutlined /> },
  ASSIGN_CASE: { label: 'Kiis la Xilsaaray', color: 'cyan', icon: <TeamOutlined /> },
  CONVERT_OB_TO_CASE: { label: 'OB ➔ Kiis', color: 'purple', icon: <SwapOutlined /> },
  CREATE_OB_ENTRY: { label: 'OB la Diiwaangeliyey', color: 'blue', icon: <FileDoneOutlined /> },
  UPDATE_OB_ENTRY: { label: 'OB la Beddelay', color: 'geekblue', icon: <FileDoneOutlined /> },
  CREATE_SUSPECT: { label: 'Eedaysane Cusub', color: 'orange', icon: <UserOutlined /> },
  UPDATE_SUSPECT: { label: 'Eedaysane la Beddelay', color: 'gold', icon: <UserOutlined /> },
  TRANSFER_OFFICER: { label: 'Askari la Wareejiyey', color: 'magenta', icon: <SwapOutlined /> },
  UPDATE_ROLE_PERMISSIONS: { label: 'Awoodaha Role-ka', color: 'purple', icon: <KeyOutlined /> },
  UPDATE_USER_PERMISSIONS: { label: 'Awoodaha User-ka', color: 'purple', icon: <KeyOutlined /> },
  PRISON_ADMISSION: { label: 'Maxbuus la Qaabilay', color: 'red', icon: <SafetyCertificateOutlined /> },
  UPDATE_MY_PROFILE: { label: 'Profile la Beddelay', color: 'blue', icon: <UserOutlined /> },
  DEACTIVATE_USER: { label: 'User la Joojiyey', color: 'red', icon: <CloseCircleOutlined /> },
};

function parseJson(val) {
  if (!val || val === '-') return null;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}

export default function AuditLogsPage() {
  const { message } = App.useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('activities');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [inspectRecord, setInspectRecord] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/reports/security-audit', { params: { limit: 100 } });
      setData(response.data.data);
      setLastRefreshed(dayjs().format('HH:mm:ss'));
    } catch (error) {
      message.error(error.response?.data?.message || 'Diiwaanka hawlaha lama soo qaadi karin.');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    load();
  }, [load]);

  const copyToClipboard = (text, label = 'Xogta') => {
    if (!text || text === '-') return;
    navigator.clipboard.writeText(String(text));
    message.success(`${label} waa la koobiyeeyay.`);
  };

  const handleInspect = (record, type = 'activity') => {
    setInspectRecord({ ...record, _inspectType: type });
    setIsModalOpen(true);
  };

  // Metrics summary
  const summary = data?.summary || {};
  const activities = data?.activities || [];
  const permissionChanges = data?.permissionChanges || [];
  const officerTransfers = data?.officerTransfers || [];
  const logins = data?.logins || [];

  const successfulLogins = Number(summary.successful_logins || 0);
  const failedLogins = Number(summary.failed_logins || 0);
  const auditTotal = Number(summary.audit_log_total || activities.length);
  const permissionTotal = Number(summary.permission_change_total || permissionChanges.length);
  const transferTotal = Number(summary.officer_transfer_total || officerTransfers.length);
  const loginTotal = Number(summary.login_attempt_total || successfulLogins + failedLogins || logins.length);

  // Filtered lists based on search and action filter
  const filteredActivities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activities.filter((item) => {
      if (actionFilter !== 'all' && item.action !== actionFilter) return false;
      if (!q) return true;
      const searchStr = `${item.user_email || ''} ${item.user_id || ''} ${item.action || ''} ${item.entity_type || ''} ${item.entity_id || ''} ${item.ip_address || ''} ${item.location_name || ''}`.toLowerCase();
      return searchStr.includes(q);
    });
  }, [activities, searchQuery, actionFilter]);

  const filteredPermissions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return permissionChanges.filter((item) => {
      if (!q) return true;
      const searchStr = `${item.actor || ''} ${item.target_name || ''} ${item.target_type || ''} ${item.permission_key || ''}`.toLowerCase();
      return searchStr.includes(q);
    });
  }, [permissionChanges, searchQuery]);

  const filteredTransfers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return officerTransfers.filter((item) => {
      if (!q) return true;
      const searchStr = `${item.full_name || ''} ${item.force_number || ''} ${item.from_assignment_name || ''} ${item.to_assignment_name || ''} ${item.transfer_reason || ''} ${item.transferred_by || ''}`.toLowerCase();
      return searchStr.includes(q);
    });
  }, [officerTransfers, searchQuery]);

  const filteredLogins = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return logins.filter((item) => {
      if (!q) return true;
      const searchStr = `${item.username || ''} ${item.ip_address || ''} ${item.user_agent || ''} ${item.failure_reason || ''}`.toLowerCase();
      return searchStr.includes(q);
    });
  }, [logins, searchQuery]);

  // Action badge helper
  const renderActionTag = (action) => {
    const info = ACTION_MAP[action] || { label: String(action || '').replaceAll('_', ' '), color: 'blue', icon: <FileDoneOutlined /> };
    return (
      <Tag color={info.color} icon={info.icon} className="audit-action-tag">
        {info.label}
      </Tag>
    );
  };

  // Activity columns
  const activityColumns = [
    {
      title: 'Waqtiga',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (val) => (
        <div className="audit-time-cell">
          <span className="audit-time-main">{dayjs(val).format('YYYY-MM-DD HH:mm')}</span>
          <span className="audit-time-ago">{dayjs(val).fromNow()}</span>
        </div>
      ),
    },
    {
      title: 'Qofka Sameeyey',
      key: 'user',
      width: 220,
      render: (_, row) => (
        <div className="audit-user-cell">
          <Avatar size={28} icon={<UserOutlined />} className="audit-avatar" />
          <div className="audit-user-details">
            <span className="audit-user-email">{row.user_email || row.user_id || 'System'}</span>
            {row.user_id && <span className="audit-user-sub">ID: {row.user_id}</span>}
          </div>
        </div>
      ),
    },
    {
      title: 'Hawsha',
      dataIndex: 'action',
      key: 'action',
      width: 190,
      render: (val) => renderActionTag(val),
    },
    {
      title: 'Qaybta & Xogta',
      key: 'entity',
      width: 170,
      render: (_, row) => (
        <Space orientation="vertical" size={2}>
          <Tag className="audit-entity-tag">{row.entity_type || 'N/A'}</Tag>
          {row.entity_id && (
            <Tooltip title="Guji si aad u koobiyeysato ID-ga">
              <span className="audit-id-badge" onClick={() => copyToClipboard(row.entity_id, 'Entity ID')}>
                #{row.entity_id} <CopyOutlined className="audit-copy-icon" />
              </span>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'Goobta & IP-ga',
      key: 'location',
      width: 190,
      render: (_, row) => (
        <div className="audit-location-cell">
          <span className="audit-location-name">
            <GlobalOutlined /> {row.location_name || 'Xarunta Guud'}
          </span>
          {row.ip_address && (
            <Tooltip title="Guji si aad u koobiyeysato IP-ga">
              <span className="audit-ip-badge" onClick={() => copyToClipboard(row.ip_address, 'IP Address')}>
                {row.ip_address}
              </span>
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      title: 'Isbeddelka',
      key: 'inspect',
      width: 120,
      align: 'center',
      render: (_, row) => (
        <Button
          size="small"
          type="primary"
          ghost
          icon={<EyeOutlined />}
          className="audit-inspect-btn"
          onClick={() => handleInspect(row, 'activity')}
        >
          Eeg
        </Button>
      ),
    },
  ];

  // Permission changes columns
  const permissionColumns = [
    {
      title: 'Waqtiga',
      dataIndex: 'created_at',
      width: 170,
      render: (val) => (
        <div className="audit-time-cell">
          <span className="audit-time-main">{dayjs(val).format('YYYY-MM-DD HH:mm')}</span>
          <span className="audit-time-ago">{dayjs(val).fromNow()}</span>
        </div>
      ),
    },
    {
      title: 'Maamulaha',
      dataIndex: 'actor',
      width: 180,
      render: (val) => (
        <Space>
          <Avatar size={24} icon={<UserOutlined />} className="audit-avatar" />
          <Text strong style={{ color: '#F5F5F5' }}>{val || 'Admin'}</Text>
        </Space>
      ),
    },
    {
      title: 'Nooca & Bartilmaameedka',
      key: 'target',
      width: 220,
      render: (_, row) => (
        <Space>
          <Tag color={row.target_type === 'ROLE' ? 'purple' : 'blue'}>
            {row.target_type === 'ROLE' ? 'Role' : 'User'}
          </Tag>
          <Text strong style={{ color: 'var(--ui-primary)' }}>
            {row.target_name || `#${row.target_id}`}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Awoodaha Cusub',
      dataIndex: 'new_effect',
      key: 'new_effect',
      render: (val) => {
        const parsed = parseJson(val);
        if (Array.isArray(parsed)) {
          return (
            <Space wrap size={[4, 4]}>
              {parsed.slice(0, 4).map((p, idx) => (
                <Tag key={idx} color="cyan" className="audit-perm-chip">{p}</Tag>
              ))}
              {parsed.length > 4 && (
                <Tag color="default" className="audit-perm-chip">+{parsed.length - 4} kale</Tag>
              )}
            </Space>
          );
        }
        return <Tag color="cyan">{String(val || '-')}</Tag>;
      },
    },
    {
      title: 'Faahfaahin',
      key: 'inspect',
      width: 100,
      align: 'center',
      render: (_, row) => (
        <Button
          size="small"
          type="primary"
          ghost
          icon={<EyeOutlined />}
          className="audit-inspect-btn"
          onClick={() => handleInspect(row, 'permission')}
        >
          Eeg
        </Button>
      ),
    },
  ];

  // Officer transfers columns
  const transferColumns = [
    {
      title: 'Waqtiga',
      dataIndex: 'transferred_at',
      width: 170,
      render: (val) => (
        <div className="audit-time-cell">
          <span className="audit-time-main">{dayjs(val).format('YYYY-MM-DD HH:mm')}</span>
          <span className="audit-time-ago">{dayjs(val).fromNow()}</span>
        </div>
      ),
    },
    {
      title: 'Sarkaalka / Askariga',
      key: 'officer',
      width: 220,
      render: (_, row) => (
        <div className="audit-user-cell">
          <Avatar size={30} icon={<TeamOutlined />} className="audit-avatar" />
          <div className="audit-user-details">
            <span className="audit-user-email">{row.full_name || 'Askari'}</span>
            <span className="audit-user-sub">Lambarka: {row.force_number || 'N/A'}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Dhaqdhaqaaqa (Laga ➔ Loo)',
      key: 'movement',
      width: 320,
      render: (_, row) => (
        <div className="audit-transfer-flow">
          <div className="audit-transfer-from">
            <span className="audit-transfer-tag from-tag">
              {row.from_assignment_name || 'Diiwaan cusub'}
            </span>
          </div>
          <SwapOutlined className="audit-transfer-arrow" />
          <div className="audit-transfer-to">
            <span className="audit-transfer-tag to-tag">
              {row.to_assignment_name || 'Lama cayimin'}
            </span>
          </div>
        </div>
      ),
    },
    {
      title: 'Sababta & Maamulaha',
      key: 'reason',
      render: (_, row) => (
        <div>
          <div style={{ color: '#E0E0E0', fontSize: 13 }}>{row.transfer_reason || 'Adeeg shaqo'}</div>
          <div style={{ color: '#888', fontSize: 11 }}>Waxaa wareejiyey: {row.transferred_by || 'Admin'}</div>
        </div>
      ),
    },
  ];

  // Login logs columns
  const loginColumns = [
    {
      title: 'Waqtiga',
      dataIndex: 'created_at',
      width: 170,
      render: (val) => (
        <div className="audit-time-cell">
          <span className="audit-time-main">{dayjs(val).format('YYYY-MM-DD HH:mm')}</span>
          <span className="audit-time-ago">{dayjs(val).fromNow()}</span>
        </div>
      ),
    },
    {
      title: 'Username-ka',
      dataIndex: 'username',
      width: 190,
      render: (val) => (
        <Space>
          <Avatar size={24} icon={<UserOutlined />} className="audit-avatar" />
          <Text strong style={{ color: '#F5F5F5' }}>{val || 'Unknown'}</Text>
        </Space>
      ),
    },
    {
      title: 'Natiijada',
      dataIndex: 'success',
      width: 150,
      render: (val) => (
        val ? (
          <Tag color="success" icon={<CheckCircleOutlined />} className="audit-status-tag success">
            Guulaystay
          </Tag>
        ) : (
          <Tag color="error" icon={<CloseCircleOutlined />} className="audit-status-tag failed">
            Fashilmay
          </Tag>
        )
      ),
    },
    {
      title: 'Sababta (Haddii uu fashilmay)',
      dataIndex: 'failure_reason',
      render: (val) => val ? <Text type="danger">{val}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'IP Address & Qalabka',
      key: 'device',
      width: 250,
      render: (_, row) => (
        <Space orientation="vertical" size={2}>
          {row.ip_address && (
            <span className="audit-ip-badge" onClick={() => copyToClipboard(row.ip_address, 'IP')}>
              {row.ip_address}
            </span>
          )}
          {row.user_agent && (
            <Tooltip title={row.user_agent}>
              <span className="audit-device-text">{row.user_agent.substring(0, 40)}...</span>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // Tab items
  const tabItems = [
    {
      key: 'activities',
      label: (
        <span className="audit-tab-title">
          <FileDoneOutlined /> Hawlaha Guud
          <Badge count={filteredActivities.length} overflowCount={999} className="audit-tab-badge" />
        </span>
      ),
      children: (
        <Table
          columns={activityColumns}
          dataSource={filteredActivities}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 12, showSizeChanger: true, pageSizeOptions: ['12', '25', '50', '100'] }}
          scroll={{ x: 1000 }}
          className="audit-modern-table"
        />
      ),
    },
    {
      key: 'permissions',
      label: (
        <span className="audit-tab-title">
          <KeyOutlined /> Isbeddelada Awoodaha
          <Badge count={filteredPermissions.length} overflowCount={999} className="audit-tab-badge" />
        </span>
      ),
      children: (
        <Table
          columns={permissionColumns}
          dataSource={filteredPermissions}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 12, showSizeChanger: true, pageSizeOptions: ['12', '25', '50', '100'] }}
          scroll={{ x: 900 }}
          className="audit-modern-table"
        />
      ),
    },
    {
      key: 'transfers',
      label: (
        <span className="audit-tab-title">
          <SwapOutlined /> Wareejinta Askarta
          <Badge count={filteredTransfers.length} overflowCount={999} className="audit-tab-badge" />
        </span>
      ),
      children: (
        <Table
          columns={transferColumns}
          dataSource={filteredTransfers}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 12, showSizeChanger: true, pageSizeOptions: ['12', '25', '50', '100'] }}
          scroll={{ x: 1000 }}
          className="audit-modern-table"
        />
      ),
    },
    {
      key: 'logins',
      label: (
        <span className="audit-tab-title">
          <LockOutlined /> Isku-dayada Login-ka
          <Badge count={filteredLogins.length} overflowCount={999} className="audit-tab-badge" />
        </span>
      ),
      children: (
        <Table
          columns={loginColumns}
          dataSource={filteredLogins}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 12, showSizeChanger: true, pageSizeOptions: ['12', '25', '50', '100'] }}
          scroll={{ x: 900 }}
          className="audit-modern-table"
        />
      ),
    },
  ];

  const renderInspectContent = () => {
    if (!inspectRecord) return null;
    const oldParsed = parseJson(inspectRecord.old_data);
    const newParsed = parseJson(inspectRecord.new_data || inspectRecord.new_effect);

    return (
      <div className="audit-inspect-modal-body">
        <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} className="audit-inspect-desc">
          <Descriptions.Item label="Waqtiga">
            {dayjs(inspectRecord.created_at || inspectRecord.transferred_at).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="Qofka / Maamulaha">
            {inspectRecord.user_email || inspectRecord.user_id || inspectRecord.actor || inspectRecord.transferred_by || 'N/A'}
          </Descriptions.Item>
          {inspectRecord.action && (
            <Descriptions.Item label="Hawsha">
              {renderActionTag(inspectRecord.action)}
            </Descriptions.Item>
          )}
          {inspectRecord.entity_type && (
            <Descriptions.Item label="Qaybta & ID">
              <Tag color="blue">{inspectRecord.entity_type}</Tag> #{inspectRecord.entity_id}
            </Descriptions.Item>
          )}
          {inspectRecord.ip_address && (
            <Descriptions.Item label="IP Address">
              <code>{inspectRecord.ip_address}</code>
            </Descriptions.Item>
          )}
          {inspectRecord.location_name && (
            <Descriptions.Item label="Goobta">
              {inspectRecord.location_name}
            </Descriptions.Item>
          )}
        </Descriptions>

        <div className="audit-diff-container" style={{ marginTop: 20 }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={oldParsed ? 12 : 24}>
              <Card
                size="small"
                title={<span style={{ color: '#EF4444' }}><HistoryOutlined /> Xogtii Hore (Previous State)</span>}
                className="audit-diff-card old-card"
              >
                {oldParsed ? (
                  <pre className="audit-json-code">
                    {JSON.stringify(oldParsed, null, 2)}
                  </pre>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Wax xog hore ah ma jirin (Diiwaan cusub)" />
                )}
              </Card>
            </Col>
            <Col xs={24} md={oldParsed ? 12 : 24}>
              <Card
                size="small"
                title={<span style={{ color: 'var(--ui-primary)' }}><FileDoneOutlined /> Xogta Cusub (New State)</span>}
                className="audit-diff-card new-card"
              >
                {newParsed ? (
                  <pre className="audit-json-code">
                    {JSON.stringify(newParsed, null, 2)}
                  </pre>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Wax xog cusub ah lama hayo" />
                )}
              </Card>
            </Col>
          </Row>
        </div>
      </div>
    );
  };

  return (
    <ProtectedRoute allowedRoles={['admin', 'sub_admin']} requiredPermissions={['audit_logs.view']}>
      <div className="audit-modern-page">
        {/* Header section */}
        <div className="audit-header-panel">
          <div>
            <div className="audit-breadcrumb">
              <HomeOutlined /> <span>Dashboard</span> <b>›</b> <strong>Diiwaanka Hawlaha</strong>
            </div>
            <Title level={2} className="audit-main-title">
              Diiwaanka Hawlaha Nidaamka
            </Title>
            <Text className="audit-sub-title">
              La soco dhammaan waxqabadka maamulka, isbeddellada awoodaha, login-ka, iyo wareejinta askarta.
            </Text>
          </div>

          <Space wrap className="audit-header-actions">
            <div className="audit-live-indicator">
              <span className="audit-live-pulse" />
              <span>LIVE TELEMETRY</span>
            </div>
            {lastRefreshed && (
              <span className="audit-refresh-time">Cusboonaysiiyey: {lastRefreshed}</span>
            )}
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={load}
              className="audit-refresh-btn"
            >
              Cusbooneysii
            </Button>
          </Space>
        </div>

        {/* 4 Telemetry KPI Cards */}
        <Row gutter={[16, 16]} className="audit-kpi-grid">
          <Col xs={24} sm={12} lg={6}>
            <Card className="audit-kpi-card kpi-activities" variant="borderless">
              <div className="audit-kpi-inner">
                <div className="audit-kpi-icon-box icon-activities">
                  <FileDoneOutlined />
                </div>
                <div className="audit-kpi-content">
                  <span className="audit-kpi-label">Hawlaha Audit-ka</span>
                  <div className="audit-kpi-val">{auditTotal.toLocaleString()}</div>
                  <span className="audit-kpi-sub">
                    {activities.length} ee u dambeeyay
                  </span>
                </div>
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card className="audit-kpi-card kpi-logins" variant="borderless">
              <div className="audit-kpi-inner">
                <div className="audit-kpi-icon-box icon-logins">
                  <LockOutlined />
                </div>
                <div className="audit-kpi-content">
                  <span className="audit-kpi-label">Isku-dayada Login-ka</span>
                  <div className="audit-kpi-val">{loginTotal.toLocaleString()}</div>
                  <div className="audit-kpi-tags">
                    <span className="kpi-mini-tag success">{successfulLogins} guulaystay</span>
                    <span className="kpi-mini-tag fail">{failedLogins} fashilmay</span>
                  </div>
                </div>
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card className="audit-kpi-card kpi-permissions" variant="borderless">
              <div className="audit-kpi-inner">
                <div className="audit-kpi-icon-box icon-permissions">
                  <KeyOutlined />
                </div>
                <div className="audit-kpi-content">
                  <span className="audit-kpi-label">Isbeddellada Awoodaha</span>
                  <div className="audit-kpi-val">{permissionTotal.toLocaleString()}</div>
                  <span className="audit-kpi-sub">
                    Roles & Users Permissions
                  </span>
                </div>
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card className="audit-kpi-card kpi-transfers" variant="borderless">
              <div className="audit-kpi-inner">
                <div className="audit-kpi-icon-box icon-transfers">
                  <SwapOutlined />
                </div>
                <div className="audit-kpi-content">
                  <span className="audit-kpi-label">Wareejinta Askarta</span>
                  <div className="audit-kpi-val">{transferTotal.toLocaleString()}</div>
                  <span className="audit-kpi-sub">
                    Dhaqdhaqaaqa ciidanka
                  </span>
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Toolbar & Filter Bar */}
        <Card className="audit-toolbar-card" variant="borderless">
          <Row gutter={[16, 16]} align="middle" justify="space-between">
            <Col xs={24} md={12} lg={10}>
              <Input
                placeholder="Raadi qof, email, ficil, IP, ID..."
                prefix={<SearchOutlined style={{ color: '#888' }} />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                allowClear
                className="audit-search-input"
              />
            </Col>

            {activeTab === 'activities' && (
              <Col xs={24} sm={12} lg={6}>
                <Select
                  value={actionFilter}
                  onChange={setActionFilter}
                  style={{ width: '100%' }}
                  className="audit-select-filter"
                  options={[
                    { value: 'all', label: 'Dhammaan Ficilada' },
                    { value: 'CREATE_CASE', label: 'Kiis la Abuuray' },
                    { value: 'UPDATE_CASE', label: 'Kiis la Beddelay' },
                    { value: 'ASSIGN_CASE', label: 'Kiis la Xilsaaray' },
                    { value: 'CONVERT_OB_TO_CASE', label: 'OB loo Beddelay Kiis' },
                    { value: 'CREATE_OB_ENTRY', label: 'OB la Diiwaangeliyey' },
                    { value: 'CREATE_SUSPECT', label: 'Eedaysane Cusub' },
                    { value: 'UPDATE_SUSPECT', label: 'Eedaysane la Beddelay' },
                    { value: 'PRISON_ADMISSION', label: 'Maxbuus la Qaabilay' },
                    { value: 'TRANSFER_OFFICER', label: 'Askari la Wareejiyey' },
                  ]}
                />
              </Col>
            )}

            <Col xs={24} md="auto">
              <span className="audit-records-count">
                Xogta diiwaanka: <strong>100 record ee ugu dambeeyay</strong>
              </span>
            </Col>
          </Row>
        </Card>

        {/* Main Tabs and Tables */}
        <Card className="audit-table-card" variant="borderless">
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            className="audit-main-tabs"
          />
        </Card>

        {/* Inspection Modal */}
        <Modal
          title={
            <Space>
              <FileDoneOutlined style={{ color: 'var(--ui-primary)' }} />
              <span>Faahfaahinta Diiwaanka Hawsha</span>
            </Space>
          }
          open={isModalOpen}
          onCancel={() => setIsModalOpen(false)}
          footer={[
            <Button key="close" type="primary" onClick={() => setIsModalOpen(false)}>
              Xidh
            </Button>,
          ]}
          width={820}
          className="audit-inspect-modal"
          centered
        >
          {renderInspectContent()}
        </Modal>
      </div>
    </ProtectedRoute>
  );
}
