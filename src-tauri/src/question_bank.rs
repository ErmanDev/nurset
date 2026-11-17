//! Built-in practice questions used by Quizlab until real AI generation is
//! connected. `pick` selects questions for a topic and set of question types.

pub struct BankQuestion {
    pub kind: &'static str,
    /// Lowercase keywords matched against the quiz topic.
    pub tags: &'static [&'static str],
    pub prompt: &'static str,
    pub case_text: Option<&'static str>,
    /// Built-in diagram key rendered by the frontend (e.g. "heart:ra").
    pub image: Option<&'static str>,
    pub choices: &'static [&'static str],
    pub answer: usize,
    pub explanation: &'static str,
    pub hint: &'static str,
}

const AP: &[&str] = &["anatomy", "physiology", "a&p"];
const CARDIO: &[&str] = &["anatomy", "physiology", "a&p", "cardio", "heart", "cardiovascular"];
const VITALS: &[&str] = &["vital", "vital signs", "assessment", "fundamentals"];
const PHARM: &[&str] = &["pharmacology", "pharma", "drug", "medication"];
const FUND: &[&str] = &["fundamentals", "fundamental", "nursing", "safety"];
const MEDSURG: &[&str] = &["medical", "surgical", "med-surg", "cardio", "pathophysiology", "nursing"];

const HEART_CHAMBERS: &[&str] = &["Right atrium", "Right ventricle", "Left atrium", "Left ventricle"];

macro_rules! q {
    ($kind:expr, $tags:expr, $prompt:expr, [$($c:expr),+], $answer:expr, $expl:expr, $hint:expr) => {
        BankQuestion { kind: $kind, tags: $tags, prompt: $prompt, case_text: None, image: None,
            choices: &[$($c),+], answer: $answer, explanation: $expl, hint: $hint }
    };
}

