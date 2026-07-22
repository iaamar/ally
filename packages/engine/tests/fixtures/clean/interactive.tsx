export function InteractiveClean() {
  const go = () => {};
  const peek = () => {};
  return (
    <section>
      <div onClick={go} onKeyDown={go} role="button" tabIndex={0}>Open</div>
      <span role="button" tabIndex={0}>Save</span>
      <div tabIndex={0}>x</div>
      <input aria-label="Search" />
      <a onClick={go} href="/details">More</a>
      <a href="/next">Next page</a>
      <button type="button" onClick={go}>Send</button>
      <div onMouseOver={peek} onFocus={peek}>tip</div>
      <form><button onClick={go}>Submit</button></form>
    </section>
  );
}
