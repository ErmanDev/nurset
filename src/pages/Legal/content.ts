// Terms of Use and Privacy Policy shown in the app (Register, Settings › Help).
//
// TODO before release: replace the bracketed placeholders in LEGAL with the
// real operator name, address, and contact email, and have both documents
// reviewed by a lawyer familiar with the Philippine Data Privacy Act.

export const LEGAL = {
  app: "NurSet",
  operator: "[Operator legal name]",
  address: "[Business address]",
  contactEmail: "[contact email]",
  dpoEmail: "[Data Protection Officer email]",
  effectiveDate: "November 17, 2026",
};

export type Block = string | { list: string[] };

export interface LegalSection {
  heading: string;
  body: Block[];
}

export interface LegalDoc {
  title: string;
  intro: string;
  sections: LegalSection[];
}

const { app, operator, address, contactEmail, dpoEmail } = LEGAL;

export const TERMS: LegalDoc = {
  title: "Terms of Use",
  intro: `These Terms of Use ("Terms") govern your use of ${app}, a clinical duty companion for nursing students and clinical instructors, operated by ${operator} ("we", "us"). By creating an account or using ${app}, you agree to these Terms and to our Privacy Policy. If you don't agree, please don't use ${app}.`,
  sections: [
    {
      heading: "1. Who can use NurSet",
      body: [
        `${app} is for nursing students and clinical instructors. You must be at least 18 years old, or have the consent of a parent or guardian, to create an account.`,
        "Student accounts are created by signing up in the app. Clinical instructor accounts are created by an administrator of your school or of NurSet and may only be used by the instructor they were issued to.",
      ],
    },
    {
      heading: "2. Your account",
      body: [
        {
          list: [
            "Give accurate information (name, email, school, year level, and student ID if you provide one) and keep it up to date.",
            "Keep your password private. You are responsible for activity on your account.",
            "Sign out on shared computers, and use Settings › Privacy & Security to sign out devices you don't recognize.",
            "Tell us right away if you believe someone else has accessed your account.",
          ],
        },
      ],
    },
    {
      heading: "3. Patient confidentiality",
      body: [
        `${app} is not a medical records system. Never enter or upload information that identifies a patient — names, hospital numbers, photos, addresses, birthdates, or any detail that could reveal who a patient is — in tasks, notes, checklists, documents, study materials, or chats.`,
        "Case write-ups, drug studies, and care plans must be fully de-identified, following the Data Privacy Act of 2012, your school's policies, and the policies of your clinical affiliation hospital. We may remove content that appears to contain patient information.",
      ],
    },
    {
      heading: "4. Not medical advice",
      body: [
        `${app} helps you organize duties and review for exams. Study content, quizzes, checklists, and any AI-assisted features are educational only and may be incomplete or wrong. They are not medical advice and must never replace the instructions of your clinical instructor, the orders of a physician, hospital protocols, or current nursing references.`,
        "Always verify drug doses, procedures, and clinical decisions with authoritative sources and your supervising staff.",
      ],
    },
    {
      heading: "5. Clinical groups and instructors",
      body: [
        "When a clinical instructor adds you to a group, they can see the information described in our Privacy Policy (for example your name, duty schedule, readiness checks, documents you submit, attendance, evaluations, and confirmed hours) so they can supervise your clinical rotation.",
        "Clinical instructors agree to use student information only for teaching, supervision, and evaluation, to keep it confidential, and to follow their school's policies. Evaluations and confirmed hours recorded in NurSet don't replace your school's official records unless your school says so.",
      ],
    },
    {
      heading: "6. Acceptable use",
      body: [
        "You agree not to:",
        {
          list: [
            "upload content you don't have the right to share, or that is unlawful, harassing, or discriminatory;",
            "use NurSet to cheat on graded work or exams, or to falsify duties, attendance, documents, or hours;",
            "access another person's account or data, or try to get around security or access controls;",
            "upload malware, or disrupt, overload, scrape, or reverse-engineer the service;",
            "use NurSet for any purpose other than its intended educational and clinical-coordination use.",
          ],
        },
      ],
    },
    {
      heading: "7. Your content",
      body: [
        "You keep ownership of what you add to NurSet — tasks, notes, documents, materials, and messages. You give us a limited permission to store, process, and display that content only to run NurSet for you and the people you share it with (such as your clinical instructor or, for materials you choose to share, your classmates).",
        "You are responsible for your content and for having the rights to upload it.",
      ],
    },
    {
      heading: "8. Premium",
      body: [
        "Premium features and prices shown in the app are currently a preview. No payment is collected and no charge is made in this version. If paid plans are introduced, the price, billing period, renewal, and refund terms will be shown before you buy, and you'll be asked to agree to them.",
      ],
    },
    {
      heading: "9. Availability and changes to the service",
      body: [
        `We work to keep ${app} available and your data safe, but the service is provided "as is" and "as available". Features may change, and the service may occasionally be unavailable for maintenance or reasons outside our control. Keep your own copies of important files; you can export your data from Settings › Privacy & Security.`,
      ],
    },
    {
      heading: "10. Suspension and deleting your account",
      body: [
        "You can delete your account at any time in Settings › Privacy & Security. We may suspend or close accounts that break these Terms, put patients or other users at risk, or are required to be closed by law.",
      ],
    },
    {
      heading: "11. Limitation of liability",
      body: [
        "To the extent allowed by law, we are not liable for indirect or consequential losses, for missed duties, deadlines, or grades, or for decisions made based on content in NurSet. Nothing in these Terms limits liability that cannot be limited under Philippine law.",
      ],
    },
    {
      heading: "12. Changes to these Terms",
      body: [
        "We may update these Terms. If a change is significant, we'll tell you in the app before it takes effect. Continuing to use NurSet after the effective date means you accept the updated Terms.",
      ],
    },
    {
      heading: "13. Governing law and contact",
      body: [
        "These Terms are governed by the laws of the Republic of the Philippines.",
        `Questions? Contact ${operator}, ${address}, at ${contactEmail}.`,
      ],
    },
  ],
};