pub const BANK: &[BankQuestion] = &[
    // ---------- multiple choice ----------
    q!("multiple_choice", CARDIO, "Which organ pumps blood throughout the human body?",
        ["Lungs", "Heart", "Kidneys", "Liver"], 1,
        "The heart's ventricles contract to move blood through the pulmonary and systemic circulations.",
        "Think of the muscular organ in the middle of the chest."),
    q!("multiple_choice", CARDIO, "Which blood vessels carry blood away from the heart?",
        ["Veins", "Arteries", "Capillaries", "Venules"], 1,
        "Arteries carry blood away from the heart; veins return it.",
        "A for Arteries, A for Away."),
    q!("multiple_choice", AP, "Where does gas exchange take place in the lungs?",
        ["Bronchi", "Trachea", "Alveoli", "Pleura"], 2,
        "Oxygen and carbon dioxide diffuse across the thin walls of the alveoli and surrounding capillaries.",
        "Look for the tiny air sacs at the end of the airways."),
    q!("multiple_choice", AP, "Which part of the brain coordinates balance and posture?",
        ["Cerebrum", "Cerebellum", "Medulla oblongata", "Hypothalamus"], 1,
        "The cerebellum coordinates voluntary movement, balance, and posture.",
        "It sits at the back of the brain, below the cerebrum."),
    q!("multiple_choice", VITALS, "What is the normal resting respiratory rate for an adult?",
        ["6–10 breaths/min", "12–20 breaths/min", "22–30 breaths/min", "30–40 breaths/min"], 1,
        "A normal adult resting respiratory rate is about 12–20 breaths per minute.",
        "It is lower than a child's and higher than 10."),
    q!("multiple_choice", VITALS, "What is the normal resting heart rate for an adult?",
        ["40–60 bpm", "60–100 bpm", "100–140 bpm", "140–180 bpm"], 1,
        "A normal adult resting heart rate is 60–100 beats per minute.",
        "Below 60 is bradycardia; above 100 is tachycardia."),
    q!("multiple_choice", VITALS, "Which site is most commonly used to check an adult's pulse during routine vital signs?",
        ["Radial", "Pedal", "Popliteal", "Femoral"], 0,
        "The radial pulse at the wrist is the most accessible site for routine assessment.",
        "It's on the thumb side of the wrist."),
    q!("multiple_choice", VITALS, "Which instrument is used to measure blood pressure?",
        ["Sphygmomanometer", "Otoscope", "Pulse oximeter", "Glucometer"], 0,
        "A sphygmomanometer (BP cuff) is used with a stethoscope or automatically to measure blood pressure.",
        "It has an inflatable cuff."),
    q!("multiple_choice", PHARM, "Amoxicillin belongs to which drug class?",
        ["Cephalosporins", "Penicillins (beta-lactams)", "Macrolides", "Aminoglycosides"], 1,
        "Amoxicillin is an aminopenicillin, a beta-lactam antibiotic.",
        "Its name ends in -cillin."),
    q!("multiple_choice", PHARM, "What is the antidote for an opioid overdose?",
        ["Flumazenil", "Naloxone", "Atropine", "Protamine sulfate"], 1,
        "Naloxone is an opioid antagonist that reverses respiratory depression from opioids.",
        "Flumazenil is for benzodiazepines."),
    q!("multiple_choice", PHARM, "Which medication reverses the effects of heparin?",
        ["Vitamin K", "Protamine sulfate", "Naloxone", "Acetylcysteine"], 1,
        "Protamine sulfate binds heparin and neutralizes it. Vitamin K reverses warfarin.",
        "Vitamin K is for a different anticoagulant."),
    q!("multiple_choice", PHARM, "What is the antidote for acetaminophen (paracetamol) overdose?",
        ["Acetylcysteine", "Naloxone", "Flumazenil", "Digoxin immune fab"], 0,
        "Acetylcysteine restores glutathione and protects the liver after acetaminophen overdose.",
        "It is also used as a mucolytic."),
    q!("multiple_choice", FUND, "What is the single most effective way to prevent the spread of infection?",
        ["Wearing a mask", "Hand hygiene", "Wearing gloves", "Isolating every patient"], 1,
        "Hand hygiene is the most important measure for preventing healthcare-associated infections.",
        "You do it before and after every patient contact."),
    q!("multiple_choice", FUND, "Which of the following is NOT one of the traditional rights of medication administration?",
        ["Right patient", "Right route", "Right price", "Right time"], 2,
        "The rights include right patient, drug, dose, route, and time (plus documentation and others). Cost is not one of them.",
        "Which option has nothing to do with patient safety?"),

    // ---------- true or false ----------
    q!("true_false", CARDIO, "The heart pumps oxygen-poor blood to the lungs via the pulmonary arteries.",
        ["True", "False"], 0,
        "The right ventricle pumps deoxygenated blood through the pulmonary arteries to the lungs.",
        "Pulmonary arteries are the exception to 'arteries carry oxygenated blood'."),
    q!("true_false", CARDIO, "The left ventricle has a thicker muscular wall than the right ventricle.",
        ["True", "False"], 0,
        "The left ventricle pumps blood to the whole body, so it needs a thicker, stronger wall.",
        "Which side pumps against higher pressure?"),
    q!("true_false", AP, "The main function of red blood cells is to fight infection.",
        ["True", "False"], 1,
        "Red blood cells carry oxygen using hemoglobin; white blood cells fight infection.",
        "Think about hemoglobin."),
    q!("true_false", AP, "Insulin is produced by the beta cells of the pancreas.",
        ["True", "False"], 0,
        "Beta cells in the islets of Langerhans produce insulin; alpha cells produce glucagon.",
        "Alpha makes glucagon."),
    q!("true_false", VITALS, "An oral temperature is usually lower than a rectal temperature.",
        ["True", "False"], 0,
        "Rectal readings are typically about 0.5 °C (1 °F) higher than oral readings.",
        "Core readings run warmer."),
    q!("true_false", VITALS, "Pulse oximetry measures the oxygen saturation of hemoglobin.",
        ["True", "False"], 0,
        "A pulse oximeter estimates SpO₂, the percentage of hemoglobin saturated with oxygen.",
        "SpO₂ stands for peripheral oxygen saturation."),
    q!("true_false", PHARM, "Antibiotics are effective against viral infections such as the common cold.",
        ["True", "False"], 1,
        "Antibiotics act on bacteria and do not treat viral infections.",
        "The common cold is caused by a virus."),
    q!("true_false", PHARM, "The effect of warfarin is monitored using the INR.",
        ["True", "False"], 0,
        "Warfarin therapy is monitored with PT/INR; heparin is monitored with aPTT.",
        "Heparin uses a different test."),
    q!("true_false", FUND, "Wearing clean gloves removes the need for hand hygiene.",
        ["True", "False"], 1,
        "Hand hygiene is still required before putting on and after removing gloves.",
        "Gloves can have tiny defects and hands get contaminated during removal."),
    q!("true_false", FUND, "A patient's identity should be confirmed with at least two identifiers before giving medication.",
        ["True", "False"], 0,
        "Two identifiers (such as full name and date of birth) are required; room number is not an identifier.",
        "One identifier is not enough."),

    // ---------- identification ----------
    BankQuestion { kind: "identification", tags: CARDIO, prompt: "Identify the labeled structure in the image.",
        case_text: None, image: Some("heart:ra"), choices: HEART_CHAMBERS, answer: 0,
        explanation: "The right atrium receives deoxygenated blood from the superior and inferior vena cava.",
        hint: "Upper chamber on the patient's right side." },
    BankQuestion { kind: "identification", tags: CARDIO, prompt: "Identify the labeled structure in the image.",
        case_text: None, image: Some("heart:rv"), choices: HEART_CHAMBERS, answer: 1,
        explanation: "The right ventricle pumps deoxygenated blood into the pulmonary artery.",
        hint: "Lower chamber on the patient's right side." },
    BankQuestion { kind: "identification", tags: CARDIO, prompt: "Identify the labeled structure in the image.",
        case_text: None, image: Some("heart:la"), choices: HEART_CHAMBERS, answer: 2,
        explanation: "The left atrium receives oxygenated blood from the pulmonary veins.",
        hint: "Upper chamber on the patient's left side." },
    BankQuestion { kind: "identification", tags: CARDIO, prompt: "Identify the labeled structure in the image.",
        case_text: None, image: Some("heart:lv"), choices: HEART_CHAMBERS, answer: 3,
        explanation: "The left ventricle pumps oxygenated blood into the aorta and out to the body.",
        hint: "Lower chamber on the patient's left side, with the thickest wall." },
    q!("identification", CARDIO, "Identify the valve located between the left atrium and the left ventricle.",
        ["Tricuspid valve", "Mitral (bicuspid) valve", "Pulmonary valve", "Aortic valve"], 1,
        "The mitral (bicuspid) valve separates the left atrium and left ventricle.",
        "It has two cusps."),
    q!("identification", CARDIO, "Identify the largest artery in the human body.",
        ["Aorta", "Carotid artery", "Femoral artery", "Pulmonary artery"], 0,
        "The aorta carries oxygenated blood from the left ventricle to the systemic circulation.",
        "It leaves the left ventricle."),

    // ---------- case-based ----------
    BankQuestion { kind: "case_based", tags: MEDSURG,
        prompt: "What is the most likely diagnosis?",
        case_text: Some("A 62-year-old man arrives at the emergency room with crushing chest pain that started 30 minutes ago and radiates to his left arm. He is diaphoretic and anxious. BP 90/60 mmHg, HR 110 bpm, RR 24/min, SpO₂ 92% on room air. The ECG shows ST-segment elevation in leads II, III, and aVF."),
        image: None,
        choices: &["Stable angina pectoris", "Acute ST-elevation myocardial infarction (STEMI)", "Pulmonary embolism", "Pneumonia"],
        answer: 1,
        explanation: "Ischemic chest pain with ST elevation in contiguous leads (II, III, aVF = inferior wall) indicates an acute STEMI.",
        hint: "Focus on the ECG finding." },
    BankQuestion { kind: "case_based", tags: MEDSURG,
        prompt: "Which condition should the nurse suspect first?",
        case_text: Some("On post-operative day 2 after hip surgery, a patient who has mostly stayed in bed suddenly develops shortness of breath and sharp chest pain that worsens on inspiration. HR 118 bpm, RR 28/min, SpO₂ 88% on room air."),
        image: None,
        choices: &["Pneumonia", "Pulmonary embolism", "Asthma attack", "Anxiety"],
        answer: 1,
        explanation: "Recent surgery and immobility raise the risk of DVT; sudden dyspnea, pleuritic pain, tachycardia, and hypoxia suggest pulmonary embolism.",
        hint: "Consider the risk factors: surgery and immobility." },
    BankQuestion { kind: "case_based", tags: &["medical", "diabetes", "endocrine", "nursing", "fundamentals"],
        prompt: "What is the nurse's priority action?",
        case_text: Some("A patient with type 1 diabetes is shaky, sweaty, and slightly confused. Capillary blood glucose is 50 mg/dL (2.8 mmol/L). The patient is awake and able to swallow safely."),
        image: None,
        choices: &["Give 15 g of fast-acting carbohydrate", "Administer the scheduled insulin", "Withhold all food until the next meal", "Encourage the patient to exercise"],
        answer: 0,
        explanation: "For conscious hypoglycemic patients who can swallow, give 15 g of fast-acting carbohydrate and recheck glucose in 15 minutes (rule of 15).",
        hint: "Insulin would lower the glucose further." },
    BankQuestion { kind: "case_based", tags: FUND,
        prompt: "How should the nurse classify this finding?",
        case_text: Some("While turning an 80-year-old patient two days after hip surgery, the nurse finds a red area over the sacrum. The skin is intact and the redness does not blanch when pressed."),
        image: None,
        choices: &["Stage 1 pressure injury", "Stage 2 pressure injury", "Stage 3 pressure injury", "Unstageable pressure injury"],
        answer: 0,
        explanation: "Intact skin with non-blanchable erythema is a Stage 1 pressure injury.",
        hint: "Is the skin broken?" },
    BankQuestion { kind: "case_based", tags: MEDSURG,
        prompt: "What should the nurse do first?",
        case_text: Some("A patient with heart failure has gained 2 kg in two days. The nurse hears crackles in both lung bases and notes 2+ pitting edema in both ankles. The patient says it is harder to breathe when lying flat."),
        image: None,
        choices: &["Place the patient in high Fowler's position and notify the provider", "Encourage more oral fluids", "Lay the patient flat to rest", "Offer a high-sodium snack"],
        answer: 0,
        explanation: "These are signs of fluid overload. Sitting upright eases breathing; the provider should be notified for treatment such as diuretics.",
        hint: "Which option helps breathing right away?" },
];

