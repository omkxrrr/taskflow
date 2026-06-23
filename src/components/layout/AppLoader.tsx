export default function AppLoader({ message = 'Loading workspace' }: { message?: string }) {
  return (
    <div className="app-loader">
      <div className="app-loader-card">
        <div className="app-loader-logo">
          <span>Task</span>
          <em>Flow</em>
        </div>
        <div className="app-loader-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="app-loader-text">{message}</div>
        <div className="app-loader-bar">
          <span />
        </div>
      </div>
    </div>
  );
}
