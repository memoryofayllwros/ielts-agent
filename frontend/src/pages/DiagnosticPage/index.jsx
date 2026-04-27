import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stepper from "@mui/material/Stepper";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import DashboardNavbar from "components/Navbars/DashboardNavbar";
import ObjectivePracticePage from "pages/ObjectivePracticePage";
import WritingPracticePage from "pages/WritingPracticePage";
import SpeakingPracticePage from "pages/SpeakingPracticePage";
import { fetchDiagnosticStatus, generateDiagnosticStep } from "services/api";

const STEPS = ["reading", "listening", "writing", "speaking"];
const LABELS = ["Reading", "Listening", "Writing", "Speaking"];

export default function DiagnosticPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState("");
  const [phase, setPhase] = useState("intro");
  const [activeIndex, setActiveIndex] = useState(0);
  const [diagSession, setDiagSession] = useState(null);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState("");

  const loadStatus = useCallback(async () => {
    setStatusError("");
    try {
      const s = await fetchDiagnosticStatus();
      setStatus(s);
    } catch (e) {
      setStatusError(e.message || "Could not load diagnostic status");
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (phase !== "run") return;
    const skill = STEPS[activeIndex];
    if (!skill) return;
    let cancelled = false;
    async function run() {
      setGenError("");
      setDiagSession(null);
      setGenLoading(true);
      try {
        const d = await generateDiagnosticStep({ step: skill });
        if (!cancelled) setDiagSession(d);
      } catch (e) {
        if (!cancelled) setGenError(e.message || "Generation failed");
      } finally {
        if (!cancelled) setGenLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [phase, activeIndex]);

  const goNextAfterStep = useCallback(async () => {
    await loadStatus();
    if (activeIndex >= STEPS.length - 1) {
      setPhase("done");
      setDiagSession(null);
      return;
    }
    setActiveIndex((i) => i + 1);
  }, [activeIndex, loadStatus]);

  const startDiagnostic = () => {
    setPhase("run");
    setActiveIndex(0);
  };

  if (statusError) {
    return (
      <Box>
        <DashboardNavbar title="Baseline diagnostic" />
        <Alert severity="error" sx={{ mt: 2 }}>{statusError}</Alert>
      </Box>
    );
  }

  if (!status) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (status.completed && phase !== "run") {
    const bands = status.bands || {};
    return (
      <Box>
        <DashboardNavbar title="Baseline diagnostic" />
        <Card sx={{ borderRadius: "16px", width: "100%", mt: 2 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" fontWeight={700} gutterBottom>Diagnostic complete</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Approximate baseline levels (stored on your profile for adaptive practice):
            </Typography>
            <Box component="ul" sx={{ pl: 2, m: 0 }}>
              {STEPS.map((k) => (
                <Typography key={k} component="li" variant="body1" sx={{ mb: 0.5 }}>
                  <strong>{k.charAt(0).toUpperCase() + k.slice(1)}:</strong>{" "}
                  {bands[k] != null ? `~${bands[k]}` : "—"}
                </Typography>
              ))}
            </Box>
            <Button variant="contained" sx={{ mt: 3, borderRadius: "10px", fontWeight: 700 }} onClick={() => navigate("/practice")}>
              Back to practice hub
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (phase === "intro") {
    return (
      <Box>
        <DashboardNavbar title="Baseline diagnostic" />
        <Card sx={{ borderRadius: "16px", width: "100%", mt: 1 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" fontWeight={700} gutterBottom>Baseline assessment</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              A short check across all four skills: reading (passage + 5 questions), listening (script + 5 questions),
              writing (Task 2), and speaking (Part 2 cue card). Results estimate your level and tune later practice.
            </Typography>
            <Stepper activeStep={-1} alternativeLabel sx={{ mb: 3 }}>
              {LABELS.map((l) => (
                <Step key={l}><StepLabel>{l}</StepLabel></Step>
              ))}
            </Stepper>
            <Button variant="contained" size="large" fullWidth onClick={startDiagnostic} sx={{ py: 1.5, borderRadius: "10px", fontWeight: 700 }}>
              Start diagnostic
            </Button>
            <Button fullWidth sx={{ mt: 1 }} onClick={() => navigate("/practice")}>Skip for now</Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (phase === "done") {
    return (
      <Box>
        <DashboardNavbar title="Baseline diagnostic" />
        <Card sx={{ borderRadius: "16px", width: "100%", mt: 2 }}>
          <CardContent sx={{ p: 4, textAlign: "center" }}>
            <Typography variant="h5" fontWeight={700} gutterBottom>All sections submitted</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Your baseline bands are saved. Regular practice will use them to match difficulty.
            </Typography>
            <Button variant="contained" onClick={() => navigate("/practice")} sx={{ borderRadius: "10px", fontWeight: 700 }}>
              Continue to practice hub
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  const skill = STEPS[activeIndex];
  const nextLabel = activeIndex < STEPS.length - 1
    ? `Continue to ${LABELS[activeIndex + 1]}`
    : "Finish diagnostic";

  if (genError) {
    return (
      <Box>
        <DashboardNavbar title={`Diagnostic — ${LABELS[activeIndex]}`} />
        <Alert severity="error" sx={{ mt: 2 }}>{genError}</Alert>
        <Button sx={{ mt: 2 }} onClick={() => setPhase("intro")}>Back</Button>
      </Box>
    );
  }

  if (genLoading || !diagSession?.session_id) {
    return (
      <Box>
        <DashboardNavbar title={`Diagnostic — ${LABELS[activeIndex]}`} />
        <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
          <Card sx={{ borderRadius: "16px", p: 5, textAlign: "center" }}>
            <CircularProgress sx={{ mb: 2 }} />
            <Typography variant="body1">Preparing {LABELS[activeIndex]} section…</Typography>
          </Card>
        </Box>
      </Box>
    );
  }

  const commonContinue = {
    diagnosticContinueLabel: nextLabel,
    onDiagnosticContinue: goNextAfterStep,
    prefetchedSession: diagSession,
  };

  if (skill === "reading") {
    return (
      <ObjectivePracticePage
        key={`diag-reading-${diagSession.session_id}`}
        skill="reading"
        navbarTitle={`Diagnostic — ${LABELS[activeIndex]}`}
        contentLabel="Reading passage"
        intro=""
        loadingBlurb="Generating diagnostic passage…"
        {...commonContinue}
      />
    );
  }

  if (skill === "listening") {
    return (
      <ObjectivePracticePage
        key={`diag-listening-${diagSession.session_id}`}
        skill="listening"
        navbarTitle={`Diagnostic — ${LABELS[activeIndex]}`}
        contentLabel="Audio"
        intro=""
        loadingBlurb="Generating diagnostic listening…"
        {...commonContinue}
      />
    );
  }

  if (skill === "writing") {
    return (
      <WritingPracticePage
        key={`diag-writing-${diagSession.session_id}`}
        {...commonContinue}
      />
    );
  }

  if (skill === "speaking") {
    return (
      <SpeakingPracticePage
        key={`diag-speaking-${diagSession.session_id}`}
        {...commonContinue}
      />
    );
  }

  return null;
}
