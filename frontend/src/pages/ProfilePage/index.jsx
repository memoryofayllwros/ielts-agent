import { useState, useEffect, useCallback, useMemo, useId } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import FormHelperText from "@mui/material/FormHelperText";
import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";
import Skeleton from "@mui/material/Skeleton";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import DashboardNavbar from "components/Navbars/DashboardNavbar";
import { useAuth } from "context/AuthContext";
import { dashboardPage } from "utils/pageLayout";
import { fetchUserProfile, updateUserProfile } from "services/api";

const BAND_STEPS = Array.from({ length: 11 }, (_, i) => 4 + i * 0.5);

/** IELTS reports four component scores plus an overall band. */
const IELTS_SKILLS = [
  { key: "reading", label: "Reading", letter: "R" },
  { key: "listening", label: "Listening", letter: "L" },
  { key: "writing", label: "Writing", letter: "W" },
  { key: "speaking", label: "Speaking", letter: "S" },
];

const emptySkillBands = () => ({
  reading: "",
  listening: "",
  writing: "",
  speaking: "",
});

function targetSkillBandsFromApi(p) {
  return {
    reading: bandToSelectValue(p.target_reading),
    listening: bandToSelectValue(p.target_listening),
    writing: bandToSelectValue(p.target_writing),
    speaking: bandToSelectValue(p.target_speaking),
  };
}

function pastSkillBandsFromApi(p) {
  return {
    reading: bandToSelectValue(p.past_reading),
    listening: bandToSelectValue(p.past_listening),
    writing: bandToSelectValue(p.past_writing),
    speaking: bandToSelectValue(p.past_speaking),
  };
}

function sameSkillBands(a, b) {
  return IELTS_SKILLS.every((s) => a[s.key] === b[s.key]);
}

