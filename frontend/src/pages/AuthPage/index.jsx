import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import { useAuth } from "context/AuthContext";

export default function AuthPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/learning/skill-map";

  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(signInEmail, signInPassword);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError("");
    if (signUpPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await register(signUpEmail, signUpPassword);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(155deg, #F8F8F8 0%, #f0f0f0 52%, #eaeaea 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse 80% 50% at 100% 0%, rgba(139, 149, 163, 0.22) 0%, transparent 55%)",
          pointerEvents: "none",
        },
      }}
    >
      <Card
        sx={{
          width: "100%",
          maxWidth: 420,
          borderRadius: "16px",
          boxShadow: "0 24px 64px rgba(15, 23, 42, 0.28)",
          position: "relative",
          zIndex: 1,
          border: "1px solid rgba(255,255,255,0.5)",
        }}
      >
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: "center", mb: 3 }}>
            <Box
              sx={{
                minWidth: 72,
                height: 44,
                px: 1.75,
                borderRadius: "14px",
                border: "1px solid rgba(15, 23, 42, 0.1)",
                background: "#F8F8F8",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                mb: 1.5,
                color: "text.primary",
                fontSize: "0.8125rem",
                fontWeight: 800,
                letterSpacing: "0.07em",
                fontFamily: '"Source Sans 3", system-ui, sans-serif',
                boxShadow: "none",
              }}
            >
              IELTS
            </Box>
            <Typography variant="h5" fontWeight={700} color="text.primary">
              IELTS Band Booster
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.5 }}>
              Practice for the four papers — reading, listening, writing, and speaking — with skill-level feedback.
            </Typography>
          </Box>

          <Tabs
            value={tab}
            onChange={(_, v) => {
              setTab(v);
              setError("");
            }}
            variant="fullWidth"
            sx={{
              mb: 3,
              minHeight: 44,
              "& .MuiTabs-indicator": { borderRadius: "2px", height: 3, backgroundColor: "primary.main" },
            }}
          >
            <Tab label="Sign in" sx={{ fontWeight: 600, textTransform: "none", fontSize: "0.95rem" }} />
            <Tab label="Create account" sx={{ fontWeight: 600, textTransform: "none", fontSize: "0.95rem" }} />
          </Tabs>

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: "10px" }}>
              {error}
            </Alert>
          )}

          {tab === 0 && (
            <Box component="form" onSubmit={handleSignIn} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <TextField
                label="Email"
                type="email"
                value={signInEmail}
                onChange={(e) => setSignInEmail(e.target.value)}
                required
                fullWidth
                size="small"
                autoComplete="email"
              />
              <TextField
                label="Password"
                type="password"
                value={signInPassword}
                onChange={(e) => setSignInPassword(e.target.value)}
                required
                fullWidth
                size="small"
                autoComplete="current-password"
              />
              <Button
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                fullWidth
                disabled={loading}
                sx={{ mt: 1, py: 1.25, borderRadius: "10px", fontWeight: 700 }}
              >
                {loading ? <CircularProgress size={22} color="inherit" /> : "Sign in"}
              </Button>
            </Box>
          )}

          {tab === 1 && (
            <Box component="form" onSubmit={handleSignUp} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <TextField
                label="Email"
                type="email"
                value={signUpEmail}
                onChange={(e) => setSignUpEmail(e.target.value)}
                required
                fullWidth
                size="small"
                autoComplete="email"
              />
              <TextField
                label="Password"
                type="password"
                value={signUpPassword}
                onChange={(e) => setSignUpPassword(e.target.value)}
                required
                fullWidth
                size="small"
                helperText="At least 6 characters"
                autoComplete="new-password"
              />
              <Button
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                fullWidth
                disabled={loading}
                sx={{ mt: 1, py: 1.25, borderRadius: "10px", fontWeight: 700 }}
              >
                {loading ? <CircularProgress size={22} color="inherit" /> : "Create account"}
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
