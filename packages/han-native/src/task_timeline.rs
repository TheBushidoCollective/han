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

    /// Helper to parse RFC3339 timestamps for tests
    fn parse_time(s: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(s).unwrap().with_timezone(&Utc)
    }

    // ===========================================
    // TaskTimeline::new() tests
    // ===========================================

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

    // ===========================================
    // find_active_task() - Basic functionality
    // ===========================================

    #[test]
    fn test_find_active_task_empty_timeline() {
        let timeline = TaskTimeline::new();
        let query = parse_time("2024-01-01T10:00:00Z");
        assert_eq!(timeline.find_active_task(&query), None);
    }

    #[test]
    fn test_find_active_task_single_completed_task() {
        let mut timeline = TaskTimeline::new();
        timeline.tasks.push(TaskTimeRange {
            task_id: "task-1".to_string(),
            start_time: parse_time("2024-01-01T10:00:00Z"),
            end_time: Some(parse_time("2024-01-01T10:30:00Z")),
        });

        // During task
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T10:15:00Z")),
            Some("task-1")
        );

        // Before task
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T09:59:00Z")),
            None
        );

        // After task ended
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T10:31:00Z")),
            None
        );
    }

    #[test]
    fn test_find_active_task_single_ongoing_task() {
        let mut timeline = TaskTimeline::new();
        timeline.tasks.push(TaskTimeRange {
            task_id: "task-ongoing".to_string(),
            start_time: parse_time("2024-01-01T10:00:00Z"),
            end_time: None, // Still in progress
        });

        // During task
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T10:15:00Z")),
            Some("task-ongoing")
        );

        // Far in the future (task still active)
        assert_eq!(
            timeline.find_active_task(&parse_time("2025-12-31T23:59:59Z")),
            Some("task-ongoing")
        );

        // Before task
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T09:59:00Z")),
            None
        );
    }

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

    // ===========================================
    // find_active_task() - Edge cases
    // ===========================================

    #[test]
    fn test_find_active_task_at_exact_start_time() {
        let mut timeline = TaskTimeline::new();
        let start = parse_time("2024-01-01T10:00:00Z");
        timeline.tasks.push(TaskTimeRange {
            task_id: "task-1".to_string(),
            start_time: start,
            end_time: Some(parse_time("2024-01-01T10:30:00Z")),
        });

        // Query at exact start time should find the task
        assert_eq!(timeline.find_active_task(&start), Some("task-1"));
    }

    #[test]
    fn test_find_active_task_at_exact_end_time() {
        let mut timeline = TaskTimeline::new();
        let end = parse_time("2024-01-01T10:30:00Z");
        timeline.tasks.push(TaskTimeRange {
            task_id: "task-1".to_string(),
            start_time: parse_time("2024-01-01T10:00:00Z"),
            end_time: Some(end),
        });

        // Query at exact end time should still find the task (end >= timestamp)
        assert_eq!(timeline.find_active_task(&end), Some("task-1"));
    }

    #[test]
    fn test_find_active_task_one_nanosecond_after_end() {
        let mut timeline = TaskTimeline::new();
        let end = parse_time("2024-01-01T10:30:00Z");
        timeline.tasks.push(TaskTimeRange {
            task_id: "task-1".to_string(),
            start_time: parse_time("2024-01-01T10:00:00Z"),
            end_time: Some(end),
        });

        // One second after end should not find the task
        let query = parse_time("2024-01-01T10:30:01Z");
        assert_eq!(timeline.find_active_task(&query), None);
    }

    #[test]
    fn test_find_active_task_multiple_sequential_tasks() {
        let mut timeline = TaskTimeline::new();

        // Task 1: 10:00 - 10:30
        timeline.tasks.push(TaskTimeRange {
            task_id: "task-1".to_string(),
            start_time: parse_time("2024-01-01T10:00:00Z"),
            end_time: Some(parse_time("2024-01-01T10:30:00Z")),
        });

        // Task 2: 10:30 - 11:00 (starts exactly when task-1 ends)
        timeline.tasks.push(TaskTimeRange {
            task_id: "task-2".to_string(),
            start_time: parse_time("2024-01-01T10:30:00Z"),
            end_time: Some(parse_time("2024-01-01T11:00:00Z")),
        });

        // Task 3: 11:00 - 11:30
        timeline.tasks.push(TaskTimeRange {
            task_id: "task-3".to_string(),
            start_time: parse_time("2024-01-01T11:00:00Z"),
            end_time: Some(parse_time("2024-01-01T11:30:00Z")),
        });

        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T10:15:00Z")),
            Some("task-1")
        );
        // At 10:30, task-2 starts and task-1 ends - task-2 should be returned (more recent)
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

        // Task 1: 10:00 - 10:30
        timeline.tasks.push(TaskTimeRange {
            task_id: "task-1".to_string(),
            start_time: parse_time("2024-01-01T10:00:00Z"),
            end_time: Some(parse_time("2024-01-01T10:30:00Z")),
        });

        // Task 2: 11:00 - 11:30 (30 minute gap)
        timeline.tasks.push(TaskTimeRange {
            task_id: "task-2".to_string(),
            start_time: parse_time("2024-01-01T11:00:00Z"),
            end_time: Some(parse_time("2024-01-01T11:30:00Z")),
        });

        // In the gap between tasks
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T10:45:00Z")),
            None
        );
    }

    #[test]
    fn test_find_active_task_overlapping_tasks_returns_most_recent() {
        let mut timeline = TaskTimeline::new();

        // Task 1: 10:00 - 11:00
        timeline.tasks.push(TaskTimeRange {
            task_id: "task-1".to_string(),
            start_time: parse_time("2024-01-01T10:00:00Z"),
            end_time: Some(parse_time("2024-01-01T11:00:00Z")),
        });

        // Task 2: 10:30 - 11:30 (overlaps with task-1)
        timeline.tasks.push(TaskTimeRange {
            task_id: "task-2".to_string(),
            start_time: parse_time("2024-01-01T10:30:00Z"),
            end_time: Some(parse_time("2024-01-01T11:30:00Z")),
        });

        // Task 3: 10:45 - 12:00 (overlaps with both)
        timeline.tasks.push(TaskTimeRange {
            task_id: "task-3".to_string(),
            start_time: parse_time("2024-01-01T10:45:00Z"),
            end_time: Some(parse_time("2024-01-01T12:00:00Z")),
        });

        // At 10:15 - only task-1 is active
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T10:15:00Z")),
            Some("task-1")
        );

        // At 10:35 - task-1 and task-2 active, task-2 is more recent
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T10:35:00Z")),
            Some("task-2")
        );

        // At 10:50 - all three active, task-3 is most recent
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T10:50:00Z")),
            Some("task-3")
        );

        // At 11:15 - task-1 ended, task-2 and task-3 active
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T11:15:00Z")),
            Some("task-3")
        );

        // At 11:45 - only task-3 active
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T11:45:00Z")),
            Some("task-3")
        );
    }

    #[test]
    fn test_find_active_task_all_tasks_ended() {
        let mut timeline = TaskTimeline::new();

        timeline.tasks.push(TaskTimeRange {
            task_id: "task-1".to_string(),
            start_time: parse_time("2024-01-01T10:00:00Z"),
            end_time: Some(parse_time("2024-01-01T10:30:00Z")),
        });

        timeline.tasks.push(TaskTimeRange {
            task_id: "task-2".to_string(),
            start_time: parse_time("2024-01-01T11:00:00Z"),
            end_time: Some(parse_time("2024-01-01T11:30:00Z")),
        });

        // After all tasks ended
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T12:00:00Z")),
            None
        );
    }

    #[test]
    fn test_find_active_task_multiple_ongoing_tasks() {
        let mut timeline = TaskTimeline::new();

        // Two tasks, both still ongoing
        timeline.tasks.push(TaskTimeRange {
            task_id: "task-1".to_string(),
            start_time: parse_time("2024-01-01T10:00:00Z"),
            end_time: None,
        });

        timeline.tasks.push(TaskTimeRange {
            task_id: "task-2".to_string(),
            start_time: parse_time("2024-01-01T10:30:00Z"),
            end_time: None,
        });

        // At 10:15 - only task-1 started
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T10:15:00Z")),
            Some("task-1")
        );

        // At 11:00 - both started, task-2 is more recent
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T11:00:00Z")),
            Some("task-2")
        );
    }

    // ===========================================
    // TaskTimeRange struct tests
    // ===========================================

    #[test]
    fn test_task_time_range_debug() {
        let range = TaskTimeRange {
            task_id: "test-id".to_string(),
            start_time: parse_time("2024-01-01T10:00:00Z"),
            end_time: Some(parse_time("2024-01-01T10:30:00Z")),
        };
        let debug_str = format!("{:?}", range);
        assert!(debug_str.contains("task_id"));
        assert!(debug_str.contains("test-id"));
    }

    #[test]
    fn test_task_time_range_clone() {
        let range = TaskTimeRange {
            task_id: "test-id".to_string(),
            start_time: parse_time("2024-01-01T10:00:00Z"),
            end_time: Some(parse_time("2024-01-01T10:30:00Z")),
        };
        let cloned = range.clone();
        assert_eq!(cloned.task_id, range.task_id);
        assert_eq!(cloned.start_time, range.start_time);
        assert_eq!(cloned.end_time, range.end_time);
    }

    // ===========================================
    // TaskTimeline struct tests
    // ===========================================

    #[test]
    fn test_task_timeline_debug() {
        let timeline = TaskTimeline::new();
        let debug_str = format!("{:?}", timeline);
        assert!(debug_str.contains("TaskTimeline"));
        assert!(debug_str.contains("tasks"));
    }

    // ===========================================
    // Boundary condition tests
    // ===========================================

    #[test]
    fn test_find_active_task_same_start_time() {
        let mut timeline = TaskTimeline::new();
        let same_start = parse_time("2024-01-01T10:00:00Z");

        // Two tasks starting at the exact same time
        timeline.tasks.push(TaskTimeRange {
            task_id: "task-1".to_string(),
            start_time: same_start,
            end_time: Some(parse_time("2024-01-01T10:30:00Z")),
        });

        timeline.tasks.push(TaskTimeRange {
            task_id: "task-2".to_string(),
            start_time: same_start,
            end_time: Some(parse_time("2024-01-01T11:00:00Z")),
        });

        // With same start time, the one later in the list (task-2) wins due to reverse iteration
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T10:15:00Z")),
            Some("task-2")
        );
    }

    #[test]
    fn test_find_active_task_unsorted_tasks() {
        // The algorithm expects tasks sorted by start time (ASC order)
        // but uses reverse iteration to find most recent first
        let mut timeline = TaskTimeline::new();

        // Add tasks in sorted order (as build_task_timeline would)
        timeline.tasks.push(TaskTimeRange {
            task_id: "early-task".to_string(),
            start_time: parse_time("2024-01-01T08:00:00Z"),
            end_time: Some(parse_time("2024-01-01T09:00:00Z")),
        });

        timeline.tasks.push(TaskTimeRange {
            task_id: "middle-task".to_string(),
            start_time: parse_time("2024-01-01T10:00:00Z"),
            end_time: Some(parse_time("2024-01-01T11:00:00Z")),
        });

        timeline.tasks.push(TaskTimeRange {
            task_id: "late-task".to_string(),
            start_time: parse_time("2024-01-01T12:00:00Z"),
            end_time: None,
        });

        // Verify each time period finds the correct task
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T08:30:00Z")),
            Some("early-task")
        );
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T10:30:00Z")),
            Some("middle-task")
        );
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T12:30:00Z")),
            Some("late-task")
        );
    }

    #[test]
    fn test_find_active_task_very_old_timestamp() {
        let mut timeline = TaskTimeline::new();
        timeline.tasks.push(TaskTimeRange {
            task_id: "task-1".to_string(),
            start_time: parse_time("2024-01-01T10:00:00Z"),
            end_time: None,
        });

        // Query with a timestamp from 1970
        let old_time = parse_time("1970-01-01T00:00:00Z");
        assert_eq!(timeline.find_active_task(&old_time), None);
    }

    #[test]
    fn test_find_active_task_far_future_timestamp() {
        let mut timeline = TaskTimeline::new();
        timeline.tasks.push(TaskTimeRange {
            task_id: "task-1".to_string(),
            start_time: parse_time("2024-01-01T10:00:00Z"),
            end_time: Some(parse_time("2024-01-01T11:00:00Z")),
        });

        // Query far in the future - task already ended
        let future_time = parse_time("2099-12-31T23:59:59Z");
        assert_eq!(timeline.find_active_task(&future_time), None);
    }

    #[test]
    fn test_find_active_task_ongoing_far_future() {
        let mut timeline = TaskTimeline::new();
        timeline.tasks.push(TaskTimeRange {
            task_id: "eternal-task".to_string(),
            start_time: parse_time("2024-01-01T10:00:00Z"),
            end_time: None, // Never ends
        });

        // Query far in the future - ongoing task should still be active
        let future_time = parse_time("2099-12-31T23:59:59Z");
        assert_eq!(
            timeline.find_active_task(&future_time),
            Some("eternal-task")
        );
    }

    // ===========================================
    // Large dataset tests
    // ===========================================

    #[test]
    fn test_find_active_task_many_tasks() {
        let mut timeline = TaskTimeline::new();

        // Create 100 sequential 10-minute tasks
        for i in 0..100 {
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

            timeline.tasks.push(TaskTimeRange {
                task_id: format!("task-{}", i),
                start_time: start,
                end_time: Some(end),
            });
        }

        // Test finding task in the middle
        // task-49 spans 490-500 minutes (08:10:00-08:20:00)
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T08:15:00Z")),
            Some("task-49")
        );

        // Test finding first task
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T00:05:00Z")),
            Some("task-0")
        );

        // Test finding last task
        assert_eq!(
            timeline.find_active_task(&parse_time("2024-01-01T16:35:00Z")),
            Some("task-99")
        );
    }
}
