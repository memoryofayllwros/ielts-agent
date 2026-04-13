import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import DashboardNavbar from "components/Navbars/DashboardNavbar";
import { generateSession, submitWriting } from "services/api";

function wordCount(s) {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

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
      {evaluation.revised_excerpt && (
        <Box sx={{ mt: 2, p: 2, bgcolor: "#f8f9fa", borderRadius: 2 }}>
          <Typography variant="caption" fontWeight={700} color="primary">Suggested revision</Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>{evaluation.revised_excerpt}</Typography>
        </Box>
      )}
    </Box>
  );
}

export default function WritingPracticePage({
  prefetchedSession = null,
  onDiagnosticContinue = null,
  diagnosticContinueLabel = null,
}) {
  const [topic, setTopic] = useState("");
  const [taskType, setTaskType] = useState("write_essay");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [session, setSession] = useState(null);
  const [text, setText] = useState("");
  const [evaluation, setEvaluation] = useState(null);

  useEffect(() => {
    if (prefetchedSession?.session_id) {
      setSession(prefetchedSession);
      setText("");
      setEvaluation(null);
      setError("");
    }
  }, [prefetchedSession]);

  const minW = session?.word_limit?.min ?? (session?.task_type === "summarize_written_text" ? 150 : 250);

  const handleGenerate = async () => {
    if (prefetchedSession?.session_id) return;
    setError("");
    setLoading(true);
    try {
      const data = await generateSession({
        skill: "writing",
        topic: topic.trim() || null,
        writing_task_type: taskType,
      });
      setSession(data);
      setText("");
      setEvaluation(null);
    } catch (e) {
      setError(e.message || "Failed to generate");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError("");
    const submitMin = prefetchedSession?.session_id ? 80 : 20;
    if (wordCount(text) < submitMin) {
      setError(
        prefetchedSession?.session_id
          ? `Please write at least ${submitMin} words for this diagnostic section.`
          : "Please write a fuller response before submitting.",
      );
      return;
    }
    setLoading(true);
    try {
      const res = await submitWriting(session.session_id, text);
      setEvaluation(res.evaluation);
    } catch (e) {
      setError(e.message || "Evaluation failed");
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
    setText("");
    setEvaluation(null);
    setError("");
    setTopic("");
  };

  if (prefetchedSession?.session_id && (!session || session.session_id !== prefetchedSession.session_id)) {
    return (
      <Box>
        <DashboardNavbar title="Diagnostic — Writing" />
        <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>
      </Box>
    );
  }

  if (!session && !loading) {
    return (
      <Box>
        <DashboardNavbar title="Writing" />
        <Box sx={{ maxWidth: 640, mx: "auto" }}>
          <Card sx={{ borderRadius: "16px" }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h5" fontWeight={700} gutterBottom>IELTS Writing</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Task 1 (report) or Task 2 (essay). Your work is scored against IELTS-style criteria.
              </Typography>
              {!prefetchedSession?.session_id && (
              <>
              <TextField
                select
                label="Task type"
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                fullWidth
                size="small"
                sx={{ mb: 2 }}
              >
                <MenuItem value="write_essay">Task 2 — Essay</MenuItem>
                <MenuItem value="summarize_written_text">Task 1 — Report (text data)</MenuItem>
              </TextField>
              <TextField
                label="Topic hint (optional)"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                fullWidth
                size="small"
                sx={{ mb: 2 }}
              />
              </>
              )}
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              <Button variant="contained" fullWidth onClick={handleGenerate}>Generate task</Button>
            </CardContent>
          </Card>
        </Box>
      </Box>
    );
  }

  if (loading && !session) {
    return (
      <Box>
        <DashboardNavbar title="Writing" />
        <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  const isT1 = session.task_type === "summarize_written_text";

  const navTitle = prefetchedSession?.session_id
    ? (evaluation ? "Diagnostic — Writing (results)" : "Diagnostic — Writing")
    : (evaluation ? "Writing — Results" : "Writing");

  return (
    <Box>
      <DashboardNavbar title={navTitle} />
      <Card sx={{ mb: 2, borderRadius: "16px" }}>
        <CardContent sx={{ p: 2, display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
          <Chip label={session.topic} />
          <Chip label={isT1 ? "Task 1" : "Task 2"} variant="outlined" />
          <Box sx={{ flex: 1 }} />
          <Button size="small" onClick={handleReset}>{prefetchedSession?.session_id ? "Exit" : "New task"}</Button>
        </CardContent>
      </Card>

      {!evaluation && (
        <>
          <Card sx={{ mb: 2, borderRadius: "16px" }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{session.instruction}</Typography>
              {isT1 ? (
                <Typography variant="body1" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>{session.passage}</Typography>
              ) : (
                <Typography variant="h6" fontWeight={600}>{session.prompt}</Typography>
              )}
              {session.outline && (
                <List dense sx={{ mt: 1 }}>
                  {session.outline.map((o, i) => <ListItem key={i} sx={{ display: "list-item", py: 0 }}><Typography variant="body2">{o}</Typography></ListItem>)}
                </List>
              )}
            </CardContent>
          </Card>
          <TextField
            multiline
            minRows={14}
            fullWidth
            placeholder="Write your answer here…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            sx={{ mb: 1 }}
          />
          <Typography variant="caption" color={wordCount(text) < minW ? "warning.main" : "text.secondary"}>
            {wordCount(text)} words (aim for at least {minW})
          </Typography>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          <Box sx={{ mt: 2 }}>
            <Button variant="contained" disabled={loading} onClick={handleSubmit}>
              {loading ? <CircularProgress size={22} color="inherit" /> : "Submit for feedback"}
            </Button>
          </Box>
        </>
      )}

      {evaluation && (
        <Card sx={{ borderRadius: "16px" }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary">Score (rubric-based)</Typography>
            <Typography variant="h4" fontWeight={700} color="primary">{evaluation.percentage}%</Typography>
            <EvaluationView evaluation={evaluation} />
            {onDiagnosticContinue && diagnosticContinueLabel ? (
              <Button sx={{ mt: 3 }} variant="contained" onClick={() => onDiagnosticContinue()}>{diagnosticContinueLabel}</Button>
            ) : (
              <Button sx={{ mt: 3 }} variant="contained" onClick={handleReset}>Another task</Button>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
