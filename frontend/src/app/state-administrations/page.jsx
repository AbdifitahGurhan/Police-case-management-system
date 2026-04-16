'use client';
import React from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import TierManager from '@/components/administration/TierManager';

export default function StateAdministrationsPage() {
  const columns = [
    { title: 'State Name', dataIndex: 'state_name', key: 'state_name' },
  ];

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <TierManager
        entityName="State Administration"
        entityKey="state"
        apiEndpoint="/state-administrations"
        columns={columns}
      />
    </ProtectedRoute>
  );
}
