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
  tableTitle = 'Recent Records',
  tableSubtitle,
  tableColumns = [],
  tableData = [],
  rowKey = 'id',
  actions = [],
  sidePanel,
  viewAllHref,
  viewAllOnClick,
  viewAllLabel = 'View all records',
}) {
  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
      <div className="standard-dashboard">
        <div className="standard-dashboard-hero">
          <div>
            <Text className="dashboard-eyebrow">{eyebrow}</Text>
            <Title level={2}>{title}</Title>
            {subtitle && <Text type="secondary">{subtitle}</Text>}
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

        <Row gutter={[16, 16]}>
          {metrics.map((metric) => (
            <Col xs={24} sm={12} xl={6} key={metric.title}>
              <Card variant="none" className={`standard-metric-card ${toneClass[metric.tone] || toneClass.blue}`}>
                <div className="standard-metric-icon">{metric.icon}</div>
                <Statistic title={metric.title} value={metric.value || 0} loading={loading} />
                {metric.note && <Text type="secondary">{metric.note}</Text>}
              </Card>
            </Col>
          ))}
        </Row>

        <Row gutter={[16, 16]}>
          {sidePanel && (
            <Col xs={24} lg={8}>
              <Card variant="none" className="standard-panel" title={sidePanel.title}>
                {sidePanel.content}
              </Card>
            </Col>
          )}
          <Col xs={24} lg={sidePanel ? 16 : 24}>
            <Card
              variant="none"
              className="standard-panel"
              title={
                <Space orientation="vertical" size={0}>
                  <span>{tableTitle}</span>
                  {tableSubtitle && <Text type="secondary">{tableSubtitle}</Text>}
                </Space>
              }
              extra={<Tag color="blue">{tableData.length} records</Tag>}
            >
              <Table
                columns={tableColumns}
                dataSource={tableData}
                loading={loading}
                rowKey={rowKey}
                pagination={false}
                size="middle"
                scroll={{ x: 'max-content' }}
              />
              {tableData.length > 0 && (
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
        </Row>
      </div>
    </ProtectedRoute>
  );
}
