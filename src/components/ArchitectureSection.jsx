export default function ArchitectureSection({ cards }) {
  return (
    <section className="architecture-section">
      <div className="section-title">
        <span>AI / ML Architecture</span>
        <h2>From excavation record to anomaly report</h2>
      </div>
      <div className="architecture-grid">
        {cards.map(card => (
          <article className="panel architecture-card" key={card.title}>
            <h3>{card.title}</h3>
            <p>{card.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
