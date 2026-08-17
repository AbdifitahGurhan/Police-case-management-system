'use client';

import React, { useMemo } from 'react';

// ─── Flow Definitions ───────────────────────────────────────────────────────

export const POLICE_CASE_FLOW = [
  { key: 'ob_created',          title: '1. OB la abuuray' },
  { key: 'case_opened',         title: '2. Case la furay' },
  { key: 'under_investigation', title: '3. Baaritaan' },
  { key: 'referred_to_court',   title: '4. Maxkamad' },
];

export const CID_INVESTIGATION_FLOW = [
  { key: 'open',                  title: 'Furan (Socota)' },
  { key: 'under_investigation',   title: 'Baaritaan' },
  { key: 'evidence_collection',   title: 'Caddeymo' },
  { key: 'witness_interviews',    title: 'Markhaati' },
  { key: 'suspect_tracking',      title: 'Raadraac' },
  { key: 'arrest_made',           title: 'Xarig' },
  { key: 'investigation_completed', title: 'Dhammaystiran' },
  { key: 'supervisor_review',     title: 'Dib-u-Eegis' },
  { key: 'approved',              title: 'La Xaqiijiyey' },
];

export const COURT_CASE_FLOW = [
  { key: 'court_received', title: '1. Maxkamad' },
  { key: 'arraignment', title: '2. Horgeyn' },
  { key: 'remand_investigation', title: '3. Muddo Baaris' },
  { key: 'assigned_legal_team', title: '4. Xilsaarid' },
  { key: 'case_scheduled', title: '5. Mudeyn' },
  { key: 'trial_hearing', title: '6. Dhageysi' },
  { key: 'evidence_defense', title: '7. Caddeymo' },
  { key: 'judgment', title: '8. Xukun' },
  { key: 'sentenced', title: '9. Ciqaab' },
  { key: 'closed', title: '10. Xirid' },
];

export const FULL_CASE_LIFECYCLE_FLOW = [
  { key: 'ob', title: '1. OB / Dhacdo' },
  { key: 'investigation', title: '2. Baaritaan' },
  { key: 'evidence', title: '3. Caddeyn' },
  { key: 'conclusion', title: '4. Gunaanad' },
  { key: 'arrest', title: '5. Xarig' },
  { key: 'jail', title: '6. Xabsiga' },
  { key: 'bail', title: '7. Damanad' },
  { key: 'prosecution', title: '8. Xeer-ilaalin' },
  { key: 'court_reg', title: '9. Diiwaan Maxkamad' },
  { key: 'schedule', title: '10. Jadwal' },
  { key: 'hearing', title: '11. Dhageysi' },
  { key: 'defense', title: '12. Difaac' },
  { key: 'case_close', title: '13. Xirid Dheg.' },
  { key: 'judgment', title: '14. Xukunnada' },
  { key: 'sentence', title: '15. Ciqaab/Sii-deyn' },
  { key: 'appeal', title: '16. Rafcaan' },
];

// ─── Status → Index Maps ─────────────────────────────────────────────────────

const POLICE_STATUS_INDEX = {
  draft: 0, OB_REGISTERED: 0, REGISTERED: 0,
  registered: 1, CASE_REGISTERED: 1, pending_commander_review: 1,
  confirmed_by_ward_commander: 1, confirmed_by_commander: 1, CONFIRMED_BY_COMMANDER: 1,
  referred_to_cid: 2, referred_cid: 2,
  under_investigation: 2,
  ready_for_court: 3, approved_for_court: 3,
  forwarded_to_court: 3, referred_to_court: 3,
  court_decided: 3, court_convicted: 3, court_acquitted: 3, court_dismissed: 3, court_adjourned: 3,
  closed: 3, archived: 3,
};

const CID_STATUS_INDEX = {
  open: 0, Socota: 0, under_investigation: 1, evidence_collection: 2,
  witness_interviews: 3, suspect_tracking: 4, arrest_made: 5,
  investigation_completed: 6, Dhammaystiran: 6, supervisor_review: 7, approved: 8,
  rejected: 7, Xiran: 7, sent_to_prosecutor: 8, sent_to_court: 8,
};

const COURT_STATUS_INDEX = {
  registered: 0,
  awaiting_hearing: 3,
  hearing_scheduled: 4,
  in_trial: 5,
  judgment_issued: 7,
  court_received: 0,
  arraignment: 1,
  remand_investigation: 2,
  remanded_to_investigator: 2,
  returned_from_remand: 2,
  assigned_legal_team: 3,
  case_scheduled: 4,
  trial_hearing: 5,
  evidence_defense: 6,
  judgment: 7,
  sentenced: 8,
  appealed: 8,
  closed: 9,
  archived: 9,
};

