import { useState, useEffect, useCallback } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import FormGroup from "@mui/material/FormGroup";
import DashboardNavbar from "components/Navbars/DashboardNavbar";
import { fetchProgress, fetchResultDetail } from "services/api";

function ScoreBadge({ percentage }) {
  const color = percentage >= 70 ? "success" : percentage >= 40 ? "warning" : "error";
  return (
    <Chip
      label={`${percentage}%`}
      color={color}
      size="small"
      sx={{ fontWeight: 700, borderRadius: "6px" }}
    />
  );
}

function StatBox({ value, label }) {
  return (
    <Box sx={{ textAlign: "center", flex: 1, p: 2 }}>
      <Typography variant="h4" fontWeight={700} color="primary">
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}

// ── Review view ───────────────────────────────────────────────────────────────

function ReviewPassage({ passage, title = "Passage" }) {
  if (!passage) return null;
  return (
    <Card sx={{ mb: 3, borderRadius: "16px" }}>
      <CardContent sx={{ p: 3 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          fontWeight={700}
          textTransform="uppercase"
          letterSpacing={0.5}
          display="block"
          sx={{ mb: 1.5 }}
        >
          {title}
        </Typography>
        <Typography variant="body1" sx={{ lineHeight: 1.9, color: "#344767", whiteSpace: "pre-wrap" }}>
          {passage}
        </Typography>
      </CardContent>
    </Card>
  );
}

function skillLabel(skill) {
  const s = skill || "reading";
  const map = { reading: "Reading", listening: "Listening", writing: "Writing", speaking: "Speaking" };
  return map[s] || s;
}

function skillChipColor(skill) {
  const s = skill || "reading";
  if (s === "writing") return "primary";
  if (s === "speaking") return "secondary";
  if (s === "listening") return "info";
  return "default";
}

function ReviewEvaluation({ evaluation }) {
  if (!evaluation) return null;
  return (
    <Card sx={{ mb: 3, borderRadius: "16px" }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase" display="block" sx={{ mb: 1 }}>
          Feedback
        </Typography>
        <Typography variant="h6" fontWeight={700}>{evaluation.band}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{evaluation.overall_feedback}</Typography>
        {(evaluation.category_scores || []).map((c) => (
          <Box key={c.category} sx={{ mb: 1 }}>
            <Typography variant="subtitle2" fontWeight={600}>{c.category}: {c.score}/{c.max_score}</Typography>
            <Typography variant="body2" color="text.secondary">{c.feedback}</Typography>
          </Box>
        ))}
      </CardContent>
    </Card>
  );
}

function ReviewQuestion({ qr, index }) {
  const correctSet = new Set(qr.correct_answers || []);
  const userSet = new Set(qr.user_answers || []);

  const renderFillBlanks = () => {
    if (!qr.passage_with_blanks) return null;
    const parts = qr.passage_with_blanks.split(/(\[BLANK_\d+\])/);
    return (
      <Typography variant="body1" sx={{ lineHeight: 2.2, color: "#344767" }} component="div">
        {parts.map((part, i) => {
          const match = part.match(/\[BLANK_(\d+)\]/);
          if (match) {
            const idx = parseInt(match[1], 10) - 1;
            const userVal = qr.user_answers?.[idx] || "";
            const correctVal = qr.correct_answers?.[idx] || "";
            const isCorrect = userVal.trim().toLowerCase() === correctVal.trim().toLowerCase();
            return (
              <Box
                key={i}
                component="span"
                sx={{
                  display: "inline-block",
                  mx: 0.5,
                  px: 1.5,
                  py: 0.25,
                  borderRadius: "6px",
                  background: isCorrect ? "#e8f5e9" : "#ffebee",
                  color: isCorrect ? "#2e7d32" : "#c62828",
                  fontWeight: 600,
                  border: `1px solid ${isCorrect ? "#a5d6a7" : "#ef9a9a"}`,
                  verticalAlign: "middle",
                }}
              >
                {userVal || <em style={{ opacity: 0.5 }}>empty</em>}
                {!isCorrect && (
                  <Typography component="span" variant="caption" sx={{ ml: 0.75, color: "#2e7d32", fontWeight: 500 }}>
                    → {correctVal}
                  </Typography>
                )}
              </Box>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </Typography>
    );
  };

  const renderMcOptions = () => {
    const options = qr.options || [];
    const isMultiple = qr.type === "mc_multiple";

    if (isMultiple) {
      return (
        <FormGroup>
          {options.map((opt) => {
            const optKey = opt.match(/^([A-E])\./)?.[1] || opt[0];
            const isCorrect = correctSet.has(optKey);
            const isSelected = userSet.has(optKey);
            let bgColor = "transparent";
            if (isCorrect) bgColor = "#e8f5e9";
            else if (isSelected) bgColor = "#ffebee";
            return (
              <FormControlLabel
                key={opt}
                control={<Checkbox size="small" checked={isSelected} disabled />}
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    <span>{opt}</span>
                    {isCorrect && <CheckCircleIcon sx={{ color: "#4CAF50", fontSize: "1rem" }} />}
                    {isSelected && !isCorrect && <CancelIcon sx={{ color: "#F44335", fontSize: "1rem" }} />}
                  </Box>
                }
                sx={{ borderRadius: "8px", px: 1, py: 0.25, mb: 0.5, background: bgColor }}
              />
            );
          })}
        </FormGroup>
      );
    }

    const userVal = qr.user_answers?.[0] || "";
    const correctVal = qr.correct_answers?.[0] || "";
    return (
      <RadioGroup value={userVal}>
        {options.map((opt) => {
          const optKey = opt.match(/^([A-E])\./)?.[1] || opt[0];
          const isCorrect = correctVal === optKey;
          const isSelected = userVal === optKey;
          let bgColor = "transparent";
          if (isCorrect) bgColor = "#e8f5e9";
          else if (isSelected) bgColor = "#ffebee";
          return (
            <FormControlLabel
              key={opt}
              value={optKey}
              control={<Radio size="small" disabled />}
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <span>{opt}</span>
                  {isCorrect && <CheckCircleIcon sx={{ color: "#4CAF50", fontSize: "1rem" }} />}
                  {isSelected && !isCorrect && <CancelIcon sx={{ color: "#F44335", fontSize: "1rem" }} />}
                </Box>
              }
              sx={{ borderRadius: "8px", px: 1, py: 0.25, mb: 0.5, background: bgColor }}
            />
          );
        })}
      </RadioGroup>
    );
  };

  return (
    <Card sx={{ mb: 2, borderRadius: "16px" }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Question {index + 1}
          </Typography>
          {qr.is_correct ? (
            <Chip label="Correct" color="success" size="small" sx={{ borderRadius: "6px" }} />
          ) : (
            <Chip label={`${qr.earned}/${qr.max}`} color="error" size="small" sx={{ borderRadius: "6px" }} />
          )}
        </Box>

        {qr.type === "fill_in_blanks" ? (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Fill in the Blanks
            </Typography>
            {renderFillBlanks()}
          </Box>
        ) : (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {qr.type === "mc_single" ? "Multiple Choice — Single Answer" : "Multiple Choice — Multiple Answers"}
            </Typography>
            {qr.question_text && (
              <Typography variant="body1" sx={{ mb: 2, color: "#344767", fontWeight: 500 }}>
                {qr.question_text}
              </Typography>
            )}
            {renderMcOptions()}
          </Box>
        )}

        {qr.explanation && (
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
              {qr.explanation}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProgressPage() {
  const [view, setView] = useState("list"); // "list" | "review"
  const [skillFilter, setSkillFilter] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState("");

  const [reviewData, setReviewData] = useState(null);
  const [loadingReview, setLoadingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");

  const loadProgress = useCallback(async () => {
    setLoadingList(true);
    setListError("");
    try {
      const data = await fetchProgress(skillFilter || undefined);
      setProgress(data);
    } catch (err) {
      setListError(err.message || "Failed to load progress");
    } finally {
      setLoadingList(false);
    }
  }, [skillFilter]);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  const openReview = async (resultId) => {
    setLoadingReview(true);
    setReviewError("");
    setReviewData(null);
    setView("review");
    try {
      const data = await fetchResultDetail(resultId);
      setReviewData(data);
    } catch (err) {
      setReviewError(err.message || "Failed to load review");
    } finally {
      setLoadingReview(false);
    }
  };

  const formatDate = (iso) => {
    try {
      return new Date(iso).toLocaleDateString("en-AU", {
        year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  // ── Review view ─────────────────────────────────────────────────────────
  if (view === "review") {
    const topicLabel = reviewData?.topic || "…";
    const scoreLabel = reviewData ? `${reviewData.percentage}%` : "";
    const dateLabel = reviewData ? formatDate(reviewData.completed_at) : "";
    const pctColor = reviewData ? (reviewData.percentage >= 70 ? "success" : reviewData.percentage >= 40 ? "warning" : "error") : "default";

    return (
      <Box>
        <DashboardNavbar title="Review Session" />

        {/* Nav bar */}
        <Card sx={{ mb: 3, borderRadius: "16px" }}>
          <CardContent sx={{ p: 2, display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
            <Button
              startIcon={<ArrowBackIcon />}
              variant="outlined"
              size="small"
              onClick={() => setView("list")}
              sx={{ borderRadius: "8px" }}
            >
              Back
            </Button>
            <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
              <Chip label={skillLabel(reviewData?.skill)} color={skillChipColor(reviewData?.skill)} size="small" sx={{ fontWeight: 600 }} />
              <Chip label={topicLabel} sx={{ background: "#f0f2f5", fontWeight: 600 }} />
              <Typography variant="body2" color="text.secondary">{dateLabel}</Typography>
            </Box>
            {scoreLabel && (
              <Chip label={scoreLabel} color={pctColor} sx={{ fontWeight: 700, borderRadius: "8px" }} />
            )}
          </CardContent>
        </Card>

        {loadingReview && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
            <CircularProgress />
          </Box>
        )}
        {reviewError && <Alert severity="error" sx={{ mb: 2, borderRadius: "8px" }}>{reviewError}</Alert>}

        {reviewData && (() => {
          const sk = reviewData.skill || "reading";
          const isObjective = sk === "reading" || sk === "listening";
          const isOpen = sk === "writing" || sk === "speaking";
          return (
            <>
              {isObjective && (
                <>
                  <ReviewPassage
                    passage={reviewData.passage || reviewData.transcript}
                    title={sk === "listening" ? "Listening (audio)" : "Reading passage"}
                  />
                  {(reviewData.question_results || []).map((qr, i) => (
                    <ReviewQuestion key={qr.question_id || i} qr={qr} index={i} />
                  ))}
                </>
              )}
              {isOpen && (
                <>
                  {reviewData.writing_task_summary && (
                    <ReviewPassage
                      title={reviewData.writing_task_summary.task_type === "summarize_written_text" ? "Task 1 data" : "Task 2 question"}
                      passage={
                        reviewData.writing_task_summary.passage
                        || reviewData.writing_task_summary.prompt
                        || ""
                      }
                    />
                  )}
                  {reviewData.speaking_task && (
                    <Card sx={{ mb: 3, borderRadius: "16px" }}>
                      <CardContent>
                        <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase" display="block" sx={{ mb: 1 }}>
                          Speaking cue
                        </Typography>
                        <Typography variant="body1" fontWeight={600}>{reviewData.speaking_task.prompt}</Typography>
                        {(reviewData.speaking_task.bullet_points || []).map((b, i) => (
                          <Typography key={i} variant="body2" color="text.secondary">• {b}</Typography>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                  {reviewData.user_response && (
                    <ReviewPassage title="Your response" passage={reviewData.user_response} />
                  )}
                  <ReviewEvaluation evaluation={reviewData.evaluation} />
                </>
              )}
            </>
          );
        })()}
      </Box>
    );
  }

  // ── List view ───────────────────────────────────────────────────────────
  const entries = progress?.entries || [];

  return (
    <Box>
      <DashboardNavbar title="Progress" />

      <Card sx={{ borderRadius: "16px" }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 1 }}>
            <Typography variant="h6" fontWeight={700}>
              Your Progress
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={loadProgress}
              sx={{ borderRadius: "8px" }}
            >
              Refresh
            </Button>
          </Box>

          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
            {[
              { label: "All", value: null },
              { label: "Reading", value: "reading" },
              { label: "Listening", value: "listening" },
              { label: "Writing", value: "writing" },
              { label: "Speaking", value: "speaking" },
            ].map((opt) => (
              <Chip
                key={String(opt.value)}
                label={opt.label}
                onClick={() => setSkillFilter(opt.value)}
                color={skillFilter === opt.value ? "primary" : "default"}
                variant={skillFilter === opt.value ? "filled" : "outlined"}
                sx={{ fontWeight: 600 }}
              />
            ))}
          </Box>

          {/* Stats */}
          {progress && entries.length > 0 && (
            <>
              <Box sx={{ display: "flex", gap: 1, mb: 3 }}>
                <StatBox value={progress.total_sessions} label="Sessions" />
                <Divider orientation="vertical" flexItem />
                <StatBox value={`${progress.average_percentage}%`} label="Average Score" />
              </Box>
              <Divider sx={{ mb: 2 }} />
            </>
          )}

          {loadingList && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {listError && <Alert severity="error" sx={{ borderRadius: "8px" }}>{listError}</Alert>}

          {!loadingList && !listError && entries.length === 0 && (
            <Box sx={{ textAlign: "center", py: 6 }}>
              <Typography variant="body1" color="text.secondary">No practice sessions yet.</Typography>
              <Typography variant="body2" color="text.secondary">Complete a practice session to see your progress here.</Typography>
            </Box>
          )}

          {!loadingList && entries.length > 0 && (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: "#7B809A", textTransform: "uppercase", fontSize: "0.7rem", letterSpacing: 0.5 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: "#7B809A", textTransform: "uppercase", fontSize: "0.7rem", letterSpacing: 0.5 }}>Skill</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: "#7B809A", textTransform: "uppercase", fontSize: "0.7rem", letterSpacing: 0.5 }}>Topic</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: "#7B809A", textTransform: "uppercase", fontSize: "0.7rem", letterSpacing: 0.5 }}>Score</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: "#7B809A", textTransform: "uppercase", fontSize: "0.7rem", letterSpacing: 0.5 }}>Result</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow
                      key={entry.id}
                      hover
                      sx={{ "&:last-child td": { border: 0 } }}
                    >
                      <TableCell sx={{ color: "#7B809A", fontSize: "0.8rem" }}>
                        {formatDate(entry.completed_at)}
                      </TableCell>
                      <TableCell>
                        <Chip label={skillLabel(entry.skill)} size="small" color={skillChipColor(entry.skill)} sx={{ fontWeight: 600 }} />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 500, color: "#344767" }}>
                        {entry.topic}
                      </TableCell>
                      <TableCell sx={{ color: "#344767" }}>
                        {entry.total_score}/{entry.max_score}
                      </TableCell>
                      <TableCell>
                        <ScoreBadge percentage={entry.percentage} />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="text"
                          color="primary"
                          onClick={() => openReview(entry.id)}
                          sx={{ fontWeight: 600, borderRadius: "6px", fontSize: "0.75rem" }}
                        >
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
