import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { CalendarDays, FileText, Hospital, Plus, Users } from "lucide-react";
import { api } from "../../lib/api";
import { useAsync } from "../../hooks/useAsync";
import GroupFormModal from "./GroupFormModal";
import { shortDay } from "./shared";
import "./Instructor.css";

export default function Groups() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { data: groups, error } = useAsync(api.listGroups);
  const [creating, setCreating] = useState(params.get("new") === "1");

  return (
    <div className="ci-page">
      <div className="ci-page-head">
        <header className="page-header page-header--plain">
          <p className="eyebrow">Clinical instruction</p>
          <h1>My Groups</h1>
          <p>Your clinical groups and the students in each one.</p>
        </header>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          <Plus size={15} /> New Group
        </button>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {!groups && !error && <div className="skeleton" style={{ height: 220 }} />}

      {groups && groups.length === 0 && (
        <div className="card ci-empty-cta">
          <div>
            <strong>No groups yet</strong>
            <span>Create a group for each clinical section, then add students by email or student ID.</span>
          </div>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            New Group
          </button>
        </div>
      )}

      <div className="ci-group-grid">
        {groups?.map((g) => (
          <button key={g.id} className={`card ci-group-card ci-accent--${g.color}`} onClick={() => navigate(`/ci/groups/${g.id}`)}>
            <span className={`ci-group-icon ci-tone--${g.color}`}>
              <Users size={20} />
            </span>
            <h2>{g.name}</h2>
            {(g.area || g.hospital) && (
              <p className="ci-group-meta">
                <Hospital size={13} /> {[g.area, g.hospital].filter(Boolean).join(" · ")}
              </p>
            )}
            {g.term && <p className="ci-group-term">{g.term}</p>}
            <div className="ci-group-stats">
              <span>
                <Users size={14} /> {g.memberCount} student{g.memberCount === 1 ? "" : "s"}
              </span>
              <span>
                <CalendarDays size={14} /> {g.nextDutyDate ? `Next duty ${shortDay(g.nextDutyDate)}` : "No upcoming duty"}
              </span>
              <span className={g.pendingReviews > 0 ? "is-alert" : ""}>
                <FileText size={14} /> {g.pendingReviews} to review
              </span>
            </div>
          </button>
        ))}
      </div>

      {creating && (
        <GroupFormModal
          onClose={() => {
            setCreating(false);
            if (params.get("new")) setParams({}, { replace: true });
          }}
          onSaved={(g) => navigate(`/ci/groups/${g.id}`)}
        />
      )}
    </div>
  );
}
