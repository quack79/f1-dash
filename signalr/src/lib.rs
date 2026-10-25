use std::{env, str::FromStr, time::Duration};

use futures::{SinkExt, Stream, StreamExt};
use reqwest::{
    Url,
    header::{self, HeaderValue},
};
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use serde_json::Value;
use tokio_tungstenite::tungstenite::{Message, client::IntoClientRequest, http::Request};
use tracing::{debug, error, info, trace, warn};
use uuid::Uuid;

/// ASCII Record Separator — used to delimit SignalR Core JSON messages.
const RECORD_SEPARATOR: &str = "\u{001E}";
/// Message type constants (SignalR Core Hub Protocol)
const INVOCATION: i32 = 1;
const COMPLETION: i32 = 3;
const PING: i32 = 6;
const CLOSE: i32 = 7;

// ──────────────────────────── Negotiation ────────────────────────────
#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct NegotiationResponse {
    pub connection_token: Option<String>,
    pub connection_id: Option<String>,
    pub negotiate_version: Option<i32>,
}

struct Negotiation {
    connection_token: Option<String>,
    cookie: String,
}

/// Perform the SignalR Core negotiation handshake.
///
/// 1. Pre-flight OPTIONS to obtain the AWSALBCORS cookie.
/// 2. POST to /negotiate to get the connection token.
async fn negotiate(base_url: &str) -> Result<Negotiation, anyhow::Error> {
    let negotiate_url = format!("https://{}/negotiate", base_url);

    // Step 1: OPTIONS pre-flight to get AWSALBCORS cookie with a 15-second timeout
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()?;

    let options_res = client
        .request(reqwest::Method::OPTIONS, &negotiate_url)
        .send()
        .await?;

    let cookie = options_res
        .cookies()
        .find(|c| c.name() == "AWSALBCORS")
        .map(|c| format!("AWSALBCORS={}", c.value()))
        .unwrap_or_default();

    debug!(?cookie, "obtained AWSALBCORS cookie");

    // Step 2: POST negotiate with negotiateVersion=1
    let url = Url::parse_with_params(&negotiate_url, &[("negotiateVersion", "1")])?;
    let mut req = client.post(url);
    if !cookie.is_empty() {
        req = req.header(header::COOKIE, &cookie);
    }

    let res = req.send().await?;
    let status = res.status();
    let body = res.text().await?;

    if body.trim().is_empty() {
        return Err(anyhow::anyhow!(
            "SignalR Core negotiate returned empty response (HTTP {status}). \
             There may be no active session."
        ));
    }

    let negotiation: NegotiationResponse = serde_json::from_str(&body).map_err(|e| {
        anyhow::anyhow!(
            "Failed to parse negotiate response: {e} — body: {}",
            &body[..body.len().min(300)]
        )
    })?;

    debug!(?negotiation, "negotiation complete");

    Ok(Negotiation {
        connection_token: negotiation.connection_token,
        cookie,
    })
}

// ──────────────────────────── WebSocket Types ────────────────────────────

type WsStream =
    tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>;

pub struct SignalrClient {
    pub stream: WsStream,
}

// ──────────────────────────── Create Client ────────────────────────────

