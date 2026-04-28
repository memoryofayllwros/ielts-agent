import { useState, useEffect, useMemo, useCallback, memo } from "react";
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
import {
  accuracyToIeltsBand,
  accuracyDeltaToBandDelta,
  formatMicroSkillBand,
} from "utils/ieltsMicroBand";
import { dashboardPage } from "utils/pageLayout";

function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

const MODULE_TAB = [
  { value: "reading", label: "Reading", Icon: MenuBook, blurb: "Passages & questions" },
  { value: "listening", label: "Listening", Icon: Headphones, blurb: "Audio & detail" },
  { value: "writing", label: "Writing", Icon: EditNote, blurb: "Tasks & structure" },
  { value: "speaking", label: "Speaking", Icon: Mic, blurb: "Fluency & ideas" },
];

/** HashRouter keeps ?module= in the hash, not in window.location.search */
function readModuleFromHash() {
  if (typeof window === "undefined") return null;
  const h = window.location.hash.replace(/^#/, "");
  const qi = h.indexOf("?");
  const q = qi >= 0 ? h.slice(qi + 1) : "";
  const m = new URLSearchParams(q).get("module");
  return m && MODULE_TAB.some((t) => t.value === m) ? m : null;
}

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

const EMPTY_SKILLS = [];

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
  const bd = accuracyDeltaToBandDelta(t);
  if (t > 0.02) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
        <TrendingUp sx={{ fontSize: 16, color: "success.main" }} />
        <Typography variant="caption" color="success.main" fontWeight={600}>
          Improving · +{Math.abs(bd).toFixed(1)} band vs last week
        </Typography>
      </Box>
    );
  }
  if (t < -0.02) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
        <TrendingDown sx={{ fontSize: 16, color: "error.main" }} />
        <Typography variant="caption" color="error.main" fontWeight={600}>
          Slipping · −{Math.abs(bd).toFixed(1)} band vs last week
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

const LegendBar = memo(function LegendBar() {
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
        rowGap: { xs: 1.25, sm: 1 },
        columnGap: { xs: 1.5, sm: 2 },
        py: { xs: 1.75, sm: 1.5 },
        px: { xs: 1.5, sm: 2 },
        borderRadius: 2,
        bgcolor: "rgba(15, 23, 42, 0.06)",
        border: "1px dashed",
        borderColor: "rgba(15, 23, 42, 0.25)",
      }}
    >
      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ width: "100%", sm: { width: "auto" } }}>
        How to read the map
      </Typography>
      {items.map((it) => (
        <Box
          key={it.label}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            minHeight: 36,
            pr: { xs: 0.5, sm: 0 },
          }}
        >
          <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: it.color, flexShrink: 0 }} />
          <Typography variant="body2" fontWeight={600} color="text.primary">
            {it.label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
});

