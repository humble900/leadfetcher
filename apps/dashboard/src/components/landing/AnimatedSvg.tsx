'use client';

import React from 'react';

// CSS modules don't easily allow raw class injection inside SVGs without specific CSS class mapping.
// So we define inline <style> tags inside the SVGs to keep them completely self-contained and modular!

export function CrawlerSvg() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: 'visible' }}
    >
      <style>{`
        @keyframes radar-pulse {
          0% { r: 6px; opacity: 1; }
          100% { r: 22px; opacity: 0; }
        }
        @keyframes orbit-rotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .pulse-circle {
          animation: radar-pulse 2s cubic-bezier(0.1, 0.8, 0.3, 1) infinite;
          stroke: #f97316;
          stroke-width: 1.5;
        }
        .orbit-group {
          animation: orbit-rotate 12s linear infinite;
          transform-origin: 24px 24px;
        }
      `}</style>
      
      {/* Outer grid boundaries */}
      <circle cx="24" cy="24" r="20" stroke="rgba(249, 115, 22, 0.1)" strokeWidth="1" strokeDasharray="3 3" />
      <circle cx="24" cy="24" r="12" stroke="rgba(249, 115, 22, 0.15)" strokeWidth="1" />
      
      {/* Radial radar scanning ring */}
      <circle cx="24" cy="24" r="6" className="pulse-circle" fill="none" />
      
      {/* Central target core */}
      <circle cx="24" cy="24" r="4" fill="#f97316" />
      
      {/* Orbiting crawlers/nodes */}
      <g className="orbit-group">
        <line x1="24" y1="24" x2="12" y2="12" stroke="rgba(249, 115, 22, 0.25)" strokeWidth="1" />
        <line x1="24" y1="24" x2="36" y2="36" stroke="rgba(249, 115, 22, 0.25)" strokeWidth="1" />
        <circle cx="12" cy="12" r="3.5" fill="#f97316" stroke="#000" strokeWidth="1" />
        <circle cx="36" cy="36" r="2.5" fill="#ea580c" stroke="#000" strokeWidth="1" />
        <circle cx="36" cy="12" r="3" fill="#ff9d5c" />
      </g>
    </svg>
  );
}

export function VerifiedSvg() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: 'visible' }}
    >
      <style>{`
        @keyframes scan-translate {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(18px); }
        }
        @keyframes check-appear {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        .scan-line {
          animation: scan-translate 2.5s ease-in-out infinite;
          stroke: #22c55e;
          stroke-width: 2;
        }
        .shield-path {
          stroke: #22c55e;
          stroke-width: 2.5;
          filter: drop-shadow(0 2px 8px rgba(34, 197, 94, 0.2));
        }
        .check-icon {
          animation: check-appear 2s infinite ease-in-out;
          transform-origin: 24px 23px;
        }
      `}</style>
      
      {/* Shield outline */}
      <path
        d="M24 6C14 6 12 10 12 10C12 22 18 36 24 40C30 36 36 22 36 10C36 10 34 6 24 6Z"
        className="shield-path"
        fill="rgba(34, 197, 94, 0.04)"
      />
      
      {/* Moving scanning ray */}
      <line x1="14" y1="12" x2="34" y2="12" className="scan-line" />
      
      {/* Glowing checkmark */}
      <g className="check-icon">
        <path
          d="M18 23L22 27L30 19"
          stroke="#22c55e"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

export function ExporterSvg() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: 'visible' }}
    >
      <style>{`
        @keyframes row-download {
          0% { transform: translateY(-8px); opacity: 0; }
          30% { opacity: 1; }
          70% { opacity: 1; }
          100% { transform: translateY(16px); opacity: 0; }
        }
        @keyframes arrow-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(3px); }
        }
        .down-row {
          animation: row-download 2.5s linear infinite;
          stroke: #f97316;
          stroke-width: 2;
        }
        .down-row-delay {
          animation: row-download 2.5s linear infinite;
          animation-delay: 1.25s;
          stroke: #ff9d5c;
          stroke-width: 2;
        }
        .arrow-indicator {
          animation: arrow-bounce 1.5s ease-in-out infinite;
          transform-origin: 38px 12px;
        }
      `}</style>

      {/* Main Database storage cylinder representation */}
      <path d="M6 10C6 7 14 5 24 5C34 5 42 7 42 10" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
      
      {/* Bottom shelf card layout */}
      <rect x="8" y="18" width="32" height="24" rx="6" stroke="rgba(255,255,255,0.08)" strokeWidth="2" fill="rgba(255, 255, 255, 0.02)" />
      
      {/* Export horizontal lines (animating downward) */}
      <line x1="14" y1="24" x2="34" y2="24" className="down-row" />
      <line x1="14" y1="24" x2="28" y2="24" className="down-row-delay" />
      
      {/* Interactive side action arrow */}
      <g className="arrow-indicator" transform="translate(1, 0)">
        <path d="M38 6V16M38 16L34 12M38 16L42 12" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
