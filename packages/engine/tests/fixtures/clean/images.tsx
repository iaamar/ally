export function Gallery() {
  return (
    <section>
      <img src="/hero.png" alt="Team gathered at launch" />
      <img src="/a.png" alt="" />
      <img src="/b.png" alt="A golden retriever playing fetch" />
      <video src="/demo.mp4" controls>
        <track kind="captions" src="c.vtt" />
      </video>
      <iframe src="https://maps.example.com/embed" title="Office location map" />
      <img src="/c.png" alt="" role="presentation" />
    </section>
  );
}
