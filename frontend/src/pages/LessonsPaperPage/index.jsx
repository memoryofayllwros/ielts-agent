import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import TextField from "@mui/material/TextField";
import Divider from "@mui/material/Divider";
import ArrowBack from "@mui/icons-material/ArrowBack";
import DashboardNavbar from "components/Navbars/DashboardNavbar";
import { dashboardPage } from "utils/pageLayout";
import { IELTS_PAPERS } from "constants/ieltsPapers";
import {
  fetchLessons,
  fetchLessonVideoBlob,
  fetchLessonClipVideoBlob,
  fetchLessonDetail,
  fetchLessonCompilePlan,
  requestLessonGenerate,
  submitLessonComprehension,
  submitLessonRoleplay,
} from "services/api";

const PAPER_KEYS = new Set(IELTS_PAPERS.map((p) => p.key));

function statusChipColor(status) {
  if (status === "ready") return "success";
  if (status === "failed") return "error";
  if (status === "processing" || status === "queued") return "warning";
  return "default";
}

function ClipCarousel({ lessonId, clipPlayback }) {
  const [idx, setIdx] = useState(0);
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const urlRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
      setUrl(null);
      try {
        const clip = clipPlayback[idx];
        const blob = await fetchLessonClipVideoBlob(lessonId, clip.index);
        if (cancelled) return;
        urlRef.current = URL.createObjectURL(blob);
        setUrl(urlRef.current);
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Could not load video");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [lessonId, clipPlayback, idx]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 1 }}>
        <CircularProgress size={22} />
        <Typography variant="body2" color="text.secondary">
          Loading clip {idx + 1}/{clipPlayback.length}…
        </Typography>
      </Box>
    );
  }
  if (err) {
    return (
      <Typography variant="body2" color="error">
        {err}
      </Typography>
    );
  }
  if (!url) return null;

  const clipType = clipPlayback[idx]?.type || "clip";

  return (
    <Box sx={{ mt: 1 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, flexWrap: "wrap" }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
          Clip {idx + 1}/{clipPlayback.length} · {clipType}
        </Typography>
        <Button size="small" variant="outlined" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>
          Previous
        </Button>
        <Button size="small" variant="outlined" disabled={idx >= clipPlayback.length - 1} onClick={() => setIdx((i) => i + 1)}>
          Next
        </Button>
      </Stack>
      <Box component="video" controls src={url} sx={{ width: "100%", maxWidth: 720, borderRadius: 1 }} playsInline />
    </Box>
  );
}

function LessonMedia({ lesson }) {
  const clips = lesson.clip_playback && lesson.clip_playback.length > 0 ? lesson.clip_playback : null;
  if (clips) {
    return <ClipCarousel lessonId={lesson.id} clipPlayback={clips} />;
  }
  return <SingleLessonVideo lessonId={lesson.id} />;
}

