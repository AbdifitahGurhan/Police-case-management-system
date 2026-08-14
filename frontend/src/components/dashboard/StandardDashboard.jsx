'use client';

import React from 'react';
import { Button, Card, Col, Row, Space, Statistic, Table, Tag, Typography } from 'antd';
import { RightOutlined } from '@ant-design/icons';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

const { Title, Text } = Typography;

const toneClass = {
  blue: 'standard-metric-blue',
  amber: 'standard-metric-amber',
  green: 'standard-metric-green',
  red: 'standard-metric-red',
  purple: 'standard-metric-purple',
};

export default function StandardDashboard({
  allowedRoles,
  eyebrow = 'Dashboard',
  title,
  subtitle,
  loading,
  metrics = [],
  tableTitle = 'Recent records',
  tableSubtitle,
  tableColumns = [],
  tableData = [],
  rowKey = 'id',
  actions = [],
  sidePanel,
  viewAllHref,
  viewAllOnClick,
  viewAllLabel = 'View all records',
  pagination = false,
  showTable = true,
}) {
  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
      <div className="standard-dashboard">
        <div className="standard-dashboard-hero">
          <div className="dashboard-hero-copy">
            <Text className="dashboard-eyebrow">Bogga Hore&nbsp;&nbsp; / &nbsp;&nbsp;{eyebrow}</Text>
            <Title level={2} style={{ fontSize: 20, fontWeight: 500, margin: '4px 0' }}>
              {title}
            </Title>
            {subtitle && (
              <Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
                {subtitle}
              </Text>
            )}
          </div>
          {actions.length > 0 && (
            <Space wrap>
              {actions.map((action) => (
                <Button
                  key={action.label}
                  type={action.type || 'default'}
                  icon={action.icon}
                  href={action.href}
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              ))}
            </Space>
          )}
        </div>

        <section className="dashboard-ledger-group">
          <div className="dashboard-group-head">
            <span className="dashboard-group-letter">A</span>
            <h2>Dulmarka Guud <small>— xogta muhiimka ah</small></h2>
            <span className="dashboard-group-rule" />
          </div>
          <Row gutter={[14, 14]}>
            {metrics.map((metric) => (
              <Col xs={24} sm={12} lg={8} xl={4} key={metric.title}>
                <Card variant="none" className={`standard-metric-card ${toneClass[metric.tone] || toneClass.blue}`}>
                  <div className="standard-metric-icon">{metric.icon}</div>
                  <Statistic title={metric.title} value={metric.value || 0} loading={loading} />
                  {metric.note && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {metric.note}
                    </Text>
                  )}
                </Card>
              </Col>
            ))}
          </Row>
        </section>

        {showTable && <section className="dashboard-ledger-group">
          <div className="dashboard-group-head">
            <span className="dashboard-group-letter">B</span>
            <h2>Faahfaahinta <small>— diiwaannada iyo waxqabadka</small></h2>
            <span className="dashboard-group-rule" />
          </div>
          <Row gutter={[16, 16]}>
          <Col xs={24} lg={sidePanel ? 16 : 24}>
            <Card
              variant="none"
              className="standard-panel"
              title={
                <Space orientation="vertical" size={0}>
                  <span style={{ fontWeight: 500 }}>{tableTitle}</span>
                  {tableSubtitle && (
                    <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                      {tableSubtitle}
                    </Text>
                  )}
                </Space>
              }
              extra={
                <Tag className="status-tag status-tag--neutral">
                  {tableData.length} records
                </Tag>
              }
            >
              <Table
                columns={tableColumns}
                dataSource={tableData}
                loading={loading}
                rowKey={rowKey}
                pagination={pagination}
                size="middle"
                scroll={{ x: 'max-content' }}
              />
              {tableData.length > 0 && (viewAllHref || viewAllOnClick) && (
                <div className="standard-table-footer">
                  <Button
                    type="text"
                    icon={<RightOutlined />}
                    href={viewAllHref}
                    onClick={viewAllOnClick}
                  >
                    {viewAllLabel}
                  </Button>
                </div>
              )}
            </Card>
          </Col>
          {sidePanel && (
            <Col xs={24} lg={8}>
              <Card variant="none" className="standard-panel" title={sidePanel.title}>
                {sidePanel.content}
              </Card>
            </Col>
          )}
          </Row>
        </section>}
      </div>
    </ProtectedRoute>
  );
}
