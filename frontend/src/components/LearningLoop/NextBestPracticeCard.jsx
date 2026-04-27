import { useEffect, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import { fetchNextStep } from "services/api";

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

function startPracticeQuery(focusSkill) {
  const p = new URLSearchParams();
  p.set("adaptive", "1");
  if (focusSkill) p.set("focus", focusSkill);
  return p.toString();
}

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
    try {
      const n = await fetchNextStep(module);
      setData(n);
    } catch (e) {
      setErr(e.message || "Could not load next step");
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

  const onStart = () => {
    const path = practicePath(module);
    const q = startPracticeQuery(data?.focus_skill);
    navigate({ pathname: path, search: `?${q}` });
  };

  return (
    <Card
      sx={{
        borderRadius: "16px",
        border: "1px solid",
        borderColor: "primary.light",
        background: "linear-gradient(135deg, rgba(25, 118, 210, 0.06) 0%, rgba(255,255,255,1) 100%)",
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Typography variant="overline" fontWeight={800} color="primary" letterSpacing={1}>
          Next best practice
        </Typography>

        {loading && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 2 }}>
            <CircularProgress size={22} />
            <Typography variant="body2" color="text.secondary">
              Loading your recommendation…
            </Typography>
          </Box>
        )}

        {err && !loading && <Alert severity="warning" sx={{ mt: 1, borderRadius: "8px" }}>{err}</Alert>}

        {!loading && !err && data && (
          <>
            {hasFocus ? (
              <>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
                  Focus skill
                </Typography>
                <Typography variant="h5" color="primary" fontWeight={800} sx={{ mt: 0.25 }}>
                  {focusLabel}
                </Typography>
                {desc ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.7 }}>
                    {desc}
                  </Typography>
                ) : null}
                {bullets.length > 0 && (
                  <Box component="ul" sx={{ m: 0, mt: 1.5, pl: 2.5 }}>
                    {bullets.map((b) => (
                      <li key={b}>
                        <Typography variant="body2" color="text.secondary" component="span" sx={{ lineHeight: 1.7 }}>
                          {b}
                        </Typography>
                      </li>
                    ))}
                  </Box>
                )}
              </>
            ) : (
              <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 1, color: "#344767" }}>
                Build a bit more data
              </Typography>
            )}

            {data.reason ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.7 }}>
                <strong>Why:</strong> {data.reason}
              </Typography>
            ) : data.message ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.7 }}>
                {data.message}
              </Typography>
            ) : null}

            {(data.difficulty || data.suggested_practice) && (
              <Box sx={{ mt: 2 }}>
                {data.difficulty ? (
                  <Typography variant="caption" color="text.secondary" display="block">
                    Suggested set: {formatDifficulty(data.difficulty)} · short targeted session
                  </Typography>
                ) : null}
                {data.suggested_practice ? (
                  <Typography variant="body2" sx={{ mt: 0.75, fontWeight: 500, color: "#344767" }}>
                    {data.suggested_practice}
                  </Typography>
                ) : null}
              </Box>
            )}

            <Button
              variant="contained"
              fullWidth
              disabled={loading}
              onClick={onStart}
              sx={{ mt: 2, borderRadius: "10px", fontWeight: 800, py: 1.25 }}
            >
              Start practice
            </Button>
            <Button
              fullWidth
              component={Link}
              to={`/learning/skill-map?module=${encodeURIComponent(module)}`}
              sx={{ mt: 1, borderRadius: "10px", fontWeight: 600 }}
            >
              View on skill map
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
