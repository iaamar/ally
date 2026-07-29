'use client';

import { useEffect, useState } from 'react';
import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(
  ArcElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
);

interface ScanPoint {
  id: string;
  score: number;
}

interface ProjectDetailChartsProps {
  scans: ScanPoint[];
  severityCounts: Record<string, number>;
}

interface Palette {
  fg: string;
  muted: string;
  border: string;
  surface: string;
  accent: string;
}

const FALLBACK: Palette = {
  fg: '#f2f3f5',
  muted: '#8a8f98',
  border: '#2b3038',
  surface: '#15181d',
  accent: '#5aa2ff',
};

const SEVERITIES = ['blocker', 'critical', 'serious', 'moderate', 'minor'] as const;
const SEVERITY_COLORS = ['#ff5865', '#ff8a4c', '#f2b544', '#d7d05a', '#7fce6a'];

function readPalette(): Palette {
  const styles = window.getComputedStyle(document.documentElement);
  return {
    fg: styles.getPropertyValue('--fg').trim() || FALLBACK.fg,
    muted: styles.getPropertyValue('--muted').trim() || FALLBACK.muted,
    border: styles.getPropertyValue('--border').trim() || FALLBACK.border,
    surface: styles.getPropertyValue('--surface').trim() || FALLBACK.surface,
    accent: styles.getPropertyValue('--accent').trim() || FALLBACK.accent,
  };
}

function shortScanId(id: string): string {
  return id.slice(0, 8);
}

export function ProjectDetailCharts({
  scans,
  severityCounts,
}: ProjectDetailChartsProps) {
  const [palette, setPalette] = useState<Palette>(FALLBACK);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const updatePalette = () => setPalette(readPalette());
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReducedMotion(motion.matches);
    updatePalette();
    updateMotion();

    const observer = new MutationObserver(updatePalette);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    motion.addEventListener('change', updateMotion);
    return () => {
      observer.disconnect();
      motion.removeEventListener('change', updateMotion);
    };
  }, []);

  const severitySeries = SEVERITIES
    .map((severity, index) => ({
      severity,
      count: severityCounts[severity] ?? 0,
      color: SEVERITY_COLORS[index],
    }))
    .filter((item) => item.count > 0);

  const animation = reducedMotion ? false : { duration: 350 };
  const tooltip = {
    backgroundColor: palette.surface,
    titleColor: palette.fg,
    bodyColor: palette.fg,
    borderColor: palette.border,
    borderWidth: 1,
  };

  return (
    <section className="project-detail-charts" aria-labelledby="project-analysis-heading">
      <header className="section-heading">
        <div>
          <p className="docs-kicker">Scan analysis</p>
          <h2 id="project-analysis-heading">Quality and finding distribution</h2>
        </div>
      </header>

      <div className="project-detail-charts__grid">
        <article className="chart-card chart-card--trajectory">
          <div>
            <h3>Score trajectory</h3>
            <p>Oldest to newest scan UUID</p>
          </div>
          <div className="chart-card__canvas">
            <Line
              role="img"
              aria-label={`Accessibility score by scan: ${scans.map((scan) => `${scan.id} score ${scan.score}`).join(', ')}`}
              data={{
                labels: scans.map((scan) => shortScanId(scan.id)),
                datasets: [{
                  label: 'Accessibility score',
                  data: scans.map((scan) => scan.score),
                  borderColor: palette.accent,
                  backgroundColor: `${palette.accent}20`,
                  pointBackgroundColor: scans.map((scan) =>
                    scan.score >= 90 ? '#39b86b' : scan.score >= 70 ? '#e6a23c' : '#ef5b62',
                  ),
                  pointBorderColor: palette.surface,
                  pointBorderWidth: 2,
                  pointRadius: 4,
                  pointHoverRadius: 5,
                  borderWidth: 2,
                  fill: true,
                  tension: scans.length > 2 ? 0.32 : 0,
                }],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                animation,
                interaction: { intersect: false, mode: 'index' },
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    ...tooltip,
                    callbacks: {
                      title: (items) => scans[items[0]?.dataIndex ?? 0]?.id ?? 'Scan',
                      label: (item) => `Score: ${item.formattedValue}/100`,
                    },
                  },
                },
                scales: {
                  x: {
                    grid: { display: false },
                    border: { color: palette.border },
                    ticks: { color: palette.muted, font: { size: 10 }, maxRotation: 0 },
                  },
                  y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: palette.border, tickColor: palette.border },
                    border: { color: palette.border },
                    ticks: { color: palette.muted, font: { size: 10 }, stepSize: 25 },
                  },
                },
              }}
            />
          </div>
        </article>

        <article className="chart-card chart-card--severity">
          <div>
            <h3>Severity mix</h3>
            <p>Latest scan findings</p>
          </div>
          <div className="chart-card__canvas chart-card__canvas--severity">
            {severitySeries.length > 0 ? (
              <Doughnut
                role="img"
                aria-label={`Latest scan severity distribution: ${severitySeries.map((item) => `${item.severity} ${item.count}`).join(', ')}`}
                data={{
                  labels: severitySeries.map((item) => item.severity),
                  datasets: [{
                    data: severitySeries.map((item) => item.count),
                    backgroundColor: severitySeries.map((item) => item.color),
                    borderColor: palette.surface,
                    borderWidth: 2,
                    hoverOffset: 3,
                  }],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  cutout: '66%',
                  animation,
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: {
                        color: palette.muted,
                        boxWidth: 8,
                        boxHeight: 8,
                        usePointStyle: true,
                        pointStyle: 'rect',
                        padding: 12,
                        font: { size: 10 },
                      },
                    },
                    tooltip,
                  },
                }}
              />
            ) : (
              <p className="empty">No findings in the latest scan.</p>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
