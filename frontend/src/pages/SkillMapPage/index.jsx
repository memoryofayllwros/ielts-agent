import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DashboardNavbar from "components/Navbars/DashboardNavbar";
import { fetchSkillMap, fetchNextStep } from "services/api";

const MODULE_TAB = [
  { value: "reading", label: "Reading" },
  { value: "listening", label: "Listening" },
  { value: "writing", label: "Writing" },
  { value: "speaking", label: "Speaking" },
];

function moduleLabel(value) {
  return MODULE_TAB.find((m) => m.value === value)?.label || value;
}

function formatDifficulty(d) {
  if (!d) return "";
  if (String(d).startsWith("band")) return `Band ${String(d).slice(4)}`;
  return d;
}

function practicePath(mod) {
  if (mod === "reading") return "/practice/reading";
  if (mod === "listening") return "/practice/listening";
  if (mod === "writing") return "/practice/writing";
  return "/practice/speaking";
}

function buildPracticeSearch({ focusSkill }) {
  const p = new URLSearchParams();
  p.set("adaptive", "1");
  if (focusSkill) p.set("focus", focusSkill);
  return p.toString();
}

function chipColorForStatus(status) {
  if (status === "unknown") return "default";
  if (status === "strong") return "success";
  if (status === "medium") return "warning";
  return "error";
}

function barColorForStatus(status) {
  if (status === "unknown") return "grey.400";
  if (status === "strong") return "success.main";
  if (status === "medium") return "warning.main";
  return "error.main";
}

function statusChipLabel(status) {
  if (status === "unknown") return "Unknown";
  return status;
}

function TrendRow({ trend, isUnknown }) {
  if (isUnknown) {
    return (
      <Typography variant="caption" color="text.secondary">
        Trend: unknown (no baseline yet)
      </Typography>
    );
  }
  const t = Number(trend) || 0;
  if (t > 0.02) {
    return (
      <Typography variant="caption" color="success.main" fontWeight={600}>
        ↑ improving · {(t * 100).toFixed(0)} pts vs prior week
      </Typography>
    );
  }
  if (t < -0.02) {
    return (
      <Typography variant="caption" color="error.main" fontWeight={600}>
        ↓ declining · {(t * 100).toFixed(0)} pts vs prior week
      </Typography>
    );
  }
  return (
    <Typography variant="caption" color="text.secondary">
      → stable (not enough change week to week)
    </Typography>
  );
}

function statusNarrative(status, label) {
  if (status === "unknown") {
    return `${label} is not diagnosed yet — we have no tagged outcomes for it. One focused practice session (or your diagnostic, where applicable) will establish a baseline.`;
  }
  if (status === "strong") {
    return `You are strong in ${label}. Keep touching it so it stays automatic under exam pressure.`;
  }
  if (status === "medium") {
    return `${label} is in the middle band — a few focused sessions usually tip it into “strong”.`;
  }
  return `${label} is a priority gap. Short, frequent sets beat occasional long marathons.`;
}

function NextStepPanel({ module, nextStep, onPractice, loading }) {
  const label =
    nextStep?.focus_skill_label || nextStep?.focus_label || "";
  const hasFocus = Boolean(nextStep?.focus_skill);

  return (
    <Card
      sx={{
        borderRadius: "16px",
        bgcolor: "#f7f9fc",
        border: "1px solid rgba(25, 118, 210, 0.12)",
        position: { md: "sticky" },
        top: { md: 88 },
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Typography variant="overline" fontWeight={700} color="primary" letterSpacing={1}>
          Next recommendation
        </Typography>
        {hasFocus ? (
          <>
            <Typography variant="h6" fontWeight={700} sx={{ mt: 0.5, color: "#344767" }}>
              Focus skill
            </Typography>
            <Typography variant="h5" color="primary" fontWeight={700} sx={{ mt: 0.5 }}>
              {label}
            </Typography>
            {nextStep?.focus_description ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.7 }}>
                {nextStep.focus_description}
              </Typography>
            ) : null}
            {(nextStep?.focus_practice_bullets || []).length > 0 ? (
              <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5 }}>
                {(nextStep.focus_practice_bullets || []).map((b) => (
                  <li key={b}>
                    <Typography variant="body2" color="text.secondary" component="span" sx={{ lineHeight: 1.7 }}>
                      {b}
                    </Typography>
                  </li>
                ))}
              </Box>
            ) : null}
          </>
        ) : (
          <Typography variant="subtitle1" fontWeight={600} sx={{ mt: 1, color: "#344767" }}>
            Build a bit more data
          </Typography>
        )}

        {nextStep?.reason ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.7 }}>
            {nextStep.reason}
          </Typography>
        ) : nextStep?.message ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.7 }}>
            {nextStep.message}
          </Typography>
        ) : null}

        {(nextStep?.difficulty || nextStep?.suggested_practice) && (
          <Box sx={{ mt: 2 }}>
            {nextStep.difficulty ? (
              <Typography variant="caption" color="text.secondary" display="block">
                Suggested difficulty: {formatDifficulty(nextStep.difficulty)}
              </Typography>
            ) : null}
            {nextStep.suggested_practice ? (
              <Typography variant="body2" sx={{ mt: 0.75, fontWeight: 500, color: "#344767" }}>
                {nextStep.suggested_practice}
              </Typography>
            ) : null}
          </Box>
        )}

        <Button
          variant="contained"
          fullWidth
          disabled={loading}
          sx={{ mt: 2.5, borderRadius: "12px", fontWeight: 700, py: 1.1 }}
          onClick={() => onPractice(hasFocus ? nextStep.focus_skill : null)}
        >
          {hasFocus ? "Practice this focus" : `Practice ${moduleLabel(module)}`}
        </Button>
      </CardContent>
    </Card>
  );
}

