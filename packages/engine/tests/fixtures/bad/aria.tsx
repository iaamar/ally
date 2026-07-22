export function BadAria() {
  return (
    <div>
      {/* aria-role-valid: invalid role */}
      <div role="buttn">Click me</div>
      {/* aria-props-valid: invalid aria prop */}
      <div aria-expandd="true">Toggle</div>
      {/* aria-hidden-on-focusable */}
      <button aria-hidden="true">Hidden button</button>
      {/* no-redundant-role: button with role="button" */}
      <button role="button">Submit</button>
      {/* no-redundant-role: nav with role="navigation" */}
      <nav role="navigation">Nav</nav>
      {/* no-redundant-role: a with href and role="link" */}
      <a href="/home" role="link">Home</a>
      {/* form-control-missing-label: input without label */}
      <input type="text" id="name" />
      {/* heading-has-content: empty heading */}
      <h1></h1>
    </div>
  );
}
