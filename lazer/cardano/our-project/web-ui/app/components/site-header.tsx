"use client";

type SiteHeaderProps = {
  title: string;
  buttonLabel: string;
  onConnect: () => void;
  isConnecting: boolean;
};

export function SiteHeader({
  title,
  buttonLabel,
  onConnect,
  isConnecting,
}: SiteHeaderProps) {
  return (
    <header className="site-header">
      <h1 className="project-name">{title}</h1>
      <button
        id="connect-wallet"
        className="connect-button"
        type="button"
        onClick={onConnect}
        disabled={isConnecting}
      >
        {buttonLabel}
      </button>
    </header>
  );
}