function OverviewStrip({ overview }) {
  if (!overview?.length) return null;
  return (
    <Card sx={{ borderRadius: "16px", mb: 3 }}>
      <CardContent sx={{ py: 2.5, px: { xs: 2, md: 3 } }}>
        <Typography variant="subtitle2" fontWeight={700} color="text.secondary" gutterBottom>
          Overall performance (by module)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 720 }}>
          A quick read of where your recent practice is strongest. Open a module below to see micro-skills.
        </Typography>
        <Grid container spacing={2}>
          {overview.map((m) => {
            const pct = Math.round((m.score || 0) * 100);
            return (
              <Grid item xs={6} md={3} key={m.module}>
                <Typography variant="caption" fontWeight={700} sx={{ textTransform: "capitalize" }}>
                  {m.module}
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, pct)}
                    sx={{
                      flex: 1,
                      height: 10,
                      borderRadius: 5,
                      bgcolor: "grey.200",
                      "& .MuiLinearProgress-bar": {
                        borderRadius: 5,
                        bgcolor:
                          pct >= 65 ? "success.main" : pct >= 45 ? "warning.main" : "error.main",
                      },
                    }}
                  />
                  <Typography variant="body2" fontWeight={700} sx={{ minWidth: 40, textAlign: "right" }}>
                    {m.score > 0 ? `${pct}%` : "—"}
                  </Typography>
                </Box>
              </Grid>
            );
          })}
        </Grid>
      </CardContent>
    </Card>
  );
}

function SkillRowCard({
  skill,
  journeyMode,
  expanded,
  onToggleExpand,
  onPracticeSkill,
}) {
  const attempts = skill.attempts ?? skill.total ?? 0;
  const pct = attempts > 0 ? Math.round(skill.accuracy * 100) : null;
  const status = skill.status || "unknown";
  const isUnknown = status === "unknown" || attempts < 1;

  return (
    <Card sx={{ borderRadius: "14px", overflow: "visible" }}>
      <CardContent sx={{ py: 2, px: 2.25 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, mb: 0.75 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: "#344767" }}>
                {skill.label}
              </Typography>
              <Chip
                label={statusChipLabel(status)}
                size="small"
                color={chipColorForStatus(status)}
                sx={{ fontWeight: 600, textTransform: status === "unknown" ? "none" : "capitalize" }}
              />
            </Box>
            <Typography variant="body2" color="text.secondary">
              {attempts > 0 ? (
                <>
                  Accuracy: <strong>{pct}%</strong>
                  {" · "}
                  Attempts: {attempts} ({skill.correct}/{skill.total} correct)
                </>
              ) : (
                <>
                  Accuracy: <strong>unknown</strong>
                  {" · "}
                  Not diagnosed yet (no tagged attempts).
                </>
              )}
            </Typography>
            <Box sx={{ mt: 0.75 }}>
              <TrendRow trend={skill.trend} isUnknown={isUnknown} />
            </Box>
            <LinearProgress
              variant="determinate"
              value={attempts > 0 ? Math.min(100, (skill.accuracy || 0) * 100) : 0}
              sx={{
                mt: 1.25,
                height: 8,
                borderRadius: 4,
                bgcolor: "grey.200",
                "& .MuiLinearProgress-bar": {
                  borderRadius: 4,
                  bgcolor: barColorForStatus(status),
                },
              }}
            />

            {journeyMode && skill.journey?.length > 0 && (
              <Box sx={{ mt: 1.5 }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary">
                  Journey (recent windows)
                </Typography>
                {skill.journey.map((pt) => (
                  <Box key={pt.label} sx={{ mt: 0.75 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.25 }}>
                      <Typography variant="caption">{pt.label}</Typography>
                      <Typography variant="caption" fontWeight={600}>
                        {Math.round(pt.accuracy * 100)}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(100, pt.accuracy * 100)}
                      sx={{
                        height: 4,
                        borderRadius: 2,
                        bgcolor: "grey.200",
                        "& .MuiLinearProgress-bar": { bgcolor: "primary.light", borderRadius: 2 },
                      }}
                    />
                  </Box>
                ))}
              </Box>
            )}
          </Box>
          <IconButton
            size="small"
            onClick={() => onToggleExpand(skill.skill_id)}
            aria-expanded={expanded}
            sx={{
              transform: expanded ? "rotate(180deg)" : "none",
              transition: "transform 0.2s",
            }}
          >
            <ExpandMoreIcon />
          </IconButton>
        </Box>

        <Button
          variant="outlined"
          size="small"
          fullWidth
          sx={{ mt: 1.5, borderRadius: "10px", fontWeight: 600 }}
          onClick={() => onPracticeSkill(skill.skill_id)}
        >
          Practice this skill
        </Button>

        <Collapse in={expanded}>
          <Divider sx={{ my: 2 }} />
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75 }}>
            {statusNarrative(status, skill.label)}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
            For item-level history, open <strong>Progress</strong> after you submit a session — each result
            keeps the passage, prompts, and your answers.
          </Typography>
        </Collapse>
      </CardContent>
    </Card>
  );
}