pub async fn create_client(base_url: &str, _hub: &str) -> Result<SignalrClient, anyhow::Error> {
    // Dev mode: connect directly to the simulator, skipping negotiate + handshake.
    if let Some(dev_url) = env::var("F1_DEV_URL").ok() {
        let url = Url::from_str(&dev_url)?;
        info!("dev mode: connecting directly to {url}");
        let (stream, _) = tokio::time::timeout(
            Duration::from_secs(10),
            tokio_tungstenite::connect_async(url.into_client_request()?),
        )
        .await
        .map_err(|_| anyhow::anyhow!("Timeout connecting to simulator at {dev_url}"))??;
        return Ok(SignalrClient { stream });
    }

    let negotiation = negotiate(base_url).await?;

    // Build the WebSocket URL
    let mut ws_url = Url::parse(&format!("wss://{}", base_url))?;
    if let Some(ref token) = negotiation.connection_token {
        ws_url.query_pairs_mut().append_pair("id", token);
    }

    info!("connecting to {ws_url}");

    let mut req: Request<()> = ws_url.clone().into_client_request()?;

    let headers = req.headers_mut();
    headers.insert(header::USER_AGENT, HeaderValue::from_static("BestHTTP"));
    headers.insert(
        header::ACCEPT_ENCODING,
        HeaderValue::from_static("gzip,identity"),
    );
    if !negotiation.cookie.is_empty() {
        headers.insert(header::COOKIE, negotiation.cookie.parse()?);
    }

    let (mut stream, res) = tokio::time::timeout(
        Duration::from_secs(15),
        tokio_tungstenite::connect_async(req),
    )
    .await
    .map_err(|_| anyhow::anyhow!("Timeout connecting WebSocket to {ws_url}"))??;
    debug!(?res, "ws connected");

    // ── SignalR Core Handshake ──
    let json = serialize(&serde_json::json!({"protocol": "json", "version": 1}))?;
    stream.send(Message::text(json)).await?;

    // Receive handshake response (should be {}\u{001E} for success) with a 15s timeout
    let handshake_response = tokio::time::timeout(Duration::from_secs(15), stream.next())
        .await
        .map_err(|_| anyhow::anyhow!("Timeout waiting for SignalR handshake response"))?
        .ok_or_else(|| anyhow::anyhow!("No handshake response"))??;

    match &handshake_response {
        Message::Text(txt) => {
            let msg = deserialize::<Value>(&txt);

            match msg {
                Ok(parsed) => {
                    if let Some(err) = parsed.get("error") {
                        return Err(anyhow::anyhow!("SignalR handshake error: {}", err));
                    }
                    debug!("handshake successful");
                }
                Err(e) => {
                    return Err(anyhow::anyhow!("Failed to parse handshake response: {}", e));
                }
            }
        }
        _ => {
            return Err(anyhow::anyhow!(
                "Unexpected handshake response type: {:?}",
                handshake_response
            ));
        }
    }

    Ok(SignalrClient { stream })
}

