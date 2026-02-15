//! Task timeline for associating messages with active tasks.
//!
//! Queries the tasks table to find which task was active at a given timestamp.
//! Used during indexing to associate sentiment events with tasks.

use chrono::{DateTime, Utc};
use sea_orm::*;

/// A task's time range (start to end).
#[derive(Debug, Clone)]
pub struct TaskTimeRange {
    pub task_id: String,
    pub start_time: DateTime<Utc>,
    pub end_time: Option<DateTime<Utc>>,
}

/// Timeline of tasks for lookups.
#[derive(Debug, Default)]
pub struct TaskTimeline {
    /// All task time ranges, sorted by start time.
    tasks: Vec<TaskTimeRange>,
}

impl TaskTimeline {
    /// Create a new empty timeline.
    pub fn new() -> Self {
        Self { tasks: Vec::new() }
    }

    /// Add a task time range. Caller is responsible for maintaining sorted order.
    pub fn push(&mut self, range: TaskTimeRange) {
        self.tasks.push(range);
    }

    /// Find the active task at a given timestamp.
    /// Returns the task_id if a task was in progress at that time.
    /// Uses reverse iteration so the most recently started task wins.
    pub fn find_active_task(&self, timestamp: &DateTime<Utc>) -> Option<&str> {
        for task in self.tasks.iter().rev() {
            if task.start_time <= *timestamp {
                match &task.end_time {
                    None => return Some(&task.task_id),
                    Some(end) if end >= timestamp => return Some(&task.task_id),
                    _ => continue,
                }
            }
        }
        None
    }
}