function SingleLessonVideo({ lessonId }) {
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;
    (async () => {
      try {
        const blob = await fetchLessonVideoBlob(lessonId);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Could not load video");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [lessonId]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 1 }}>
        <CircularProgress size={22} />
        <Typography variant="body2" color="text.secondary">
          Loading video…
        </Typography>
      </Box>
    );
  }
  if (err) {
    return (
      <Typography variant="body2" color="error">
        {err}
      </Typography>
    );
  }
  if (!url) return null;
  return <Box component="video" controls src={url} sx={{ width: "100%", maxWidth: 720, borderRadius: 1, mt: 1 }} playsInline />;
}

function LessonPackPanel({ lessonId, detail, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [local, setLocal] = useState(null);
  const [cqBusy, setCqBusy] = useState(false);
  const [rpBusy, setRpBusy] = useState(false);
  const [cqErr, setCqErr] = useState(null);
  const [rpErr, setRpErr] = useState(null);
  const [answers, setAnswers] = useState({});
  const [transcript, setTranscript] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetchLessonDetail(lessonId);
      setLocal(d);
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    if (open && !local) load();
  }, [open, local, load]);

  const data = local || detail;
  const content = data?.content || {};
  const questions = content.comprehension_questions || [];
  const hook = data?.evaluation_hook || {};

  const handleComprehension = async () => {
    setCqBusy(true);
    setCqErr(null);
    try {
      await submitLessonComprehension(lessonId, answers);
      await load();
      onUpdate?.();
    } catch (e) {
      setCqErr(e?.message || "Submit failed");
    } finally {
      setCqBusy(false);
    }
  };

  const handleRoleplay = async () => {
    setRpBusy(true);
    setRpErr(null);
    try {
      await submitLessonRoleplay(lessonId, transcript);
      await load();
      onUpdate?.();
    } catch (e) {
      setRpErr(e?.message || "Submit failed");
    } finally {
      setRpBusy(false);
    }
  };

  return (
    <Box sx={{ mt: 1.5 }}>
      <Button size="small" variant="text" onClick={() => setOpen((o) => !o)} sx={{ fontWeight: 700 }}>
        {open ? "Hide lesson pack" : "Show lesson pack (text + practice)"}
      </Button>
      <Collapse in={open}>
        <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 1, bgcolor: "action.hover" }}>
          {loading ? <LinearProgress sx={{ mb: 1 }} /> : null}
          {content.model_answer?.text ? (
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                Model language
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, lineHeight: 1.65 }}>
                {content.model_answer.text}
              </Typography>
            </Box>
          ) : null}
          {content.highlighted_phrases?.length ? (
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                Highlighted chunks
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 0.75 }}>
                {content.highlighted_phrases.map((p) => (
                  <Chip key={p} size="small" label={p} variant="outlined" />
                ))}
              </Stack>
            </Box>
          ) : null}
          {content.explanation ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.65 }}>
              {content.explanation}
            </Typography>
          ) : null}
          {content.practice_prompt ? (
            <Alert severity="info" sx={{ mb: 1.5 }}>
              <Typography variant="body2" fontWeight={700}>
                Practice
              </Typography>
              <Typography variant="body2">{content.practice_prompt}</Typography>
            </Alert>
          ) : null}
          {questions.length > 0 ? (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
                Comprehension
              </Typography>
              {questions.map((q) => (
                <TextField
                  key={q.id}
                  fullWidth
                  size="small"
                  sx={{ mb: 1 }}
                  label={q.question}
                  value={answers[q.id] || ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                />
              ))}
              {data?.comprehension_results ? (
                <Typography variant="caption" color="text.secondary">
                  Results: {JSON.stringify(data.comprehension_results)}
                </Typography>
              ) : null}
              {cqErr ? (
                <Typography variant="caption" color="error" display="block">
                  {cqErr}
                </Typography>
              ) : null}
              <Button size="small" variant="contained" disabled={cqBusy || data?.comprehension_submitted} onClick={handleComprehension}>
                {cqBusy ? "Checking…" : data?.comprehension_submitted ? "Submitted" : "Submit answers"}
              </Button>
            </Box>
          ) : null}
          {hook.type === "speaking_response" ? (
            <Box>
              <Divider sx={{ my: 1.5 }} />
              <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
                Roleplay / speaking
              </Typography>
              {content.roleplay_prompt ? (
                <Typography variant="body2" sx={{ mb: 1, lineHeight: 1.65 }}>
                  {content.roleplay_prompt}
                </Typography>
              ) : null}
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="Your response (transcript)"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                sx={{ mb: 1 }}
              />
              {rpErr ? (
                <Typography variant="caption" color="error" display="block">
                  {rpErr}
                </Typography>
              ) : null}
              {data?.roleplay_evaluation ? (
                <Alert severity="success" sx={{ mt: 1 }}>
                  Submitted — band feedback recorded. Weakness vector updated.
                </Alert>
              ) : null}
              <Button size="small" variant="contained" disabled={rpBusy || data?.roleplay_submitted} onClick={handleRoleplay}>
                {rpBusy ? "Evaluating…" : data?.roleplay_submitted ? "Submitted" : "Submit for AI feedback"}
              </Button>
            </Box>
          ) : null}
        </Box>
      </Collapse>
    </Box>
  );
}

