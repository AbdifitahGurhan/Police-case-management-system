// src/components/shared/CaseStatusTag.jsx
import { Tag } from 'antd';

const statusMap = {
  draft: { color: 'default', label: 'QABYO' },
  pending_commander_review: { color: 'processing', label: 'SUGAYA ANSIXIN' },
  returned_for_correction: { color: 'warning', label: 'DIB U SAXID' },
  confirmed_by_ward_commander: { color: 'success', label: 'LA ANSIXIYAY' },
  under_investigation: { color: 'orange', label: 'BAARIS SOCOTA' },
  referred_cid: { color: 'purple', label: 'CID LOO GUDBIYAY' },
  transferred: { color: 'blue', label: 'LA WAREEJIYAY' },
  reassigned: { color: 'geekblue', label: 'DIB LOO QOONDEEYEY' },
  referred_to_court: { color: 'cyan', label: 'MAXKAMAD LOO GUDBIYAY' },
  returned_evidence: { color: 'warning', label: 'CADEYN DHEERI AH' },
  rejected: { color: 'volcano', label: 'LA DIIDAY' },
  closed: { color: 'green', label: 'LA XIRAY' },
  dismissed: { color: 'red', label: 'LA LAALAY' },
  archived: { color: 'default', label: 'KEYD' },
};

const CaseStatusTag = ({ status }) => {
  const config = statusMap[status] || { color: 'default', label: status?.toUpperCase() };
  return <Tag color={config.color}>{config.label}</Tag>;
};

export default CaseStatusTag;
