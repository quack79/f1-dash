use std::{env, sync::Arc};

use anyhow::Error;
use axum::{
    Router,
    extract::{
        State, WebSocketUpgrade,
        ws::{Message, WebSocket},
    },
    response::Response,
    routing::get,
};
use futures::{SinkExt, StreamExt};
use serde_json::Value;
use tokio::net::TcpListener;
use tracing::{debug, error, info};

pub struct AppState {
    lines: Vec<String>,
}

// Old ASP.NET SignalR: {"M":[{"H":"hub","M":"method","A":[args...]}]}
// SignalR Core (what `listen` expects): {"type":1,"target":"method","arguments":[args...]}\u{001E}
fn to_signalr_core(line: &str) -> Option<String> {
    let parsed: Value = serde_json::from_str(line).ok()?;
    let messages = parsed.get("M")?.as_array()?;

    let mut out = String::new();
    for msg in messages {
        if msg.get("M")?.as_str()? != "feed" {
            continue;
        }
        let args = msg.get("A")?;
        let core = serde_json::json!({"type": 1, "target": "feed", "arguments": args});
        out.push_str(&core.to_string());
        out.push('\u{001E}');
    }

    if out.is_empty() { None } else { Some(out) }
}

pub async fn run(lines: Vec<String>) -> Result<(), Error> {
    let addr = env::var("ADDRESS").unwrap_or_else(|_| "0.0.0.0:8000".to_string());

    let app_state = Arc::new(AppState { lines });

    let app = Router::new()
        .route("/ws", get(handle_http))
        .with_state(app_state);

    info!(addr, "starting simulator replay server");

    axum::serve(TcpListener::bind(addr).await?, app).await?;

    Ok(())
}

async fn handle_http(ws: WebSocketUpgrade, State(state): State<Arc<AppState>>) -> Response {
    info!("recived connection");

    ws.on_upgrade(|socket| handle_ws(socket, state))
}

async fn handle_ws(socket: WebSocket, state: Arc<AppState>) {
    let (mut tx, mut rx) = socket.split();

    tokio::select! {
        _ = async {
            let amount_of_updates = state.lines.len();

            debug!(amount_of_updates, "starting to send updates");

            for line in state.lines.iter() {
                let Some(converted) = to_signalr_core(line) else {
                    continue;
                };
                match tx.send(Message::text(converted)).await {
                    Ok(_) => {}
                    Err(e) => {
                        error!("error sending ws message: {}", e);
                        break;
                    }
                }
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            }

            tx.send(Message::Close(None))
        } => {}
        _ = async {
            while let Some(Ok(msg)) = rx.next().await {
                match msg {
                    Message::Close(_) => {
                        info!("received close");
                        break;
                    }
                    _ => {}
                }
            }
        } => {}
    }

    info!("connection closed");
}
