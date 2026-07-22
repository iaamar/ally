export function CleanAria() {
  return (
    <div>
      {/* Valid role */}
      <div role="button">Click me</div>
      {/* Valid aria prop */}
      <div aria-expanded="true">Toggle</div>
      {/* aria-hidden on non-focusable */}
      <div aria-hidden="true">Hidden div</div>
      {/* Non-redundant role: button with role="link" is fine */}
      <button role="link">Navigate</button>
      {/* nav without role is fine */}
      <nav>Nav</nav>
      {/* a without href: role="link" is NOT redundant (no implicit) */}
      <a role="link">Link</a>
      {/* form-control with wrapping label */}
      <label>
        Name
        <input type="text" />
      </label>
      {/* form-control with for/id association */}
      <label htmlFor="email">Email</label>
      <input type="email" id="email" />
      {/* form-control with aria-label */}
      <input type="search" aria-label="Search" />
      {/* form-control with aria-labelledby */}
      <input type="text" aria-labelledby="custom-label" />
      {/* heading with content */}
      <h1>Welcome</h1>
      {/* heading with child element content */}
      <h2><span>Subtitle</span></h2>
    </div>
  );
}