/// Simple xorshift PRNG — enough to vary question order between quizzes.
pub struct Rng(u64);

impl Rng {
    pub fn new(seed: u64) -> Self {
        Self(seed.max(1))
    }

    fn next(&mut self) -> u64 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.0 = x;
        x
    }

    pub fn shuffle<T>(&mut self, items: &mut [T]) {
        for i in (1..items.len()).rev() {
            let j = (self.next() % (i as u64 + 1)) as usize;
            items.swap(i, j);
        }
    }
}

fn matches_topic(q: &BankQuestion, words: &[String]) -> bool {
    words.iter().any(|w| q.tags.iter().any(|t| t.contains(w.as_str()) || w.contains(t)))
}

/// Up to `count` questions of the given kinds, topic matches first, shuffled.
pub fn pick(kinds: &[String], topic: &str, count: usize, rng: &mut Rng) -> Vec<&'static BankQuestion> {
    let words: Vec<String> = topic
        .to_lowercase()
        .split(|c: char| !c.is_alphanumeric() && c != '&')
        .filter(|w| w.len() >= 3)
        .map(String::from)
        .collect();

    let (mut matching, mut others): (Vec<_>, Vec<_>) = BANK
        .iter()
        .filter(|q| kinds.iter().any(|k| k == q.kind))
        .partition(|q| matches_topic(q, &words));
    rng.shuffle(&mut matching);
    rng.shuffle(&mut others);
    matching.into_iter().chain(others).take(count).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn answers_are_in_range() {
        for q in BANK {
            assert!(q.answer < q.choices.len(), "bad answer index: {}", q.prompt);
        }
    }

    #[test]
    fn topic_matches_come_first() {
        let kinds = vec!["multiple_choice".to_string()];
        let picked = pick(&kinds, "Pharmacology", 4, &mut Rng::new(7));
        assert_eq!(picked.len(), 4);
        assert!(picked.iter().all(|q| q.tags.contains(&"pharmacology")));
    }

    #[test]
    fn caps_at_available_questions() {
        let kinds = vec!["case_based".to_string()];
        assert_eq!(pick(&kinds, "", 50, &mut Rng::new(1)).len(), 5);
    }
}
