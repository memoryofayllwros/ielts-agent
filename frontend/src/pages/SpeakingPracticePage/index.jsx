import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import DashboardNavbar from "components/Navbars/DashboardNavbar";
import SessionSkillBreakdown from "components/LearningLoop/SessionSkillBreakdown";
import NextBestPracticeCard from "components/LearningLoop/NextBestPracticeCard";
import { generateSession, submitSpeakingForm, submitSpeakingJson } from "services/api";

function EvaluationView({ evaluation }) {
  if (!evaluation) return null;
  return (
    <Box>
      <Typography variant="h6" fontWeight={700} gutterBottom>{evaluation.band}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{evaluation.overall_feedback}</Typography>
      {(evaluation.category_scores || []).map((c) => (
        <Box key={c.category} sx={{ mb: 1.5 }}>
          <Typography variant="subtitle2" fontWeight={600}>{c.category}: {c.score}/{c.max_score}</Typography>
          <Typography variant="body2" color="text.secondary">{c.feedback}</Typography>
        </Box>
      ))}
      {evaluation.strengths?.length > 0 && (
        <Typography variant="body2" sx={{ mt: 2 }}><strong>Strengths:</strong> {evaluation.strengths.join(" · ")}</Typography>
      )}
      {evaluation.improvements?.length > 0 && (
        <Typography variant="body2" sx={{ mt: 1 }}><strong>Improve:</strong> {evaluation.improvements.join(" · ")}</Typography>
      )}
      {evaluation.better_answer_snippet && (
        <Box sx={{ mt: 2, p: 2, bgcolor: "grey.100", borderRadius: 2, border: 1, borderColor: "divider" }}>
          <Typography variant="caption" fontWeight={700} color="primary">Example snippet</Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>{evaluation.better_answer_snippet}</Typography>
        </Box>
      )}
    </Box>
  );
}

