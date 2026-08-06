'use client';
import React from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import TierManager from '@/components/administration/TierManager';

const REGIONS_BY_STATE = {
  PNT: [{ name: 'Bari', code: 'PNT-BRI' }, { name: 'Nugaal', code: 'PNT-NGL' }, { name: 'Mudug', code: 'PNT-MDG' }],
  JBL: [{ name: 'Gedo', code: 'JBL-GED' }, { name: 'Jubbada Dhexe', code: 'JBL-JDH' }, { name: 'Jubbada Hoose', code: 'JBL-JHL' }],
  HSH: [{ name: 'Hiiraan', code: 'HSH-HIR' }, { name: 'Shabeellaha Dhexe', code: 'HSH-SHD' }],
  GLM: [{ name: 'Galgaduud', code: 'GLM-GLG' }, { name: 'Mudug', code: 'GLM-MDG' }],
  SWS: [{ name: 'Bakool', code: 'SWS-BKL' }, { name: 'Bay', code: 'SWS-BAY' }, { name: 'Shabeellaha Hoose', code: 'SWS-SHH' }],
  SSC: [{ name: 'Sool', code: 'SSC-SOL' }, { name: 'Sanaag', code: 'SSC-SNG' }, { name: 'Cayn', code: 'SSC-CYN' }],
  BNDR: [{ name: 'Banaadir', code: 'BNDR-BND' }],
};

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
        autoParentRoles={['state_admin']}
        nameOptionsByParent={REGIONS_BY_STATE}
        generatedCode
      />
    </ProtectedRoute>
  );
}
