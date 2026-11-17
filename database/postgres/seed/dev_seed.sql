-- Development sample data — NEVER run against production.
-- Creates a demo student (no password; sign-in isn't wired yet) plus shared
-- library content. Re-runnable: the demo user is recreated each time.
-- Dates are relative to today, like the desktop app's sample data.

DELETE FROM users WHERE email = 'demo@nurset.local';

DO $$
DECLARE
    uid       BIGINT;
    ward_id   BIGINT;
    er_id     BIGINT;
    bag_id    BIGINT;
    rot_id    BIGINT;
    req_ncp   BIGINT;
BEGIN
    INSERT INTO users (email, full_name, display_name, university, student_id, year_level)
    VALUES ('demo@nurset.local', 'Regiel Andrea C. Cagol', 'Regiel', 'Central Mindanao University', '000-000', '4th Year')
    RETURNING id INTO uid;

    INSERT INTO user_settings (user_id, key, value)
    VALUES (uid, 'theme', 'light'), (uid, 'accent', 'blue'), (uid, 'study_daily_goal', '3');

    -- Duties
    INSERT INTO duties (user_id, area, hospital, location, duty_date, start_time, end_time, clinical_instructor, notes)
    VALUES (uid, 'Medical Ward', 'Sanitarium Medical Center', '3rd Floor - Medical Ward', CURRENT_DATE + 1,
            '07:00', '15:00', 'CI Angela Reyes, RN', 'Assist with supervised patient care and documentation.')
    RETURNING id INTO ward_id;
    INSERT INTO duties (user_id, area, hospital, location, duty_date, start_time, end_time, clinical_instructor)
    VALUES (uid, 'Emergency Room', 'Sanitarium Medical Center', 'Ground Floor - ER', CURRENT_DATE + 4,
            '15:00', '23:00', 'CI Miguel Santos, RN')
    RETURNING id INTO er_id;
    INSERT INTO duties (user_id, area, hospital, location, duty_date, start_time, end_time, clinical_instructor)
    VALUES (uid, 'Community Health', 'Community Health Center', 'Barangay San Isidro', CURRENT_DATE - 7,
            '08:00', '16:00', 'CI Lola Mendoza, RN');

    INSERT INTO events (user_id, title, event_type, event_date, start_time, location, description)
    VALUES (uid, 'Nursing Exam', 'exam', CURRENT_DATE + 10, '09:00', 'School / Examination Room',
            'Review the required topics and bring your examination materials.');

    -- Requirements + a submitted document
    INSERT INTO requirements (user_id, title, due_date, color)
    VALUES (uid, 'Nursing Care Plan', CURRENT_DATE + 1, 'red') RETURNING id INTO req_ncp;
    INSERT INTO requirements (user_id, title, due_date, color)
    VALUES (uid, 'Drug Study', CURRENT_DATE + 2, 'amber'), (uid, 'Workbook', CURRENT_DATE + 4, 'blue');

    INSERT INTO documents (user_id, requirement_id, title, document_type, file_name, status, submitted_at)
    VALUES (uid, req_ncp, 'Nursing Care Plan - Week 1', 'Nursing Care Plan', 'Nursing Care Plan - Week 1.pdf',
            'under_review', now() - interval '2 days');

    -- Tasks
    INSERT INTO tasks (user_id, title, category, priority, subject, due_date, due_time)
    VALUES (uid, 'Complete Nursing Care Plan', 'Requirement', 'high', 'Medical-Surgical Nursing', CURRENT_DATE, '20:00'),
           (uid, 'Review Cardiovascular System', 'Study', 'medium', 'Anatomy & Physiology', CURRENT_DATE, '19:00'),
           (uid, 'Complete Workbook Activity', 'Academic', 'low', 'Community Health Nursing', CURRENT_DATE + 3, NULL);
    INSERT INTO tasks (user_id, title, category, priority, due_date, completed, completed_at)
    VALUES (uid, 'Print patient assessment form', 'Clinical', 'low', CURRENT_DATE, true, now());

    -- Duty checklist
    INSERT INTO checklists (user_id, name, kind, duty_id)
    VALUES (uid, 'Duty Bag Checklist', 'bag', ward_id) RETURNING id INTO bag_id;
    INSERT INTO checklist_items (checklist_id, label, checked, position)
    SELECT bag_id, label, ord <= 3, ord
    FROM unnest(ARRAY['School / Clinical ID', 'Duty Uniform', 'Watch', 'Stethoscope', 'Penlight'])
         WITH ORDINALITY AS t(label, ord);

    INSERT INTO checklists (user_id, name, kind, area)
    VALUES (uid, 'Rotation Checklist', 'rotation', 'Medical Ward') RETURNING id INTO rot_id;
    INSERT INTO checklist_items (checklist_id, label, checked, position)
    VALUES (rot_id, 'Review assigned topics', true, 0), (rot_id, 'Review CI instructions', false, 1);

    INSERT INTO duty_readiness (duty_id, item_key, checked)
    VALUES (ward_id, 'schedule', true), (ward_id, 'requirements', true);

    -- CI notes
    INSERT INTO ci_notes (user_id, title, content, clinical_instructor, clinical_area, note_date, is_important, is_pinned, duty_id)
    VALUES (uid, 'Important Reminder', 'Review the assigned topic and check the required materials before duty.',
            'CI Angela Reyes, RN', 'Medical Ward', CURRENT_DATE, true, true, ward_id),
           (uid, 'ER Requirements', 'Check your assigned requirements and prepare the necessary materials.',
            'CI Miguel Santos, RN', 'Emergency Room (ER)', CURRENT_DATE - 1, false, false, er_id);

    INSERT INTO study_activity (user_id, title, subtitle, kind, link)
    VALUES (uid, 'Pharmacology Review', 'Study: Antibiotics (Beta-lactams)', 'review', '/ai-study/chat');
END $$;

-- Shared content (only if empty)
INSERT INTO announcements (category, title, body, posted_at)
SELECT * FROM (VALUES
    ('important', 'Clinical Duty Schedule Update',
     'Please check your assigned clinical duty schedule for the latest updates from your clinical instructor.', CURRENT_DATE),
    ('academic', 'Nursing Skills Laboratory Orientation',
     'Students assigned to the skills laboratory should review the orientation reminders and prepare their required materials.', CURRENT_DATE - 3),
    ('reminder', 'Complete Your Clinical Requirements',
     'Review your outstanding documents and submit any missing requirements before your department''s stated deadline.', CURRENT_DATE - 5)
) AS v(category, title, body, posted_at)
WHERE NOT EXISTS (SELECT 1 FROM announcements);

INSERT INTO materials (owner_id, title, description, kind, page_count, tone, is_sample)
SELECT NULL, v.title, v.description, v.kind, v.pages, v.tone, true FROM (VALUES
    ('Fundamentals of Nursing', 'Essential nursing concepts, patient care basics, and clinical foundations.', 'pdf_notes', 24, 'pink'),
    ('Pharmacology Essentials', 'Drug classifications, medication safety, and dosage calculations.', 'pdf_notes', 32, 'green'),
    ('Nursing Presentations', 'Presentation materials for nursing concepts and classroom discussions.', 'presentation', 18, 'purple')
) AS v(title, description, kind, pages, tone)
WHERE NOT EXISTS (SELECT 1 FROM materials WHERE owner_id IS NULL);

-- ---------------------------------------------------------------------------
-- Clinical instructor + classmates (requires migration 0002)
-- Sign in as ci.reyes@nurset.local to see the instructor side.
-- ---------------------------------------------------------------------------
DELETE FROM users WHERE email IN (
    'ci.reyes@nurset.local', 'juan.delacruz@nurset.local', 'maria.santos@nurset.local',
    'paolo.garcia@nurset.local', 'andrea.lim@nurset.local');

DO $$
DECLARE
    ci      BIGINT;
    demo    BIGINT := (SELECT id FROM users WHERE email = 'demo@nurset.local');
    g1      BIGINT;
    g2      BIGINT;
    s       RECORD;
    sid     BIGINT;
    did     BIGINT;
    rid     BIGINT;
BEGIN
    INSERT INTO users (email, full_name, display_name, role, account_type, university)
    VALUES ('ci.reyes@nurset.local', 'Angela Reyes, RN', 'CI Angela', 'Clinical Instructor',
            'clinical_instructor', 'Central Mindanao University')
    RETURNING id INTO ci;

    INSERT INTO clinical_groups (instructor_id, name, area, hospital, term, color)
    VALUES (ci, 'BSN 4-A · Group 1', 'Medical Ward', 'Sanitarium Medical Center', '1st Sem 2026-2027', 'blue')
    RETURNING id INTO g1;
    INSERT INTO clinical_groups (instructor_id, name, area, hospital, term, color)
    VALUES (ci, 'BSN 4-A · Group 2', 'Emergency Room', 'Sanitarium Medical Center', '1st Sem 2026-2027', 'green')
    RETURNING id INTO g2;

    IF demo IS NOT NULL THEN
        INSERT INTO group_members (group_id, student_id) VALUES (g1, demo);
    END IF;

    -- (email, name, display, student no., group, duty offset, area, ready checks, doc status, overdue?)
    FOR s IN SELECT * FROM (VALUES
        ('juan.delacruz@nurset.local', 'Juan Dela Cruz', 'Juan', '2023-0142', 1, 1, 'Medical Ward', 4, 'pending', false),
        ('maria.santos@nurset.local', 'Maria Santos', 'Maria', '2023-0188', 1, 1, 'Medical Ward', 1, 'needs_revision', true),
        ('paolo.garcia@nurset.local', 'Paolo Garcia', 'Paolo', '2023-0201', 2, 0, 'Emergency Room', 2, 'under_review', false),
        ('andrea.lim@nurset.local', 'Andrea Lim', 'Andrea', '2023-0217', 2, 0, 'Emergency Room', 4, 'approved', false)
    ) AS v(email, full_name, display_name, student_no, grp, duty_offset, area, ready, doc_status, overdue)
    LOOP
        INSERT INTO users (email, full_name, display_name, student_id, year_level, university)
        VALUES (s.email, s.full_name, s.display_name, s.student_no, '4th Year', 'Central Mindanao University')
        RETURNING id INTO sid;
        INSERT INTO group_members (group_id, student_id) VALUES (CASE s.grp WHEN 1 THEN g1 ELSE g2 END, sid);

        INSERT INTO duties (user_id, area, hospital, duty_date, start_time, end_time, clinical_instructor)
        VALUES (sid, s.area, 'Sanitarium Medical Center', CURRENT_DATE + s.duty_offset,
                CASE WHEN s.grp = 1 THEN TIME '07:00' ELSE TIME '15:00' END,
                CASE WHEN s.grp = 1 THEN TIME '15:00' ELSE TIME '23:00' END, 'Angela Reyes, RN')
        RETURNING id INTO did;
        INSERT INTO duty_readiness (duty_id, item_key, checked)
        SELECT did, k, true FROM unnest((ARRAY['schedule', 'requirements', 'bag', 'ci'])[1:s.ready]) AS k;

        INSERT INTO requirements (user_id, title, due_date, color)
        VALUES (sid, 'Drug Study', CURRENT_DATE + 2, 'amber') RETURNING id INTO rid;
        INSERT INTO requirements (user_id, title, due_date, color)
        VALUES (sid, 'Nursing Care Plan', CURRENT_DATE + 5, 'red');
        INSERT INTO documents (user_id, requirement_id, title, document_type, file_name, status, submitted_at, feedback, feedback_at)
        VALUES (sid, rid, 'Drug Study - Paracetamol', 'Drug Study', 'Drug Study - Paracetamol.pdf', s.doc_status,
                now() - interval '1 day',
                CASE WHEN s.doc_status = 'needs_revision' THEN 'Add the nursing responsibilities section.' END,
                CASE WHEN s.doc_status = 'needs_revision' THEN now() END);

        IF s.overdue THEN
            INSERT INTO tasks (user_id, title, category, priority, due_date)
            VALUES (sid, 'Submit case study reflection', 'Requirement', 'high', CURRENT_DATE - 2);
        END IF;
    END LOOP;
END $$;