export default function SpeakingPracticePage({
  prefetchedSession = null,
  onDiagnosticContinue = null,
  diagnosticContinueLabel = null,
}) {
  const [sp] = useSearchParams();
  const useAdaptive = sp.get("adaptive") === "1";
  const focusSkill = sp.get("focus") || sp.get("focus_skill") || null;
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [session, setSession] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [evaluation, setEvaluation] = useState(null);
  const [strengthenedSkills, setStrengthenedSkills] = useState([]);
  const [needsWorkSkills, setNeedsWorkSkills] = useState([]);
  const [recording, setRecording] = useState(false);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const recRef = useRef(null);

  useEffect(() => {
    if (prefetchedSession?.session_id) {
      setSession(prefetchedSession);
      setTranscript("");
      setEvaluation(null);
      setError("");
      chunksRef.current = [];
    }
  }, [prefetchedSession]);

  const startRecording = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRef.current = stream;
      const rec = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : undefined });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch {
      setError("Microphone access denied or unavailable.");
    }
  };

  const stopRecording = () => {
    if (recRef.current && recording) {
      recRef.current.stop();
      setRecording(false);
    }
  };

  const runBrowserDictation = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setError("Browser speech recognition not available. Type or paste your transcript.");
      return;
    }
    const r = new SR();
    r.lang = "en-AU";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (ev) => {
      let add = "";
      for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
        if (ev.results[i].isFinal) add += ev.results[i][0].transcript;
      }
      if (add) setTranscript((prev) => `${prev}${add}`);
    };
    r.onerror = () => setError("Dictation ended or failed.");
    r.start();
  };

  const handleGenerate = async () => {
    if (prefetchedSession?.session_id) return;
    setError("");
    setLoading(true);
    try {
      const data = await generateSession({
        skill: "speaking",
        topic: topic.trim() || null,
        use_adaptive: useAdaptive,
        focus_skill: focusSkill || null,
      });
      setSession(data);
      setTranscript("");
      setEvaluation(null);
      setStrengthenedSkills([]);
      setNeedsWorkSkills([]);
      chunksRef.current = [];
    } catch (e) {
      setError(e.message || "Failed to generate");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      const blob = chunksRef.current.length
        ? new Blob(chunksRef.current, { type: "audio/webm" })
        : null;
      let res;
      if (blob && blob.size > 0) {
        res = await submitSpeakingForm(session.session_id, blob, transcript.trim() || undefined);
      } else if (transcript.trim()) {
        res = await submitSpeakingJson(session.session_id, transcript.trim());
      } else {
        throw new Error("Record audio or enter a transcript.");
      }
      setEvaluation(res.evaluation);
      setStrengthenedSkills(res.strengthened_skills || []);
      setNeedsWorkSkills(res.needs_work_skills || []);
    } catch (e) {
      setError(e.message || "Submit failed");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (prefetchedSession?.session_id && onDiagnosticContinue) {
      onDiagnosticContinue();
      return;
    }
    setSession(null);
    setTranscript("");
    setEvaluation(null);
    setStrengthenedSkills([]);
    setNeedsWorkSkills([]);
    setError("");
    setTopic("");
    chunksRef.current = [];
  };

  if (prefetchedSession?.session_id && (!session || session.session_id !== prefetchedSession.session_id)) {
    return (
      <Box>
        <DashboardNavbar title="Diagnostic — Speaking" />
        <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>
      </Box>
    );
  }

  if (!session && !loading) {
    return (
      <Box>
        <DashboardNavbar title="Speaking" />
        <Box sx={{ width: "100%", minWidth: 0 }}>
          <Card sx={{ borderRadius: "16px" }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h5" fontWeight={700} gutterBottom>IELTS Speaking (Part 2)</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Record your answer or use live dictation / typed transcript. With OPENROUTER_API_KEY on the server, audio is transcribed via OpenRouter. Rubric scores map to micro-skills.
              </Typography>
              {useAdaptive && (
                <Alert severity="info" sx={{ mb: 2, borderRadius: "8px" }}>
                  Adaptive: the cue card is shaped toward your weakest speaking micro-skill.
                </Alert>
              )}
              {!prefetchedSession?.session_id && (
              <TextField label="Theme hint (optional)" value={topic} onChange={(e) => setTopic(e.target.value)} fullWidth size="small" sx={{ mb: 2 }} />
              )}
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              <Button variant="contained" fullWidth onClick={handleGenerate}>Get cue card</Button>
            </CardContent>
          </Card>
        </Box>
      </Box>
    );
  }

  if (loading && !session) {
    return (
      <Box>
        <DashboardNavbar title="Speaking" />
        <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>
      </Box>
    );
  }

  const navTitle = prefetchedSession?.session_id
    ? (evaluation ? "Diagnostic — Speaking (results)" : "Diagnostic — Speaking")
    : (evaluation ? "Speaking — Results" : "Speaking");

  return (
    <Box>
      <DashboardNavbar title={navTitle} />
      <Card sx={{ mb: 2, borderRadius: "16px" }}>
        <CardContent sx={{ p: 2, display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
          <Chip label={session.topic} />
          <Typography variant="caption" color="text.secondary">
            Prep {session.prep_seconds}s · Speak ~{session.speak_seconds}s
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button size="small" onClick={handleReset}>{prefetchedSession?.session_id ? "Exit" : "New cue"}</Button>
        </CardContent>
      </Card>

      {!evaluation && (
        <>
          <Card sx={{ mb: 2, borderRadius: "16px" }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>{session.prompt}</Typography>
              <List dense>
                {(session.bullet_points || []).map((b, i) => (
                  <ListItem key={i} sx={{ display: "list-item", py: 0 }}><Typography variant="body2">{b}</Typography></ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
          <Card sx={{ mb: 2, borderRadius: "16px" }}>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>Recording</Typography>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
                {!recording ? (
                  <Button variant="contained" color="secondary" onClick={startRecording}>Record</Button>
                ) : (
                  <Button variant="outlined" color="error" onClick={stopRecording}>Stop</Button>
                )}
                <Button variant="outlined" onClick={runBrowserDictation}>Live dictation</Button>
              </Box>
              <Typography variant="subtitle2" gutterBottom>Transcript (edit if needed)</Typography>
              <TextField
                multiline
                minRows={6}
                fullWidth
                placeholder="Your spoken answer as text…"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
              />
              {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
              <Button sx={{ mt: 2 }} variant="contained" disabled={loading} onClick={handleSubmit}>
                {loading ? <CircularProgress size={22} color="inherit" /> : "Submit for feedback"}
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {evaluation && (
        <Card sx={{ borderRadius: "16px" }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary">Approximate score (from transcript)</Typography>
            <Typography variant="h4" fontWeight={700} color="primary">{evaluation.percentage}%</Typography>
            <EvaluationView evaluation={evaluation} />
            <Box sx={{ my: 2 }}>
              <SessionSkillBreakdown strengthenedSkills={strengthenedSkills} needsWorkSkills={needsWorkSkills} />
            </Box>
            <Box sx={{ my: 2 }}>
              <NextBestPracticeCard module="speaking" />
            </Box>
            {onDiagnosticContinue && diagnosticContinueLabel ? (
              <Button sx={{ mt: 3 }} variant="contained" onClick={() => onDiagnosticContinue()}>{diagnosticContinueLabel}</Button>
            ) : (
              <Button sx={{ mt: 3 }} variant="contained" onClick={handleReset}>Another cue</Button>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
