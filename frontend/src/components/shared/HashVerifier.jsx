// src/components/shared/HashVerifier.jsx
'use client';

import React, { useState, useEffect } from 'react';
import { Tag, Tooltip, Space, Spin, Typography } from 'antd';
import { CheckCircleOutlined, ExclamationCircleOutlined, SecurityScanOutlined } from '@ant-design/icons';
import api from '@/services/api';

const { Text } = Typography;

const HashVerifier = ({ entityType, entityId, initialHash }) => {
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState(null);

  const verify = async () => {
    setVerifying(true);
    try {
      const response = await api.post('/blockchain/verify', { entity_type: entityType, entity_id: entityId });
      setResult(response.data.data);
    } catch (err) {
      console.error('Verification failed', err);
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    verify();
  }, [entityId, entityType]);

  return (
    <Space orientation="vertical" size={0}>
      <Space>
        <SecurityScanOutlined style={{ color: '#1677ff' }} />
        <Text strong style={{ fontSize: '12px' }}>Blockchain Integrity Proof:</Text>
        {verifying ? (
          <Spin size="small" />
        ) : result?.valid ? (
          <Tag icon={<CheckCircleOutlined />} color="success">VERIFIED</Tag>
        ) : (
          <Tag icon={<ExclamationCircleOutlined />} color="error">TAMPER DETECTED</Tag>
        )}
      </Space>
      <Tooltip title="SHA-256 Hash of this record as stored in the blockchain ledger.">
        <Text code copyable style={{ fontSize: '10px', color: '#8c8c8c' }}>
          {initialHash || result?.storedHash || 'N/A'}
        </Text>
      </Tooltip>
    </Space>
  );
};

export default HashVerifier;
