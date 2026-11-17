import { Monitor } from "lucide-react";
import { SectionHeader } from "./shared";

export default function DevicesSection() {
  return (
    <div className="st-section">
      <SectionHeader title="Connected Devices" subtitle="Devices that can access your NurSet workspace." />
      <div className="st-device">
        <Monitor size={24} />
        <div>
          <strong>This computer</strong>
          <span>NurSet desktop app · Active now</span>
        </div>
        <span className="badge badge--green">Current device</span>
      </div>
      <p className="st-note">
        Syncing across devices needs a NurSet account, which isn't available yet. Use Privacy &amp; Security › Data
        Export to keep a backup copy.
      </p>
    </div>
  );
}
