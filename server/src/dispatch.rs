//! Maps command names (as the app calls them) to the command functions.
//! Add a line here for each new command (arguments use the app's camelCase names).

use serde::de::DeserializeOwned;
use serde::Serialize;
use serde_json::{Map, Value};

use crate::commands;
use crate::db::Db;
use crate::error::{AppError, AppResult};

/// One argument by its camelCase name; a missing optional argument is `None`.
fn arg<T: DeserializeOwned>(args: &mut Map<String, Value>, name: &str) -> AppResult<T> {
    let value = args.remove(name).unwrap_or(Value::Null);
    serde_json::from_value(value).map_err(|e| AppError::new(format!("Invalid \"{name}\": {e}")))
}

fn out<T: Serialize>(result: AppResult<T>) -> AppResult<Value> {
    result.and_then(|v| serde_json::to_value(v).map_err(AppError::from))
}

/// Number of commands available over `/api/rpc/<name>`.
pub const COMMAND_COUNT: usize = 98;

/// Error text for a command name that doesn't exist (sent as HTTP 404).
pub const UNKNOWN_COMMAND: &str = "Unknown command";

pub async fn call(db: &Db, name: &str, args: Value) -> AppResult<Value> {
    let mut a = match args {
        Value::Object(map) => map,
        _ => Map::new(),
    };
    match name {
        "register" => out(commands::auth::register(db, arg(&mut a, "input")?).await),
        "sign_in" => out(commands::auth::sign_in(db, arg(&mut a, "identifier")?, arg(&mut a, "password")?, arg(&mut a, "remember")?, arg(&mut a, "device")?).await),
        "sign_out" => out(commands::auth::sign_out(db).await),
        "current_session" => out(commands::auth::current_session(db).await),
        "change_password" => out(commands::auth::change_password(db, arg(&mut a, "current")?, arg(&mut a, "newPassword")?).await),
        "get_security" => out(commands::auth::get_security(db).await),
        "end_sessions" => out(commands::auth::end_sessions(db, arg(&mut a, "id")?).await),
        "get_ci_dashboard" => out(commands::instructor::get_ci_dashboard(db).await),
        "list_groups" => out(commands::instructor::list_groups(db).await),
        "get_group" => out(commands::instructor::get_group(db, arg(&mut a, "id")?).await),
        "create_group" => out(commands::instructor::create_group(db, arg(&mut a, "input")?).await),
        "update_group" => out(commands::instructor::update_group(db, arg(&mut a, "id")?, arg(&mut a, "input")?).await),
        "delete_group" => out(commands::instructor::delete_group(db, arg(&mut a, "id")?).await),
        "add_group_member" => out(commands::instructor::add_group_member(db, arg(&mut a, "groupId")?, arg(&mut a, "identifier")?).await),
        "remove_group_member" => out(commands::instructor::remove_group_member(db, arg(&mut a, "groupId")?, arg(&mut a, "studentId")?).await),
        "list_group_invitations" => out(commands::invitations::list_group_invitations(db).await),
        "respond_group_invitation" => out(commands::invitations::respond_group_invitation(db, arg(&mut a, "groupId")?, arg(&mut a, "accept")?).await),
        "list_my_students" => out(commands::instructor::list_my_students(db).await),
        "list_duty_assignments" => out(commands::ci_assignments::list_duty_assignments(db).await),
        "create_duty_assignment" => out(commands::ci_assignments::create_duty_assignment(db, arg(&mut a, "input")?).await),
        "update_duty_assignment" => out(commands::ci_assignments::update_duty_assignment(db, arg(&mut a, "id")?, arg(&mut a, "input")?).await),
        "delete_duty_assignment" => out(commands::ci_assignments::delete_duty_assignment(db, arg(&mut a, "id")?).await),
        "list_requirement_assignments" => out(commands::ci_assignments::list_requirement_assignments(db).await),
        "create_requirement_assignment" => out(commands::ci_assignments::create_requirement_assignment(db, arg(&mut a, "input")?).await),
        "delete_requirement_assignment" => out(commands::ci_assignments::delete_requirement_assignment(db, arg(&mut a, "id")?).await),
        "list_reviews" => out(commands::ci_reviews::list_reviews(db, arg(&mut a, "status")?).await),
        "review_document" => out(commands::ci_reviews::review_document(db, arg(&mut a, "id")?, arg(&mut a, "status")?, arg(&mut a, "feedback")?).await),
        "open_review_document" => out(commands::ci_reviews::open_review_document(db, arg(&mut a, "id")?).await),
        "list_instructions" => out(commands::ci_instructions::list_instructions(db).await),
        "create_instruction" => out(commands::ci_instructions::create_instruction(db, arg(&mut a, "input")?).await),
        "delete_instruction" => out(commands::ci_instructions::delete_instruction(db, arg(&mut a, "id")?).await),
        "get_duty_day" => out(commands::ci_duty_day::get_duty_day(db, arg(&mut a, "date")?).await),
        "set_attendance" => out(commands::ci_duty_day::set_attendance(db, arg(&mut a, "dutyId")?, arg(&mut a, "input")?).await),
        "get_evaluations" => out(commands::ci_duty_day::get_evaluations(db).await),
        "save_evaluation" => out(commands::ci_duty_day::save_evaluation(db, arg(&mut a, "dutyId")?, arg(&mut a, "input")?).await),
        "list_ci_announcements" => out(commands::ci_announcements::list_ci_announcements(db).await),
        "create_announcement" => out(commands::ci_announcements::create_announcement(db, arg(&mut a, "input")?).await),
        "delete_announcement" => out(commands::ci_announcements::delete_announcement(db, arg(&mut a, "id")?).await),
        "get_dashboard" => out(commands::dashboard::get_dashboard(db).await),
        "list_notifications" => out(commands::notifications::list_notifications(db).await),
        "mark_notifications_read" => out(commands::notifications::mark_notifications_read(db, arg(&mut a, "keys")?).await),
        "get_profile" => out(commands::profile::get_profile(db).await),
        "get_progress" => out(commands::progress::get_progress(db, arg(&mut a, "range")?).await),
        "get_settings" => out(commands::settings::get_settings(db).await),
        "set_settings" => out(commands::settings::set_settings(db, arg(&mut a, "values")?).await),
        "update_profile" => out(commands::settings::update_profile(db, arg(&mut a, "input")?).await),
        "set_avatar" => out(commands::settings::set_avatar(db, arg(&mut a, "data")?).await),
        "export_data" => out(commands::settings::export_data(db).await),
        "reset_all_data" => out(commands::settings::reset_all_data(db, arg(&mut a, "confirm")?).await),
        "list_receipts" => out(commands::settings::list_receipts(db).await),
        "activate_premium" => out(commands::settings::activate_premium(db, arg(&mut a, "plan")?, arg(&mut a, "method")?).await),
        "cancel_premium" => out(commands::settings::cancel_premium(db).await),
        "list_duties" => out(commands::duties::list_duties(db).await),
        "add_duty" => out(commands::duties::add_duty(db, arg(&mut a, "input")?).await),
        "list_events" => out(commands::events::list_events(db).await),
        "add_event" => out(commands::events::add_event(db, arg(&mut a, "input")?).await),
        "list_requirements" => out(commands::requirements::list_requirements(db).await),
        "add_requirement" => out(commands::requirements::add_requirement(db, arg(&mut a, "input")?).await),
        "list_documents" => out(commands::documents::list_documents(db).await),
        "open_document" => out(commands::documents::open_document(db, arg(&mut a, "id")?).await),
        "list_tasks" => out(commands::tasks::list_tasks(db, arg(&mut a, "date")?).await),
        "add_task" => out(commands::tasks::add_task(db, arg(&mut a, "input")?).await),
        "update_task" => out(commands::tasks::update_task(db, arg(&mut a, "id")?, arg(&mut a, "input")?).await),
        "delete_task" => out(commands::tasks::delete_task(db, arg(&mut a, "id")?).await),
        "toggle_task" => out(commands::tasks::toggle_task(db, arg(&mut a, "id")?, arg(&mut a, "completed")?).await),
        "list_checklists" => out(commands::checklists::list_checklists(db).await),
        "list_checklist_items" => out(commands::checklists::list_checklist_items(db, arg(&mut a, "checklistId")?).await),
        "get_duty_prep" => out(commands::duty_checklist::get_duty_prep(db, arg(&mut a, "dutyId")?).await),
        "get_rotation_checklist" => out(commands::duty_checklist::get_rotation_checklist(db, arg(&mut a, "area")?).await),
        "add_checklist_item" => out(commands::duty_checklist::add_checklist_item(db, arg(&mut a, "checklistId")?, arg(&mut a, "label")?).await),
        "toggle_checklist_item" => out(commands::duty_checklist::toggle_checklist_item(db, arg(&mut a, "id")?, arg(&mut a, "checked")?).await),
        "delete_checklist_item" => out(commands::duty_checklist::delete_checklist_item(db, arg(&mut a, "id")?).await),
        "set_duty_readiness" => out(commands::duty_checklist::set_duty_readiness(db, arg(&mut a, "dutyId")?, arg(&mut a, "key")?, arg(&mut a, "checked")?).await),
        "list_ci_notes" => out(commands::ci_notes::list_ci_notes(db).await),
        "add_ci_note" => out(commands::ci_notes::add_ci_note(db, arg(&mut a, "input")?).await),
        "update_ci_note" => out(commands::ci_notes::update_ci_note(db, arg(&mut a, "id")?, arg(&mut a, "input")?).await),
        "set_ci_note_pinned" => out(commands::ci_notes::set_ci_note_pinned(db, arg(&mut a, "id")?, arg(&mut a, "pinned")?).await),
        "delete_ci_note" => out(commands::ci_notes::delete_ci_note(db, arg(&mut a, "id")?).await),
        "list_quick_links" => out(commands::quick_links::list_quick_links(db).await),
        "list_materials" => out(commands::quick_links::list_materials(db).await),
        "update_material" => out(commands::quick_links::update_material(db, arg(&mut a, "id")?, arg(&mut a, "input")?).await),
        "delete_material" => out(commands::quick_links::delete_material(db, arg(&mut a, "id")?).await),
        "set_material_bookmark" => out(commands::quick_links::set_material_bookmark(db, arg(&mut a, "id")?, arg(&mut a, "bookmarked")?).await),
        "open_material" => out(commands::quick_links::open_material(db, arg(&mut a, "id")?).await),
        "get_handbook" => out(commands::quick_links::get_handbook(db).await),
        "list_announcements" => out(commands::quick_links::list_announcements(db).await),
        "get_study_journey" => out(commands::quick_links::get_study_journey(db).await),
        "list_study_activity" => out(commands::ai_study::list_study_activity(db, arg(&mut a, "limit")?).await),
        "list_quizzes" => out(commands::ai_study::list_quizzes(db).await),
        "create_quiz" => out(commands::ai_study::create_quiz(db, arg(&mut a, "input")?).await),
        "get_quiz" => out(commands::ai_study::get_quiz(db, arg(&mut a, "id")?).await),
        "answer_question" => out(commands::ai_study::answer_question(db, arg(&mut a, "id")?, arg(&mut a, "chosenIndex")?).await),
        "finish_quiz" => out(commands::ai_study::finish_quiz(db, arg(&mut a, "id")?).await),
        "restart_quiz" => out(commands::ai_study::restart_quiz(db, arg(&mut a, "id")?).await),
        "get_quiz_feedback" => out(commands::ai_study::get_quiz_feedback(db, arg(&mut a, "id")?).await),
        "list_chat_messages" => out(commands::ai_study::list_chat_messages(db).await),
        "send_chat_message" => out(commands::ai_study::send_chat_message(db, arg(&mut a, "content")?, arg(&mut a, "attachment")?).await),
        "clear_chat" => out(commands::ai_study::clear_chat(db).await),
        _ => Err(AppError::new(UNKNOWN_COMMAND)),
    }
}
