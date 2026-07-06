import type { AuthUser } from "../lib/types";

interface AccountProfileProps {
  user: AuthUser;
  onUseWebsite: (url: string) => void;
}

function formatValue(value: string | null): string {
  return value && value.trim() ? value : "Not provided";
}

export function AccountProfile({ user, onUseWebsite }: AccountProfileProps) {
  return (
    <section className="panel account-profile">
      <div className="panel-header">
        <p className="eyebrow">Workspace profile</p>
        <h2>{formatValue(user.companyName)}</h2>
      </div>
      <div className="profile-grid">
        <div>
          <span>Name</span>
          <strong>{formatValue(user.fullName)}</strong>
        </div>
        <div>
          <span>Role</span>
          <strong>{formatValue(user.role)}</strong>
        </div>
        <div>
          <span>Use case</span>
          <strong>{formatValue(user.useCase)}</strong>
        </div>
        <div>
          <span>Team size</span>
          <strong>{formatValue(user.teamSize)}</strong>
        </div>
      </div>
      {user.websiteUrl ? (
        <div className="profile-website">
          <span>{user.websiteUrl}</span>
          <button className="secondary-button" onClick={() => onUseWebsite(user.websiteUrl as string)}>
            Use registered website
          </button>
        </div>
      ) : null}
    </section>
  );
}
