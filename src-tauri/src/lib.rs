mod ai;
mod commands;
mod db;
mod error;
mod models;
mod question_bank;

#[cfg(test)]
mod integration_tests;
#[cfg(test)]
mod integration_tests_auth;
#[cfg(test)]
mod integration_tests_ci;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Local secrets (GEMINI_API_KEY, DATABASE_URL) from a git-ignored .env, if present.
            let _ = dotenvy::dotenv();
            // PostgreSQL: DATABASE_URL, or the local Docker database (pnpm db:up).
            let url = std::env::var("DATABASE_URL")
                .unwrap_or_else(|_| db::DEFAULT_DATABASE_URL.to_string());
            let database = tauri::async_runtime::block_on(async { db::Db::connect_lazy(&url) })?;
            app.manage(database);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::auth::register,
            commands::auth::sign_in,
            commands::auth::sign_out,
            commands::auth::current_session,
            commands::auth::change_password,
            commands::auth::get_security,
            commands::auth::end_sessions,
            commands::instructor::get_ci_dashboard,
            commands::instructor::list_groups,
            commands::instructor::get_group,
            commands::instructor::create_group,
            commands::instructor::update_group,
            commands::instructor::delete_group,
            commands::instructor::add_group_member,
            commands::instructor::remove_group_member,
            commands::instructor::list_my_students,
            commands::ci_assignments::list_duty_assignments,
            commands::ci_assignments::create_duty_assignment,
            commands::ci_assignments::update_duty_assignment,
            commands::ci_assignments::delete_duty_assignment,
            commands::ci_assignments::list_requirement_assignments,
            commands::ci_assignments::create_requirement_assignment,
            commands::ci_assignments::delete_requirement_assignment,
            commands::ci_reviews::list_reviews,
            commands::ci_reviews::review_document,
            commands::ci_reviews::open_review_document,
            commands::ci_instructions::list_instructions,
            commands::ci_instructions::create_instruction,
            commands::ci_instructions::delete_instruction,
            commands::ci_duty_day::get_duty_day,
            commands::ci_duty_day::set_attendance,
            commands::ci_duty_day::get_evaluations,
            commands::ci_duty_day::save_evaluation,
            commands::ci_announcements::list_ci_announcements,
            commands::ci_announcements::create_announcement,
            commands::ci_announcements::delete_announcement,
            commands::dashboard::get_dashboard,
            commands::notifications::list_notifications,
            commands::notifications::mark_notifications_read,
            commands::profile::get_profile,
            commands::progress::get_progress,
            commands::settings::get_settings,
            commands::settings::set_settings,
            commands::settings::update_profile,
            commands::settings::set_avatar,
            commands::settings::export_data,
            commands::settings::reset_all_data,
            commands::settings::list_receipts,
            commands::settings::activate_premium,
            commands::settings::cancel_premium,
            commands::duties::list_duties,
            commands::duties::add_duty,
            commands::events::list_events,
            commands::events::add_event,
            commands::requirements::list_requirements,
            commands::requirements::add_requirement,
            commands::documents::list_documents,
            commands::documents::upload_document,
            commands::documents::open_document,
            commands::tasks::list_tasks,
            commands::tasks::add_task,
            commands::tasks::update_task,
            commands::tasks::delete_task,
            commands::tasks::toggle_task,
            commands::checklists::list_checklists,
            commands::checklists::list_checklist_items,
            commands::duty_checklist::get_duty_prep,
            commands::duty_checklist::get_rotation_checklist,
            commands::duty_checklist::add_checklist_item,
            commands::duty_checklist::toggle_checklist_item,
            commands::duty_checklist::delete_checklist_item,
            commands::duty_checklist::set_duty_readiness,
            commands::ci_notes::list_ci_notes,
            commands::ci_notes::add_ci_note,
            commands::ci_notes::update_ci_note,
            commands::ci_notes::set_ci_note_pinned,
            commands::ci_notes::delete_ci_note,
            commands::quick_links::list_quick_links,
            commands::quick_links::list_materials,
            commands::quick_links::upload_material,
            commands::quick_links::update_material,
            commands::quick_links::delete_material,
            commands::quick_links::set_material_bookmark,
            commands::quick_links::open_material,
            commands::quick_links::get_handbook,
            commands::quick_links::list_announcements,
            commands::quick_links::get_study_journey,
            commands::ai_study::list_study_activity,
            commands::ai_study::list_quizzes,
            commands::ai_study::create_quiz,
            commands::ai_study::get_quiz,
            commands::ai_study::answer_question,
            commands::ai_study::finish_quiz,
            commands::ai_study::restart_quiz,
            commands::ai_study::get_quiz_feedback,
            commands::ai_study::list_chat_messages,
            commands::ai_study::send_chat_message,
            commands::ai_study::clear_chat,
        ])
        .run(tauri::generate_context!())
        .expect("error while running NurSet");
}
