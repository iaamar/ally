'use client';

import { useEffect, useState } from 'react';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  DoughnutController,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Legend,
  LinearScale,
  Tooltip,
);

interface ProjectChartItem {
  name: string;
  score: number | null;
  findings: number;
}

interface ProjectChartsProps {
  projects: ProjectChartItem[];
}

interface ChartPalette {
  fg: string;
  muted: string;
  border: string;
  surface: string;
}

const FALLBACK_PALETTE: ChartPalette = {
  fg: '#f2f3f5',
  muted: '#8a8f98',
  border: '#2b3038',
  surface: '#15181d',
};

function readPalette(): ChartPalette {
  const styles = window.getComputedStyle(document.documentElement);
  return {
    fg: styles.getPropertyValue('--fg').trim() || FALLBACK_PALETTE.fg,
    muted: styles.getPropertyValue('--muted').trim() || FALLBACK_PALETTE.muted,
    border: styles.getPropertyValue('--border').trim() || FALLBACK_PALETTE.border,
    surface: styles.getPropertyValue('--surface').trim() || FALLBACK_PALETTE.surface,
  };
}

export function ProjectCharts({ projects }: ProjectChartsProps) {
  const [palette, setPalette] = useState<ChartPalette>(FALLBACK_PALETTE);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const update = () => setPalette(readPalette());
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReducedMotion(motion.matches);
    update();
    updateMotion();
    const observer = new MutationObserver(update);
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

  const scored = projects.filter(
    (project): project is ProjectChartItem & { score: number } =>
      project.score !== null,
  );
  const projectsWithFindings = projects.filter((project) => project.findings > 0);

  if (scored.length === 0 && projectsWithFindings.length === 0) return null;

  const axis = {
    ticks: { color: palette.muted, font: { size: 11 } },
    grid: { color: palette.border, tickColor: palette.border },
    border: { color: palette.border },
  };

  return (
    <section className="project-charts" aria-labelledby="project-insights-heading">
      <div className="section-heading">
        <div>
          <p className="docs-kicker">Portfolio insights</p>
          <h2 id="project-insights-heading">Project quality at a glance</h2>
        </div>
      </div>

      <div className="project-charts__grid">
        {scored.length > 0 ? (
          <article className="chart-card chart-card--scores">
            <div>
              <h3>Accessibility score</h3>
              <p>Latest score by project</p>
            </div>
            <div className="chart-card__canvas">
              <Bar
                role="img"
                aria-label={`Latest accessibility scores: ${scored.map((project) => `${project.name} ${project.score}`).join(', ')}`}
                data={{
                  labels: scored.map((project) => project.name),
                  datasets: [{
                    label: 'Score',
                    data: scored.map((project) => project.score),
                    backgroundColor: scored.map((project) =>
                      project.score >= 90
                        ? '#39b86b'
                        : project.score >= 70
                          ? '#e6a23c'
                          : '#ef5b62',
                    ),
                    borderWidth: 0,
                    borderRadius: 0,
                    barThickness: 20,
                  }],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  animation: reducedMotion ? false : { duration: 350 },
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      backgroundColor: palette.surface,
                      titleColor: palette.fg,
                      bodyColor: palette.fg,
                      borderColor: palette.border,
                      borderWidth: 1,
                    },
                  },
                  scales: {
                    x: { ...axis, grid: { display: false } },
                    y: { ...axis, beginAtZero: true, max: 100 },
                  },
                }}
              />
            </div>
          </article>
        ) : null}

        {projectsWithFindings.length > 0 ? (
          <article className="chart-card chart-card--findings">
            <div>
              <h3>Finding concentration</h3>
              <p>Share of open findings</p>
            </div>
            <div className="chart-card__canvas chart-card__canvas--doughnut">
              <Doughnut
                role="img"
                aria-label={`Open findings by project: ${projectsWithFindings.map((project) => `${project.name} ${project.findings}`).join(', ')}`}
                data={{
                  labels: projectsWithFindings.map((project) => project.name),
                  datasets: [{
                    data: projectsWithFindings.map((project) => project.findings),
                    backgroundColor: ['#4f8cff', '#8b6df6', '#2fbf8f', '#f0a84b', '#e9638a', '#38a6c9'],
                    borderColor: palette.surface,
                    borderWidth: 2,
                    hoverOffset: 3,
                  }],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  cutout: '68%',
                  animation: reducedMotion ? false : { duration: 350 },
                  plugins: {
                    legend: {
                      position: 'right',
                      labels: {
                        color: palette.muted,
                        boxWidth: 8,
                        boxHeight: 8,
                        usePointStyle: true,
                        pointStyle: 'rect',
                        font: { size: 10 },
                      },
                    },
                    tooltip: {
                      backgroundColor: palette.surface,
                      titleColor: palette.fg,
                      bodyColor: palette.fg,
                      borderColor: palette.border,
                      borderWidth: 1,
                    },
                  },
                }}
              />
            </div>
          </article>
        ) : null}
      </div>
    </section>
  );
}
