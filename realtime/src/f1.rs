use anyhow::Error;
use serde_json::json;
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

    let new_session_id = extract_session_id(&initial);
    let prev_session_id = state_service.get_session_id().await;

    let is_new_session = match (&prev_session_id, &new_session_id) {
        (Some(prev), Some(new)) => prev != new,
        _ => false,
    };

    if is_new_session {
        info!(
            ?prev_session_id,
            ?new_session_id,
            "Detected session transition upon connect/subscribe. Clearing previous session state."
        );
        state_service.clear_state().await?;
        let _ = update_sender.send(BroadcastMessage::Reset);
    }

    state_service.set_state(initial.clone()).await?;

    // Notify connected SSE clients of the initial session state
    let _ = update_sender.send(BroadcastMessage::Initial(initial.to_string()));

    let current_session_key = initial.pointer("/SessionInfo/Key").and_then(|v| v.as_i64());
    let current_session_name = initial
        .pointer("/SessionInfo/Name")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let mut stream = signalr::listen(client);

    while let Some(items) = stream.next().await {
        for update in items {
            trace!(?update.topic, "received update");

            if update.topic == "SessionInfo" {
                let update_key = update.data.get("Key").and_then(|v| v.as_i64());
                let update_name = update.data.get("Name").and_then(|v| v.as_str());

                let session_changed = match (
                    current_session_key,
                    update_key,
                    current_session_name.as_deref(),
                    update_name,
                ) {
                    (Some(curr_k), Some(new_k), _, _) if curr_k != new_k => true,
                    (_, _, Some(curr_n), Some(new_n))
                        if !new_n.is_empty() && curr_n != new_n =>
                    {
                        true
                    }
                    _ => false,
                };

                if session_changed {
                    warn!(
                        ?current_session_key,
                        ?update_key,
                        ?current_session_name,
                        ?update_name,
                        "received SessionInfo with new session key/name, restarting ingestion..."
                    );
                    return Ok(());
                }
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