export const PRIVACY: LegalDoc = {
  title: "Privacy Policy",
  intro: `This Privacy Policy explains how ${operator} ("we", "us") collects, uses, shares, and protects personal information in ${app}, in line with the Data Privacy Act of 2012 (Republic Act No. 10173), its Implementing Rules and Regulations, and issuances of the National Privacy Commission (NPC).`,
  sections: [
    {
      heading: "1. Information we collect",
      body: [
        "Information you give us:",
        {
          list: [
            "Account details: full name, display name, email address, school, nursing year level, student ID (optional), and profile picture (optional). Clinical instructor accounts also include role and school.",
            "Your password, which we store only as a one-way bcrypt hash — we never see or keep the password itself.",
            "Clinical and study records you add: duties and schedule events, tasks, requirements, duty checklists and readiness checks, CI notes, uploaded documents and study materials, quizzes and answers, and messages you type in AI Study chat.",
            "Settings and preferences, such as appearance, notification choices, and quiet hours.",
          ],
        },
        "Information created when you use NurSet:",
        {
          list: [
            "Sign-in sessions: the device name and operating system, sign-in time, and last activity, so you can review and sign out devices. Session tokens are stored only as secure hashes.",
            "Activity used for features such as your study streak and progress, and which notifications you have read.",
            "Records added by your clinical instructor: group membership, duty assignments, attendance, document reviews and feedback, evaluations, and confirmed hours.",
          ],
        },
        "We do not intentionally collect sensitive personal information such as health records. Please do not upload patient information (see Terms of Use, section 3).",
      ],
    },
    {
      heading: "2. How we use your information",
      body: [
        {
          list: [
            "To create and secure your account and keep you signed in.",
            "To provide NurSet's features: your schedule, tasks, requirements, checklists, notes, study tools, progress, and notifications.",
            "To let clinical instructors supervise and evaluate the students in their groups.",
            "To respond to your questions and support requests.",
            "To keep NurSet safe, prevent misuse, and fix problems.",
            "To comply with legal obligations.",
          ],
        },
        "We process your information based on your consent, the performance of our agreement with you (the Terms of Use), our legitimate interest in running a secure service, and compliance with law. We do not sell your personal information and we do not use it for advertising.",
      ],
    },
    {
      heading: "3. Who can see your information",
      body: [
        {
          list: [
            "Your clinical instructor: if you are in their group, they can see your name, email, student ID, school details, duty schedule, readiness checks, requirements and the documents you submit to them, and they record attendance, reviews, evaluations, and confirmed hours.",
            "Students in your instructor's groups: they see announcements and instructions your instructor posts, not your personal records.",
            "Classmates: only study materials you deliberately share to the Learning Hub.",
            "Service providers who host our database and servers (for example, a cloud hosting provider), under contracts that require them to protect the data and use it only to provide their service.",
            "Google, which processes AI Study chat messages and Quizlab topics and notes through the Gemini API (see section 9).",
            "Authorities, when required by law, court order, or to protect the rights and safety of users or others.",
          ],
        },
      ],
    },
    {
      heading: "4. Where your data is stored",
      body: [
        "Your account, records, and uploaded files are stored in NurSet's database on our hosting provider (Render), in its Singapore region. The desktop app connects to it over an encrypted (HTTPS) connection. Where data is processed outside the Philippines, we make sure it receives protection comparable to the Data Privacy Act. If we change hosting providers or regions, we will update this policy.",
      ],
    },
    {
      heading: "5. How long we keep it",
      body: [
        "We keep your information while your account is active. When you delete your account in Settings › Privacy & Security, your account and the records linked to it are deleted, including files NurSet stored on that computer. Sign-in history is kept for a limited period for security. Some information may be kept longer where the law requires it.",
      ],
    },
    {
      heading: "6. How we protect it",
      body: [
        "We use reasonable organizational, physical, and technical measures, including hashed passwords and session tokens, per-account separation of records in the database, encrypted connections to hosted databases, and the ability to review and end sign-in sessions. No system is perfectly secure; if a personal data breach occurs that is likely to put you at risk, we will notify you and the NPC as required by law.",
      ],
    },
    {
      heading: "7. Your rights",
      body: [
        "Under the Data Privacy Act you have the right to:",
        {
          list: [
            "be informed about how your data is processed;",
            "access your personal data — you can export a copy in Settings › Privacy & Security › Data Export;",
            "correct inaccurate data — most details can be edited in Settings › Account;",
            "object to processing, and withdraw consent where processing is based on it;",
            "have your data erased or blocked — you can delete your account in Settings;",
            "data portability, in a commonly used format (the export is JSON);",
            "be indemnified for damages caused by unlawful processing; and",
            "file a complaint with the National Privacy Commission (privacy.gov.ph).",
          ],
        },
        `To exercise a right that isn't available in the app, contact our Data Protection Officer at ${dpoEmail}.`,
      ],
    },
    {
      heading: "8. Age",
      body: [
        "NurSet is meant for college nursing students and instructors. If you are under 18, use NurSet only with the consent of a parent or guardian. If we learn we collected information from a minor without consent, we will delete it.",
      ],
    },
    {
      heading: "9. AI features",
      body: [
        "AI Study (a Premium feature) is powered by Google's Gemini API. When you send a chat message, that message and your recent chat messages are sent to Google to generate the reply. When you create a Quizlab quiz, the topic and any notes you add are sent to Google to write the questions. Only the name of an attached file is sent, not the file itself. Your name, email, and other account details are not included.",
        "NurSet currently uses Google's free Gemini tier, under which Google may use the content sent to it to improve its products. Do not type personal, sensitive, or patient information into AI Study chat. If we move to a paid tier or a different AI provider, we will update this policy.",
        "AI replies can be wrong. They are for studying only and are not medical advice.",
      ],
    },
    {
      heading: "10. Changes to this policy",
      body: [
        "We may update this Privacy Policy as NurSet changes. We'll show the new effective date and, for significant changes, notify you in the app.",
      ],
    },
    {
      heading: "11. Contact us",
      body: [`${operator}, ${address}. General questions: ${contactEmail}. Data Protection Officer: ${dpoEmail}.`],
    },
  ],
};