/// Build a task timeline from the database.
pub async fn build_task_timeline(db: &DatabaseConnection) -> TaskTimeline {
    let mut timeline = TaskTimeline::new();

    // Query all tasks ordered by started_at ASC
    let rows = match db
        .query_all(Statement::from_string(
            db.get_database_backend(),
            "SELECT task_id, started_at, completed_at FROM tasks ORDER BY started_at ASC"
                .to_string(),
        ))
        .await
    {
        Ok(rows) => rows,
        Err(_) => return timeline,
    };

    for row in rows {
        let task_id: String = match row.try_get("", "task_id") {
            Ok(v) => v,
            Err(_) => continue,
        };
        let started_at: String = match row.try_get("", "started_at") {
            Ok(v) => v,
            Err(_) => continue,
        };
        let completed_at: Option<String> = row.try_get("", "completed_at").ok();

        let start_time = match DateTime::parse_from_rfc3339(&started_at) {
            Ok(ts) => ts.with_timezone(&Utc),
            Err(_) => continue,
        };

        let end_time = completed_at.and_then(|s| {
            DateTime::parse_from_rfc3339(&s)
                .ok()
                .map(|ts| ts.with_timezone(&Utc))
        });

        timeline.push(TaskTimeRange {
            task_id,
            start_time,
            end_time,
        });
    }

    timeline
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse_time(s: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(s).unwrap().with_timezone(&Utc)
    }

    #[test]
    fn test_new_creates_empty_timeline() {
        let timeline = TaskTimeline::new();
        assert!(timeline.tasks.is_empty());
    }

    #[test]
    fn test_default_creates_empty_timeline() {
        let timeline = TaskTimeline::default();
        assert!(timeline.tasks.is_empty());
    }

    #[test]
    fn test_find_active_task_empty_timeline() {
        let timeline = TaskTimeline::new();
        let query = parse_time("2024-01-01T10:00:00Z");
        assert_eq!(timeline.find_active_task(&query), None);
    }

    #[test]
    fn test_find_active_task_single_completed_task() {
        let mut timeline = TaskTimeline::new();
        timeline.push(TaskTimeRange {
            task_id: "task-1".to_string(),
            start_time: parse_time("2024-01-01T10:00:00Z"),
            end_time: Some(parse_time("2024-01-01T10:30:00Z")),
        });

        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T10:15:00Z")),
            Some("task-1")
        );
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T09:59:00Z")),
            None
        );
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T10:31:00Z")),
            None
        );
    }

    #[test]
    fn test_find_active_task_single_ongoing_task() {
        let mut timeline = TaskTimeline::new();
        timeline.push(TaskTimeRange {
            task_id: "task-ongoing".to_string(),
            start_time: parse_time("2024-01-01T10:00:00Z"),
            end_time: None,
        });

        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T10:15:00Z")),
            Some("task-ongoing")
        );
        assert_eq!(
            timeline.find_active_task(&parse_time("2025-12-31T23:59:59Z")),
            Some("task-ongoing")
        );
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T09:59:00Z")),
            None
        );
    }

    #[test]
    fn test_find_active_task_overlapping() {
        let mut timeline = TaskTimeline::new();

        timeline.push(TaskTimeRange {
            task_id: "task-1".to_string(),
            start_time: parse_time("2024-01-01T10:00:00Z"),
            end_time: Some(parse_time("2024-01-01T10:30:00Z")),
        });

        timeline.push(TaskTimeRange {
            task_id: "task-2".to_string(),
            start_time: parse_time("2024-01-01T10:15:00Z"),
            end_time: None,
        });

        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T10:05:00Z")),
            Some("task-1")
        );
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T10:20:00Z")),
            Some("task-2")
        );
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T10:35:00Z")),
            Some("task-2")
        );
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T09:00:00Z")),
            None
        );
    }

    #[test]
    fn test_find_active_task_at_exact_start_time() {
        let mut timeline = TaskTimeline::new();
        let start = parse_time("2024-01-01T10:00:00Z");
        timeline.push(TaskTimeRange {
            task_id: "task-1".to_string(),
            start_time: start,
            end_time: Some(parse_time("2024-01-01T10:30:00Z")),
        });
        assert_eq!(timeline.find_active_task(&start), Some("task-1"));
    }

    #[test]
    fn test_find_active_task_at_exact_end_time() {
        let mut timeline = TaskTimeline::new();
        let end = parse_time("2024-01-01T10:30:00Z");
        timeline.push(TaskTimeRange {
            task_id: "task-1".to_string(),
            start_time: parse_time("2024-01-01T10:00:00Z"),
            end_time: Some(end),
        });
        assert_eq!(timeline.find_active_task(&end), Some("task-1"));
    }

    #[test]
    fn test_find_active_task_one_second_after_end() {
        let mut timeline = TaskTimeline::new();
        timeline.push(TaskTimeRange {
            task_id: "task-1".to_string(),
            start_time: parse_time("2024-01-01T10:00:00Z"),
            end_time: Some(parse_time("2024-01-01T10:30:00Z")),
        });
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T10:30:01Z")),
            None
        );
    }

    #[test]
    fn test_find_active_task_sequential_tasks() {
        let mut timeline = TaskTimeline::new();

        timeline.push(TaskTimeRange {
            task_id: "task-1".to_string(),
            start_time: parse_time("2024-01-01T10:00:00Z"),
            end_time: Some(parse_time("2024-01-01T10:30:00Z")),
        });
        timeline.push(TaskTimeRange {
            task_id: "task-2".to_string(),
            start_time: parse_time("2024-01-01T10:30:00Z"),
            end_time: Some(parse_time("2024-01-01T11:00:00Z")),
        });
        timeline.push(TaskTimeRange {
            task_id: "task-3".to_string(),
            start_time: parse_time("2024-01-01T11:00:00Z"),
            end_time: Some(parse_time("2024-01-01T11:30:00Z")),
        });

        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T10:15:00Z")),
            Some("task-1")
        );
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T10:30:00Z")),
            Some("task-2")
        );
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T10:45:00Z")),
            Some("task-2")
        );
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T11:15:00Z")),
            Some("task-3")
        );
    }

    #[test]
    fn test_find_active_task_gap_between_tasks() {
        let mut timeline = TaskTimeline::new();

        timeline.push(TaskTimeRange {
            task_id: "task-1".to_string(),
            start_time: parse_time("2024-01-01T10:00:00Z"),
            end_time: Some(parse_time("2024-01-01T10:30:00Z")),
        });
        timeline.push(TaskTimeRange {
            task_id: "task-2".to_string(),
            start_time: parse_time("2024-01-01T11:00:00Z"),
            end_time: Some(parse_time("2024-01-01T11:30:00Z")),
        });

        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T10:45:00Z")),
            None
        );
    }

    #[test]
    fn test_find_active_task_overlapping_returns_most_recent() {
        let mut timeline = TaskTimeline::new();

        timeline.push(TaskTimeRange {
            task_id: "task-1".to_string(),
            start_time: parse_time("2024-01-01T10:00:00Z"),
            end_time: Some(parse_time("2024-01-01T11:00:00Z")),
        });
        timeline.push(TaskTimeRange {
            task_id: "task-2".to_string(),
            start_time: parse_time("2024-01-01T10:30:00Z"),
            end_time: Some(parse_time("2024-01-01T11:30:00Z")),
        });
        timeline.push(TaskTimeRange {
            task_id: "task-3".to_string(),
            start_time: parse_time("2024-01-01T10:45:00Z"),
            end_time: Some(parse_time("2024-01-01T12:00:00Z")),
        });

        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T10:15:00Z")),
            Some("task-1")
        );
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T10:35:00Z")),
            Some("task-2")
        );
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T10:50:00Z")),
            Some("task-3")
        );
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T11:15:00Z")),
            Some("task-3")
        );
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T11:45:00Z")),
            Some("task-3")
        );
    }

    #[test]
    fn test_find_active_task_all_tasks_ended() {
        let mut timeline = TaskTimeline::new();
        timeline.push(TaskTimeRange {
            task_id: "task-1".to_string(),
            start_time: parse_time("2024-01-01T10:00:00Z"),
            end_time: Some(parse_time("2024-01-01T10:30:00Z")),
        });
        timeline.push(TaskTimeRange {
            task_id: "task-2".to_string(),
            start_time: parse_time("2024-01-01T11:00:00Z"),
            end_time: Some(parse_time("2024-01-01T11:30:00Z")),
        });

        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T12:00:00Z")),
            None
        );
    }

    #[test]
    fn test_find_active_task_multiple_ongoing() {
        let mut timeline = TaskTimeline::new();
        timeline.push(TaskTimeRange {
            task_id: "task-1".to_string(),
            start_time: parse_time("2024-01-01T10:00:00Z"),
            end_time: None,
        });
        timeline.push(TaskTimeRange {
            task_id: "task-2".to_string(),
            start_time: parse_time("2024-01-01T10:30:00Z"),
            end_time: None,
        });

        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T10:15:00Z")),
            Some("task-1")
        );
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T11:00:00Z")),
            Some("task-2")
        );
    }

    #[test]
    fn test_find_active_task_same_start_time() {
        let mut timeline = TaskTimeline::new();
        let same_start = parse_time("2024-01-01T10:00:00Z");

        timeline.push(TaskTimeRange {
            task_id: "task-1".to_string(),
            start_time: same_start,
            end_time: Some(parse_time("2024-01-01T10:30:00Z")),
        });
        timeline.push(TaskTimeRange {
            task_id: "task-2".to_string(),
            start_time: same_start,
            end_time: Some(parse_time("2024-01-01T11:00:00Z")),
        });

        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T10:15:00Z")),
            Some("task-2")
        );
    }

    #[test]
    fn test_find_active_task_very_old_timestamp() {
        let mut timeline = TaskTimeline::new();
        timeline.push(TaskTimeRange {
            task_id: "task-1".to_string(),
            start_time: parse_time("2024-01-01T10:00:00Z"),
            end_time: None,
        });
        assert_eq!(
            timeline.find_active_task(&parse_time("1970-01-01T00:00:00Z")),
            None
        );
    }

    #[test]
    fn test_find_active_task_far_future_completed() {
        let mut timeline = TaskTimeline::new();
        timeline.push(TaskTimeRange {
            task_id: "task-1".to_string(),
            start_time: parse_time("2024-01-01T10:00:00Z"),
            end_time: Some(parse_time("2024-01-01T11:00:00Z")),
        });
        assert_eq!(
            timeline.find_active_task(&parse_time("2099-12-31T23:59:59Z")),
            None
        );
    }

    #[test]
    fn test_find_active_task_ongoing_far_future() {
        let mut timeline = TaskTimeline::new();
        timeline.push(TaskTimeRange {
            task_id: "eternal-task".to_string(),
            start_time: parse_time("2024-01-01T10:00:00Z"),
            end_time: None,
        });
        assert_eq!(
            timeline.find_active_task(&parse_time("2099-12-31T23:59:59Z")),
            Some("eternal-task")
        );
    }

    #[test]
    fn test_find_active_task_many_tasks() {
        let mut timeline = TaskTimeline::new();

        for i in 0..100u32 {
            let start_minutes = i * 10;
            let end_minutes = start_minutes + 10;
            let start = parse_time(&format!(
                "2024-01-01T{:02}:{:02}:00Z",
                start_minutes / 60,
                start_minutes % 60
            ));
            let end = parse_time(&format!(
                "2024-01-01T{:02}:{:02}:00Z",
                end_minutes / 60,
                end_minutes % 60
            ));

            timeline.push(TaskTimeRange {
                task_id: format!("task-{}", i),
                start_time: start,
                end_time: Some(end),
            });
        }

        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T08:15:00Z")),
            Some("task-49")
        );
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T00:05:00Z")),
            Some("task-0")
        );
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T16:35:00Z")),
            Some("task-99")
        );
    }
}
