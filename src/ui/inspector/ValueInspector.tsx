export function ValueInspector() {
  return (
    <aside className="inspector" id="inspector-panel">
      <div className="inspector__header">
        <span className="inspector__title">Inspector</span>
      </div>
      <div className="inspector-empty">
        <span style={{ fontSize: '1.5rem', opacity: 0.3 }}>🔍</span>
        <p className="inspector-empty__text">
          Select a component to view and edit its properties.
        </p>
      </div>
    </aside>
  );
}