const FULL_STATUS_INDEX = {
  draft: 0, registered: 0, OB_REGISTERED: 0, FORWARDED_FOR_REVIEW: 0, CONVERTED_TO_CASE: 0,
  referred_to_cid: 1, under_investigation: 1, open: 1, Socota: 1,
  evidence_collection: 2, witness_interviews: 2,
  investigation_completed: 3, Dhammaystiran: 3, supervisor_review: 3, Xiran: 3,
  arrest_made: 4, arrested: 4,
  admitted: 5, in_jail: 5,
  bail_granted: 6, temporary_detention: 6,
  prosecutor_review: 7, sent_to_prosecutor: 7,
  court_registered: 8, court_cases: 8,
  hearing_scheduled: 9, scheduled: 9,
  in_trial: 10, hearing: 10,
  defense_presented: 11,
  hearing_closed: 12,
  judgment_issued: 13, convicted: 13, acquitted: 13,
  sentenced: 14, released: 14,
  appealed: 15, appeal_pending: 15,
};

const FLOW_MAP = {
  case:  { steps: POLICE_CASE_FLOW,       index: POLICE_STATUS_INDEX },
  cid:   { steps: CID_INVESTIGATION_FLOW, index: CID_STATUS_INDEX },
  court: { steps: COURT_CASE_FLOW,        index: COURT_STATUS_INDEX },
  full:  { steps: FULL_CASE_LIFECYCLE_FLOW, index: FULL_STATUS_INDEX },
};

// ─── Custom Stepper ──────────────────────────────────────────────────────────

/**
 * Reusable workflow stepper — custom renderer to prevent label overflow/collision.
 * @param {'case'|'cid'|'court'} flow
 * @param {string} outcome - 'convicted' | 'acquitted' | 'dismissed'
 */
export default function CaseStatusStepper({ status, outcome, flow = 'case', style }) {
  const config = FLOW_MAP[flow] || FLOW_MAP.case;

  const current = useMemo(() => {
    if (status == null) return 0;
    if (config.index[status] != null) return config.index[status];
    const byKey = config.steps.findIndex((s) => s.key === status);
    return byKey >= 0 ? byKey : 0;
  }, [config, status]);

  const isNonConviction = outcome === 'dismissed' || outcome === 'acquitted';
  const steps = config.steps;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        width: '100%',
        gap: 0,
        ...style,
      }}
    >
      {steps.map((step, idx) => {
        const isSentenceStep = step.key === 'sentenced' || step.key === 'sentence';
        const isSkipped = isSentenceStep && isNonConviction;

        let isCompleted = idx < current && !isSkipped;
        const isCurrent = idx === current && !isSkipped;

        // Circle colours
        const circleBg = isSkipped
          ? '#2B2B2B'
          : isCompleted
          ? '#A8FF4D'
          : isCurrent
          ? '#A8FF4D'
          : '#2B2B2B';

        const circleColor = isSkipped
          ? '#707070'
          : isCompleted
          ? '#0E0E0E'
          : isCurrent
          ? '#0E0E0E'
          : '#707070';

        const circleBorder = isSkipped
          ? '1px dashed #707070'
          : isCurrent
          ? '2px solid #A8FF4D'
          : '2px solid transparent';

        const circleGlow = isCurrent ? '0 0 0 3px rgba(168, 255, 77, 0.20)' : 'none';

        // Label colour
        const labelColor = isSkipped ? '#707070' : isCompleted ? '#A5A5A5' : isCurrent ? '#A8FF4D' : '#707070';

        // Connector line (after every step except last)
        const showConnector = idx < steps.length - 1;
        const connectorColor = isCompleted || (isSkipped && idx < current) ? '#A8FF4D' : '#2B2B2B';

        const displayTitle = isSkipped
          ? `${step.title} (Aan lagu ridin)`
          : step.title;

        return (
          <div
            key={step.key}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
              minWidth: 0,
            }}
          >
            {/* Row: connector-left + circle + connector-right */}
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', position: 'relative' }}>
              {/* Left connector */}
              <div
                style={{
                  flex: 1,
                  height: 2,
                  background: idx === 0 ? 'transparent' : (idx <= current ? '#A8FF4D' : '#2B2B2B'),
                  transition: 'background 0.3s',
                }}
              />

              {/* Circle */}
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: circleBg,
                  border: circleBorder,
                  boxShadow: circleGlow,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'background 0.3s, box-shadow 0.3s',
                  zIndex: 1,
                }}
              >
                {isSkipped ? (
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#707070' }}>—</span>
                ) : isCompleted ? (
                  // Checkmark SVG
                  <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
                    <path d="M1 4L4.5 7.5L11 1" stroke="#0E0E0E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <span style={{ fontSize: 10, fontWeight: 700, color: circleColor, lineHeight: 1 }}>
                    {idx + 1}
                  </span>
                )}
              </div>

              {/* Right connector */}
              <div
                style={{
                  flex: 1,
                  height: 2,
                  background: showConnector ? connectorColor : 'transparent',
                  transition: 'background 0.3s',
                }}
              />
            </div>

            {/* Label below the circle */}
            <div
              style={{
                marginTop: 6,
                fontSize: 9.5,
                fontWeight: isCurrent ? 600 : 400,
                color: labelColor,
                textAlign: 'center',
                lineHeight: 1.3,
                wordBreak: 'break-word',
                hyphens: 'auto',
                padding: '0 2px',
                width: '100%',
                maxWidth: '100%',
                transition: 'color 0.3s',
              }}
            >
              {displayTitle}
            </div>
          </div>
        );
      })}
    </div>
  );
}
