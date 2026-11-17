import { Check } from "lucide-react";
import Modal from "../../../components/Modal/Modal";
import { formatTimeRange, parseDate, shortMonth } from "../../../lib/format";
import type { Duty } from "../../../lib/types";

interface Props {
  duties: Duty[];
  currentId?: number;
  onPick: (duty: Duty) => void;
  onClose: () => void;
}

export default function ChangeDutyModal({ duties, currentId, onPick, onClose }: Props) {
  return (
    <Modal open onClose={onClose} eyebrow="Scheduled duties" title="Change Duty" width={460}>
      {duties.length === 0 ? (
        <p className="empty-text">No upcoming duties.</p>
      ) : (
        <ul className="prep-duty-picker" role="listbox" aria-label="Scheduled duties">
          {duties.map((d) => {
            const current = d.id === currentId;
            return (
              <li key={d.id} role="option" aria-selected={current}>
                <button className={current ? "is-current" : ""} onClick={() => onPick(d)}>
                  <span className="prep-duty-tile">
                    <strong>{parseDate(d.dutyDate).getDate()}</strong>
                    <span>{shortMonth(d.dutyDate)}</span>
                  </span>
                  <span className="prep-duty-picker-text">
                    <strong>{d.area}</strong>
                    <span>
                      {formatTimeRange(d.startTime, d.endTime).replace(" - ", "-")} • {d.hospital}
                    </span>
                  </span>
                  {current && <Check size={18} className="prep-duty-picker-check" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
