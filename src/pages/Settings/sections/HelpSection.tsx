import { useState } from "react";
import { useNavigate } from "react-router";
import { SectionHeader, SettingRow } from "./shared";
import LegalModal, { type LegalKind } from "../../Legal/LegalModal";

export default function HelpSection() {
  const navigate = useNavigate();
  const [legal, setLegal] = useState<LegalKind | null>(null);
  return (
    <div className="st-section">
      <SectionHeader title="Help & Support" subtitle="Get answers and find out more about NurSet." />
      <div className="st-block">
        <SettingRow title="Frequently asked questions" text="How to add duties, upload documents, prepare for duty, and more.">
          <button className="btn btn-secondary" onClick={() => navigate("/quick-links/help")}>
            Open
          </button>
        </SettingRow>
        <SettingRow title="School policies" text="Questions about schedules or requirements? Ask your clinical instructor or nursing department.">
          <button className="btn btn-secondary" onClick={() => navigate("/quick-links/handbook")}>
            Handbook
          </button>
        </SettingRow>
        <SettingRow title="Terms of Use" text="The rules for using NurSet, including patient confidentiality.">
          <button className="btn btn-secondary" onClick={() => setLegal("terms")}>
            Read
          </button>
        </SettingRow>
        <SettingRow title="Privacy Policy" text="What we collect, who can see it, and your rights under the Data Privacy Act.">
          <button className="btn btn-secondary" onClick={() => setLegal("privacy")}>
            Read
          </button>
        </SettingRow>
        <SettingRow title="About NurSet" text="Version 0.1.0 · PostgreSQL database">
          <span className="badge badge--blue">v0.1.0</span>
        </SettingRow>
      </div>
      {legal && <LegalModal kind={legal} onClose={() => setLegal(null)} onSwitch={setLegal} />}
    </div>
  );
}
