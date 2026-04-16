'use client';
import React from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import TierManager from '@/components/administration/TierManager';

export default function RegionsPage() {
  const columns = [
    { title: 'Region Name', dataIndex: 'region_name', key: 'region_name' },
    { title: 'State Name', dataIndex: 'state_name', key: 'state_name' },
  ];

  return (
    <ProtectedRoute allowedRoles={['admin', 'state_admin']}>
      <TierManager
        entityName="Region"
        apiEndpoint="/regions"
        columns={columns}
        parentKey="state_administration_id"
        parentEndpoint="/state-administrations"
        parentLabel="State Administration"
        parentNameKey="state_name"
      />
    </ProtectedRoute>
  );
}
