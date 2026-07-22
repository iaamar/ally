export function CleanWaveD() {
  return (
    <div>
      {/* checkbox with required aria-checked */}
      <div role="checkbox" aria-checked="false">Toggle</div>
      {/* no accessKey */}
      <button>Save</button>
      {/* input image with alt */}
      <input type="image" src="submit.png" alt="Submit" />
      {/* area with alt */}
      <area href="/link" alt="Link area" />
      {/* object with title */}
      <object data="movie.swf" title="Movie player"></object>
      {/* svg with aria-label */}
      <svg viewBox="0 0 100 100" aria-label="Circle icon"><circle cx="50" cy="50" r="40" /></svg>
      {/* decorative svg with aria-hidden */}
      <svg viewBox="0 0 10 10" aria-hidden="true"><rect width="10" height="10" /></svg>
      {/* concrete role */}
      <div role="button">Concrete</div>
      {/* no nested interactive */}
      <button>Just a button</button>
      {/* fieldset with legend */}
      <fieldset>
        <legend>Details</legend>
        <input type="text" aria-label="Name" />
      </fieldset>
      {/* label wrapping control */}
      <label>Name <input type="text" /></label>
      {/* proper heading order */}
      <h1>Title</h1>
      <h2>Section</h2>
      <h3>Subsection</h3>
      {/* slider with aria-valuenow */}
      <div role="slider" aria-valuenow="50">Slide</div>
    </div>
  );
}
