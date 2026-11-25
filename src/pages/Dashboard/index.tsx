import { api } from "../../lib/api";
import { formatHeaderDate, greeting, todayIso } from "../../lib/format";
import { useAsync } from "../../hooks/useAsync";
import NextDutyCard from "../../components/NextDutyCard/NextDutyCard";
import UpcomingDeadlines from "./components/UpcomingDeadlines";
import TodaysTasks from "./components/TodaysTasks";
import DutyBagCard from "./components/DutyBagCard";
import WeeklyProgressCard from "./components/WeeklyProgressCard";
import CiReminderCard from "./components/CiReminderCard";
import AiStudyBanner from "./components/AiStudyBanner";
import GroupInvitations from "./components/GroupInvitations";
import { toast } from "../../components/Toast/Toast";
import "./Dashboard.css";

export default function Dashboard() {
  const { data, error, reload, setData } = useAsync(api.getDashboard);

  async function handleToggleTask(id: number, completed: boolean) {
    // Optimistic: flip the checkbox now, then refresh counts from the database.
    setData((d) =>
      d && {
        ...d,
        todaysTasks: d.todaysTasks.map((t) => (t.id === id ? { ...t, completed } : t)),
      },
    );
    try {
      await api.toggleTask(id, completed);
    } finally {
      await reload();
    }
  }

  async function handleAddTask(title: string) {
    await api.addTask({ title, dueDate: todayIso() });
    toast.created("Task added", `“${title.trim()}” is on today's list.`);
    await reload();
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <p className="eyebrow">{formatHeaderDate()}</p>
        <h1>
          {greeting()}
          {data?.profile ? `, ${data.profile.displayName}!` : "!"}
        </h1>
        <p className="dashboard-subtitle">Ready for your next duty?</p>
      </header>

      {error && <div className="alert-error">Couldn't load your dashboard: {error}</div>}

      <GroupInvitations onAccepted={() => void reload()} />

      {!data && !error ? (
        <DashboardSkeleton />
      ) : data ? (
        <>
          <div className="dashboard-grid">
            <div className="dashboard-col">
              <NextDutyCard duty={data.nextDuty} />
              <TodaysTasks
                tasks={data.todaysTasks}
                onToggle={handleToggleTask}
                onAdd={handleAddTask}
              />
            </div>

            <div className="dashboard-col">
              <UpcomingDeadlines deadlines={data.upcomingDeadlines} />
              <div className="dashboard-mini-grid">
                <DutyBagCard
                  checklist={data.dutyBag}
                  dutyDate={
                    data.nextDuty && data.dutyBag?.dutyId === data.nextDuty.id
                      ? data.nextDuty.dutyDate
                      : undefined
                  }
                />
                <WeeklyProgressCard progress={data.weeklyProgress} />
              </div>
              {data.ciReminder && <CiReminderCard note={data.ciReminder} />}
            </div>
          </div>

          <AiStudyBanner />
        </>
      ) : null}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="dashboard-grid">
      <div className="dashboard-col">
        <div className="skeleton" style={{ height: 200 }} />
        <div className="skeleton" style={{ height: 280 }} />
      </div>
      <div className="dashboard-col">
        <div className="skeleton" style={{ height: 200 }} />
        <div className="skeleton" style={{ height: 160 }} />
      </div>
    </div>
  );
}