const FourPaperSelector = memo(function FourPaperSelector({ module, overview, onSelectModule }) {
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
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 560 }}>
        Tap a paper to open its skills below.
      </Typography>
      <Grid container spacing={1.5}>
        {MODULE_TAB.map((m) => {
          const o = byMod.get(m.value);
          const sc = o?.score != null ? clamp01(o.score) : null;
          const band = sc != null && sc > 0 ? accuracyToIeltsBand(sc) : null;
          const bandStr = band != null ? formatMicroSkillBand(band) : null;
          const pct = sc != null ? Math.round(sc * 100) : null;
          const selected = module === m.value;
          const Icon = m.Icon;
          const barColor =
            pct == null || sc <= 0
              ? "grey.300"
              : pct >= 65
                ? "success.main"
                : pct >= 45
                  ? "warning.main"
                  : "error.main";
          const activate = () => onSelectModule(m.value);
          return (
            <Grid item xs={12} sm={6} md={3} key={m.value}>
              <Paper
                elevation={0}
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                aria-label={`${m.label}: ${m.blurb}${bandStr != null ? `, ${bandStr}` : ", no score yet"}`}
                onClick={activate}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    activate();
                  }
                }}
                sx={{
                  p: { xs: 2, sm: 2 },
                  cursor: "pointer",
                  height: "100%",
                  minHeight: { xs: 96, sm: 0 },
                  border: 2,
                  borderColor: selected ? "primary.main" : "transparent",
                  bgcolor: selected ? "rgba(15, 23, 42, 0.08)" : "background.paper",
                  borderRadius: 2,
                  touchAction: "manipulation",
                  WebkitTapHighlightColor: "rgba(15, 23, 42, 0.12)",
                  transition: "transform 0.15s ease-out, box-shadow 0.15s ease-out",
                  boxShadow: selected ? "0 4px 20px rgba(15, 23, 42, 0.15)" : 1,
                  "@media (hover: hover)": {
                    "&:hover": {
                      boxShadow: 3,
                      "@media (prefers-reduced-motion: no-preference)": {
                        transform: "translateY(-2px)",
                      },
                    },
                  },
                  "@media (prefers-reduced-motion: reduce)": {
                    transition: "none",
                  },
                  "&:focus-visible": {
                    outline: "2px solid",
                    outlineColor: "primary.main",
                    outlineOffset: 2,
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
                  <Typography variant="h6" fontWeight={800} sx={{ minWidth: 56, textAlign: "right", color: "text.primary" }}>
                    {bandStr != null ? bandStr : "—"}
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
});

const ModuleQuickStats = memo(function ModuleQuickStats({ skills, show }) {
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
});

const NextStepPanel = memo(function NextStepPanel({ module, nextStep, onPractice, loading, loadError }) {
  const label = nextStep?.focus_skill_label || nextStep?.focus_label || "";
  const hasFocus = Boolean(nextStep?.focus_skill);
  const textBreak = { overflowWrap: "anywhere", wordBreak: "break-word" };

  return (
    <Card
      sx={{
        borderRadius: 2,
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "rgba(15, 23, 42, 0.28)",
        background: "linear-gradient(180deg, rgba(15, 23, 42, 0.06) 0%, #fff 40%)",
        position: { md: "sticky" },
        top: { md: 88 },
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Typography variant="overline" fontWeight={800} color="primary" sx={{ letterSpacing: "0.08em" }}>
          Suggested next step
        </Typography>
        {loadError ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.7 }}>
            Recommendations did not load. Use <strong>Retry</strong> on the alert above, then open this panel again.
          </Typography>
        ) : loading ? (
          <Box
            sx={{ display: "flex", justifyContent: "center", py: 4 }}
            aria-busy="true"
            aria-live="polite"
            aria-label="Loading suggested next step"
          >
            <CircularProgress size={36} />
          </Box>
        ) : (
          <>
            {hasFocus ? (
              <>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                  Focus skill
                </Typography>
                <Typography
                  variant="h5"
                  color="primary.dark"
                  fontWeight={800}
                  sx={{ mt: 0.25, lineHeight: 1.3, ...textBreak }}
                >
                  {label}
                </Typography>
                {nextStep?.focus_description ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.7, ...textBreak }}>
                    {nextStep.focus_description}
                  </Typography>
                ) : null}
                {(nextStep?.focus_practice_bullets || []).length > 0 ? (
                  <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5 }}>
                    {(nextStep.focus_practice_bullets || []).map((b, bi) => (
                      <li key={`${bi}-${String(b).slice(0, 64)}`}>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          component="span"
                          sx={{ lineHeight: 1.7, ...textBreak }}
                        >
                          {b}
                        </Typography>
                      </li>
                    ))}
                  </Box>
                ) : null}
              </>
            ) : (
              <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 1, color: "text.primary", ...textBreak }}>
                Keep practicing to unlock a focus
              </Typography>
            )}

            {nextStep?.reason ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.7, ...textBreak }}>
                {nextStep.reason}
              </Typography>
            ) : nextStep?.message ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.7, ...textBreak }}>
                {nextStep.message}
              </Typography>
            ) : null}

            {(nextStep?.difficulty || nextStep?.suggested_practice) && (
              <Box sx={{ mt: 2 }}>
                {nextStep.difficulty ? (
                  <Typography variant="caption" color="text.secondary" display="block" sx={textBreak}>
                    Suggested difficulty: {formatDifficulty(nextStep.difficulty)}
                  </Typography>
                ) : null}
                {nextStep.suggested_practice ? (
                  <Typography variant="body2" sx={{ mt: 0.75, fontWeight: 600, color: "text.primary", ...textBreak }}>
                    {nextStep.suggested_practice}
                  </Typography>
                ) : null}
              </Box>
            )}

            <Button
              variant="contained"
              fullWidth
              sx={{ mt: 2.5, borderRadius: "12px", fontWeight: 700, py: { xs: 1.35, sm: 1.2 }, minHeight: 48 }}
              onClick={() => onPractice(hasFocus ? nextStep.focus_skill : null)}
            >
              {hasFocus ? "Go to practice" : `Practice ${moduleLabel(module)}`}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
});

