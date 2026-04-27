import { useState, useEffect, useCallback } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import LinearProgress from "@mui/material/LinearProgress";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import SpellcheckIcon from "@mui/icons-material/Spellcheck";
import HistoryIcon from "@mui/icons-material/History";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DashboardNavbar from "components/Navbars/DashboardNavbar";
import {
  generateVocabTest,
  submitVocabAnswers,
  fetchVocabHistory,
  fetchVocabResultDetail,
} from "services/api";

// ── CEFR level colours ────────────────────────────────────────────────────────

const LEVEL_COLOR = {
  A2: { bg: "#e3f2fd", text: "#1565c0", border: "#90caf9" },
  B1: { bg: "#e8f5e9", text: "#2e7d32", border: "#a5d6a7" },
  B2: { bg: "#fff8e1", text: "#e65100", border: "#ffcc80" },
  C1: { bg: "#fce4ec", text: "#880e4f", border: "#f48fb1" },
  C2: { bg: "#f3e5f5", text: "#4a148c", border: "#ce93d8" },
};

function LevelChip({ level, size = "small" }) {
  const c = LEVEL_COLOR[level] || { bg: "#f1f5f9", text: "#1e293b", border: "#cbd5e1" };
  return (
    <Chip
      label={level}
      size={size}
      sx={{
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
        fontWeight: 700,
        borderRadius: "6px",
        fontSize: size === "small" ? "0.7rem" : "0.85rem",
      }}
    />
  );
}

// ── Score ring ────────────────────────────────────────────────────────────────

const LEVEL_LABEL = {
  A2: "Elementary",
  B1: "Intermediate",
  B2: "Upper-Intermediate",
  C1: "Advanced",
  C2: "Proficient",
};

function LevelResult({ level, vocabSize }) {
  const c = LEVEL_COLOR[level] || { bg: "#f1f5f9", text: "#1e293b", border: "#cbd5e1" };
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: 160,
        height: 160,
        borderRadius: "50%",
        border: `6px solid ${c.border}`,
        background: c.bg,
        flexShrink: 0,
      }}
    >
      <Typography variant="h3" fontWeight={800} sx={{ color: c.text, lineHeight: 1 }}>
        {level}
      </Typography>
      <Typography variant="caption" sx={{ color: c.text, fontWeight: 600 }}>
        {LEVEL_LABEL[level]}
      </Typography>
      <Typography variant="caption" sx={{ color: c.text, opacity: 0.8 }}>
        ~{vocabSize.toLocaleString()} words
      </Typography>
    </Box>
  );
}

// ── Level breakdown bar ───────────────────────────────────────────────────────

function LevelBreakdown({ breakdown }) {
  return (
    <Box>
      {breakdown.map((b) => {
        const acc = b.accuracy ?? 0;
        const c = LEVEL_COLOR[b.level] || { bg: "#f1f5f9", text: "#1e293b", border: "#cbd5e1" };
        return (
          <Box key={b.level} sx={{ mb: 1.5 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <LevelChip level={b.level} />
                <Typography variant="body2" color="text.secondary">
                  {b.correct}/{b.total} correct
                </Typography>
              </Box>
              <Typography variant="body2" fontWeight={700} sx={{ color: c.text }}>
                {b.accuracy !== null ? `${acc}%` : "—"}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={acc}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: "grey.200",
                "& .MuiLinearProgress-bar": { background: c.border, borderRadius: 4 },
              }}
            />
          </Box>
        );
      })}
    </Box>
  );
}

// ── History panel ─────────────────────────────────────────────────────────────

