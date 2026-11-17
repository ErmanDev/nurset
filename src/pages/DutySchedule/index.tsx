import { useMemo, useState } from "react";
import { api } from "../../lib/api";
import { todayIso } from "../../lib/format";
import { useAsync } from "../../hooks/useAsync";
import NextDutyCard from "../../components/NextDutyCard/NextDutyCard";
import UpcomingDuties from "./components/UpcomingDuties";
import DutySummary from "./components/DutySummary";
import DutyHistory from "./components/DutyHistory";
import DutyCalendar from "./components/DutyCalendar";
import MyEvents from "./components/MyEvents";
import AddScheduleModal, { type ScheduleKind } from "./components/AddScheduleModal";
import { isCompleted, toCalendarItems, upcomingAgenda } from "./schedule";
import "./DutySchedule.css";

const loadSchedule = async () => {
  const [duties, events] = await Promise.all([api.listDuties(), api.listEvents()]);
  return { duties, events };
};

interface ModalState {
  kind: ScheduleKind;
  date?: string;
}

export default function DutySchedule() {
  const { data, error, reload } = useAsync(loadSchedule);
  const [modal, setModal] = useState<ModalState | null>(null);

  const view = useMemo(() => {
    if (!data) return null;
    const today = todayIso();
    const upcoming = data.duties.filter((d) => !isCompleted(d, today)); // sorted by date already
    const completed = data.duties.filter((d) => isCompleted(d, today)).reverse(); // newest first
    return {
      upcoming,
      completed,
      calendarItems: toCalendarItems(data.duties, data.events),
      agenda: upcomingAgenda(data.duties, data.events),
    };
  }, [data]);

  return (
    <div className="schedule">
      <header className="page-header">
        <p className="eyebrow">Clinical organization</p>
        <h1>Duty Schedule</h1>
        <p>Organize and keep track of your clinical duties.</p>
      </header>

      {error && <div className="alert-error">Couldn't load your schedule: {error}</div>}

      {!view && !error && (
        <>
          <div className="skeleton" style={{ height: 200 }} />
          <div className="skeleton" style={{ height: 160 }} />
        </>
      )}

      {data && view && (
        <>
          <NextDutyCard duty={view.upcoming[0] ?? null} />

          <UpcomingDuties duties={view.upcoming} onAdd={() => setModal({ kind: "duty" })} />

          <DutySummary duties={data.duties} />

          <DutyHistory duties={view.completed} />

          <DutyCalendar
            items={view.calendarItems}
            onAdd={() => setModal({ kind: "exam" })}
            onSelectDate={(date) => setModal({ kind: "exam", date })}
          />

          <MyEvents items={view.agenda} onAdd={() => setModal({ kind: "exam" })} />
        </>
      )}

      <AddScheduleModal
        key={modal ? `${modal.kind}-${modal.date ?? ""}` : "closed"}
        open={modal !== null}
        initialKind={modal?.kind ?? "duty"}
        initialDate={modal?.date}
        onClose={() => setModal(null)}
        onSaved={() => {
          setModal(null);
          void reload();
        }}
      />
    </div>
  );
}