// ──────────────────────────── SignalR Core Message Types ────────────────────────────
#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct Completion {
    r#type: i32,
    invocation_id: String,
    result: Option<Value>,
    error: Option<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InvocationMessage {
    r#type: i32,
    invocation_id: String,
    target: String,
    arguments: Vec<Value>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FeedMessage {
    r#type: i32,
    target: String,
    arguments: (String, Value, String),
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct MinimalMessage {
    r#type: i32,
    #[serde(default)]
    error: Option<String>,
}

// ──────────────────────────── Subscribe ────────────────────────────
pub async fn subscribe(
    client: &mut SignalrClient,
    topics: &[&str],
) -> Result<Value, anyhow::Error> {
    // Dev mode: simulator streams raw feed messages; skip the subscribe ceremony
    // and return an empty initial state — updates will build state from scratch.
    if env::var("F1_DEV_URL").is_ok() {
        return Ok(Value::Object(Default::default()));
    }

    let invocation_id = Uuid::new_v4().to_string();

    let invoke = InvocationMessage {
        r#type: INVOCATION,
        invocation_id: invocation_id.clone(),
        target: "Subscribe".to_string(),
        arguments: vec![Value::Array(
            topics
                .iter()
                .map(|&t| Value::String(t.to_string()))
                .collect(),
        )],
    };

    let json = serialize(&invoke)?;

    client.stream.send(Message::text(json)).await?;

    debug!("subscribe invocation sent, waiting for completion...");

    // Wait for the Completion response (type 3) with our invocation ID, timeout after 30s
    tokio::time::timeout(Duration::from_secs(30), async {
        loop {
            let response = client
                .stream
                .next()
                .await
                .ok_or_else(|| anyhow::anyhow!("No response received from server"))??;

            let Message::Text(txt) = response else {
                continue;
            };

            for msg in split_messages(&txt) {
                let Ok(completion) = deserialize::<Completion>(msg) else {
                    continue;
                };

                if completion.r#type != COMPLETION || completion.invocation_id != invocation_id {
                    continue;
                }

                if let Some(error) = completion.error {
                    return Err(anyhow::anyhow!("Server error: {}", error));
                }

                return completion
                    .result
                    .ok_or_else(|| anyhow::anyhow!("No result received"));
            }
        }
    })
    .await
    .map_err(|_| anyhow::anyhow!("Timeout waiting for SignalR subscribe completion"))?
}

fn serialize<T>(value: &T) -> Result<String, serde_json::Error>
where
    T: ?Sized + Serialize,
{
    let serialized = serde_json::to_string(value)?;
    Ok(serialized + RECORD_SEPARATOR)
}

fn deserialize<T: DeserializeOwned>(input: &str) -> Result<T, serde_json::Error> {
    let stripped = strip_record_separator(input);
    serde_json::from_str(stripped)
}

fn split_messages(input: &str) -> Vec<&str> {
    input
        .split(RECORD_SEPARATOR)
        .filter(|item| !item.trim().is_empty())
        .collect()
}

fn strip_record_separator(input: &str) -> &str {
    input.trim_end_matches(RECORD_SEPARATOR)
}

// ──────────────────────────── Public Data Types ────────────────────────────
#[derive(Debug, Clone)]
pub struct UpdateArgs {
    pub topic: String,
    pub data: serde_json::Value,
    pub timestamp: String,
}

// ──────────────────────────── Listen (structured) ────────────────────────────

/// Listen to WebSocket messages and parse them into structured UpdateArgs.
/// In SignalR Core, feed updates arrive as Invocation messages (type 1)
/// with target "feed" and arguments [topic, data, timestamp].
///
/// Features active client pings (`{"type":6}\u{001E}`) every 15 seconds,
/// server ping & close frame handling, and a 40-second watchdog timer to cleanly
/// detect half-open TCP connections.
pub fn listen(client: SignalrClient) -> impl Stream<Item = Vec<UpdateArgs>> {
    let (tx, rx) = tokio::sync::mpsc::channel::<Vec<UpdateArgs>>(64);

    tokio::spawn(async move {
        let (mut ws_tx, mut ws_rx) = client.stream.split();
        let mut ping_interval = tokio::time::interval(Duration::from_secs(15));
        ping_interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
        // Consume immediate first tick so we wait 15s before first ping
        ping_interval.tick().await;

        // Created once and only pushed forward when a frame is received, so our own
        // keepalive pings never restart it
        let watchdog_timeout = Duration::from_secs(40);
        let watchdog = tokio::time::sleep(watchdog_timeout);
        tokio::pin!(watchdog);

        loop {
            tokio::select! {
                // If receiver dropped, cleanly abort task
                _ = tx.closed() => {
                    debug!("listen receiver dropped, terminating SignalR reader task");
                    break;
                }

                // Send active SignalR Core ping frame to keep the connection alive
                _ = ping_interval.tick() => {
                    let ping_msg = Message::text(format!("{{\"type\":{}}}{}", PING, RECORD_SEPARATOR));
                    if let Err(err) = ws_tx.send(ping_msg).await {
                        warn!(?err, "failed to send SignalR keepalive ping; connection dropped");
                        break;
                    }
                    trace!("sent SignalR client keepalive ping");
                }

                // No frame received within the watchdog window, treat the connection as dead
                _ = &mut watchdog => {
                    warn!("SignalR watchdog timeout: no messages or heartbeats received for {watchdog_timeout:?}, aborting dead connection");
                    break;
                }

                // Read incoming WebSocket frames
                msg_opt = ws_rx.next() => {
                    let msg = match msg_opt {
                        Some(Ok(m)) => m,
                        Some(Err(err)) => {
                            error!(?err, "WebSocket error during listen");
                            break;
                        }
                        None => {
                            info!("WebSocket connection closed by server");
                            break;
                        }
                    };

                    watchdog.as_mut().reset(tokio::time::Instant::now() + watchdog_timeout);

                    match msg {
                        Message::Text(txt) => {
                            let messages = split_messages(&txt);
                            let mut results = Vec::new();

                            for raw_msg in messages {
                                if let Ok(min_msg) = deserialize::<MinimalMessage>(raw_msg) {
                                    match min_msg.r#type {
                                        PING => {
                                            trace!("received SignalR ping frame from server");
                                            continue;
                                        }
                                        CLOSE => {
                                            warn!(error = ?min_msg.error, "received SignalR Close frame from server, terminating stream");
                                            return;
                                        }
                                        _ => {}
                                    }
                                }

                                let invocation = match deserialize::<FeedMessage>(raw_msg) {
                                    Ok(invocation) => invocation,
                                    Err(err) => {
                                        debug!(?err, frame = raw_msg, "skipping non-feed signalr frame");
                                        continue;
                                    }
                                };

                                if invocation.r#type != INVOCATION || invocation.target != "feed" {
                                    continue;
                                }

                                let (topic, data, timestamp) = invocation.arguments;

                                results.push(UpdateArgs {
                                    topic,
                                    data,
                                    timestamp,
                                });
                            }

                            if !results.is_empty() {
                                if tx.send(results).await.is_err() {
                                    debug!("stream receiver dropped while sending updates");
                                    break;
                                }
                            }
                        }
                        Message::Ping(payload) => {
                            trace!("received WebSocket protocol Ping frame");
                            if let Err(err) = ws_tx.send(Message::Pong(payload)).await {
                                warn!(?err, "failed to respond with WebSocket Pong");
                                break;
                            }
                        }
                        Message::Close(frame) => {
                            info!(?frame, "received WebSocket protocol Close frame");
                            break;
                        }
                        _ => {}
                    }
                }
            }
        }
    });

    tokio_stream::wrappers::ReceiverStream::new(rx)
}

