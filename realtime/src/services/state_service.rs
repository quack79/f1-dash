use anyhow::Error;
use serde_json::Value;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Clone)]
pub struct StateService {
    state: Arc<RwLock<Value>>,
}

impl StateService {
    pub fn new() -> Self {
        Self {
            state: Arc::new(RwLock::new(Value::Object(serde_json::Map::new()))),
        }
    }

    pub async fn get_state(&self) -> Result<Value, Error> {
        let state = self.state.read().await;
        Ok(state.clone())
    }

    pub async fn get_state_string(&self) -> Result<String, Error> {
        let state = self.state.read().await;
        Ok(state.to_string())
    }

    pub async fn set_state(&self, new_state: Value) -> Result<(), Error> {
        let mut state = self.state.write().await;
        *state = new_state;
        Ok(())
    }

    pub async fn clear_state(&self) -> Result<(), Error> {
        let mut state = self.state.write().await;
        *state = Value::Object(serde_json::Map::new());
        Ok(())
    }

    pub async fn update_state(&self, update: Value) -> Result<(), Error> {
        let mut state = self.state.write().await;
        merge(&mut state, update);
        Ok(())
    }

    pub async fn get_session_id(&self) -> Option<String> {
        let state = self.state.read().await;
        extract_session_id(&state)
    }
}

pub fn extract_session_id(value: &Value) -> Option<String> {
    let info = value.get("SessionInfo")?;
    let meeting_key = info.pointer("/Meeting/Key").and_then(|v| v.as_i64()).unwrap_or(0);
    let key = info.get("Key").and_then(|v| v.as_i64()).unwrap_or(0);
    let name = info.get("Name").and_then(|v| v.as_str()).unwrap_or("");
    if key == 0 && name.is_empty() {
        None
    } else {
        Some(format!("{}:{}:{}", meeting_key, key, name))
    }
}

pub fn merge(base: &mut Value, update: Value) {
    match (base, update) {
        (Value::Object(prev), Value::Object(update)) => {
            for (k, v) in update {
                merge(prev.entry(k).or_insert(Value::Null), v);
            }
        }
        (Value::Array(prev), Value::Object(update)) => {
            for (k, v) in update {
                if let Ok(index) = k.parse::<usize>() {
                    if let Some(item) = prev.get_mut(index) {
                        merge(item, v);
                    } else {
                        prev.push(v);
                    }
                }
            }
        }
        (a, b) => *a = b,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[tokio::test]
    async fn test_state_service_clear_and_set() {
        let service = StateService::new();
        let initial = json!({
            "SessionInfo": {
                "Meeting": { "Key": 1234 },
                "Key": 9100,
                "Name": "Practice 1"
            },
            "DriverList": { "1": { "BroadcastName": "VER" } }
        });

        service.set_state(initial).await.unwrap();
        assert_eq!(
            service.get_session_id().await,
            Some("1234:9100:Practice 1".to_string())
        );

        service.clear_state().await.unwrap();
        let cleared = service.get_state().await.unwrap();
        assert_eq!(cleared, json!({}));
        assert_eq!(service.get_session_id().await, None);
    }

    #[test]
    fn test_extract_session_id() {
        let state1 = json!({
            "SessionInfo": {
                "Meeting": { "Key": 1234 },
                "Key": 9100,
                "Name": "Practice 1"
            }
        });
        assert_eq!(
            extract_session_id(&state1),
            Some("1234:9100:Practice 1".to_string())
        );

        let state2 = json!({
            "SessionInfo": {
                "Meeting": { "Key": 1234 },
                "Key": 9101,
                "Name": "Qualifying"
            }
        });
        assert_eq!(
            extract_session_id(&state2),
            Some("1234:9101:Qualifying".to_string())
        );

        let empty = json!({});
        assert_eq!(extract_session_id(&empty), None);
    }
}
