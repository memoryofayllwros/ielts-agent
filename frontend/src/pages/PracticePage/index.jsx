import { useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import FormGroup from "@mui/material/FormGroup";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import DashboardNavbar from "components/Navbars/DashboardNavbar";
import { generateSession, submitAnswers } from "services/api";

// ── Question renderers ────────────────────────────────────────────────────────

function FillInBlanksQuestion({ question, answers, onAnswer, submitted, result }) {
  const blanks = (question.passage_with_blanks?.match(/\[BLANK_\d+\]/g) || []);
  const wordBank = question.word_bank || [];

  const parts = question.passage_with_blanks?.split(/(\[BLANK_\d+\])/) || [];

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
        Fill in the Blanks
      </Typography>
      <Typography
        variant="body1"
        sx={{ lineHeight: 2.2, color: "#344767" }}
        component="div"
      >
        {parts.map((part, i) => {
          const match = part.match(/\[BLANK_(\d+)\]/);
          if (match) {
            const idx = parseInt(match[1], 10) - 1;
            const userVal = answers[idx] || "";
            const isCorrect = result?.correct_answers[idx]?.toLowerCase() === userVal.toLowerCase();
            const correctVal = result?.correct_answers[idx];

            return (
              <Box key={i} component="span" sx={{ display: "inline-block", mx: 0.5, verticalAlign: "middle" }}>
                {submitted ? (
                  <Box
                    component="span"
                    sx={{
                      px: 1.5,
                      py: 0.25,
                      borderRadius: "6px",
                      background: isCorrect ? "#e8f5e9" : "#ffebee",
                      color: isCorrect ? "#2e7d32" : "#c62828",
                      fontWeight: 600,
                      border: `1px solid ${isCorrect ? "#a5d6a7" : "#ef9a9a"}`,
                    }}
                  >
                    {userVal || <em style={{ opacity: 0.5 }}>empty</em>}
                    {!isCorrect && (
                      <Typography component="span" variant="caption" sx={{ ml: 0.75, color: "#2e7d32", fontWeight: 500 }}>
                        → {correctVal}
                      </Typography>
                    )}
                  </Box>
                ) : (
                  <FormControl size="small" sx={{ minWidth: 130 }}>
                    <Select
                      value={userVal}
                      onChange={(e) => {
                        const newAnswers = [...(answers || Array(blanks.length).fill(""))];
                        newAnswers[idx] = e.target.value;
                        onAnswer(newAnswers);
                      }}
                      displayEmpty
                      sx={{ borderRadius: "8px", fontSize: "0.875rem" }}
                    >
                      <MenuItem value=""><em>Select word</em></MenuItem>
                      {wordBank.map((w) => (
                        <MenuItem key={w} value={w}>{w}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </Box>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </Typography>

      {!submitted && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            Word Bank:
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 0.75 }}>
            {wordBank.map((w) => (
              <Chip key={w} label={w} size="small" variant="outlined" sx={{ borderRadius: "6px" }} />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}

function McSingleQuestion({ question, answers, onAnswer, submitted, result }) {
  const userAns = answers?.[0] || "";
  const correctAns = result?.correct_answers?.[0] || "";

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
        Multiple Choice — Single Answer
      </Typography>
      <Typography variant="body1" sx={{ mb: 2, color: "#344767", fontWeight: 500 }}>
        {question.question}
      </Typography>
      <RadioGroup
        value={userAns}
        onChange={(e) => !submitted && onAnswer([e.target.value])}
      >
        {(question.options || []).map((opt) => {
          const optKey = opt.match(/^([A-D])\./)?.[1] || opt[0];
          const isCorrect = correctAns === optKey;
          const isSelected = userAns === optKey;
          let bgColor = "transparent";
          if (submitted) {
            if (isCorrect) bgColor = "#e8f5e9";
            else if (isSelected && !isCorrect) bgColor = "#ffebee";
          }

          return (
            <FormControlLabel
              key={opt}
              value={optKey}
              control={<Radio size="small" disabled={submitted} />}
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <span>{opt}</span>
                  {submitted && isCorrect && <CheckCircleIcon sx={{ color: "#4CAF50", fontSize: "1rem" }} />}
                  {submitted && isSelected && !isCorrect && <CancelIcon sx={{ color: "#F44335", fontSize: "1rem" }} />}
                </Box>
              }
              sx={{
                borderRadius: "8px",
                px: 1,
                py: 0.25,
                mb: 0.5,
                background: bgColor,
                transition: "background 0.2s",
              }}
            />
          );
        })}
      </RadioGroup>
    </Box>
  );
}

function McMultipleQuestion({ question, answers, onAnswer, submitted, result }) {
  const userSet = new Set(answers || []);
  const correctSet = new Set(result?.correct_answers || []);

  const toggle = (optKey) => {
    if (submitted) return;
    const next = new Set(userSet);
    if (next.has(optKey)) next.delete(optKey);
    else next.add(optKey);
    onAnswer([...next]);
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
        Multiple Choice — Multiple Answers
      </Typography>
      <Typography variant="body1" sx={{ mb: 2, color: "#344767", fontWeight: 500 }}>
        {question.question}
      </Typography>
      <FormGroup>
        {(question.options || []).map((opt) => {
          const optKey = opt.match(/^([A-D])\./)?.[1] || opt[0];
          const isCorrect = correctSet.has(optKey);
          const isSelected = userSet.has(optKey);
          let bgColor = "transparent";
          if (submitted) {
            if (isCorrect) bgColor = "#e8f5e9";
            else if (isSelected && !isCorrect) bgColor = "#ffebee";
          }

          return (
            <FormControlLabel
              key={opt}
              control={
                <Checkbox
                  size="small"
                  checked={isSelected}
                  onChange={() => toggle(optKey)}
                  disabled={submitted}
                />
              }
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <span>{opt}</span>
                  {submitted && isCorrect && <CheckCircleIcon sx={{ color: "#4CAF50", fontSize: "1rem" }} />}
                  {submitted && isSelected && !isCorrect && <CancelIcon sx={{ color: "#F44335", fontSize: "1rem" }} />}
                </Box>
              }
              sx={{
                borderRadius: "8px",
                px: 1,
                py: 0.25,
                mb: 0.5,
                background: bgColor,
                transition: "background 0.2s",
              }}
            />
          );
        })}
      </FormGroup>
    </Box>
  );
}

function QuestionCard({ question, index, answers, onAnswer, submitted, result }) {
  return (
    <Card sx={{ mb: 2, borderRadius: "16px" }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: "block" }}>
          Question {index + 1}
        </Typography>

        {question.type === "fill_in_blanks" && (
          <FillInBlanksQuestion
            question={question}
            answers={answers}
            onAnswer={onAnswer}
            submitted={submitted}
            result={result}
          />
        )}
        {question.type === "mc_single" && (
          <McSingleQuestion
            question={question}
            answers={answers}
            onAnswer={onAnswer}
            submitted={submitted}
            result={result}
          />
        )}
        {question.type === "mc_multiple" && (
          <McMultipleQuestion
            question={question}
            answers={answers}
            onAnswer={onAnswer}
            submitted={submitted}
            result={result}
          />
        )}

        {submitted && result?.explanation && (
          <Box
            sx={{
              mt: 2,
              p: 2,
              background: "#f8f9fa",
              borderRadius: "10px",
              borderLeft: "3px solid #1A73E8",
            }}
          >
            <Typography variant="caption" color="primary" fontWeight={700} display="block" sx={{ mb: 0.5 }}>
              Explanation
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {result.explanation}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

// ── Score circle ──────────────────────────────────────────────────────────────

function ScoreCircle({ percentage }) {
  const color = percentage >= 70 ? "#4CAF50" : percentage >= 40 ? "#FB8C00" : "#F44335";
  return (
    <Box
      sx={{
        width: 100,
        height: 100,
        borderRadius: "50%",
        border: `6px solid ${color}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Typography variant="h5" fontWeight={700} sx={{ color, lineHeight: 1 }}>
        {percentage}%
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Score
      </Typography>
    </Box>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PracticePage() {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Session state
  const [session, setSession] = useState(null);

  // Answers map: { questionId: string[] }
  const [answers, setAnswers] = useState({});

  // Results
  const [results, setResults] = useState(null);

  const allAnswered = session
    ? session.questions.every((q) => {
        const ans = answers[q.id];
        if (!ans || ans.length === 0) return false;
        if (q.type === "fill_in_blanks") {
          const blankCount = (q.passage_with_blanks?.match(/\[BLANK_\d+\]/g) || []).length;
          return ans.filter(Boolean).length === blankCount;
        }
        return true;
      })
    : false;

  const handleGenerate = async () => {
    setError("");
    setLoading(true);
    try {
      const data = await generateSession(topic.trim() || null);
      setSession(data);
      setAnswers({});
      setResults(null);
    } catch (err) {
      setError(err.message || "Failed to generate session");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      const data = await submitAnswers(session.session_id, answers);
      setResults(data);
    } catch (err) {
      setError(err.message || "Failed to submit answers");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSession(null);
    setAnswers({});
    setResults(null);
    setError("");
    setTopic("");
  };

  // ── Generate panel ────────────────────────────────────────────────────────
  if (!session && !loading) {
    return (
      <Box>
        <DashboardNavbar title="Practice" />
        <Box sx={{ maxWidth: 600, mx: "auto" }}>
          <Card sx={{ borderRadius: "16px" }}>
            <CardContent sx={{ p: 4, textAlign: "center" }}>
              <Typography variant="h5" fontWeight={700} gutterBottom>
                Start a Practice Session
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                AI will generate an academic passage with reading questions in the style of IELTS Academic Reading.
              </Typography>
              <TextField
                label="Topic (optional)"
                placeholder="e.g. Climate Change, Artificial Intelligence, Ancient Rome…"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                fullWidth
                size="small"
                inputProps={{ maxLength: 80 }}
                sx={{ mb: 2 }}
              />
              {error && <Alert severity="error" sx={{ mb: 2, borderRadius: "8px" }}>{error}</Alert>}
              <Button
                variant="contained"
                color="primary"
                size="large"
                fullWidth
                onClick={handleGenerate}
                sx={{ py: 1.5, borderRadius: "10px", fontWeight: 700 }}
              >
                Generate Practice Session
              </Button>
            </CardContent>
          </Card>
        </Box>
      </Box>
    );
  }

  // ── Loading panel ─────────────────────────────────────────────────────────
  if (loading && !session) {
    return (
      <Box>
        <DashboardNavbar title="Practice" />
        <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
          <Card sx={{ borderRadius: "16px", p: 5, textAlign: "center" }}>
            <CircularProgress sx={{ mb: 3 }} />
            <Typography variant="h6" fontWeight={600}>Generating your practice session…</Typography>
            <Typography variant="body2" color="text.secondary">Claude is crafting a passage and questions for you.</Typography>
          </Card>
        </Box>
      </Box>
    );
  }

  // ── Results panel ─────────────────────────────────────────────────────────
  if (results) {
    const resultMap = {};
    results.question_results.forEach((r) => { resultMap[r.question_id] = r; });

    return (
      <Box>
        <DashboardNavbar title="Results" />

        {/* Score header */}
        <Card sx={{ mb: 3, borderRadius: "16px" }}>
          <CardContent sx={{ p: 3, display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" }}>
            <ScoreCircle percentage={results.percentage} />
            <Box sx={{ flex: 1 }}>
              <Chip
                label={results.topic}
                size="small"
                sx={{ mb: 1, background: "#f0f2f5", fontWeight: 600 }}
              />
              <Typography variant="body1" color="text.secondary">
                {results.total_score} / {results.max_score} points
                {" · "}
                {results.question_results.filter((r) => r.is_correct).length} of{" "}
                {results.question_results.length} questions correct
              </Typography>
            </Box>
            <Button
              variant="contained"
              color="primary"
              onClick={handleReset}
              sx={{ borderRadius: "10px", fontWeight: 700 }}
            >
              Practice Again
            </Button>
          </CardContent>
        </Card>

        {/* Passage */}
        <Card sx={{ mb: 3, borderRadius: "16px" }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase" letterSpacing={0.5} display="block" sx={{ mb: 1.5 }}>
              Reading Passage
            </Typography>
            <Typography variant="body1" sx={{ lineHeight: 1.9, color: "#344767" }}>
              {session.passage}
            </Typography>
          </CardContent>
        </Card>

        {/* Questions with results */}
        {session.questions.map((q, i) => (
          <QuestionCard
            key={q.id}
            question={q}
            index={i}
            answers={answers[q.id]}
            onAnswer={() => {}}
            submitted
            result={resultMap[q.id]}
          />
        ))}
      </Box>
    );
  }

  // ── Questions panel ───────────────────────────────────────────────────────
  return (
    <Box>
      <DashboardNavbar title="Practice" />

      {/* Session header */}
      <Card sx={{ mb: 3, borderRadius: "16px" }}>
        <CardContent sx={{ p: 2.5, display: "flex", alignItems: "center", gap: 2 }}>
          <Chip
            label={session.topic}
            sx={{ background: "#f0f2f5", fontWeight: 600 }}
          />
          <Typography variant="body2" color="text.secondary">
            3 questions · IELTS Academic style
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button variant="outlined" size="small" onClick={handleReset} sx={{ borderRadius: "8px" }}>
            New Session
          </Button>
        </CardContent>
      </Card>

      {/* Passage */}
      <Card sx={{ mb: 3, borderRadius: "16px" }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase" letterSpacing={0.5} display="block" sx={{ mb: 1.5 }}>
            Reading Passage
          </Typography>
          <Typography variant="body1" sx={{ lineHeight: 1.9, color: "#344767" }}>
            {session.passage}
          </Typography>
        </CardContent>
      </Card>

      {/* Questions */}
      {session.questions.map((q, i) => (
        <QuestionCard
          key={q.id}
          question={q}
          index={i}
          answers={answers[q.id]}
          onAnswer={(val) => handleAnswerChange(q.id, val)}
          submitted={false}
          result={null}
        />
      ))}

      {/* Submit bar */}
      <Card sx={{ mb: 3, borderRadius: "16px" }}>
        <CardContent sx={{ p: 2.5, display: "flex", alignItems: "center", gap: 2 }}>
          {error && <Alert severity="error" sx={{ flex: 1, borderRadius: "8px" }}>{error}</Alert>}
          {!error && (
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
              {allAnswered ? "Ready to submit!" : "Answer all questions before submitting."}
            </Typography>
          )}
          <Button
            variant="contained"
            color="primary"
            disabled={!allAnswered || loading}
            onClick={handleSubmit}
            sx={{ borderRadius: "10px", fontWeight: 700, minWidth: 140 }}
          >
            {loading ? <CircularProgress size={20} color="inherit" /> : "Submit Answers"}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
