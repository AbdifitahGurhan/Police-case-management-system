'use client';

import React, { useMemo } from 'react';

// ─── Flow Definitions ───────────────────────────────────────────────────────

export const POLICE_CASE_FLOW = [
  { key: 'draft',              title: 'Qoraal' },
  { key: 'registered',         title: 'Diiwaan' },
  { key: 'referred_to_cid',   title: 'CID' },
  { key: 'under_investigation', title: 'Baaritaan' },
  { key: 'ready_for_court',   title: 'Maxkamad' },
  { key: 'forwarded_to_court', title: 'U Dirtay' },
  { key: 'court_decided',     title: 'Go\'aan' },
  { key: 'closed',            title: 'La Xiray' },
];

export const CID_INVESTIGATION_FLOW = [
  { key: 'open',                  title: 'Furan' },
  { key: 'under_investigation',   title: 'Baaritaan' },
  { key: 'evidence_collection',   title: 'Caddeymo' },
  { key: 'witness_interviews',    title: 'Markhaati' },
  { key: 'suspect_tracking',      title: 'Raadraac' },
  { key: 'arrest_made',           title: 'Xarig' },
  { key: 'investigation_completed', title: 'Dhammaad' },
  { key: 'supervisor_review',     title: 'Dib-u-Eeg' },
  { key: 'approved',              title: 'La Xaqiijiyey' },
];

export const COURT_CASE_FLOW = [
  { key: 'registered',       title: 'Diiwaan' },
  { key: 'awaiting_hearing', title: 'Sugaya Dheg.' },
  { key: 'hearing_scheduled', title: 'Dheg. Qorshe' },
  { key: 'in_trial',         title: 'Maxkamadayn' },
  { key: 'judgment_issued',  title: 'Go\'aan' },
  { key: 'sentenced',        title: 'Xukun' },
  { key: 'closed',           title: 'La Xiray' },
];

// ─── Status → Index Maps ─────────────────────────────────────────────────────

const POLICE_STATUS_INDEX = {
  draft: 0,
  registered: 1, CASE_REGISTERED: 1, pending_commander_review: 1,
  confirmed_by_ward_commander: 1, confirmed_by_commander: 1, CONFIRMED_BY_COMMANDER: 1,
  referred_to_cid: 2, referred_cid: 2,
  under_investigation: 3,
  ready_for_court: 4, approved_for_court: 4,
  forwarded_to_court: 5, referred_to_court: 5,
  court_decided: 6, court_convicted: 6, court_acquitted: 6, court_dismissed: 6, court_adjourned: 6,
  closed: 7, archived: 7,
};

const CID_STATUS_INDEX = {
  open: 0, under_investigation: 1, evidence_collection: 2,
  witness_interviews: 3, suspect_tracking: 4, arrest_made: 5,
  investigation_completed: 6, supervisor_review: 7, approved: 8,
  rejected: 7, sent_to_prosecutor: 8, sent_to_court: 8,
};

const COURT_STATUS_INDEX = {
  registered: 0, awaiting_hearing: 1, hearing_scheduled: 2,
  in_trial: 3, judgment_issued: 4, sentenced: 5, appealed: 5,
  closed: 6, archived: 6,
};

const FLOW_MAP = {
  case:  { steps: POLICE_CASE_FLOW,       index: POLICE_STATUS_INDEX },
  cid:   { steps: CID_INVESTIGATION_FLOW, index: CID_STATUS_INDEX },
  court: { steps: COURT_CASE_FLOW,        index: COURT_STATUS_INDEX },
};

// ─── Custom Stepper ──────────────────────────────────────────────────────────

/**
 * Reusable workflow stepper — custom renderer to prevent label overflow/collision.
 * @param {'case'|'cid'|'court'} flow
 */
export default function CaseStatusStepper({ status, flow = 'case', style }) {
  const config = FLOW_MAP[flow] || FLOW_MAP.case;

  const current = useMemo(() => {
    if (status == null) return 0;
    if (config.index[status] != null) return config.index[status];
    const byKey = config.steps.findIndex((s) => s.key === status);
    return byKey >= 0 ? byKey : 0;
  }, [config, status]);

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
        const isCompleted = idx < current;
        const isCurrent   = idx === current;
        const isUpcoming  = idx > current;

        // Circle colours
        const circleBg     = isCompleted ? '#A8FF4D' : isCurrent ? '#A8FF4D' : '#2B2B2B';
        const circleColor  = isCompleted ? '#0E0E0E' : isCurrent ? '#0E0E0E' : '#707070';
        const circleBorder = isCurrent   ? '2px solid #A8FF4D' : '2px solid transparent';
        const circleGlow   = isCurrent   ? '0 0 0 3px rgba(168, 255, 77, 0.20)' : 'none';

        // Label colour
        const labelColor = isCompleted ? '#A5A5A5' : isCurrent ? '#A8FF4D' : '#707070';

        // Connector line (after every step except last)
        const showConnector = idx < steps.length - 1;
        const connectorColor = isCompleted ? '#A8FF4D' : '#2B2B2B';

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
                {isCompleted ? (
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
              {step.title}
            </div>
          </div>
        );
      })}
    </div>
  );
}
