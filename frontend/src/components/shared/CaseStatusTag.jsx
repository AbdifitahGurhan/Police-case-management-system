// src/components/shared/CaseStatusTag.jsx
import { Tag } from 'antd';

const statusMap = {
  draft: { color: 'default', label: 'DRAFT' },
  pending_commander_review: { color: 'processing', label: 'PENDING REVIEW' },
  returned_for_correction: { color: 'warning', label: 'NEEDS REVISION' },
  confirmed_by_ward_commander: { color: 'success', label: 'APPROVED' },
  under_investigation: { color: 'orange', label: 'UNDER INVESTIGATION' },
  referred_cid: { color: 'purple', label: 'REFERRED TO CID' },
  transferred: { color: 'blue', label: 'TRANSFERRED' },
  reassigned: { color: 'geekblue', label: 'REASSIGNED' },
  referred_to_court: { color: 'cyan', label: 'REFERRED TO COURT' },
  returned_evidence: { color: 'warning', label: 'EVIDENCE RETURNED' },
  rejected: { color: 'volcano', label: 'REJECTED' },
  closed: { color: 'green', label: 'CLOSED' },
  dismissed: { color: 'red', label: 'DISMISSED' },
  archived: { color: 'default', label: 'ARCHIVED' },
};

const CaseStatusTag = ({ status }) => {
  const config = statusMap[status] || { color: 'default', label: status?.toUpperCase() };
  return <Tag color={config.color}>{config.label}</Tag>;
};

export default CaseStatusTag;
