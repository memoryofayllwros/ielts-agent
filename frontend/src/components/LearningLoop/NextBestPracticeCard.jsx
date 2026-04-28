import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";
import { fetchNextStep } from "services/api";

function formatDifficulty(d) {
  if (!d) return "";
  if (String(d).startsWith("band")) return `Band ${String(d).slice(4)}`;
  return d;
}

function practicePath(mod) {
  if (mod === "listening") return "/practice/listening";
  if (mod === "writing") return "/practice/writing";
  if (mod === "speaking") return "/practice/speaking";
  return "/practice/reading";
}

function moduleLabel(mod) {
  if (mod === "listening") return "Listening";
  if (mod === "writing") return "Writing";
  if (mod === "speaking") return "Speaking";
  return "Reading";
}

function startPracticeQuery(focusSkill) {
  const p = new URLSearchParams();
  p.set("adaptive", "1");
  if (focusSkill) p.set("focus", focusSkill);
  return p.toString();
}

const textBreak = { overflowWrap: "anywhere", wordBreak: "break-word" };

/** Light grey demo palette (self-contained; not tied to theme primary). */
const nbp = {
  bgTop: "#F8F8F8",
  bgBottom: "#F0F0F0",
  border: "rgba(15, 23, 42, 0.1)",
  overline: "#64748b",
  text: "#0f172a",
  muted: "#475569",
  faint: "rgba(15, 23, 42, 0.45)",
  divider: "rgba(15, 23, 42, 0.08)",
  button: "#525f6b",
  buttonHover: "#3d4650",
  link: "#334155",
  surfaceHover: "rgba(15, 23, 42, 0.04)",
  cardShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
};

/**
 * Fetches planner recommendation and surfaces a clear next action for the learning loop.
 * @param {object} props
 * @param {"reading"|"listening"|"writing"|"speaking"} props.module
 */
