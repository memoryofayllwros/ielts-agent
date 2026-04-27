import { useState, useEffect, useMemo } from "react";
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
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import MenuBook from "@mui/icons-material/MenuBook";
import Headphones from "@mui/icons-material/Headphones";
import EditNote from "@mui/icons-material/EditNote";
import Mic from "@mui/icons-material/Mic";
import TrendingUp from "@mui/icons-material/TrendingUp";
import TrendingFlat from "@mui/icons-material/TrendingFlat";
import TrendingDown from "@mui/icons-material/TrendingDown";
import HelpOutline from "@mui/icons-material/HelpOutline";
import DashboardNavbar from "components/Navbars/DashboardNavbar";
import { fetchSkillMap, fetchNextStep } from "services/api";

const MODULE_TAB = [
  { value: "reading", label: "Reading", Icon: MenuBook, blurb: "Passages & questions" },
  { value: "listening", label: "Listening", Icon: Headphones, blurb: "Audio & detail" },
  { value: "writing", label: "Writing", Icon: EditNote, blurb: "Tasks & structure" },
  { value: "speaking", label: "Speaking", Icon: Mic, blurb: "Fluency & ideas" },
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
  if (status === "unknown") return "Not measured";
  if (status === "strong") return "Strong";
  if (status === "medium") return "Developing";
  return "Priority";
}

/** Group id for layout + ordering */
function skillGroupId(status) {
  if (status === "unknown") return "notMeasured";
  if (status === "strong") return "strong";
  if (status === "medium") return "developing";
  return "priority";
}

const SKILL_GROUPS = [
  {
    id: "priority",
    title: "Priority",
    subtitle: "Practice these first — they hold your band back most.",
    dot: "error.main",
  },
  {
    id: "developing",
    title: "Developing",
    subtitle: "You are close — a few focused sessions usually move these up.",
    dot: "warning.main",
  },
  {
    id: "strong",
    title: "Strong",
    subtitle: "Keep reviewing so they stay automatic under exam pressure.",
    dot: "success.main",
  },
  {
    id: "notMeasured",
    title: "Not measured yet",
    subtitle: "No tagged practice here yet — one session will draw these on the map.",
    dot: "grey.500",
  },
];

function TrendRow({ trend, isUnknown }) {
  if (isUnknown) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
        <HelpOutline sx={{ fontSize: 16, color: "text.disabled" }} />
        <Typography variant="caption" color="text.secondary">
          No trend yet (need more data)
        </Typography>
      </Box>
    );
  }
  const t = Number(trend) || 0;
  if (t > 0.02) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
        <TrendingUp sx={{ fontSize: 16, color: "success.main" }} />
        <Typography variant="caption" color="success.main" fontWeight={600}>
          Improving · +{(t * 100).toFixed(0)} pts vs last week
        </Typography>
      </Box>
    );
  }
  if (t < -0.02) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
        <TrendingDown sx={{ fontSize: 16, color: "error.main" }} />
        <Typography variant="caption" color="error.main" fontWeight={600}>
          Slipping · {(t * 100).toFixed(0)} pts vs last week
        </Typography>
      </Box>
    );
  }
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
      <TrendingFlat sx={{ fontSize: 16, color: "text.secondary" }} />
      <Typography variant="caption" color="text.secondary">
        Stable week to week
      </Typography>
    </Box>
  );
}

function statusNarrative(status, label) {
  if (status === "unknown") {
    return `${label} is not on the map yet — we need at least one tagged outcome. Start a short practice (or your diagnostic) to place it.`;
  }
  if (status === "strong") {
    return `You are strong in ${label}. Keep light touch practice so it stays automatic in the real exam.`;
  }
  if (status === "medium") {
    return `${label} is in the middle — a few focused sessions usually push it into “strong”.`;
  }
  return `${label} is a priority gap. Short, frequent sets work better than rare long sessions.`;
}