function HistoryPanel({ onReview }) {
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchVocabHistory()
      .then((d) => setHistory(d.entries || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const fmt = (iso) => {
    try {
      return new Date(iso).toLocaleDateString("en-AU", {
        year: "numeric", month: "short", day: "numeric",
      });
    } catch { return iso; }
  };

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error" sx={{ borderRadius: "8px" }}>{error}</Alert>;
  if (!history?.length) return (
    <Box sx={{ textAlign: "center", py: 4 }}>
      <Typography variant="body2" color="text.secondary">No past vocab tests yet.</Typography>
    </Box>
  );

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            {["Date", "Topic", "Level", "Vocab Size", "Score", ""].map((h) => (
              <TableCell key={h} sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", fontSize: "0.7rem", letterSpacing: 0.5 }}>
                {h}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {history.map((e) => (
            <TableRow key={e.result_id} hover sx={{ "&:last-child td": { border: 0 } }}>
              <TableCell sx={{ color: "text.secondary", fontSize: "0.8rem" }}>{fmt(e.completed_at)}</TableCell>
              <TableCell sx={{ fontWeight: 500, color: "text.primary" }}>{e.topic}</TableCell>
              <TableCell><LevelChip level={e.estimated_level} /></TableCell>
              <TableCell sx={{ color: "text.primary" }}>~{e.estimated_vocab_size.toLocaleString()}</TableCell>
              <TableCell>
                <Chip
                  label={`${e.percentage}%`}
                  size="small"
                  color={e.percentage >= 70 ? "success" : e.percentage >= 50 ? "warning" : "error"}
                  sx={{ fontWeight: 700, borderRadius: "6px" }}
                />
              </TableCell>
              <TableCell align="right">
                <Button size="small" variant="text" color="primary" onClick={() => onReview(e.result_id)}
                  sx={{ fontWeight: 600, borderRadius: "6px", fontSize: "0.75rem" }}>
                  Review
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ── Review panel ──────────────────────────────────────────────────────────────

function ReviewPanel({ resultId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchVocabResultDetail(resultId)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [resultId]);

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return null;

  return (
    <Box>
      <Card sx={{ mb: 3, borderRadius: "16px" }}>
        <CardContent sx={{ p: 2.5, display: "flex", alignItems: "center", gap: 2 }}>
          <Button startIcon={<ArrowBackIcon />} variant="outlined" size="small" onClick={onBack} sx={{ borderRadius: "8px" }}>
            Back
          </Button>
          <Typography variant="h6" fontWeight={700} sx={{ flex: 1 }}>Test Review — {data.topic}</Typography>
          <LevelChip level={data.estimated_level} size="medium" />
        </CardContent>
      </Card>

      <Card sx={{ mb: 3, borderRadius: "16px" }}>
        <CardContent sx={{ p: 3, display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
          <LevelResult level={data.estimated_level} vocabSize={data.estimated_vocab_size} />
          <Box sx={{ flex: 1, minWidth: 240 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>Performance by Level</Typography>
            <LevelBreakdown breakdown={data.level_breakdown || []} />
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: "16px" }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>All Questions</Typography>
          {(data.item_results || []).map((r, i) => (
            <Box key={r.question_id} sx={{
              mb: 2, p: 2,
              borderRadius: "10px",
              background: r.is_correct ? "#f1f8f1" : "#fff5f5",
              border: `1px solid ${r.is_correct ? "#c8e6c9" : "#ffcdd2"}`,
            }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                {r.is_correct
                  ? <CheckCircleIcon sx={{ color: "#4CAF50", fontSize: "1.1rem" }} />
                  : <CancelIcon sx={{ color: "#F44335", fontSize: "1.1rem" }} />}
                <Typography variant="subtitle2" fontWeight={700}>{i + 1}. {r.word}</Typography>
                <LevelChip level={r.level} />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontStyle: "italic" }}>
                {r.sentence}
              </Typography>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                {(r.options || []).map((opt) => {
                  const key = opt.charAt(0);
                  const isCorrect = key === r.correct_answer;
                  const isUser = key === r.user_answer;
                  return (
                    <Chip
                      key={opt}
                      label={opt}
                      size="small"
                      sx={{
                        borderRadius: "6px",
                        fontWeight: isCorrect ? 700 : 400,
                        background: isCorrect ? "#e8f5e9" : isUser ? "#ffebee" : "#f0f2f5",
                        color: isCorrect ? "#2e7d32" : isUser ? "#c62828" : "text.secondary",
                        border: `1px solid ${isCorrect ? "#a5d6a7" : isUser ? "#ef9a9a" : "transparent"}`,
                      }}
                    />
                  );
                })}
              </Box>
              {!r.is_correct && r.explanation && (
                <Box sx={{ mt: 1, p: 1.5, bgcolor: "background.paper", borderRadius: "8px", borderLeft: "3px solid", borderColor: "primary.main" }}>
                  <Typography variant="caption" color="primary" fontWeight={700}>Explanation: </Typography>
                  <Typography variant="caption" color="text.secondary">{r.explanation}</Typography>
                </Box>
              )}
            </Box>
          ))}
        </CardContent>
      </Card>
    </Box>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function VocabTestPage() {
  const [view, setView] = useState("start"); // start | loading | test | results | history | review
  const [topic, setTopic] = useState("");
  const [error, setError] = useState("");

  // Test session
  const [session, setSession] = useState(null);           // { session_id, questions, topic }
  const [currentIdx, setCurrentIdx] = useState(0);        // current question index
  const [answers, setAnswers] = useState({});              // { v1: "A", v2: "C", … }
  const [chosen, setChosen] = useState(null);             // chosen option for current question
  const [showFeedback, setShowFeedback] = useState(false); // brief correct/wrong flash

  // Results
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Review
  const [reviewId, setReviewId] = useState(null);

  const currentQuestion = session?.questions?.[currentIdx];
  const totalQuestions = session?.questions?.length ?? 0;
  const allAnswered = session ? Object.keys(answers).length === totalQuestions : false;

  const handleStart = async () => {
    setError("");
    setView("loading");
    try {
      const data = await generateVocabTest(topic.trim() || null);
      setSession(data);
      setAnswers({});
      setCurrentIdx(0);
      setChosen(null);
      setShowFeedback(false);
      setView("test");
    } catch (e) {
      setError(e.message || "Failed to generate test");
      setView("start");
    }
  };

  const handleChoose = (optionKey) => {
    if (showFeedback || answers[currentQuestion.id]) return;
    setChosen(optionKey);
    setShowFeedback(true);
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: optionKey }));

    // Auto-advance after 1 second
    setTimeout(() => {
      setShowFeedback(false);
      setChosen(null);
      if (currentIdx < totalQuestions - 1) {
        setCurrentIdx((i) => i + 1);
      }
    }, 1000);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const data = await submitVocabAnswers(session.session_id, answers);
      setResult(data);
      setView("results");
    } catch (e) {
      setError(e.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetake = () => {
    setSession(null);
    setResult(null);
    setAnswers({});
    setCurrentIdx(0);
    setChosen(null);
    setView("start");
    setError("");
  };

  // ── START ───────────────────────────────────────────────────────────────────
  if (view === "start") {
    return (
      <Box>
        <DashboardNavbar title="Vocabulary Level Test" />
        <Box sx={{ width: "100%", minWidth: 0 }}>
          <Card sx={{ borderRadius: "16px" }}>
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
                <Box sx={{
                  width: 56, height: 56, borderRadius: "14px",
                  background: (t) => `linear-gradient(135deg, ${t.palette.primary.dark}, ${t.palette.primary.main})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <SpellcheckIcon sx={{ color: "#fff", fontSize: "1.75rem" }} />
                </Box>
                <Box>
                  <Typography variant="h5" fontWeight={800}>Vocabulary Level Test</Typography>
                  <Typography variant="body2" color="text.secondary">
                    20 questions · CEFR A2–C2 · ~5 minutes
                  </Typography>
                </Box>
              </Box>

              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Discover your vocabulary level. Each question shows a word in context and asks for its meaning.
                Questions span five CEFR levels — the harder the words you know, the higher your estimated level.
              </Typography>

              <Box sx={{ display: "flex", gap: 1.5, mb: 3, flexWrap: "wrap" }}>
                {Object.entries(LEVEL_COLOR).map(([lvl, c]) => (
                  <Box key={lvl} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <LevelChip level={lvl} />
                    <Typography variant="caption" color="text.secondary">{LEVEL_LABEL[lvl]}</Typography>
                  </Box>
                ))}
              </Box>

              <TextField
                label="Topic focus (optional)"
                placeholder="e.g. technology, environment, medicine…"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                fullWidth
                size="small"
                inputProps={{ maxLength: 60 }}
                sx={{ mb: 2 }}
              />

              {error && <Alert severity="error" sx={{ mb: 2, borderRadius: "8px" }}>{error}</Alert>}

              <Button
                variant="contained"
                color="primary"
                size="large"
                fullWidth
                onClick={handleStart}
                sx={{ py: 1.5, borderRadius: "10px", fontWeight: 700, mb: 1.5 }}
              >
                Start Vocabulary Test
              </Button>

              <Button
                variant="text"
                color="secondary"
                fullWidth
                startIcon={<HistoryIcon />}
                onClick={() => setView("history")}
                sx={{ borderRadius: "10px" }}
              >
                View Past Results
              </Button>
            </CardContent>
          </Card>
        </Box>
      </Box>
    );
  }

  // ── LOADING ─────────────────────────────────────────────────────────────────
  if (view === "loading") {
    return (
      <Box>
        <DashboardNavbar title="Vocabulary Level Test" />
        <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
          <Card sx={{ borderRadius: "16px", p: 5, textAlign: "center" }}>
            <CircularProgress sx={{ mb: 3 }} />
            <Typography variant="h6" fontWeight={600}>Generating your vocabulary test…</Typography>
            <Typography variant="body2" color="text.secondary">Selecting words across all CEFR levels.</Typography>
          </Card>
        </Box>
      </Box>
    );
  }

  // ── TEST ────────────────────────────────────────────────────────────────────
  if (view === "test" && currentQuestion) {
    const progress = Math.round((currentIdx / totalQuestions) * 100);
    const answered = answers[currentQuestion.id];

    return (
      <Box>
        <DashboardNavbar title={`Vocabulary Test — ${session.topic}`} />

        {/* Progress bar */}
        <Card sx={{ mb: 3, borderRadius: "16px" }}>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.75 }}>
              <Typography variant="body2" color="text.secondary">
                Question {currentIdx + 1} of {totalQuestions}
              </Typography>
              <Typography variant="body2" fontWeight={600} color="primary">
                {Object.keys(answers).length} answered
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{ height: 8, borderRadius: 4, "& .MuiLinearProgress-bar": { borderRadius: 4 } }}
            />
          </CardContent>
        </Card>

        {/* Question card */}
        <Card sx={{ mb: 3, borderRadius: "16px" }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
              <Typography variant="h4" fontWeight={800} color="primary">
                {currentQuestion.word}
              </Typography>
              <LevelChip level={currentQuestion.level} />
            </Box>

            <Box sx={{
              p: 2.5, mb: 3,
              bgcolor: "grey.100",
              borderRadius: "12px",
              borderLeft: "4px solid",
              borderColor: "primary.main",
            }}>
              <Typography variant="body1" color="text.secondary" sx={{ fontStyle: "italic", lineHeight: 1.8 }}>
                {currentQuestion.sentence}
              </Typography>
            </Box>

            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              {currentQuestion.stem}
            </Typography>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {currentQuestion.options.map((opt) => {
                const key = opt.charAt(0);
                const isChosen = chosen === key;
                const isAnswered = !!answered;

                let bg = "#f1f5f9";
                let border = "1px solid transparent";
                let color = "#1e293b";

                if (isAnswered && isChosen && !showFeedback) {
                  // Already answered, not in feedback window — dim chosen
                  bg = "rgba(13, 148, 136, 0.12)";
                  border = "1px solid rgba(13, 148, 136, 0.35)";
                }
                if (showFeedback && isChosen) {
                  // Brief flash
                  bg = "#e2e8f0";
                  border = "1px solid #cbd5e1";
                }

                return (
                  <Button
                    key={opt}
                    fullWidth
                    variant="outlined"
                    disabled={!!answered && !showFeedback}
                    onClick={() => handleChoose(key)}
                    sx={{
                      justifyContent: "flex-start",
                      textAlign: "left",
                      textTransform: "none",
                      borderRadius: "10px",
                      py: 1.5,
                      px: 2,
                      background: bg,
                      border,
                      color,
                      fontWeight: 500,
                      fontSize: "0.95rem",
                      "&:hover": { background: answered ? bg : "rgba(13, 148, 136, 0.08)", border: answered ? border : "1px solid rgba(13, 148, 136, 0.35)" },
                    }}
                  >
                    {opt}
                  </Button>
                );
              })}
            </Box>
          </CardContent>
        </Card>

        {/* Navigation */}
        <Card sx={{ borderRadius: "16px" }}>
          <CardContent sx={{ p: 2, display: "flex", alignItems: "center", gap: 2 }}>
            <Button
              variant="outlined"
              size="small"
              disabled={currentIdx === 0}
              onClick={() => setCurrentIdx((i) => i - 1)}
              sx={{ borderRadius: "8px" }}
            >
              Previous
            </Button>
            <Box sx={{ flex: 1, display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 0.5 }}>
              {session.questions.map((q, i) => (
                <Box
                  key={q.id}
                  onClick={() => { if (!showFeedback) setCurrentIdx(i); }}
                  sx={{
                    width: 24, height: 24, borderRadius: "50%",
                    cursor: "pointer",
                    bgcolor: answers[q.id]
                      ? "primary.main"
                      : i === currentIdx
                        ? "rgba(13, 148, 136, 0.18)"
                        : "grey.200",
                    border: i === currentIdx ? "2px solid" : "2px solid transparent",
                    borderColor: i === currentIdx ? "primary.main" : "transparent",
                    transition: "background-color 0.2s",
                  }}
                />
              ))}
            </Box>
            {currentIdx < totalQuestions - 1 ? (
              <Button
                variant="outlined"
                size="small"
                disabled={showFeedback}
                onClick={() => setCurrentIdx((i) => i + 1)}
                sx={{ borderRadius: "8px" }}
              >
                Next
              </Button>
            ) : (
              <Button
                variant="contained"
                color="primary"
                size="small"
                disabled={!allAnswered || submitting}
                onClick={handleSubmit}
                sx={{ borderRadius: "8px", fontWeight: 700 }}
              >
                {submitting ? <CircularProgress size={18} color="inherit" /> : "See Results"}
              </Button>
            )}
          </CardContent>
        </Card>

        {error && <Alert severity="error" sx={{ mt: 2, borderRadius: "8px" }}>{error}</Alert>}
      </Box>
    );
  }

  // ── RESULTS ─────────────────────────────────────────────────────────────────
  if (view === "results" && result) {
    return (
      <Box>
        <DashboardNavbar title="Your Vocabulary Result" />

        {/* Main result card */}
        <Card sx={{ mb: 3, borderRadius: "16px" }}>
          <CardContent sx={{ p: 4, display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
            <LevelResult level={result.estimated_level} vocabSize={result.estimated_vocab_size} />

            <Box sx={{ flex: 1, minWidth: 240 }}>
              <Typography variant="h5" fontWeight={800} gutterBottom>
                {LEVEL_LABEL[result.estimated_level]}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                You answered {result.total_correct} of {result.total_questions} questions correctly ({result.percentage}%).
                Your estimated active vocabulary is approximately{" "}
                <strong>{result.estimated_vocab_size.toLocaleString()} words</strong>.
              </Typography>

              <Box sx={{ display: "flex", gap: 1 }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleRetake}
                  sx={{ borderRadius: "10px", fontWeight: 700 }}
                >
                  Retake Test
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setView("history")}
                  sx={{ borderRadius: "10px" }}
                >
                  History
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Level breakdown */}
        <Card sx={{ mb: 3, borderRadius: "16px" }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>Performance by Level</Typography>
            <LevelBreakdown breakdown={result.level_breakdown || []} />
          </CardContent>
        </Card>

        {/* Missed words */}
        {result.item_results?.some((r) => !r.is_correct) && (
          <Card sx={{ borderRadius: "16px" }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>Words to Learn</Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {result.item_results
                  .filter((r) => !r.is_correct)
                  .map((r) => (
                    <Box key={r.question_id} sx={{
                      p: 2, borderRadius: "10px",
                      background: "#fff5f5",
                      border: "1px solid #ffcdd2",
                    }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                        <Typography variant="subtitle2" fontWeight={700}>{r.word}</Typography>
                        <LevelChip level={r.level} />
                        {r.user_answer && (
                          <Typography variant="caption" color="error">
                            You chose: {r.options?.find((o) => o.startsWith(r.user_answer)) || r.user_answer}
                          </Typography>
                        )}
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic", mb: 0.5 }}>
                        {r.sentence}
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#2e7d32", fontWeight: 500 }}>
                        ✓ {r.options?.find((o) => o.startsWith(r.correct_answer)) || r.correct_answer}
                      </Typography>
                      {r.explanation && (
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                          {r.explanation}
                        </Typography>
                      )}
                    </Box>
                  ))}
              </Box>
            </CardContent>
          </Card>
        )}
      </Box>
    );
  }

  // ── HISTORY ─────────────────────────────────────────────────────────────────
  if (view === "history") {
    return (
      <Box>
        <DashboardNavbar title="Vocabulary Test History" />
        <Card sx={{ borderRadius: "16px" }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
              <Typography variant="h6" fontWeight={700}>Past Results</Typography>
              <Button
                variant="contained"
                color="primary"
                size="small"
                onClick={handleRetake}
                sx={{ borderRadius: "8px", fontWeight: 700 }}
              >
                New Test
              </Button>
            </Box>
            <HistoryPanel onReview={(id) => { setReviewId(id); setView("review"); }} />
          </CardContent>
        </Card>
      </Box>
    );
  }

  // ── REVIEW ───────────────────────────────────────────────────────────────────
  if (view === "review" && reviewId) {
    return (
      <Box>
        <DashboardNavbar title="Vocabulary Test Review" />
        <ReviewPanel
          resultId={reviewId}
          onBack={() => setView("history")}
        />
      </Box>
    );
  }

  return null;
}
