//! Relay Node interface and global ID encoding/decoding.
//!
//! Global IDs use `Typename:id` format (colon-delimited, NOT base64).
//! The browse-client depends on this format.
//!
//! Only splits on the first colon - the ID portion can contain additional colons.
//! Example: `Session:projectDir:sessionId` or `Message:uuid`

use async_graphql::ID;

/// Parsed global ID with typename and raw id.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedGlobalId {
    pub typename: String,
    pub id: String,
}

/// Encode a global ID in `Typename:id` format (colon-delimited).
pub fn encode_global_id(typename: &str, id: &str) -> ID {
    ID(format!("{typename}:{id}"))
}

/// Decode a global ID from `Typename:id` format (colon-delimited).
/// Only splits on the first colon - ID portion can contain additional colons.
/// Returns None if the format is invalid.
pub fn decode_global_id(global_id: &str) -> Option<ParsedGlobalId> {
    let colon_idx = global_id.find(':')?;
    let typename = &global_id[..colon_idx];
    let id = &global_id[colon_idx + 1..];

    if typename.is_empty() || id.is_empty() {
        return None;
    }

    Some(ParsedGlobalId {
        typename: typename.to_string(),
        id: id.to_string(),
    })
}

/// Encode a message cursor.
/// Format: `Message:{projectDir}:{sessionId}:{lineNumber}`
pub fn encode_message_cursor(project_dir: &str, session_id: &str, line_number: i32) -> String {
    format!("Message:{project_dir}:{session_id}:{line_number}")
}

/// Encode a message pagination cursor from timestamp and database ID.
/// Format: `MC:{timestamp}|{id}`
/// This cursor is stable across re-indexing because it uses immutable message properties.
pub fn encode_msg_cursor(timestamp: &str, id: &str) -> String {
    format!("MC:{timestamp}|{id}")
}

/// Decode a message pagination cursor to (timestamp, id).
/// Returns None for invalid or old-format cursors.
pub fn decode_msg_cursor(cursor: &str) -> Option<(String, String)> {
    let content = cursor.strip_prefix("MC:")?;
    let pipe_idx = content.find('|')?;
    let timestamp = content[..pipe_idx].to_string();
    let id = content[pipe_idx + 1..].to_string();
    if timestamp.is_empty() || id.is_empty() {
        return None;
    }
    Some((timestamp, id))
}

/// Encode a session cursor using base64.
pub fn encode_session_cursor(session_id: &str, date: &str) -> String {
    use base64::Engine;
    let raw = format!("{session_id}:{date}");
    base64::engine::general_purpose::STANDARD.encode(raw.as_bytes())
}

/// Decode a session cursor from base64.
pub fn decode_session_cursor(cursor: &str) -> Option<(String, String)> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD.decode(cursor).ok()?;
    let raw = String::from_utf8(bytes).ok()?;
    let colon_idx = raw.find(':')?;
    let session_id = raw[..colon_idx].to_string();
    let date = raw[colon_idx + 1..].to_string();
    Some((session_id, date))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_global_id() {
        let id = encode_global_id("Session", "abc123");
        assert_eq!(id.as_str(), "Session:abc123");
    }

    #[test]
    fn test_decode_global_id_simple() {
        let parsed = decode_global_id("Session:abc123").unwrap();
        assert_eq!(parsed.typename, "Session");
        assert_eq!(parsed.id, "abc123");
    }

    #[test]
    fn test_decode_global_id_with_colons_in_id() {
        let parsed = decode_global_id("Session:projectDir:sessionId").unwrap();
        assert_eq!(parsed.typename, "Session");
        assert_eq!(parsed.id, "projectDir:sessionId");
    }

    #[test]
    fn test_decode_global_id_invalid() {
        assert!(decode_global_id("no-colon").is_none());
        assert!(decode_global_id(":no-typename").is_none());
        assert!(decode_global_id("no-id:").is_none());
    }

    #[test]
    fn test_message_cursor() {
        let cursor = encode_message_cursor("proj", "sess", 42);
        assert_eq!(cursor, "Message:proj:sess:42");
    }

    #[test]
    fn test_session_cursor_roundtrip() {
        let cursor = encode_session_cursor("sess123", "2024-01-01");
        let (session_id, date) = decode_session_cursor(&cursor).unwrap();
        assert_eq!(session_id, "sess123");
        assert_eq!(date, "2024-01-01");
    }

    #[test]
    fn test_msg_cursor_roundtrip() {
        let cursor = encode_msg_cursor("2024-01-15T10:30:00Z", "abc-123-def");
        let (ts, id) = decode_msg_cursor(&cursor).unwrap();
        assert_eq!(ts, "2024-01-15T10:30:00Z");
        assert_eq!(id, "abc-123-def");
    }

    #[test]
    fn test_msg_cursor_rejects_old_format() {
        assert!(decode_msg_cursor("Message:proj:sess:42").is_none());
    }

    #[test]
    fn test_msg_cursor_rejects_invalid() {
        assert!(decode_msg_cursor("MC:").is_none());
        assert!(decode_msg_cursor("MC:|").is_none());
        assert!(decode_msg_cursor("MC:ts|").is_none());
        assert!(decode_msg_cursor("MC:|id").is_none());
        assert!(decode_msg_cursor("garbage").is_none());
    }
}
