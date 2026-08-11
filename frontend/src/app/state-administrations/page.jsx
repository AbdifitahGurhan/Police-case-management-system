'use client';
import React from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import TierManager from '@/components/administration/TierManager';

const SOMALIA_STATE_OPTIONS = [
  { name: 'Puntland', code: 'PNT' },
  { name: 'Jubaland', code: 'JBL' },
  { name: 'Hirshabelle', code: 'HSH' },
  { name: 'Galmudug', code: 'GLM' },
  { name: 'South West State', code: 'SWS' },
  { name: 'SSC-Khaatumo', code: 'SSC' },
  { name: 'Banaadir Regional Administration', code: 'BNDR' },
];

export default function StateAdministrationsPage() {
  const columns = [
    { title: 'State Name', dataIndex: 'state_name', key: 'state_name' },
    { title: 'State Code', dataIndex: 'state_code', key: 'state_code' },
  ];

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <TierManager
        entityName="State Administration"
        entityKey="state"
        apiEndpoint="/state-administrations"
        columns={columns}
        nameOptions={SOMALIA_STATE_OPTIONS}
        generatedCode
      />
    </ProtectedRoute>
  );
}