export default function SkillMapPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [module, setModule] = useState(() => {
    const m = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : "",
    ).get("module");
    return m && MODULE_TAB.some((t) => t.value === m) ? m : "reading";
  });
  const [data, setData] = useState(null);
  const [nextStep, setNextStep] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [journeyMode, setJourneyMode] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    const m = searchParams.get("module");
    if (m && MODULE_TAB.some((t) => t.value === m)) {
      setModule(m);
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    setErr("");
    setLoading(true);
    (async () => {
      try {
        const [sm, ns] = await Promise.all([fetchSkillMap(module), fetchNextStep(module)]);
        if (!cancelled) {
          setData(sm);
          setNextStep(ns);
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e.message || "Failed to load");
          setData(null);
          setNextStep(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [module]);

  const goPractice = (focusSkill) => {
    const path = practicePath(module);
    const q = buildPracticeSearch({ focusSkill });
    navigate(`${path}?${q}`);
  };

  const ready = !loading && data?.module === module;
  const skills = ready ? data.skills || [] : [];
  const overview = data?.overview || [];

  const tabIndex = MODULE_TAB.findIndex((m) => m.value === module);

  return (
    <Box sx={{ pb: 4 }}>
      <DashboardNavbar title="Learning skill map" />
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 800 }}>
        This is a visual map of what you are getting better at — not just a score. Use it to see strengths,
        gaps, and the next skill the planner recommends.
      </Typography>

      {err ? <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert> : null}

      {overview.length > 0 ? <OverviewStrip overview={overview} /> : null}

      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: { md: "flex-start" },
          gap: 3,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Card sx={{ borderRadius: "16px", mb: 2 }}>
            <Box sx={{ borderBottom: 1, borderColor: "divider", px: 1 }}>
              <Tabs
                value={tabIndex >= 0 ? tabIndex : 0}
                onChange={(_, i) => setModule(MODULE_TAB[i].value)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ minHeight: 48 }}
              >
                {MODULE_TAB.map((m) => (
                  <Tab key={m.value} label={m.label} sx={{ fontWeight: 600 }} />
                ))}
              </Tabs>
            </Box>
            <CardContent sx={{ pt: 2 }}>
              <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2, mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#344767", flex: 1 }}>
                  {moduleLabel(module)} micro-skills
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={journeyMode}
                      onChange={(e) => setJourneyMode(e.target.checked)}
                      size="small"
                    />
                  }
                  label={<Typography variant="body2">Journey mode</Typography>}
                />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Weakest skills appear first so you can see what to fix. Expand a row for a short narrative;
                trend compares the last 7 days to the previous 7 days (when you have data in both).
              </Typography>
              {err && !data ? (
                <Typography variant="body2" color="text.secondary">
                  Fix the error above, then switch module or refresh the page to retry.
                </Typography>
              ) : !ready ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  {skills.map((s) => (
                    <SkillRowCard
                      key={s.skill_id}
                      skill={s}
                      journeyMode={journeyMode}
                      expanded={expandedId === s.skill_id}
                      onToggleExpand={(id) =>
                        setExpandedId((prev) => (prev === id ? null : id))
                      }
                      onPracticeSkill={(id) => goPractice(id)}
                    />
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ width: { xs: "100%", md: 360 }, flexShrink: 0 }}>
          <NextStepPanel
            module={module}
            nextStep={nextStep}
            onPractice={goPractice}
            loading={loading}
          />
        </Box>
      </Box>
    </Box>
  );
}
