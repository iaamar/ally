export function InteractiveBad() {
  const go = () => {};
  const peek = () => {};
  return (
    <section>
      <div onClick={go}>Open</div>
      <span role="button">Save</span>
      <div tabIndex="3">x</div>
      <input autoFocus />
      <p tabIndex="0">note</p>
      <div onMouseOver={peek}>tip</div>
      <a onClick={go} href="#">More</a>
      <a href="/next"><span className="icon" /></a>
      <button onClick={go}>Send</button>
      <marquee>hi</marquee>
    </section>
  );
}
