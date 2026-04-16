// src/components/shared/CaseStatusTag.jsx
import { Tag } from 'antd';

const statusMap = {
  draft: { color: 'default', label: 'DRAFT' },
  pending_commander_review: { color: 'processing', label: 'PENDING REVIEW' },
  returned_for_correction: { color: 'warning', label: 'RETURNED FOR CORRECTION' },
  confirmed_by_ward_commander: { color: 'success', label: 'CONFIRMED BY COMMANDER' },
  under_investigation: { color: 'orange', label: 'INVESTIGATING' },
  referred_cid: { color: 'purple', label: 'REFERRED TO CID' },
  referred_prosecutor: { color: 'gold', label: 'REFERRED TO PROSECUTOR' },
  transferred: { color: 'blue', label: 'TRANSFERRED' },
  reassigned: { color: 'geekblue', label: 'REASSIGNED' },
  approved_for_court: { color: 'cyan', label: 'APPROVED FOR COURT' },
  returned_evidence: { color: 'warning', label: 'MORE EVIDENCE REQ' },
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