// ──────────────────────────── Listen Raw ────────────────────────────

/// Listen to raw WebSocket messages without parsing them.
/// Returns the raw text messages as-is, useful for saving to a file for replay.
pub fn listen_raw(client: SignalrClient) -> futures::stream::BoxStream<'static, String> {
    client
        .stream
        .filter_map(|message| async move {
            match message {
                Ok(Message::Text(txt)) => Some(txt.to_string()),
                Ok(_) => None,
                Err(err) => {
                    error!(?err, "ws error");
                    None
                }
            }
        })
        .boxed()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_split_messages() {
        let payload = format!(
            "{{\"type\":6}}{}{{\"type\":1,\"target\":\"feed\",\"arguments\":[\"SessionInfo\",{{\"Name\":\"Practice 1\"}},\"2026-10-25T12:00:00Z\"]}}{}",
            RECORD_SEPARATOR, RECORD_SEPARATOR
        );
        let msgs = split_messages(&payload);
        assert_eq!(msgs.len(), 2);
        assert_eq!(msgs[0], "{\"type\":6}");
        assert!(msgs[1].contains("\"target\":\"feed\""));
    }

    #[test]
    fn test_parse_minimal_message_ping() {
        let raw = "{\"type\":6}";
        let min_msg: MinimalMessage = deserialize(raw).expect("should parse ping");
        assert_eq!(min_msg.r#type, PING);
    }

    #[test]
    fn test_parse_minimal_message_close() {
        let raw = "{\"type\":7,\"error\":\"Hub closed\",\"allowReconnect\":true}";
        let min_msg: MinimalMessage = deserialize(raw).expect("should parse close");
        assert_eq!(min_msg.r#type, CLOSE);
        assert_eq!(min_msg.error.as_deref(), Some("Hub closed"));
    }

    #[test]
    fn test_parse_feed_message() {
        let raw = json!({
            "type": 1,
            "target": "feed",
            "arguments": ["TrackStatus", { "Status": "1", "Message": "AllClear" }, "2026-10-25T12:00:00Z"]
        }).to_string();

        let feed: FeedMessage = deserialize(&raw).expect("should parse feed");
        assert_eq!(feed.r#type, INVOCATION);
        assert_eq!(feed.target, "feed");
        assert_eq!(feed.arguments.0, "TrackStatus");
        assert_eq!(feed.arguments.1["Status"], "1");
        assert_eq!(feed.arguments.2, "2026-10-25T12:00:00Z");
    }
}
