use anyhow::Error;
use shared::tracing_subscriber;
use tokio::sync::broadcast;
use tracing::{debug, info, warn};

use crate::http_server::BroadcastMessage;
use crate::services::state_service::StateService;

mod f1;
mod http_server;
mod services {
    pub mod state_service;
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    // Try workspace-root path first, then service-local .env
    dotenvy::from_filename("realtime/.env").or_else(|_| dotenvy::dotenv()).ok();

    tracing_subscriber();

    let state_service = StateService::new();

    // Broadcast channel with capacity 256 to handle burst updates during active racing
    let (sender, _) = broadcast::channel::<BroadcastMessage>(256);

    {
        let state_service = state_service.clone();
        let sender = sender.clone();
        tokio::spawn(async move {
            let mut consecutive_failures: u32 = 0;

            loop {
                let start_time = std::time::Instant::now();

                match f1::ingest_f1(state_service.clone(), sender.clone()).await {
                    Ok(_) => {
                        info!("ingest_f1 completed session normally");
                    }
                    Err(err) => {
                        if consecutive_failures == 0 {
                            warn!(?err, "ingest_f1 connection lost/failed; checking for next session...");
                        } else {
                            debug!(?err, consecutive_failures, "ingest_f1 retry attempt failed");
                        }
                    }
                };

                // If the connection was active for at least 30 seconds, reset consecutive failures
                if start_time.elapsed() >= std::time::Duration::from_secs(30) {
                    consecutive_failures = 0;
                } else {
                    consecutive_failures = consecutive_failures.saturating_add(1);
                }

                // Exponential backoff between sessions: 2s -> 5s -> 10s -> 20s -> max 30s
                let delay = match consecutive_failures {
                    0 => std::time::Duration::from_secs(2),
                    1 => std::time::Duration::from_secs(2),
                    2 => std::time::Duration::from_secs(5),
                    3 => std::time::Duration::from_secs(10),
                    4 => std::time::Duration::from_secs(20),
                    _ => std::time::Duration::from_secs(30),
                };

                if consecutive_failures > 1 && consecutive_failures % 10 == 0 {
                    info!(
                        consecutive_failures,
                        delay_secs = delay.as_secs(),
                        "No active F1 live session currently; polling for upcoming session..."
                    );
                }

                tokio::time::sleep(delay).await;
            }
        });
    }

    http_server::start(state_service, sender).await?;

    Ok(())
}
