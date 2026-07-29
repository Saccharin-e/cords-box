export function Toolbar() {
  return (
    <header className="toolbar" id="toolbar">
      <div className="toolbar__brand">
        <div className="toolbar__logo">CB</div>
        <span className="toolbar__title">Cords Box</span>
        <span className="toolbar__subtitle">Guitar Wiring Sandbox</span>
      </div>
      <nav className="toolbar__actions">
        <button className="btn btn--ghost btn--sm" id="btn-new">
          New
        </button>
        <button className="btn btn--ghost btn--sm" id="btn-import">
          Import
        </button>
        <button className="btn btn--ghost btn--sm" id="btn-export">
          Export
        </button>
        <button className="btn btn--primary btn--sm" id="btn-simulate">
          ▶ Simulate
        </button>
      </nav>
    </header>
  );
}
