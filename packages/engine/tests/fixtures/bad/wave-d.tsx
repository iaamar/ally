export function BadWaveD() {
  return (
    <div>
      {/* aria-required-attr: checkbox missing aria-checked */}
      <div role="checkbox">Toggle</div>
      {/* aria-unsupported-elements: role on meta (won't parse in JSX easily, skip) */}
      {/* no-access-key */}
      <button accessKey="s">Save</button>
      {/* input-image-missing-alt */}
      <input type="image" src="submit.png" />
      {/* area-missing-alt */}
      <area href="/link" />
      {/* object-missing-text */}
      <object data="movie.swf"></object>
      {/* svg-missing-title: svg without title or aria-label */}
      <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" /></svg>
      {/* abstract-role-used */}
      <div role="widget">Abstract</div>
      {/* no-nested-interactive: button containing anchor */}
      <button><a href="/go">Link inside button</a></button>
      {/* fieldset-missing-legend */}
      <fieldset>
        <input type="text" aria-label="Name" />
      </fieldset>
      {/* label-missing-control: label with no matching for or wrapped control */}
      <label>Orphan label</label>
      {/* heading-order: h1 then h3 skips h2 */}
      <h1>Title</h1>
      <h3>Subsection</h3>
      {/* aria-required-attr: slider missing aria-valuenow */}
      <div role="slider">Slide</div>
      {/* no-nested-interactive: a containing button */}
      <a href="/foo"><button>Nested</button></a>
    </div>
  );
}
