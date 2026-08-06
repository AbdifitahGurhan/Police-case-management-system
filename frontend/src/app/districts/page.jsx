'use client';
import React from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import TierManager from '@/components/administration/TierManager';

const DISTRICTS_BY_REGION = {
  Hiiraan: [
    { name: 'Beledweyne', code: 'HIR-BLW' },
    { name: 'Buulo Burte', code: 'HIR-BBT' },
    { name: 'Jalalaqsi', code: 'HIR-JLL' },
    { name: 'Matabaan', code: 'HIR-MTB' },
    { name: 'Maxaas', code: 'HIR-MXS' },
    { name: 'Halgan', code: 'HIR-HLG' },
    { name: 'Ceel-Cali', code: 'HIR-CCA' },
    { name: 'Far-Libaax', code: 'HIR-FLB' },
    { name: 'Moqokori', code: 'HIR-MQK' },
    { name: 'Buq-Aqable', code: 'HIR-BQA' },
    { name: 'Booco/Burweyn', code: 'HIR-BBW' },
    { name: 'Cali-Gaduud', code: 'HIR-CGD' },
    { name: 'Raage-Ceelle', code: 'HIR-RCL' },
    { name: 'Xawaadley', code: 'HIR-XWD' },
  ],
};

export default function DistrictsPage() {
  const columns = [
    { title: 'District Name', dataIndex: 'district_name', key: 'district_name' },
  ];

  return (
    <ProtectedRoute allowedRoles={['admin', 'region_admin']}>
      <TierManager
        entityName="District"
        apiEndpoint="/districts"
        columns={columns}
        parentKey="region_id"
        parentEndpoint="/regions"
        parentLabel="Gobolka"
        parentNameKey="region_name"
        autoParentRoles={['region_admin']}
        nameOptionsByParent={DISTRICTS_BY_REGION}
        generatedCode
      />
    </ProtectedRoute>
  );
}