export default function NextBestPracticeCard({ module = "reading" }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setErr("");
    setLoading(true);
    setData(null);
    try {
      const n = await fetchNextStep(module);
      setData(n);
    } catch (e) {
      setErr(e.message || "Could not load your recommendation. Check your connection and try again.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [module]);

  useEffect(() => {
    load();
  }, [load]);

  const focusLabel = data?.focus_skill_label || data?.focus_label || "";
  const hasFocus = Boolean(data?.focus_skill);
  const bullets = data?.focus_practice_bullets || [];
  const desc = data?.focus_description;

  const extraBullets = useMemo(() => {
    const d = (desc || "").trim();
    if (!d) return bullets;
    return bullets.filter((b) => {
      const t = String(b).trim();
      return t && t !== d;
    });
  }, [desc, bullets]);

  /** One plan line. If API sends suggested_practice, it already includes band; do not add a second “Session” row. */
  const planLine = useMemo(() => {
    if (!data) return "";
    if (data.suggested_practice) return data.suggested_practice;
    if (data.difficulty) return `Practice at ${formatDifficulty(data.difficulty)}.`;
    return "";
  }, [data]);

  const onStart = () => {
    const path = practicePath(module);
    const q = startPracticeQuery(data?.focus_skill);
    navigate({ pathname: path, search: `?${q}` });
  };

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 2,
        border: "1px solid",
        borderColor: nbp.border,
        bgcolor: nbp.bgBottom,
        background: `linear-gradient(180deg, ${nbp.bgTop} 0%, ${nbp.bgBottom} 100%)`,
        boxShadow: nbp.cardShadow,
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack component="section" aria-label="Recommended next practice" spacing={0}>
          <Typography
            component="h2"
            variant="overline"
            fontWeight={800}
            sx={{ letterSpacing: "0.1em", lineHeight: 1.2, display: "block", mb: 1.5, color: nbp.overline }}
          >
            Next up · {moduleLabel(module)}
          </Typography>

          {loading && (
            <Box
              sx={{ display: "flex", alignItems: "center", gap: 1, py: 1.5 }}
              aria-busy="true"
              aria-live="polite"
              aria-label="Loading practice recommendation"
            >
              <CircularProgress size={22} aria-hidden sx={{ color: nbp.overline }} />
              <Typography variant="body2" sx={{ color: nbp.muted }}>
                Loading…
              </Typography>
            </Box>
          )}

          {err && !loading ? (
            <Stack spacing={1.5}>
              <Typography variant="body2" sx={{ ...textBreak, fontWeight: 600, color: "#9a3412" }}>
                {err}
              </Typography>
              <Button
                size="small"
                variant="outlined"
                onClick={() => load()}
                sx={{
                  fontWeight: 700,
                  alignSelf: "flex-start",
                  color: nbp.link,
                  borderColor: nbp.border,
                  "&:hover": { borderColor: nbp.overline, bgcolor: nbp.surfaceHover },
                }}
              >
                Retry
              </Button>
              <Button
                fullWidth
                component={Link}
                to={`/learning/skill-map?module=${encodeURIComponent(module)}`}
                variant="outlined"
                sx={{
                  borderRadius: "10px",
                  fontWeight: 600,
                  color: nbp.link,
                  borderColor: nbp.border,
                  "&:hover": { borderColor: nbp.overline, bgcolor: nbp.surfaceHover },
                }}
              >
                Open skill map
              </Button>
            </Stack>
          ) : null}

          {!loading && !err && data && (
            <Stack spacing={0}>
              {hasFocus ? (
                <Box component="div">
                  <Typography
                    component="h3"
                    variant="h6"
                    fontWeight={800}
                    sx={{ color: nbp.text, lineHeight: 1.3, letterSpacing: "-0.02em", ...textBreak }}
                  >
                    {focusLabel}
                  </Typography>
                  {desc ? (
                    <Typography
                      variant="body2"
                      sx={{ mt: 0.5, lineHeight: 1.55, ...textBreak, color: nbp.muted }}
                    >
                      {desc}
                    </Typography>
                  ) : null}
                  {extraBullets.length > 0 && (
                    <Box component="ul" sx={{ m: 0, mt: 1, pl: 2, color: nbp.muted }}>
                      {extraBullets.map((b, bi) => (
                        <li key={`${bi}-${String(b).slice(0, 64)}`}>
                          <Typography variant="body2" component="span" sx={{ lineHeight: 1.55, ...textBreak }}>
                            {b}
                          </Typography>
                        </li>
                      ))}
                    </Box>
                  )}
                </Box>
              ) : (
                <Typography
                  component="h3"
                  variant="subtitle1"
                  fontWeight={800}
                  sx={{ color: nbp.text, lineHeight: 1.3, letterSpacing: "-0.01em", ...textBreak }}
                >
                  {data.message || "A few more sessions, then we can suggest a focus."}
                </Typography>
              )}

              {data.reason ? (
                <>
                  <Divider sx={{ my: 1.75, borderColor: nbp.divider }} />
                  <Typography variant="body2" component="p" sx={{ m: 0, lineHeight: 1.6, ...textBreak, color: nbp.muted }}>
                    <Box component="span" sx={{ color: nbp.faint, fontWeight: 600 }}>
                      Why this{" "}
                    </Box>
                    {data.reason}
                  </Typography>
                </>
              ) : null}

              {planLine ? (
                <>
                  <Divider sx={{ my: 1.75, borderColor: nbp.divider }} />
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    component="p"
                    sx={{ m: 0, lineHeight: 1.5, ...textBreak, color: nbp.text }}
                  >
                    {planLine}
                  </Typography>
                </>
              ) : null}

              <Stack spacing={1} sx={{ mt: 2.5 }}>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={onStart}
                  size="large"
                  sx={{
                    borderRadius: "10px",
                    fontWeight: 800,
                    py: 1.25,
                    touchAction: "manipulation",
                    bgcolor: nbp.button,
                    color: "#fafafa",
                    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.12)",
                    "&:hover": { bgcolor: nbp.buttonHover },
                  }}
                >
                  Start this practice
                </Button>
                <Button
                  fullWidth
                  component={Link}
                  to={`/learning/skill-map?module=${encodeURIComponent(module)}`}
                  variant="text"
                  size="small"
                  sx={{
                    fontWeight: 600,
                    color: nbp.link,
                    "&:hover": { bgcolor: nbp.surfaceHover },
                  }}
                >
                  See it on the skill map
                </Button>
              </Stack>
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
