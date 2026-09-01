"use client";

import { RealtimeAgent, RealtimeSession } from "@openai/agents/realtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SIHA_AGENT_INSTRUCTIONS } from "@/lib/siha-agent";

type Status = "idle" | "connecting" | "listening" | "speaking" | "error";

type DebugEvent = {
  at: number;
  type: string;
  detail?: string;
};

type TranscriptTurn = {
  role: "AI" | "시하";
  text: string;
};

const SESSION_MS = 5 * 60 * 1000;
const MAX_EVENTS = 40;

function now() {
  return performance.now();
}

function formatSeconds(ms: number | null) {
  return ms === null ? "—" : `${(ms / 1000).toFixed(2)}초`;
}

export function VoiceTutor() {
  const sessionRef = useRef<RealtimeSession | null>(null);
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechStoppedRef = useRef<number | null>(null);
  const firstAudioSeenRef = useRef(false);

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<DebugEvent[]>([]);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const startedAtRef = useRef<number | null>(null);

  const addEvent = useCallback((type: string, detail?: string) => {
    setEvents((current) =>
      [{ at: now(), type, detail }, ...current].slice(0, MAX_EVENTS),
    );
  }, []);

  const stop = useCallback((reason = "manual") => {
    if (endTimerRef.current) clearTimeout(endTimerRef.current);
    endTimerRef.current = null;
    sessionRef.current?.close();
    sessionRef.current = null;
    startedAtRef.current = null;
    setStatus("idle");
    setElapsed(0);
    addEvent("SESSION_ENDED", reason);
  }, [addEvent]);

  useEffect(() => {
    if (status === "idle" || startedAtRef.current === null) return;
    const timer = window.setInterval(() => {
      if (startedAtRef.current !== null) {
        setElapsed(now() - startedAtRef.current);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => () => {
    if (endTimerRef.current) clearTimeout(endTimerRef.current);
    sessionRef.current?.close();
  }, []);

  const handleTransportEvent = useCallback((event: unknown) => {
    if (!event || typeof event !== "object") return;
    const realtimeEvent = event as Record<string, unknown>;
    const type = String(realtimeEvent.type ?? "unknown");

    if (type === "input_audio_buffer.speech_started") {
      setStatus("listening");
      firstAudioSeenRef.current = false;
      addEvent("SPEECH_STARTED");
      return;
    }

    if (type === "input_audio_buffer.speech_stopped") {
      speechStoppedRef.current = now();
      firstAudioSeenRef.current = false;
      addEvent("SPEECH_STOPPED");
      return;
    }

    if (
      !firstAudioSeenRef.current &&
      (type === "response.output_audio.delta" ||
        type === "response.audio.delta" ||
        type === "response.audio_transcript.delta")
    ) {
      firstAudioSeenRef.current = true;
      setStatus("speaking");
      if (speechStoppedRef.current !== null) {
        const measured = now() - speechStoppedRef.current;
        setLatencyMs(measured);
        addEvent("FIRST_AUDIO", `${Math.round(measured)}ms`);
      }
      return;
    }

    if (type.includes("transcription.completed")) {
      const transcript =
        typeof realtimeEvent.transcript === "string"
          ? realtimeEvent.transcript
          : undefined;
      addEvent("TRANSCRIPT", transcript);
      if (transcript?.trim()) {
        setTranscript((current) => [
          ...current,
          { role: "시하", text: transcript.trim() },
        ]);
      }
      return;
    }

    if (type === "response.output_audio_transcript.done") {
      const assistantTranscript =
        typeof realtimeEvent.transcript === "string"
          ? realtimeEvent.transcript.trim()
          : "";
      if (assistantTranscript) {
        setTranscript((current) => [
          ...current,
          { role: "AI", text: assistantTranscript },
        ]);
      }
      return;
    }

    if (type === "response.done") {
      setStatus("listening");
      addEvent("RESPONSE_DONE");
      return;
    }

    if (type === "error") {
      addEvent("REALTIME_ERROR");
    }
  }, [addEvent]);

  const start = useCallback(async () => {
    if (sessionRef.current || status === "connecting") return;
    setStatus("connecting");
    setError(null);
    setLatencyMs(null);
    setEvents([]);
    setTranscript([]);
    setCopyState("idle");

    try {
      const tokenResponse = await fetch("/api/realtime/session", {
        method: "POST",
        cache: "no-store",
      });
      const token = (await tokenResponse.json()) as {
        value?: string;
        client_secret?: { value?: string };
        error?: string;
      };
      const ephemeralKey = token.value ?? token.client_secret?.value;
      if (!tokenResponse.ok || !ephemeralKey) {
        throw new Error(token.error ?? "임시 세션을 만들지 못했어요.");
      }

      const agent = new RealtimeAgent({
        name: "Siha English Friend",
        instructions: SIHA_AGENT_INSTRUCTIONS,
      });

      const session = new RealtimeSession(agent, {
        model: "gpt-realtime-2.1",
        transport: "webrtc",
        config: {
          outputModalities: ["audio"],
          audio: {
            input: {
              transcription: {
                model: "gpt-4o-mini-transcribe",
                prompt: "A Korean child naturally mixing Korean and beginner English.",
              },
              turnDetection: {
                type: "semantic_vad",
                eagerness: "low",
                createResponse: true,
                interruptResponse: true,
              },
            },
            output: { voice: "marin" },
          },
        },
      });

      session.on("transport_event", handleTransportEvent);
      session.on("error", (sessionError) => {
        console.error(sessionError);
        addEvent("SDK_ERROR");
      });

      sessionRef.current = session;
      await session.connect({ apiKey: ephemeralKey });
      startedAtRef.current = now();
      setStatus("listening");
      addEvent("SESSION_CONNECTED");

      endTimerRef.current = setTimeout(() => {
        session.sendMessage(
          "The five-minute session is over. Say one very short warm goodbye with no question.",
        );
        setTimeout(() => stop("time_limit"), 5000);
      }, SESSION_MS);

      session.sendMessage(
        "Start now. Greet Siha naturally in Korean, say briefly that you are her English playmate, and ask in Korean what she wants to talk about today. Tell her she may answer in Korean. Do not start with a quiz or an animal choice.",
      );
    } catch (caught) {
      console.error(caught);
      sessionRef.current?.close();
      sessionRef.current = null;
      const message =
        caught instanceof Error ? caught.message : "연결에 실패했어요.";
      setError(message);
      setStatus("error");
      addEvent("CONNECT_ERROR", message);
    }
  }, [addEvent, handleTransportEvent, status, stop]);

  const remainingSeconds = useMemo(
    () => Math.max(0, Math.ceil((SESSION_MS - elapsed) / 1000)),
    [elapsed],
  );

  const copyTranscript = useCallback(async () => {
    const text = transcript
      .map((turn) => `${turn.role}: ${turn.text}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }, [transcript]);

  const characterClass = [
    "character",
    status === "speaking" ? "characterSpeaking" : "",
    status === "listening" ? "characterListening" : "",
  ].filter(Boolean).join(" ");

  return (
    <main className="appShell">
      <section className="tutorCard">
        <header className="topBar">
          <div>
            <p className="eyebrow">SIHA&apos;S ENGLISH FRIEND</p>
            <h1>시하야, 같이 놀자!</h1>
          </div>
          {status !== "idle" && status !== "error" && (
            <span className="timer">
              {Math.floor(remainingSeconds / 60)}:
              {String(remainingSeconds % 60).padStart(2, "0")}
            </span>
          )}
        </header>

        <div className="stage" aria-live="polite">
          <div className={characterClass} aria-hidden="true">
            <span className="ear earLeft" />
            <span className="ear earRight" />
            <span className="face">
              <span className="eye eyeLeft" />
              <span className="eye eyeRight" />
              <span className="mouth" />
            </span>
          </div>

          <p className="statusText">
            {status === "idle" && "영어 친구를 만나볼까?"}
            {status === "connecting" && "친구가 오고 있어…"}
            {status === "listening" && "시하의 이야기를 듣고 있어"}
            {status === "speaking" && "영어 친구가 말하고 있어"}
            {status === "error" && "친구를 만나지 못했어"}
          </p>

          {error && <p className="errorText">{error}</p>}
        </div>

        <div className="controls">
          {(status === "idle" || status === "error") ? (
            <button className="primaryButton" onClick={start}>
              <span className="micIcon">●</span>
              이야기 시작
            </button>
          ) : (
            <button className="stopButton" onClick={() => stop("manual")}>
              오늘은 여기까지
            </button>
          )}
          <p className="permissionHint">
            처음 한 번 마이크 사용을 허용해 주세요.
          </p>
        </div>

        {status === "idle" && transcript.length > 0 && (
          <section className="transcriptPanel">
            <div className="transcriptHeader">
              <div>
                <p className="transcriptEyebrow">오늘의 대화</p>
                <h2>대화 로그</h2>
              </div>
              <button className="copyButton" onClick={copyTranscript}>
                {copyState === "copied" ? "복사됨!" : "전체 복사"}
              </button>
            </div>
            {copyState === "error" && (
              <p className="copyError">복사하지 못했어요. 다시 눌러주세요.</p>
            )}
            <div className="transcriptList">
              {transcript.map((turn, index) => (
                <p className={`transcriptTurn transcript${turn.role}`} key={`${turn.role}-${index}`}>
                  <strong>{turn.role}</strong>
                  <span>{turn.text}</span>
                </p>
              ))}
            </div>
          </section>
        )}

        <button
          className="debugToggle"
          onClick={() => setShowDebug((value) => !value)}
          aria-expanded={showDebug}
        >
          개발 정보 {showDebug ? "닫기" : "보기"}
        </button>

        {showDebug && (
          <aside className="debugPanel">
            <div className="metric">
              <span>최근 응답 속도</span>
              <strong>{formatSeconds(latencyMs)}</strong>
            </div>
            <div className="metric">
              <span>VAD</span>
              <strong>semantic / low</strong>
            </div>
            <div className="eventList">
              {events.length === 0 && <p>아직 이벤트가 없어요.</p>}
              {events.map((event, index) => (
                <div className="eventRow" key={`${event.at}-${index}`}>
                  <span>{event.type}</span>
                  <small>{event.detail ?? ""}</small>
                </div>
              ))}
            </div>
          </aside>
        )}
      </section>
    </main>
  );
}
