//! Task timeline for associating messages with active tasks
//!
//! Queries the SQLite tasks table to find which task was active at a given timestamp.
//! Used during indexing to associate sentiment events with tasks.

use crate::db::get_db;
use chrono::{DateTime, Utc};

/// A task's time range (start to end)
#[derive(Debug, Clone)]
pub struct TaskTimeRange {
    pub task_id: String,
    pub start_time: DateTime<Utc>,
    pub end_time: Option<DateTime<Utc>>,
}

/// Timeline of tasks for lookups
#[derive(Debug, Default)]
pub struct TaskTimeline {
    /// All task time ranges, sorted by start time
    tasks: Vec<TaskTimeRange>,
}

impl TaskTimeline {
    /// Create a new empty timeline
    pub fn new() -> Self {
        Self { tasks: Vec::new() }
    }

    /// Find the active task at a given timestamp
    /// Returns the task_id if a task was in progress at that time
    pub fn find_active_task(&self, timestamp: &DateTime<Utc>) -> Option<&str> {
        // Find the most recent task that started before this timestamp
        // and either has no end time or ends after this timestamp
        for task in self.tasks.iter().rev() {
            if task.start_time <= *timestamp {
                match &task.end_time {
                    None => return Some(&task.task_id), // Still in progress
                    Some(end) if end >= timestamp => return Some(&task.task_id),
                    _ => continue, // Task ended before timestamp
                }
            }
        }
        None
    }
}

/// Build a task timeline from the SQLite tasks table
pub fn build_task_timeline() -> TaskTimeline {
    let mut timeline = TaskTimeline::new();

    let db = match get_db() {
        Ok(db) => db,
        Err(_) => return timeline,
    };

    let conn = match db.lock() {
        Ok(c) => c,
        Err(_) => return timeline,
    };

    // Query all tasks with their time ranges
    let mut stmt = match conn
        .prepare("SELECT task_id, started_at, completed_at FROM tasks ORDER BY started_at ASC")
    {
        Ok(s) => s,
        Err(_) => return timeline,
    };

    let task_iter = stmt.query_map([], |row| {
        let task_id: String = row.get(0)?;
        let started_at: String = row.get(1)?;
        let completed_at: Option<String> = row.get(2)?;
        Ok((task_id, started_at, completed_at))
    });

    if let Ok(iter) = task_iter {
        for task_result in iter.flatten() {
            let (task_id, started_at, completed_at) = task_result;

            // Parse start time
            let start_time = match DateTime::parse_from_rfc3339(&started_at) {
                Ok(ts) => ts.with_timezone(&Utc),
                Err(_) => continue,
            };

            // Parse end time if present
            let end_time = completed_at.and_then(|s| {
                DateTime::parse_from_rfc3339(&s)
                    .ok()
                    .map(|ts| ts.with_timezone(&Utc))
            });

            timeline.tasks.push(TaskTimeRange {
                task_id,
                start_time,
                end_time,
            });
        }
    }

    timeline
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_active_task() {
        let mut timeline = TaskTimeline::new();

        // Task 1: 10:00 - 10:30
        let t1_start = DateTime::parse_from_rfc3339("2024-01-01T10:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let t1_end = DateTime::parse_from_rfc3339("2024-01-01T10:30:00Z")
            .unwrap()
            .with_timezone(&Utc);
        timeline.tasks.push(TaskTimeRange {
            task_id: "task-1".to_string(),
            start_time: t1_start,
            end_time: Some(t1_end),
        });

        // Task 2: 10:15 - still active (overlapping)
        let t2_start = DateTime::parse_from_rfc3339("2024-01-01T10:15:00Z")
            .unwrap()
            .with_timezone(&Utc);
        timeline.tasks.push(TaskTimeRange {
            task_id: "task-2".to_string(),
            start_time: t2_start,
            end_time: None,
        });

        // At 10:05, task-1 is active
        let query1 = DateTime::parse_from_rfc3339("2024-01-01T10:05:00Z")
            .unwrap()
            .with_timezone(&Utc);
        assert_eq!(timeline.find_active_task(&query1), Some("task-1"));

        // At 10:20, both are active but task-2 is more recent
        let query2 = DateTime::parse_from_rfc3339("2024-01-01T10:20:00Z")
            .unwrap()
            .with_timezone(&Utc);
        assert_eq!(timeline.find_active_task(&query2), Some("task-2"));

        // At 10:35, only task-2 is active (task-1 ended)
        let query3 = DateTime::parse_from_rfc3339("2024-01-01T10:35:00Z")
            .unwrap()
            .with_timezone(&Utc);
        assert_eq!(timeline.find_active_task(&query3), Some("task-2"));

        // Before any task
        let query4 = DateTime::parse_from_rfc3339("2024-01-01T09:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        assert_eq!(timeline.find_active_task(&query4), None);
    }
}