const SkillRowCard = memo(function SkillRowCard({
  skill,
  journeyMode,
  expanded,
  onToggleExpand,
  onPracticeSkill,
}) {
  const attempts = skill.attempts ?? skill.total ?? 0;
  const status = skill.status || "unknown";
  const isUnknown = status === "unknown" || attempts < 1;
  const stripe = barColorForStatus(status);

  const acc = clamp01(skill.accuracy);
  const band = attempts > 0 ? accuracyToIeltsBand(acc) : null;
  const bandStr = band != null ? formatMicroSkillBand(band) : null;
  const barPct = attempts > 0 ? Math.min(100, acc * 100) : 0;

  return (
    <Card
      sx={{
        borderRadius: 2,
        overflow: "visible",
        border: "1px solid",
        borderColor: "divider",
        borderTop: "4px solid",
        borderTopColor: stripe,
      }}
    >
      <CardContent sx={{ py: 2, px: 2.25 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, mb: 0.5 }}>
              <Typography
                variant="subtitle1"
                fontWeight={800}
                sx={{ color: "text.primary", overflowWrap: "anywhere", wordBreak: "break-word" }}
              >
                {skill.label}
              </Typography>
              <Chip
                label={statusChipLabel(status)}
                size="small"
                color={chipColorForStatus(status)}
                sx={{ fontWeight: 700 }}
              />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
              {attempts > 0 ? (
                <>
                  <strong>{bandStr}</strong> (practice estimate) · {attempts} attempts ({skill.correct}/{skill.total}{" "}
                  correct)
                </>
              ) : (
                <>No data yet — practice once to place this skill on the map.</>
              )}
            </Typography>
            <TrendRow trend={skill.trend} isUnknown={isUnknown} />
            <LinearProgress
              variant="determinate"
              value={barPct}
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
                {skill.journey.map((pt, pi) => (
                  <Box key={`${pi}-${pt.label}`} sx={{ mt: 0.75 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.25, gap: 1, minWidth: 0 }}>
                      <Typography variant="caption" sx={{ overflowWrap: "anywhere", minWidth: 0 }}>
                        {pt.label}
                      </Typography>
                      <Typography variant="caption" fontWeight={700} sx={{ flexShrink: 0 }}>
                        {formatMicroSkillBand(accuracyToIeltsBand(pt.accuracy))}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(100, clamp01(pt.accuracy) * 100)}
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
              size="medium"
              onClick={() => onToggleExpand(skill.skill_id)}
              aria-expanded={expanded}
              aria-label={expanded ? "Hide skill tips and detail" : "Show skill tips and detail"}
              sx={{
                minWidth: 44,
                minHeight: 44,
                mt: -0.5,
                transform: expanded ? "rotate(180deg)" : "none",
                transition: "transform 0.2s ease-out",
                "@media (prefers-reduced-motion: reduce)": {
                  transition: "none",
                },
              }}
            >
              <ExpandMoreIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <Button
          variant="outlined"
          color="primary"
          size="medium"
          fullWidth
          sx={{ mt: 1.5, borderRadius: "10px", fontWeight: 700, py: 1.15, minHeight: 48 }}
          onClick={() => onPracticeSkill(skill.skill_id)}
        >
          Practice this skill
        </Button>

        <Collapse in={expanded}>
          <Divider sx={{ my: 2 }} />
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ lineHeight: 1.75, overflowWrap: "anywhere", wordBreak: "break-word" }}
          >
            {statusNarrative(status, skill.label)}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
            For item-by-item history, open <strong>Progress</strong> after you submit a session.
          </Typography>
        </Collapse>
      </CardContent>
    </Card>
  );
});

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
  const [module, setModuleState] = useState(() => readModuleFromHash() || "reading");
  const [data, setData] = useState(null);
  const [nextStep, setNextStep] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
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
    setData(null);
    setNextStep(null);
    (async () => {
      try {
        const [sm, ns] = await Promise.all([fetchSkillMap(module), fetchNextStep(module)]);
        if (!cancelled) {
          setData(sm);
          setNextStep(ns);
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e.message || "Failed to load skill map. Check your connection and try again.");
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
  }, [module, reloadKey]);

  const goPractice = useCallback(
    (focusSkill) => {
      const path = practicePath(module);
      const q = buildPracticeSearch({ focusSkill });
      navigate(`${path}?${q}`);
    },
    [module, navigate],
  );

  const handleToggleExpand = useCallback((id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const handlePracticeSkill = useCallback(
    (id) => {
      goPractice(id);
    },
    [goPractice],
  );

  const ready = !loading && data?.module === module;
  const overview = data?.overview || [];
  const skills = useMemo(() => {
    if (!ready) return EMPTY_SKILLS;
    const s = data?.skills;
    if (s && s.length > 0) return s;
    return EMPTY_SKILLS;
  }, [ready, data]);
  const grouped = useMemo(() => groupSkillsByBand(skills), [skills]);

  return (
    <Box sx={dashboardPage.root}>
      <DashboardNavbar title="Skill map" />

      <Card
        sx={{
          mb: 3,
          borderRadius: 2,
          overflow: "hidden",
          background:
            `linear-gradient(135deg, #F8F8F8 0%, #f2f2f2 42%, #ebebeb 100%)`,
          color: "text.primary",
        }}
      >
        <CardContent sx={{ p: { xs: 2.25, sm: 2.75, md: 3.5 } }}>
          <Typography variant="overline" sx={{ color: "text.secondary", fontWeight: 800, letterSpacing: { xs: "0.1em", sm: "0.14em" } }}>
            At a glance
          </Typography>
          <Typography
            component="h1"
            variant="h4"
            sx={{
              fontWeight: 800,
              mt: 0.5,
              letterSpacing: "-0.03em",
              fontSize: { xs: "1.35rem", sm: "1.5rem", md: "1.75rem" },
              lineHeight: 1.2,
            }}
          >
            Your skill map
          </Typography>
          <Typography
            variant="body1"
            sx={{
              mt: { xs: 1, sm: 1.25 },
              color: "text.secondary",
              maxWidth: 560,
              lineHeight: 1.55,
              fontSize: { xs: "0.9375rem", sm: "1rem" },
            }}
          >
            Sub-skills for each paper, grouped so you know what to improve first.
          </Typography>
          <Typography
            component="p"
            variant="caption"
            sx={{
              mt: { xs: 1.5, sm: 1.75 },
              m: 0,
              display: "block",
              opacity: 0.72,
              maxWidth: 480,
              lineHeight: 1.45,
              fontSize: { xs: "0.68rem", sm: "0.7rem" },
              letterSpacing: "0.02em",
            }}
          >
            Bands 1–9 on this map are estimated from your tagged practice here, not an official IELTS score.
          </Typography>
        </CardContent>
      </Card>

      <LegendBar />

      {err ? (
        <Alert
          severity="error"
          sx={{ mb: 2, borderRadius: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => setReloadKey((k) => k + 1)} sx={{ fontWeight: 700 }}>
              Retry
            </Button>
          }
        >
          {err}
        </Alert>
      ) : null}

      <FourPaperSelector module={module} overview={overview} onSelectModule={setModule} />

      <Box sx={dashboardPage.splitMainAsideLg}>
        <Box
          sx={{
            minWidth: 0,
            contain: "layout style",
            order: { xs: 2, lg: 1 },
          }}
        >
          <Typography variant="subtitle1" fontWeight={800} color="text.primary" sx={{ mb: 0.5 }}>
            2 · Micro-skills · {moduleLabel(module)}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, maxWidth: 560 }}>
            <strong>Priority</strong> first. <strong>Trend</strong> = last 7 days vs. the week before (when both have data).
          </Typography>

          <ModuleQuickStats skills={skills} show={ready && skills.length > 0} />

          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: { xs: "flex-start", sm: "center" },
              gap: { xs: 1, sm: 2 },
              mb: 2,
              rowGap: 1,
            }}
          >
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
                <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.35 }}>
                  Show recent band windows
                </Typography>
              }
              sx={{
                m: 0,
                mr: { xs: 0, sm: 1 },
                alignItems: "flex-start",
                maxWidth: { xs: "100%", sm: "none" },
                "& .MuiFormControlLabel-label": { mt: "2px" },
              }}
            />
            <Tooltip title="Extra mini-bars (IELTS bands) when you have history across time windows">
              <Typography
                component="span"
                variant="caption"
                color="text.secondary"
                sx={{ cursor: "help", display: "inline-block", py: 0.5, minHeight: 36, lineHeight: "36px" }}
              >
                What is this?
              </Typography>
            </Tooltip>
          </Box>

          {!ready && !err ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                py: { xs: 5, sm: 6 },
                minHeight: { xs: 200, sm: 160 },
              }}
              aria-busy="true"
              aria-live="polite"
              aria-label="Loading skill map"
            >
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
                      <Typography variant="h6" fontWeight={800} color="text.primary" sx={{ overflowWrap: "anywhere" }}>
                        {g.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
                      >
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
                        onToggleExpand={handleToggleExpand}
                        onPracticeSkill={handlePracticeSkill}
                      />
                    ))}
                  </Box>
                </Box>
              );
            })}
        </Box>

        <Box
          sx={{
            minWidth: 0,
            width: 1,
            order: { xs: 1, lg: 2 },
          }}
        >
          <NextStepPanel
            module={module}
            nextStep={nextStep}
            onPractice={goPractice}
            loading={loading}
            loadError={Boolean(err)}
          />
        </Box>
      </Box>
    </Box>
  );
}
