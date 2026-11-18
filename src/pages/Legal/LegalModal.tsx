import Modal from "../../components/Modal/Modal";
import { LEGAL, PRIVACY, TERMS, type LegalDoc } from "./content";
import "./Legal.css";

export type LegalKind = "terms" | "privacy";

const DOCS: Record<LegalKind, LegalDoc> = { terms: TERMS, privacy: PRIVACY };

/** Readable Terms of Use / Privacy Policy, opened from Register and Settings › Help. */
export default function LegalModal({
  kind,
  onClose,
  onSwitch,
}: {
  kind: LegalKind;
  onClose: () => void;
  /** Lets "Privacy Policy" links inside the Terms open the other document. */
  onSwitch?: (kind: LegalKind) => void;
}) {
  const doc = DOCS[kind];
  const other: LegalKind = kind === "terms" ? "privacy" : "terms";
  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={`${LEGAL.app} · Effective ${LEGAL.effectiveDate}`}
      title={doc.title}
      width={720}
      footer={
        <>
          {onSwitch && (
            <button className="btn btn-secondary" onClick={() => onSwitch(other)}>
              Read the {DOCS[other].title}
            </button>
          )}
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      <article className="legal">
        <p className="legal-intro">{doc.intro}</p>
        {doc.sections.map((s) => (
          <section key={s.heading}>
            <h3>{s.heading}</h3>
            {s.body.map((block, i) =>
              typeof block === "string" ? (
                <p key={i}>{block}</p>
              ) : (
                <ul key={i}>
                  {block.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ),
            )}
          </section>
        ))}
      </article>
    </Modal>
  );
}
