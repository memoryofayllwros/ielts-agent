import { useState, useRef, useCallback, useEffect } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import DashboardNavbar from "components/Navbars/DashboardNavbar";
import { QuestionCard, ScoreCircle } from "components/PracticeQuestions";
import { generateSession, submitAnswers, fetchListeningTts } from "services/api";

function ListenToolbar({ transcript, sessionId }) {
  const utterRef = useRef(null);
  const audioElRef = useRef(null);
  const serverUrlRef = useRef(null);
  const [playingBrowser, setPlayingBrowser] = useState(false);
  const [loadingServer, setLoadingServer] = useState(false);
  const [serverError, setServerError] = useState("");

  const stopBrowser = useCallback(() => {
    window.speechSynthesis.cancel();
    setPlayingBrowser(false);
  }, []);

  const playBrowser = useCallback(() => {
    if (!transcript?.trim()) return;
    stopBrowser();
    const u = new SpeechSynthesisUtterance(transcript);
    u.onend = () => setPlayingBrowser(false);
    u.onerror = () => setPlayingBrowser(false);
    utterRef.current = u;
    setPlayingBrowser(true);
    window.speechSynthesis.speak(u);
  }, [transcript, stopBrowser]);

  const loadServerAudio = async () => {
    setServerError("");
    setLoadingServer(true);
    try {
      if (audioElRef.current) {
        audioElRef.current.pause();
        audioElRef.current = null;
      }
      if (serverUrlRef.current) {
        URL.revokeObjectURL(serverUrlRef.current);
        serverUrlRef.current = null;
      }
      const blob = await fetchListeningTts(sessionId);
      const url = URL.createObjectURL(blob);
      serverUrlRef.current = url;
      const el = new Audio(url);
      el.onended = () => {
        if (serverUrlRef.current === url) {
          URL.revokeObjectURL(url);
          serverUrlRef.current = null;
        }
      };
      audioElRef.current = el;
      await el.play();
    } catch (e) {
      setServerError(e.message || "Server audio unavailable");
    } finally {
      setLoadingServer(false);
    }
  };

  return (
    <Box sx={{ mb: 2, display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
      <Button size="small" variant="contained" onClick={playBrowser} disabled={playingBrowser}>
        Play (browser voice)
      </Button>
      <Button size="small" variant="outlined" onClick={stopBrowser} disabled={!playingBrowser}>
        Stop
      </Button>
      <Button size="small" variant="outlined" onClick={loadServerAudio} disabled={loadingServer || !sessionId}>
        {loadingServer ? <CircularProgress size={18} /> : "Play (server voice)"}
      </Button>
      {serverError && (
        <Typography variant="caption" color="text.secondary">{serverError}</Typography>
      )}
    </Box>
  );
}

export default function ObjectivePracticePage({
  skill,
  navbarTitle,
  contentLabel,
  intro,
  loadingBlurb,
  prefetchedSession = null,
  diagnosticContinueLabel = null,
  onDiagnosticContinue = null,
}) {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [session, setSession] = useState(null);
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState(null);

  useEffect(() => {
    if (prefetchedSession?.session_id) {
      setSession(prefetchedSession);
      setAnswers({});
      setResults(null);
      setError("");
    }
  }, [prefetchedSession]);

  const scriptText = session
    ? (skill === "listening" ? (session.transcript || session.passage) : session.passage)
    : "";

  const questions = session?.questions ?? [];
  const allAnswered = session
    ? questions.length > 0 &&
      questions.every((q) => {
        const ans = answers[q.id];
        if (!ans || ans.length === 0) return false;
        if (q.type === "fill_in_blanks") {
          const blankCount = (q.passage_with_blanks?.match(/\[BLANK_\d+\]/g) || []).length;
          if (blankCount === 0) return false;
          return ans.filter(Boolean).length === blankCount;
        }
        return true;
      })
    : false;

  const handleGenerate = async () => {
    if (prefetchedSession?.session_id) return;
    setError("");
    setLoading(true);
    try {
      const data = await generateSession({ skill, topic: topic.trim() || null });
      setSession(data);
      setAnswers({});
      setResults(null);
    } catch (err) {
      setError(err.message || "Failed to generate session");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      const data = await submitAnswers(session.session_id, answers);
      setResults(data);
    } catch (err) {
      setError(err.message || "Failed to submit");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (prefetchedSession?.session_id) {
      onDiagnosticContinue?.();
      return;
    }
    setSession(null);
    setAnswers({});
    setResults(null);
    setError("");
    setTopic("");
    window.speechSynthesis.cancel();
  };

  const waitingPrefetch = prefetchedSession?.session_id && !session?.session_id;
  if (waitingPrefetch) {
    return (
      <Box>
        <DashboardNavbar title={navbarTitle} />
        <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
          <Card sx={{ borderRadius: "16px", p: 5, textAlign: "center" }}>
            <CircularProgress sx={{ mb: 3 }} />
            <Typography variant="h6" fontWeight={600}>{loadingBlurb}</Typography>
          </Card>
        </Box>
      </Box>
    );
  }

  if (!session && !loading) {
    return (
      <Box>
        <DashboardNavbar title={navbarTitle} />
        <Box sx={{ maxWidth: 600, mx: "auto" }}>
          <Card sx={{ borderRadius: "16px" }}>
            <CardContent sx={{ p: 4, textAlign: "center" }}>
              <Typography variant="h5" fontWeight={700} gutterBottom>{navbarTitle}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{intro}</Typography>
              {!prefetchedSession && (
              <TextField
                label="Topic (optional)"
                placeholder="e.g. Climate change, campus life…"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                fullWidth
                size="small"
                inputProps={{ maxLength: 80 }}
                sx={{ mb: 2 }}
              />
              )}
              {error && <Alert severity="error" sx={{ mb: 2, borderRadius: "8px" }}>{error}</Alert>}
              <Button variant="contained" color="primary" size="large" fullWidth onClick={handleGenerate} sx={{ py: 1.5, borderRadius: "10px", fontWeight: 700 }}>
                Start session
              </Button>
            </CardContent>
          </Card>
        </Box>
      </Box>
    );
  }

  if (loading && !session) {
    return (
      <Box>
        <DashboardNavbar title={navbarTitle} />
        <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
          <Card sx={{ borderRadius: "16px", p: 5, textAlign: "center" }}>
            <CircularProgress sx={{ mb: 3 }} />
            <Typography variant="h6" fontWeight={600}>{loadingBlurb}</Typography>
          </Card>
        </Box>
      </Box>
    );
  }

  if (results) {
    const resultMap = {};
    results.question_results.forEach((r) => { resultMap[r.question_id] = r; });
    return (
      <Box>
        <DashboardNavbar title="Results" />
        <Card sx={{ mb: 3, borderRadius: "16px" }}>
          <CardContent sx={{ p: 3, display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" }}>
            <ScoreCircle percentage={results.percentage} />
            <Box sx={{ flex: 1 }}>
              <Chip label={results.topic} size="small" sx={{ mb: 1, background: "#f0f2f5", fontWeight: 600 }} />
              <Typography variant="body1" color="text.secondary">
                {results.total_score} / {results.max_score} points · {results.question_results.filter((r) => r.is_correct).length} of {results.question_results.length} correct
              </Typography>
            </Box>
            {onDiagnosticContinue && diagnosticContinueLabel ? (
              <Button variant="contained" color="primary" onClick={() => onDiagnosticContinue()} sx={{ borderRadius: "10px", fontWeight: 700 }}>{diagnosticContinueLabel}</Button>
            ) : (
              <Button variant="contained" color="primary" onClick={handleReset} sx={{ borderRadius: "10px", fontWeight: 700 }}>Practice again</Button>
            )}
          </CardContent>
        </Card>
        <Card sx={{ mb: 3, borderRadius: "16px" }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase" letterSpacing={0.5} display="block" sx={{ mb: 1.5 }}>
              {skill === "listening" ? "Audio" : contentLabel}
            </Typography>
            {skill === "listening" ? (
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                The listening script is not shown after the test. Review your answers below.
              </Typography>
            ) : (
              <Typography variant="body1" sx={{ lineHeight: 1.9, color: "#344767", whiteSpace: "pre-wrap" }}>{scriptText}</Typography>
            )}
          </CardContent>
        </Card>
        {questions.map((q, i) => (
          <QuestionCard key={q.id} question={q} index={i} answers={answers[q.id]} onAnswer={() => {}} submitted result={resultMap[q.id]} />
        ))}
      </Box>
    );
  }

  return (
    <Box>
      <DashboardNavbar title={navbarTitle} />
      <Card sx={{ mb: 3, borderRadius: "16px" }}>
        <CardContent sx={{ p: 2.5, display: "flex", alignItems: "center", gap: 2 }}>
          <Chip label={session.topic} sx={{ background: "#f0f2f5", fontWeight: 600 }} />
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
            {questions.length} question{questions.length === 1 ? "" : "s"}
          </Typography>
          <Button variant="outlined" size="small" onClick={handleReset} sx={{ borderRadius: "8px" }}>{prefetchedSession?.session_id ? "Exit" : "New session"}</Button>
        </CardContent>
      </Card>
      <Card sx={{ mb: 3, borderRadius: "16px" }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase" letterSpacing={0.5} display="block" sx={{ mb: 1.5 }}>
            {skill === "listening" ? "Audio" : contentLabel}
          </Typography>
          {skill === "listening" && (
            <>
              <ListenToolbar transcript={scriptText} sessionId={session.session_id} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.8 }}>
                The full listening script is hidden during this test. Use the controls above to play audio as many times as you need.
              </Typography>
            </>
          )}
          {skill !== "listening" && (
            <Typography variant="body1" sx={{ lineHeight: 1.9, color: "#344767", whiteSpace: "pre-wrap" }}>{scriptText}</Typography>
          )}
        </CardContent>
      </Card>
      {questions.map((q, i) => (
        <QuestionCard
          key={q.id}
          question={q}
          index={i}
          answers={answers[q.id]}
          onAnswer={(val) => setAnswers((prev) => ({ ...prev, [q.id]: val }))}
          submitted={false}
          result={null}
        />
      ))}
      <Card sx={{ mb: 3, borderRadius: "16px" }}>
        <CardContent sx={{ p: 2.5, display: "flex", alignItems: "center", gap: 2 }}>
          {error && <Alert severity="error" sx={{ flex: 1, borderRadius: "8px" }}>{error}</Alert>}
          {!error && (
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
              {allAnswered ? "Ready to submit." : "Answer all questions before submitting."}
            </Typography>
          )}
          <Button variant="contained" color="primary" disabled={!allAnswered || loading} onClick={handleSubmit} sx={{ borderRadius: "10px", fontWeight: 700, minWidth: 140 }}>
            {loading ? <CircularProgress size={20} color="inherit" /> : "Submit"}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