export default function LessonsPaperPage() {
  const { paper } = useParams();
  const navigate = useNavigate();
  const meta = IELTS_PAPERS.find((p) => p.key === paper);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [genBusy, setGenBusy] = useState(false);
  const [plan, setPlan] = useState(null);
  const [planErr, setPlanErr] = useState(null);
  const pollRef = useRef(null);

  const load = useCallback(async () => {
    if (!paper || !PAPER_KEYS.has(paper)) return;
    try {
      const data = await fetchLessons(paper);
      setLessons(data.lessons || []);
      setError(null);
    } catch (e) {
      setError(e?.message || "Failed to load lessons");
    } finally {
      setLoading(false);
    }
  }, [paper]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const needsPoll = lessons.some((l) => l.status === "queued" || l.status === "processing");
    if (needsPoll) {
      pollRef.current = window.setInterval(load, 3500);
      return () => {
        if (pollRef.current) window.clearInterval(pollRef.current);
      };
    }
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return undefined;
  }, [lessons, load]);

  if (!paper || !PAPER_KEYS.has(paper) || !meta) {
    return <Navigate to="/lessons" replace />;
  }

  const IconComp = meta.Icon;

  const handleGenerate = async () => {
    setGenBusy(true);
    setError(null);
    try {
      await requestLessonGenerate({ module: paper });
      await load();
    } catch (e) {
      setError(e?.message || "Generation failed");
    } finally {
      setGenBusy(false);
    }
  };

  const handleCompilePlan = async () => {
    setPlan(null);
    setPlanErr(null);
    try {
      const p = await fetchLessonCompilePlan({ module: paper, max_steps: 6 });
      setPlan(p);
    } catch (e) {
      setPlanErr(e?.message || "Could not build plan");
    }
  };

  return (
    <Box component="main" id={`main-lessons-${paper}`} sx={dashboardPage.root} aria-label={`${meta.title} lessons`}>
      <DashboardNavbar title={`Lessons · ${meta.title}`} />
      <Button startIcon={<ArrowBack />} onClick={() => navigate("/lessons")} sx={{ mb: 2, fontWeight: 600 }} color="inherit">
        All papers
      </Button>

      <Card sx={{ borderRadius: 2, border: "1px solid", borderColor: meta.border, background: meta.tint, mb: 2.5 }}>
        <CardContent sx={{ p: { xs: 2.25, sm: 3 } }}>
          <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ mb: 2 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                bgcolor: "background.paper",
                color: meta.iconColor,
                boxShadow: "0 2px 8px rgba(15, 23, 42, 0.06)",
              }}
              aria-hidden
            >
              <IconComp sx={{ fontSize: 28 }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography component="h1" variant="h5" fontWeight={800} color="text.primary" sx={{ letterSpacing: "-0.02em", mb: 0.5 }}>
                {meta.title} lessons
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65, maxWidth: "65ch" }}>
                AI videos target weaker micro-skills. Speaking defaults to scenario-style clips; other papers use explainer-style
                motion graphics. Open the lesson pack for text, comprehension, and optional speaking evaluation.
              </Typography>
            </Box>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }} flexWrap="wrap">
            <Button
              variant="contained"
              color={meta.accent}
              disabled={genBusy}
              onClick={handleGenerate}
              sx={{ borderRadius: "10px", fontWeight: 700, minHeight: 44 }}
            >
              {genBusy ? "Starting…" : "Generate lesson (weakness-weighted)"}
            </Button>
            <Button variant="outlined" color={meta.accent} onClick={handleCompilePlan} sx={{ borderRadius: "10px", fontWeight: 700 }}>
              Preview study plan
            </Button>
            <Button variant="outlined" color={meta.accent} onClick={() => navigate(meta.practiceRoute)} sx={{ borderRadius: "10px", fontWeight: 700 }}>
              Go to Practice · {meta.title}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {planErr ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {planErr}
        </Alert>
      ) : null}
      {plan ? (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => setPlan(null)}>
          <Typography variant="subtitle2" fontWeight={800}>
            Suggested sequence ({plan.module})
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Weakness vector: {JSON.stringify(plan.weakness_vector)}
          </Typography>
          <Stack component="ol" spacing={0.5} sx={{ m: 0, pl: 2.5 }}>
            {(plan.steps || []).map((s, i) => (
              <Typography key={`${s.skill_id}-${i}`} component="li" variant="body2">
                {s.skill_id} — {s.topic}/{s.scenario} ({s.difficulty}) · {s.lesson_kind} · {s.reason}
              </Typography>
            ))}
          </Stack>
        </Alert>
      ) : null}

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <LinearProgress sx={{ mb: 2 }} />
      ) : lessons.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No lessons yet. Use the button above to generate your first video for this paper.
        </Typography>
      ) : (
        <Stack spacing={2}>
          {lessons.map((lesson) => (
            <Card key={lesson.id} variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} sx={{ mb: 1 }} flexWrap="wrap">
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" fontWeight={800} sx={{ lineHeight: 1.3 }}>
                      {lesson.title || lesson.skill_id}
                    </Typography>
                    <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 0.5 }}>
                      <Chip size="small" label={lesson.lesson_kind || "skill_explainer"} variant="outlined" />
                      {lesson.curriculum?.topic ? <Chip size="small" label={`topic: ${lesson.curriculum.topic}`} /> : null}
                      {lesson.curriculum?.difficulty ? <Chip size="small" label={lesson.curriculum.difficulty} /> : null}
                    </Stack>
                  </Box>
                  <Chip size="small" label={lesson.status} color={statusChipColor(lesson.status)} sx={{ fontWeight: 700 }} />
                </Stack>
                {lesson.why_this_lesson ? (
                  <Box
                    sx={{
                      mb: 1.5,
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: "action.hover",
                      borderLeft: "4px solid",
                      borderColor: "primary.main",
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Why this lesson?
                    </Typography>
                    <Typography variant="body2" color="text.primary" sx={{ mt: 0.5, lineHeight: 1.6 }}>
                      {lesson.why_this_lesson.summary}
                    </Typography>
                    {lesson.why_this_lesson.attempts_at_generation > 0 ? (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                        {lesson.why_this_lesson.skill_label} — about{" "}
                        {Math.round((lesson.why_this_lesson.accuracy_at_generation ?? 0) * 100)}% accuracy across{" "}
                        {lesson.why_this_lesson.attempts_at_generation} attempts (when generated).
                      </Typography>
                    ) : null}
                  </Box>
                ) : null}
                {lesson.status === "queued" || lesson.status === "processing" ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Generating video in the background… This page refreshes automatically.
                  </Typography>
                ) : null}
                {lesson.status === "failed" && lesson.error ? (
                  <Typography variant="body2" color="error" sx={{ mb: 1, whiteSpace: "pre-wrap" }}>
                    {lesson.error}
                  </Typography>
                ) : null}
                {lesson.status === "ready" ? (
                  <>
                    <LessonMedia lesson={lesson} />
                    <LessonPackPanel lessonId={lesson.id} detail={null} onUpdate={load} />
                  </>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
}