function LegendBar() {
  const items = [
    { label: "Strong", color: "success.main" },
    { label: "Developing", color: "warning.main" },
    { label: "Priority", color: "error.main" },
    { label: "Not measured", color: "grey.400" },
  ];
  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: { xs: 1, sm: 2 },
        py: 1.5,
        px: { xs: 1.5, sm: 2 },
        borderRadius: 2,
        bgcolor: "rgba(13, 148, 136, 0.06)",
        border: "1px dashed",
        borderColor: "rgba(13, 148, 136, 0.25)",
      }}
    >
      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ width: "100%", sm: { width: "auto" } }}>
        How to read the map
      </Typography>
      {items.map((it) => (
        <Box key={it.label} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: it.color }} />
          <Typography variant="body2" fontWeight={600} color="text.primary">
            {it.label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function FourPaperSelector({ module, overview, onSelectModule }) {
  const byMod = useMemo(() => {
    const m = new Map();
    (overview || []).forEach((o) => m.set(o.module, o));
    return m;
  }, [overview]);

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle1" fontWeight={800} color="text.primary" sx={{ mb: 0.5 }}>
        1 · Your four papers
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 720 }}>
        Tap a paper to open its micro-skills below. Numbers are from your recent tagged practice.
      </Typography>
      <Grid container spacing={1.5}>
        {MODULE_TAB.map((m) => {
          const o = byMod.get(m.value);
          const pct = o?.score != null ? Math.round((o.score || 0) * 100) : null;
          const selected = module === m.value;
          const Icon = m.Icon;
          const barColor =
            pct == null || o?.score <= 0
              ? "grey.300"
              : pct >= 65
                ? "success.main"
                : pct >= 45
                  ? "warning.main"
                  : "error.main";
          return (
            <Grid item xs={6} md={3} key={m.value}>
              <Paper
                elevation={0}
                onClick={() => onSelectModule(m.value)}
                sx={{
                  p: 2,
                  cursor: "pointer",
                  height: "100%",
                  border: 2,
                  borderColor: selected ? "primary.main" : "transparent",
                  bgcolor: selected ? "rgba(13, 148, 136, 0.08)" : "background.paper",
                  borderRadius: 2,
                  transition: "transform 0.15s, box-shadow 0.15s",
                  boxShadow: selected ? "0 4px 20px rgba(13, 148, 136, 0.15)" : 1,
                  "&:hover": {
                    transform: "translateY(-2px)",
                    boxShadow: 3,
                  },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: "10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: selected ? "primary.main" : "grey.100",
                      color: selected ? "#fff" : "primary.main",
                    }}
                  >
                    <Icon fontSize="small" />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" fontWeight={800} noWrap>
                      {m.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {m.blurb}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={pct != null && pct > 0 ? Math.min(100, pct) : 0}
                    sx={{
                      flex: 1,
                      height: 8,
                      borderRadius: 4,
                      bgcolor: "grey.200",
                      "& .MuiLinearProgress-bar": { borderRadius: 4, bgcolor: barColor },
                    }}
                  />
                  <Typography variant="h6" fontWeight={800} sx={{ minWidth: 44, textAlign: "right", color: "text.primary" }}>
                    {pct != null && o?.score > 0 ? `${pct}%` : "—"}
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}

function ModuleQuickStats({ skills, show }) {
  const counts = useMemo(() => {
    const c = { priority: 0, developing: 0, strong: 0, notMeasured: 0 };
    skills.forEach((s) => {
      c[skillGroupId(s.status || "unknown")] += 1;
    });
    return c;
  }, [skills]);

  const items = [
    { key: "priority", label: "Priority", n: counts.priority, color: "error.main" },
    { key: "developing", label: "Developing", n: counts.developing, color: "warning.main" },
    { key: "strong", label: "Strong", n: counts.strong, color: "success.main" },
    { key: "notMeasured", label: "Not measured", n: counts.notMeasured, color: "grey.500" },
  ];

  if (!show) return null;

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25, mb: 2 }}>
      {items.map((it) => (
        <Box
          key={it.key}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            py: 0.75,
            px: 1.5,
            borderRadius: 10,
            bgcolor: "grey.100",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: it.color }} />
          <Typography variant="body2" fontWeight={800} color="text.primary">
            {it.n} {it.label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function NextStepPanel({ module, nextStep, onPractice, loading }) {
  const label = nextStep?.focus_skill_label || nextStep?.focus_label || "";
  const hasFocus = Boolean(nextStep?.focus_skill);

  return (
    <Card
      sx={{
        borderRadius: 2,
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "rgba(13, 148, 136, 0.28)",
        background: "linear-gradient(180deg, rgba(13, 148, 136, 0.06) 0%, #fff 40%)",
        position: { md: "sticky" },
        top: { md: 88 },
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Typography variant="overline" fontWeight={800} color="primary" letterSpacing={1.2}>
          Suggested next step
        </Typography>
        {hasFocus ? (
          <>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              Focus skill
            </Typography>
            <Typography variant="h5" color="primary.dark" fontWeight={800} sx={{ mt: 0.25, lineHeight: 1.3 }}>
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
          <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 1, color: "text.primary" }}>
            Keep practicing to unlock a focus
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
              <Typography variant="body2" sx={{ mt: 0.75, fontWeight: 600, color: "text.primary" }}>
                {nextStep.suggested_practice}
              </Typography>
            ) : null}
          </Box>
        )}

        <Button
          variant="contained"
          fullWidth
          disabled={loading}
          sx={{ mt: 2.5, borderRadius: "12px", fontWeight: 700, py: 1.2 }}
          onClick={() => onPractice(hasFocus ? nextStep.focus_skill : null)}
        >
          {hasFocus ? "Go to practice" : `Practice ${moduleLabel(module)}`}
        </Button>
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
  const stripe = barColorForStatus(status);

  return (
    <Card
      sx={{
        borderRadius: 2,
        overflow: "visible",
        border: "1px solid",
        borderColor: "divider",
        borderLeft: "5px solid",
        borderLeftColor: stripe,
      }}
    >
      <CardContent sx={{ py: 2, px: 2.25 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, mb: 0.5 }}>
              <Typography variant="subtitle1" fontWeight={800} sx={{ color: "text.primary" }}>
                {skill.label}
              </Typography>
              <Chip
                label={statusChipLabel(status)}
                size="small"
                color={chipColorForStatus(status)}
                sx={{ fontWeight: 700 }}
              />
            </Box>
            <Typography variant="body2" color="text.secondary">
              {attempts > 0 ? (
                <>
                  <strong>{pct}%</strong> accuracy · {attempts} attempts ({skill.correct}/{skill.total} correct)
                </>
              ) : (
                <>No data yet — practice once to place this skill on the map.</>
              )}
            </Typography>
            <TrendRow trend={skill.trend} isUnknown={isUnknown} />
            <LinearProgress
              variant="determinate"
              value={attempts > 0 ? Math.min(100, (skill.accuracy || 0) * 100) : 0}
              sx={{
                mt: 1.25,
                height: 10,
                borderRadius: 5,
                bgcolor: "grey.200",
                "& .MuiLinearProgress-bar": {
                  borderRadius: 5,
                  bgcolor: stripe,
                },
              }}
            />

            {journeyMode && skill.journey?.length > 0 && (
              <Box sx={{ mt: 1.5 }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary">
                  Recent windows
                </Typography>
                {skill.journey.map((pt) => (
                  <Box key={pt.label} sx={{ mt: 0.75 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.25 }}>
                      <Typography variant="caption">{pt.label}</Typography>
                      <Typography variant="caption" fontWeight={700}>
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
          <Tooltip title="Tips & detail">
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
          </Tooltip>
        </Box>

        <Button
          variant="outlined"
          color="primary"
          size="medium"
          fullWidth
          sx={{ mt: 1.5, borderRadius: "10px", fontWeight: 700 }}
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
            For item-by-item history, open <strong>Progress</strong> after you submit a session.
          </Typography>
        </Collapse>
      </CardContent>
    </Card>
  );
}

function groupSkillsByBand(skills) {
  const grouped = { priority: [], developing: [], strong: [], notMeasured: [] };
  skills.forEach((s) => {
    grouped[skillGroupId(s.status || "unknown")].push(s);
  });
  return grouped;
}

export default function SkillMapPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [module, setModuleState] = useState(() => {
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

  const setModule = (m) => {
    setModuleState(m);
    setSearchParams({ module: m });
  };

  useEffect(() => {
    const m = searchParams.get("module");
    if (m && MODULE_TAB.some((t) => t.value === m)) {
      setModuleState(m);
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
  const grouped = useMemo(() => groupSkillsByBand(skills), [skills]);

  return (
    <Box sx={{ pb: 5, width: "100%", minWidth: 0 }}>
      <DashboardNavbar title="Skill map" />

      <Card
        sx={{
          mb: 3,
          borderRadius: 2,
          overflow: "hidden",
          background: (t) =>
            `linear-gradient(135deg, ${t.palette.primary.dark} 0%, ${t.palette.primary.main} 45%, #2DD4BF 100%)`,
          color: "#fff",
        }}
      >
        <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
          <Typography variant="overline" sx={{ opacity: 0.95, fontWeight: 800, letterSpacing: "0.14em" }}>
            At a glance
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5, letterSpacing: "-0.03em" }}>
            Your skill map
          </Typography>
          <Typography variant="body1" sx={{ mt: 1.25, opacity: 0.95, maxWidth: 720, lineHeight: 1.65 }}>
            Each <strong>micro-skill</strong> is a building block inside Listening, Reading, Writing, or Speaking.
            Colors show how you are doing <strong>right now</strong> — not a single exam score.
          </Typography>
        </CardContent>
      </Card>

      <LegendBar />

      {err ? (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {err}
        </Alert>
      ) : null}

      <FourPaperSelector module={module} overview={overview} onSelectModule={setModule} />

      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", lg: "row" },
          alignItems: { lg: "flex-start" },
          gap: 3,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={800} color="text.primary" sx={{ mb: 0.5 }}>
            2 · Micro-skills · {moduleLabel(module)}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, maxWidth: 720 }}>
            Skills are grouped so you see <strong>what to fix first</strong>. Trend compares the last 7 days to the week
            before (when both have data).
          </Typography>

          <ModuleQuickStats skills={skills} show={ready && skills.length > 0} />

          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2, mb: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={journeyMode}
                  onChange={(e) => setJourneyMode(e.target.checked)}
                  size="small"
                  color="primary"
                />
              }
              label={
                <Typography variant="body2" fontWeight={600}>
                  Show recent score windows
                </Typography>
              }
            />
            <Tooltip title="Extra mini-bars when you have history across time windows">
              <Typography variant="caption" color="text.secondary" sx={{ cursor: "help" }}>
                What is this?
              </Typography>
            </Tooltip>
          </Box>

          {!ready && !err ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress />
            </Box>
          ) : null}

          {ready && skills.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              No micro-skills listed for this paper yet. Complete a practice session — your map will fill in.
            </Alert>
          ) : null}

          {ready &&
            SKILL_GROUPS.map((g) => {
              const list = grouped[g.id];
              if (!list?.length) return null;
              return (
                <Box key={g.id} sx={{ mb: 3 }}>
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 1.5 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: g.dot, mt: 0.6, flexShrink: 0 }} />
                    <Box>
                      <Typography variant="h6" fontWeight={800} color="text.primary">
                        {g.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {g.subtitle}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                    {list.map((s) => (
                      <SkillRowCard
                        key={s.skill_id}
                        skill={s}
                        journeyMode={journeyMode}
                        expanded={expandedId === s.skill_id}
                        onToggleExpand={(id) => setExpandedId((prev) => (prev === id ? null : id))}
                        onPracticeSkill={(id) => goPractice(id)}
                      />
                    ))}
                  </Box>
                </Box>
              );
            })}
        </Box>

        <Box sx={{ width: { xs: "100%", lg: 380 }, flexShrink: 0 }}>
          <NextStepPanel module={module} nextStep={nextStep} onPractice={goPractice} loading={loading} />
        </Box>
      </Box>
    </Box>
  );
}
