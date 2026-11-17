import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { BriefcaseMedical, Hospital, Plus } from "lucide-react";
import { api } from "../../lib/api";
import { todayIso } from "../../lib/format";
import type { ChecklistDetail, ChecklistItem, DutyPrep, ReadinessKey } from "../../lib/types";
import { SelectField } from "../../components/TextField/TextField";
import PreparingBanner from "./components/PreparingBanner";
import ChecklistCard from "./components/ChecklistCard";
import ChecklistItems from "./components/ChecklistItems";
import PrepProgress from "./components/PrepProgress";
import RequirementsToBring from "./components/RequirementsToBring";
import CiReminderPanel from "./components/CiReminderPanel";
import BeforeYouGo from "./components/BeforeYouGo";
import ChangeDutyModal from "./components/ChangeDutyModal";
import AddChecklistItemModal, { type ChecklistCategory } from "./components/AddChecklistItemModal";
import "./DutyChecklist.css";

type ListSetter = (fn: (c: ChecklistDetail) => ChecklistDetail) => void;

export default function DutyChecklist() {
  // ?duty=<id> picks a specific duty; otherwise the next upcoming one is used.
  const [params, setParams] = useSearchParams();
  const dutyParam = params.get("duty");
  const dutyId = dutyParam ? Number(dutyParam) : undefined;

  const [prep, setPrep] = useState<DutyPrep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [area, setArea] = useState("");
  const [rotation, setRotation] = useState<ChecklistDetail | null>(null);
  const [changing, setChanging] = useState(false);
  const [addCategory, setAddCategory] = useState<ChecklistCategory | null>(null);

  const loadPrep = useCallback(async () => {
    try {
      const data = await api.getDutyPrep(dutyId);
      setPrep(data);
      setError(null);
      // Default the rotation to the duty's ward/area.
      setArea((current) => current || data.duty?.area || data.rotationAreas[0] || "");
    } catch (err) {
      setError(String(err));
    }
  }, [dutyId]);

  useEffect(() => {
    void loadPrep();
  }, [loadPrep]);

  useEffect(() => {
    if (!area) return;
    let cancelled = false;
    api
      .getRotationChecklist(area)
      .then((c) => !cancelled && setRotation(c))
      .catch((err) => !cancelled && setError(String(err)));
    return () => {
      cancelled = true;
    };
  }, [area]);

  // ----- checklist mutations (optimistic, re-sync on failure) -----

  const setBag: ListSetter = (fn) => setPrep((p) => (p?.bag ? { ...p, bag: fn(p.bag) } : p));
  const setRot: ListSetter = (fn) => setRotation((c) => (c ? fn(c) : c));

  async function resync(err: unknown) {
    setError(String(err));
    await loadPrep();
    if (area) setRotation(await api.getRotationChecklist(area));
  }

  function itemHandlers(set: ListSetter) {
    return {
      onToggle: (item: ChecklistItem, checked: boolean) => {
        set((c) => ({ ...c, items: c.items.map((i) => (i.id === item.id ? { ...i, checked } : i)) }));
        api.toggleChecklistItem(item.id, checked).catch(resync);
      },
      onDelete: (item: ChecklistItem) => {
        set((c) => ({ ...c, items: c.items.filter((i) => i.id !== item.id) }));
        api.deleteChecklistItem(item.id).catch(resync);
      },
    };
  }

  /** Save from the "Add Checklist Items" dialog to the list its category points at. */
  async function addItem(label: string, category: ChecklistCategory) {
    if (category === "requirement") {
      await api.addRequirement({ title: label, dueDate: prep?.duty?.dutyDate ?? todayIso() });
      await loadPrep(); // refresh "Requirements to Bring"
    } else if (category === "rotation") {
      if (!rotation) throw new Error("Choose a rotation first.");
      const item = await api.addChecklistItem(rotation.id, label);
      setRot((c) => ({ ...c, items: [...c.items, item] }));
    } else {
      // "Duty Bag" and "Other" both go on the duty's bag list.
      if (!prep?.bag) throw new Error("Select a duty first.");
      const item = await api.addChecklistItem(prep.bag.id, label);
      setBag((c) => ({ ...c, items: [...c.items, item] }));
    }
    setAddCategory(null);
  }

  function toggleReadiness(key: ReadinessKey, checked: boolean) {
    if (!prep?.duty) return;
    setPrep({ ...prep, readiness: prep.readiness.map((r) => (r.key === key ? { ...r, checked } : r)) });
    api.setDutyReadiness(prep.duty.id, key, checked).catch((err) => {
      setError(String(err));
      void loadPrep();
    });
  }

  const areaOptions = prep
    ? Array.from(new Set([...prep.rotationAreas, ...(area ? [area] : [])])).map((a) => ({ value: a, label: a }))
    : [];

  const unavailable: ChecklistCategory[] = [
    ...(prep?.bag ? [] : (["bag", "other"] as const)),
    ...(rotation ? [] : (["rotation"] as const)),
  ];

  return (
    <div className="prep">
      <header className="page-header">
        <p className="eyebrow">Plan your day</p>
        <h1>Duty Checklist</h1>
        <p>Make sure you're prepared before every clinical duty.</p>
      </header>

      {error && <div className="alert-error">{error}</div>}

      {!prep && !error && (
        <>
          <div className="skeleton" style={{ height: 150 }} />
          <div className="skeleton" style={{ height: 360 }} />
        </>
      )}

      {prep && (
        <>
          <PreparingBanner
            duty={prep.duty}
            canChange={prep.upcomingDuties.length > 0}
            onChange={() => setChanging(true)}
          />

          <div className="prep-grid">
            <div className="prep-col">
              {prep.bag && (
                <ChecklistCard
                  icon={BriefcaseMedical}
                  tone="blue"
                  eyebrow="What you plan to bring"
                  title="Duty Bag Checklist"
                  note="Your required materials may vary by school, clinical instructor, hospital, and assigned area. Customize this list for your duty."
                  action={
                    <button className="prep-add-pill" onClick={() => setAddCategory("bag")}>
                      <Plus size={15} /> Add Item
                    </button>
                  }
                >
                  <ChecklistItems
                    items={prep.bag.items}
                    doneText="Ready"
                    todoText="Not picked yet"
                    {...itemHandlers(setBag)}
                  />
                </ChecklistCard>
              )}

              <ChecklistCard
                icon={Hospital}
                tone="green"
                eyebrow="Custom preparation reminders"
                title="Rotation Checklist"
              >
                <SelectField
                  label="Current rotation"
                  options={areaOptions}
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                />
                {rotation && rotation.area === area && (
                  <>
                    <p className="prep-section-label">{area} preparation</p>
                    <ChecklistItems
                      items={rotation.items}
                      doneText="Done"
                      todoText="Customizable reminder"
                      footerAddLabel="Add preparation reminder"
                      onAddClick={() => setAddCategory("rotation")}
                      {...itemHandlers(setRot)}
                    />
                  </>
                )}
              </ChecklistCard>
            </div>

            <div className="prep-col">
              {prep.bag && <PrepProgress checklist={prep.bag} />}
              <RequirementsToBring items={prep.requirements} />
              {prep.ciReminder && <CiReminderPanel note={prep.ciReminder} />}
              {prep.duty && <BeforeYouGo readiness={prep.readiness} onToggle={toggleReadiness} />}
            </div>
          </div>
        </>
      )}

      {changing && prep && (
        <ChangeDutyModal
          duties={prep.upcomingDuties}
          currentId={prep.duty?.id}
          onClose={() => setChanging(false)}
          onPick={(duty) => {
            setChanging(false);
            setArea(duty.area);
            setParams({ duty: String(duty.id) });
          }}
        />
      )}

      {addCategory && (
        <AddChecklistItemModal
          initialCategory={addCategory}
          unavailable={unavailable}
          onClose={() => setAddCategory(null)}
          onSubmit={addItem}
        />
      )}
    </div>
  );
}
