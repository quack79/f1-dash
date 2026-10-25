use anyhow::Error;
use serde_json::{Value, json};
use tokio::sync::broadcast::Sender;
use tokio_stream::StreamExt;
use tracing::{error, info, trace, warn};

use crate::http_server::BroadcastMessage;
use crate::services::state_service::{StateService, extract_session_id};

const URL: &str = "livetiming.formula1.com/signalrcore";
const HUB: &str = "Streaming";

const TOPICS: [&str; 17] = [
    "Heartbeat",
    "CarData.z",
    "Position.z",
    "ExtrapolatedClock",
    "TimingStats",
    "TimingAppData",
    "WeatherData",
    "TrackStatus",
    "SessionStatus",
    "DriverList",
    "RaceControlMessages",
    "SessionInfo",
    "SessionData",
    "LapCount",
    "TimingData",
    "TeamRadio",
    "ChampionshipPrediction",
];

pub async fn ingest_f1(
    state_service: StateService,
    update_sender: Sender<BroadcastMessage>,
) -> Result<(), Error> {
    let mut client = signalr::create_client(URL, HUB).await?;

    let initial = signalr::subscribe(&mut client, &TOPICS).await?;

    let session_id = extract_session_id(&initial);
    let prev_session_id = state_service.get_session_id().await;
    let session_changed = session_id != prev_session_id;

    state_service.set_state(initial.clone()).await?;

    // Only reset connected clients when the session changed, a routine reconnect
    // within the same session must not wipe their delay buffers
    if session_changed {
        info!(
            ?prev_session_id,
            ?session_id,
            "session changed, resetting connected clients"
        );
        let _ = update_sender.send(BroadcastMessage::Reset);
        let _ = update_sender.send(BroadcastMessage::Initial(initial.to_string()));
    }

    let current_session_info = initial.get("SessionInfo");

    let mut stream = signalr::listen(client);

    while let Some(items) = stream.next().await {
        for update in items {
            trace!(?update.topic, "received update");

            if update.topic == "SessionInfo"
                && is_session_change(current_session_info, &update.data)
            {
                warn!(
                    ?session_id,
                    update = ?update.data,
                    "received SessionInfo for a new session, restarting ingestion..."
                );
                return Ok(());
            }

            if update.topic == "SessionStatus" {
                if let Some(status) = update.data.get("Status").and_then(|s| s.as_str()) {
                    if status == "Ends" || status == "Finalised" || status == "Finished" {
                        info!(?status, "SessionStatus indicates session end");
                    }
                }
            }

            let payload = json!({ update.topic: update.data });

            if let Err(err) = update_sender.send(BroadcastMessage::Update(payload.to_string())) {
                trace!(?err, "failed to send update (no receivers)");
            }

            if let Err(err) = state_service.update_state(payload).await {
                error!(?err, "failed to update state");
            }
        }
    }

    info!("SignalR ingestion stream completed");
    Ok(())
}

/// Whether a SessionInfo update belongs to a different session than `current`,
/// the SessionInfo of the snapshot we subscribed with (if it had one)
fn is_session_change(current: Option<&Value>, update: &Value) -> bool {
    let key = |info: &Value| info.get("Key").and_then(Value::as_i64);
    let name = |info: &Value| {
        info.get("Name")
            .and_then(Value::as_str)
            .filter(|name| !name.is_empty())
            .map(str::to_string)
    };

    let (current_key, current_name) = (current.and_then(key), current.and_then(name));
    let (update_key, update_name) = (key(update), name(update));

    match (current_key, &current_name) {
        // the snapshot had no session, so any update identifying one starts a new session
        (None, None) => update_key.is_some() || update_name.is_some(),
        _ => {
            matches!((current_key, update_key), (Some(c), Some(u)) if c != u)
                || matches!((current_name, update_name), (Some(c), Some(u)) if c != u)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_session_change() {
        let current = json!({ "Key": 9100, "Name": "Practice 1" });

        // same session, partial updates
        assert!(!is_session_change(Some(&current), &json!({ "Key": 9100 })));
        assert!(!is_session_change(
            Some(&current),
            &json!({ "ArchiveStatus": { "Status": "Complete" } })
        ));
        assert!(!is_session_change(Some(&current), &json!({ "Name": "" })));

        // new session by key or name
        assert!(is_session_change(Some(&current), &json!({ "Key": 9101 })));
        assert!(is_session_change(
            Some(&current),
            &json!({ "Name": "Qualifying" })
        ));

        // snapshot without SessionInfo
        assert!(is_session_change(
            None,
            &json!({ "Key": 9101, "Name": "Qualifying" })
        ));
        assert!(is_session_change(
            Some(&json!({})),
            &json!({ "Name": "Qualifying" })
        ));
        assert!(!is_session_change(
            None,
            &json!({ "ArchiveStatus": { "Status": "Complete" } })
        ));
    }
}