function formatSkillSnapshot(st) {
  const parts = IELTS_SKILLS.map((s) => {
    const b = formatBandSelect(st[s.key]);
    return b && b !== "—" ? `${s.letter} ${b}` : null;
  }).filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function bandToSelectValue(b) {
  if (b == null || b === "") return "";
  return String(b);
}

function formatBandSelect(v) {
  if (v === "" || v == null) return null;
  const n = Number.parseFloat(String(v), 10);
  if (Number.isNaN(n)) return "—";
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

function profileSnapshotValueSx(lines = 1) {
  if (lines <= 1) {
    return {
      fontWeight: 600,
      wordBreak: "break-word",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    };
  }
  return {
    fontWeight: 600,
    wordBreak: "break-word",
    display: "-webkit-box",
    WebkitLineClamp: lines,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  };
}

export default function ProfilePage() {
  const { user, mergeSession } = useAuth();
  const email = (user?.email || "").trim();
  const statusAnnouncerId = useId();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveOk, setSaveOk] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [baseline, setBaseline] = useState(null);

  const [name, setName] = useState("");
  const [targetBand, setTargetBand] = useState("");
  const [targetBySkill, setTargetBySkill] = useState(emptySkillBands);
  const [pastExamBand, setPastExamBand] = useState("");
  const [pastBySkill, setPastBySkill] = useState(emptySkillBands);
  const [pastNotes, setPastNotes] = useState("");

  const isDirty = useMemo(() => {
    if (loading || !baseline) return false;
    return (
      name !== baseline.name ||
      targetBand !== baseline.targetBand ||
      !sameSkillBands(targetBySkill, baseline.targetBySkill) ||
      pastExamBand !== baseline.pastExamBand ||
      !sameSkillBands(pastBySkill, baseline.pastBySkill) ||
      pastNotes !== baseline.pastNotes
    );
  }, [loading, baseline, name, targetBand, targetBySkill, pastExamBand, pastBySkill, pastNotes]);

  useEffect(() => {
    if (!isDirty) return undefined;
    const onBeforeLeave = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeLeave);
    return () => window.removeEventListener("beforeunload", onBeforeLeave);
  }, [isDirty]);

  const load = useCallback(async () => {
    setLoadError("");
    setSaveOk(false);
    setLoading(true);
    try {
      const p = await fetchUserProfile();
      const tgt = targetSkillBandsFromApi(p);
      const pst = pastSkillBandsFromApi(p);
      const next = {
        name: p.display_name != null && p.display_name !== "" ? p.display_name : "",
        targetBand: bandToSelectValue(p.target_band),
        targetBySkill: { ...tgt },
        pastExamBand: bandToSelectValue(p.past_exam_band),
        pastBySkill: { ...pst },
        pastNotes: p.past_exam_notes != null && p.past_exam_notes !== "" ? p.past_exam_notes : "",
      };
      setName(next.name);
      setTargetBand(next.targetBand);
      setTargetBySkill(tgt);
      setPastExamBand(next.pastExamBand);
      setPastBySkill(pst);
      setPastNotes(next.pastNotes);
      setBaseline(next);
    } catch (e) {
      setLoadError(e.message || "Could not load profile");
      setBaseline(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const bandSelectSx = useMemo(
    () => ({
      minHeight: 48,
      "& .MuiSelect-select": { display: "flex", alignItems: "center" },
    }),
    [],
  );

  const handleReloadFromServer = () => {
    if (isDirty) {
      const ok = window.confirm("Discard your edits on this page and reload profile data from the server?");
      if (!ok) return;
    }
    load();
  };

  const canSubmit = Boolean(baseline) && isDirty;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaveError("");
    setSaveOk(false);
    setSaving(true);
    try {
      const toBand = (v) => (v === "" || v == null ? null : Number.parseFloat(String(v), 10));
      const body = {
        display_name: name.trim() || null,
        target_band: toBand(targetBand),
        target_reading: toBand(targetBySkill.reading),
        target_listening: toBand(targetBySkill.listening),
        target_writing: toBand(targetBySkill.writing),
        target_speaking: toBand(targetBySkill.speaking),
        past_exam_band: toBand(pastExamBand),
        past_reading: toBand(pastBySkill.reading),
        past_listening: toBand(pastBySkill.listening),
        past_writing: toBand(pastBySkill.writing),
        past_speaking: toBand(pastBySkill.speaking),
        past_exam_notes: pastNotes.trim() || null,
      };
      const p = await updateUserProfile(body);
      mergeSession({
        display_name: p.display_name ?? null,
        target_band: p.target_band ?? null,
        target_reading: p.target_reading ?? null,
        target_listening: p.target_listening ?? null,
        target_writing: p.target_writing ?? null,
        target_speaking: p.target_speaking ?? null,
        past_exam_band: p.past_exam_band ?? null,
        past_reading: p.past_reading ?? null,
        past_listening: p.past_listening ?? null,
        past_writing: p.past_writing ?? null,
        past_speaking: p.past_speaking ?? null,
        past_exam_notes: p.past_exam_notes ?? null,
      });
      const tgt2 = targetSkillBandsFromApi(p);
      const pst2 = pastSkillBandsFromApi(p);
      const synced = {
        name: p.display_name != null && p.display_name !== "" ? p.display_name : "",
        targetBand: bandToSelectValue(p.target_band),
        targetBySkill: { ...tgt2 },
        pastExamBand: bandToSelectValue(p.past_exam_band),
        pastBySkill: { ...pst2 },
        pastNotes: p.past_exam_notes != null && p.past_exam_notes !== "" ? p.past_exam_notes : "",
      };
      setName(synced.name);
      setTargetBand(synced.targetBand);
      setTargetBySkill(tgt2);
      setPastExamBand(synced.pastExamBand);
      setPastBySkill(pst2);
      setPastNotes(synced.pastNotes);
      setBaseline(synced);
      setLastSavedAt(new Date());
      setSaveOk(true);
    } catch (err) {
      setSaveError(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const lastSavedText =
    lastSavedAt != null
      ? lastSavedAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
      : null;

  return (
    <Box sx={dashboardPage.root}>
      <DashboardNavbar title="Personal profile" />
      {loadError && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setLoadError("")}>
          {loadError}
        </Alert>
      )}
      <Box sx={dashboardPage.splitMainAside}>
        <Card sx={{ borderRadius: 2, width: 1, minWidth: 0, order: { xs: 1, md: 1 } }}>
        <CardContent
          component="form"
          onSubmit={handleSave}
          sx={{ p: { xs: 2.25, sm: 3 }, display: "flex", flexDirection: "column", gap: 2.5 }}
        >
          <Typography component="h2" variant="h6" fontWeight={800} sx={{ letterSpacing: "-0.01em" }}>
            Your details
          </Typography>

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={32} aria-label="Loading profile" />
            </Box>
          ) : (
            <>
              {email && (
                <Box>
                  <TextField
                    label="Email"
                    value={email}
                    fullWidth
                    size="small"
                    disabled
                    InputProps={{ readOnly: true }}
                    helperText="Sign-in email (not editable here)"
                    sx={{ "& .MuiInputBase-input": { fontWeight: 600 } }}
                  />
                </Box>
              )}

              <TextField
                id="profile-display-name"
                label="Name"
                name="name"
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                fullWidth
                size="small"
                autoComplete="name"
                inputProps={{ maxLength: 120 }}
                helperText="How we address you in the app"
                placeholder="e.g. Sam Taylor"
              />

              <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800, letterSpacing: "0.12em" }}>
                Goals
              </Typography>
              <FormControl fullWidth size="small">
                <InputLabel id="profile-target-label">Target band (overall)</InputLabel>
                <Select
                  labelId="profile-target-label"
                  id="profile-target"
                  value={targetBand}
                  label="Target band (overall)"
                  onChange={(ev) => setTargetBand(ev.target.value)}
                  sx={bandSelectSx}
                >
                  <MenuItem value="">
                    <em>Not set</em>
                  </MenuItem>
                  {BAND_STEPS.map((b) => (
                    <MenuItem key={b} value={String(b)}>
                      {b % 1 === 0 ? b : b.toFixed(1)}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>Optional overall goal; per-skill targets below can fine-tune each paper</FormHelperText>
              </FormControl>

              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
                  Target by skill (optional)
                </Typography>
                <Grid container spacing={1.5}>
                  {IELTS_SKILLS.map((s) => (
                    <Grid item xs={12} sm={6} key={s.key}>
                      <FormControl fullWidth size="small">
                        <InputLabel id={`profile-tg-${s.key}`}>Target · {s.label}</InputLabel>
                        <Select
                          labelId={`profile-tg-${s.key}`}
                          id={`profile-tg-${s.key}-sel`}
                          value={targetBySkill[s.key]}
                          label={`Target · ${s.label}`}
                          onChange={(ev) =>
                            setTargetBySkill((prev) => ({ ...prev, [s.key]: ev.target.value }))
                          }
                          sx={bandSelectSx}
                        >
                          <MenuItem value="">
                            <em>Not set</em>
                          </MenuItem>
                          {BAND_STEPS.map((b) => (
                            <MenuItem key={b} value={String(b)}>
                              {b % 1 === 0 ? b : b.toFixed(1)}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  ))}
                </Grid>
              </Box>

              <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800, letterSpacing: "0.12em" }}>
                Last test or mock
              </Typography>
              <FormControl fullWidth size="small">
                <InputLabel id="profile-past-label">Last exam (overall band)</InputLabel>
                <Select
                  labelId="profile-past-label"
                  id="profile-past"
                  value={pastExamBand}
                  label="Last exam (overall band)"
                  onChange={(ev) => setPastExamBand(ev.target.value)}
                  sx={bandSelectSx}
                >
                  <MenuItem value="">
                    <em>Not set</em>
                  </MenuItem>
                  {BAND_STEPS.map((b) => (
                    <MenuItem key={b} value={String(b)}>
                      {b % 1 === 0 ? b : b.toFixed(1)}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>Overall from your most recent IELTS or trusted mock, if you have it</FormHelperText>
              </FormControl>

              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
                  Last exam by skill (optional)
                </Typography>
                <Grid container spacing={1.5}>
                  {IELTS_SKILLS.map((s) => (
                    <Grid item xs={12} sm={6} key={s.key}>
                      <FormControl fullWidth size="small">
                        <InputLabel id={`profile-ps-${s.key}`}>Past · {s.label}</InputLabel>
                        <Select
                          labelId={`profile-ps-${s.key}`}
                          id={`profile-ps-${s.key}-sel`}
                          value={pastBySkill[s.key]}
                          label={`Past · ${s.label}`}
                          onChange={(ev) =>
                            setPastBySkill((prev) => ({ ...prev, [s.key]: ev.target.value }))
                          }
                          sx={bandSelectSx}
                        >
                          <MenuItem value="">
                            <em>Not set</em>
                          </MenuItem>
                          {BAND_STEPS.map((b) => (
                            <MenuItem key={b} value={String(b)}>
                              {b % 1 === 0 ? b : b.toFixed(1)}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  ))}
                </Grid>
              </Box>

              <TextField
                id="profile-past-notes"
                name="notes"
                label="Past exam details (optional)"
                value={pastNotes}
                onChange={(ev) => setPastNotes(ev.target.value)}
                fullWidth
                multiline
                minRows={3}
                size="small"
                inputProps={{ maxLength: 2000 }}
                placeholder="e.g. Academic IELTS, March 2025 · R7 L6.5 W6 S6"
                helperText={`${pastNotes.length}/2000 · Section scores, test type, or notes`}
              />

              <Divider sx={{ my: 0.5 }} />

              {saveError && (
                <Alert severity="error" sx={{ borderRadius: 2 }} onClose={() => setSaveError("")}>
                  {saveError}
                </Alert>
              )}
              {saveOk && (
                <Alert severity="success" sx={{ borderRadius: 2 }} onClose={() => setSaveOk(false)}>
                  Profile saved
                </Alert>
              )}

              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center" }}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={saving || !canSubmit}
                  sx={{ minHeight: 48, minWidth: 160, borderRadius: "10px", fontWeight: 700 }}
                >
                  {saving ? <CircularProgress size={22} color="inherit" /> : "Save changes"}
                </Button>
                <Button
                  type="button"
                  variant="outlined"
                  size="small"
                  onClick={handleReloadFromServer}
                  disabled={saving || loading}
                  sx={{ minHeight: 40 }}
                >
                  Reload
                </Button>
              </Box>
            </>
          )}
        </CardContent>
      </Card>

      <Box
        component="aside"
        aria-label="Profile summary, sync status, and how your data is used"
        sx={{
          order: { xs: 2, md: 2 },
          position: { md: "sticky" },
          top: { md: 20 },
          alignSelf: "start",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          bgcolor: "grey.50",
          p: { xs: 2, sm: 2.25 },
          minWidth: 0,
          width: 1,
        }}
      >
        <Stack spacing={2}>
          {loading && (
            <Box>
              <Skeleton variant="text" width="55%" height={20} />
              <Skeleton variant="text" width="100%" height={20} sx={{ mt: 1 }} />
              <Skeleton variant="text" width="80%" height={20} />
            </Box>
          )}

          {!loading && (
            <>
              <Box
                id={statusAnnouncerId}
                role="status"
                aria-live="polite"
                aria-atomic="true"
                sx={{
                  border: "1px solid",
                  borderColor: (t) => (isDirty ? t.palette.warning.light : t.palette.divider),
                  borderRadius: 1.5,
                  bgcolor: (t) => (isDirty ? "rgba(237, 108, 2, 0.07)" : "background.paper"),
                  p: 1.25,
                  minWidth: 0,
                }}
              >
                {isDirty ? (
                  <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ minWidth: 0 }}>
                    <WarningAmberIcon sx={{ color: "warning.main", fontSize: "1.35rem", flexShrink: 0, mt: 0.1 }} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={700} color="text.primary">
                        Unsaved changes
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5, lineHeight: 1.5 }}>
                        Save to keep your edits. Leaving the site may prompt you before the next navigation.
                      </Typography>
                    </Box>
                  </Stack>
                ) : lastSavedText ? (
                  <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ minWidth: 0 }}>
                    <CheckCircleOutlineIcon color="primary" sx={{ fontSize: "1.35rem", flexShrink: 0, mt: 0.1 }} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={700} color="text.primary">
                        Last saved
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25, lineHeight: 1.5 }}>
                        {lastSavedText}
                      </Typography>
                    </Box>
                  </Stack>
                ) : (
                  <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ minWidth: 0 }}>
                    <CheckCircleOutlineIcon color="action" sx={{ fontSize: "1.35rem", flexShrink: 0, mt: 0.1 }} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={700} color="text.primary">
                        In sync
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25, lineHeight: 1.5 }}>
                        {baseline
                          ? "Your form matches the last data loaded or saved for this page."
                          : "After your profile loads, you can edit and save from the form."}
                      </Typography>
                    </Box>
                  </Stack>
                )}
              </Box>

              {!loadError && baseline && (
                <>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={800} color="text.primary" sx={{ letterSpacing: "-0.01em" }}>
                      On your account
                    </Typography>
                    <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          component="p"
                          sx={{ fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", mb: 0.25 }}
                        >
                          Name
                        </Typography>
                        <Typography
                          component="p"
                          variant="body2"
                          sx={profileSnapshotValueSx(2)}
                          title={name.trim() ? name.trim() : undefined}
                        >
                          {name.trim() ? name.trim() : "Not set"}
                        </Typography>
                      </Box>
                      {email && (
                        <Box sx={{ minWidth: 0 }}>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            component="p"
                            sx={{ fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", mb: 0.25 }}
                          >
                            Sign-in email
                          </Typography>
                          <Typography
                            component="p"
                            variant="body2"
                            sx={profileSnapshotValueSx(1)}
                            title={email}
                          >
                            {email}
                          </Typography>
                        </Box>
                      )}
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          component="p"
                          sx={{ fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", mb: 0.25 }}
                        >
                          Target overall
                        </Typography>
                        <Typography component="p" variant="body2" sx={profileSnapshotValueSx(1)}>
                          {formatBandSelect(targetBand) != null ? formatBandSelect(targetBand) : "Not set"}
                        </Typography>
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          component="p"
                          sx={{ fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", mb: 0.25 }}
                        >
                          Target by skill
                        </Typography>
                        <Typography
                          component="p"
                          variant="body2"
                          sx={profileSnapshotValueSx(2)}
                          title={formatSkillSnapshot(targetBySkill) || undefined}
                        >
                          {formatSkillSnapshot(targetBySkill) || "Not set"}
                        </Typography>
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          component="p"
                          sx={{ fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", mb: 0.25 }}
                        >
                          Last exam (overall)
                        </Typography>
                        <Typography component="p" variant="body2" sx={profileSnapshotValueSx(1)}>
                          {formatBandSelect(pastExamBand) != null ? formatBandSelect(pastExamBand) : "Not set"}
                        </Typography>
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          component="p"
                          sx={{ fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", mb: 0.25 }}
                        >
                          Last exam by skill
                        </Typography>
                        <Typography
                          component="p"
                          variant="body2"
                          sx={profileSnapshotValueSx(2)}
                          title={formatSkillSnapshot(pastBySkill) || undefined}
                        >
                          {formatSkillSnapshot(pastBySkill) || "Not set"}
                        </Typography>
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          component="p"
                          sx={{ fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", mb: 0.25 }}
                        >
                          Past details preview
                        </Typography>
                        {pastNotes.trim() ? (
                          <Typography
                            component="p"
                            variant="body2"
                            color="text.secondary"
                            sx={profileSnapshotValueSx(4)}
                            title={pastNotes.length > 180 ? pastNotes : undefined}
                          >
                            {pastNotes}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                            None added
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                  </Box>

                  <Divider />

                  <Box>
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1 }}>
                      <InfoOutlinedIcon sx={{ fontSize: "1.1rem", color: "primary.main" }} aria-hidden />
                      <Typography variant="subtitle2" fontWeight={800} color="text.primary" sx={{ letterSpacing: "-0.01em" }}>
                        How this is used
                      </Typography>
                    </Stack>
                    <Box component="ul" sx={{ m: 0, pl: 2.5, pr: 0, color: "text.secondary" }}>
                      <Typography component="li" variant="body2" sx={{ lineHeight: 1.6, mb: 0.75, display: "list-item" }}>
                        Your name can appear in navigation and personal touches across the app.
                      </Typography>
                      <Typography component="li" variant="body2" sx={{ lineHeight: 1.6, mb: 0.75, display: "list-item" }}>
                        Per-skill targets shape difficulty for that paper; overall fills in when a skill is not set.
                      </Typography>
                      <Typography component="li" variant="body2" sx={{ lineHeight: 1.6, mb: 0.75, display: "list-item" }}>
                        Your past IELTS or mock numbers are context for you and the app, not a verified transcript.
                      </Typography>
                      <Typography component="li" variant="body2" sx={{ lineHeight: 1.6, display: "list-item" }}>
                        Long notes, emoji, and mixed scripts are fine; the preview may shorten long text.
                      </Typography>
                    </Box>
                  </Box>
                </>
              )}

              {!loading && !baseline && !loadError && (
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                  Nothing loaded for this page yet. Use{" "}
                  <Box component="span" fontWeight={700} sx={{ color: "text.primary" }}>
                    Reload
                  </Box>{" "}
                  in the form, or check your network.
                </Typography>
              )}
            </>
          )}
        </Stack>
      </Box>
    </Box>
    </Box>
  );
}
