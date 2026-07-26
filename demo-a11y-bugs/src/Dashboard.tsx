// Demo file: remediated ARIA, structure, and interactive examples.
import React from 'react';

export function Dashboard() {
  return (
    <div>
      <div>Widget</div>

      <button type="button">Hidden action</button>

      <span role="button" tabIndex={0} onClick={() => {}}>Open</span>

      <h2>Dashboard</h2>

      <div aria-label="Panel">Panel</div>

      <div onMouseOver={() => {}} onFocus={() => {}}>Hover me</div>

      <iframe src="/embed" title="Embedded dashboard"></iframe>

      <button type="button">Save</button>
    </div>
  );
}
