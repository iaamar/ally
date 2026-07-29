'use client';

import { useEffect, useState } from 'react';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, BarElement, CategoryScale, Legend, LinearScale, Tooltip);

interface FindingMetric {
  severity: string;
  status: string;
  rule_id: string;
}

interface ScanMetricsChartsProps {
  findings: FindingMetric[];
}

const SEVERITIES = ['blocker', 'critical', 'serious', 'moderate', 'minor'];
const SEVERITY_COLORS = ['#ff4f64', '#ff7a45', '#f3b43f', '#d2ca55', '#62bd72'];
const STATUS_COLORS = ['#4f8cff', '#9a7dff', '#35bd84', '#eeaa48', '#8391a8'];

export function ScanMetricsCharts({ findings }: ScanMetricsChartsProps) {
  const [themeTick, setThemeTick] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReducedMotion(motion.matches);
    updateMotion();
    motion.addEventListener('change', updateMotion);
    const observer = new MutationObserver(() => setThemeTick((value) => value + 1));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      motion.removeEventListener('change', updateMotion);
      observer.disconnect();
    };
  }, []);

  if (findings.length === 0) return null;

  const styles = typeof window === 'undefined' ? null : window.getComputedStyle(document.documentElement);
  const fg = styles?.getPropertyValue('--fg').trim() || '#f2f3f5';
  const muted = styles?.getPropertyValue('--muted').trim() || '#8a8f98';
  const border = styles?.getPropertyValue('--border').trim() || '#2b3038';
  const surface = styles?.getPropertyValue('--surface').trim() || '#15181d';
  void themeTick;

  const severityData = SEVERITIES
    .map((severity, index) => ({
      severity,
      count: findings.filter((finding) => finding.severity === severity).length,
      color: SEVERITY_COLORS[index],
    }))
    .filter(({ count }) => count > 0);

  const statuses = [...new Set(findings.map((finding) => finding.status))];
  const statusData = statuses.map((status, index) => ({
    status,
    count: findings.filter((finding) => finding.status === status).length,
    color: STATUS_COLORS[index % STATUS_COLORS.length],
  }));

  const tooltip = {
    backgroundColor: surface,
    titleColor: fg,
    bodyColor: fg,
    borderColor: border,
    borderWidth: 1,
  };

  return (
    <section className="scan-visuals" aria-labelledby="scan-visuals-heading">
      <div className="section-heading">
        <div>
          <p className="docs-kicker">Finding intelligence</p>
          <h2 id="scan-visuals-heading">Risk profile</h2>
        </div>
      </div>
      <div className="scan-visuals__grid">
        <article className="chart-card">
          <div>
            <h3>Severity pressure</h3>
            <p>Defects grouped by impact</p>
          </div>
          <div className="chart-card__canvas">
            <Bar
              role="img"
              aria-label={`Findings by severity: ${severityData.map(({ severity, count }) => `${severity} ${count}`).join(', ')}`}
              data={{
                labels: severityData.map(({ severity }) => severity),
                datasets: [{
                  label: 'Findings',
                  data: severityData.map(({ count }) => count),
                  backgroundColor: severityData.map(({ color }) => color),
                  borderWidth: 0,
                  barThickness: 20,
                }],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                animation: reducedMotion ? false : { duration: 350 },
                plugins: { legend: { display: false }, tooltip },
                scales: {
                  x: { beginAtZero: true, ticks: { color: muted, precision: 0 }, grid: { color: border } },
                  y: { ticks: { color: muted }, grid: { display: false } },
                },
              }}
            />
          </div>
        </article>
        <article className="chart-card">
          <div>
            <h3>Workflow state</h3>
            <p>Where findings sit now</p>
          </div>
          <div className="chart-card__canvas">
            <Doughnut
              role="img"
              aria-label={`Findings by status: ${statusData.map(({ status, count }) => `${status} ${count}`).join(', ')}`}
              data={{
                labels: statusData.map(({ status }) => status),
                datasets: [{
                  data: statusData.map(({ count }) => count),
                  backgroundColor: statusData.map(({ color }) => color),
                  borderColor: surface,
                  borderWidth: 2,
                }],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: '68%',
                animation: reducedMotion ? false : { duration: 350 },
                plugins: {
                  tooltip,
                  legend: {
                    position: 'bottom',
                    labels: { color: muted, usePointStyle: true, boxWidth: 8, boxHeight: 8 },
                  },
                },
              }}
            />
          </div>
        </article>
      </div>
    </section>
  );
}
