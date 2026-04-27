import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import MenuBook from "@mui/icons-material/MenuBook";
import Headphones from "@mui/icons-material/Headphones";
import EditNote from "@mui/icons-material/EditNote";
import Mic from "@mui/icons-material/Mic";
import DashboardNavbar from "components/Navbars/DashboardNavbar";
import NextBestPracticeCard from "components/LearningLoop/NextBestPracticeCard";

const SKILLS = [
  {
    key: "reading",
    title: "Reading",
    desc: "Academic-style passages, gap-fill, and multiple choice — like the real test.",
    route: "/practice/reading",
    Icon: MenuBook,
    accent: "primary",
    iconColor: "primary.main",
    tint: "rgba(13, 148, 136, 0.08)",
    border: "rgba(13, 148, 136, 0.35)",
  },
  {
    key: "listening",
    title: "Listening",
    desc: "Audio-based questions; the script stays hidden until you need it.",
    route: "/practice/listening",
    Icon: Headphones,
    accent: "primary",
    iconColor: "primary.dark",
    tint: "rgba(14, 116, 144, 0.08)",
    border: "rgba(14, 116, 144, 0.35)",
  },
  {
    key: "writing",
    title: "Writing",
    desc: "Task 1 or Task 2 prompts with rubric-style feedback on your work.",
    route: "/practice/writing",
    Icon: EditNote,
    accent: "warning",
    iconColor: "warning.dark",
    tint: "rgba(217, 119, 6, 0.1)",
    border: "rgba(217, 119, 6, 0.4)",
  },
  {
    key: "speaking",
    title: "Speaking",
    desc: "Part 2 cue cards; record or dictate so you can focus on fluency and ideas.",
    route: "/practice/speaking",
    Icon: Mic,
    accent: "secondary",
    iconColor: "secondary.main",
    tint: "rgba(100, 116, 139, 0.1)",
    border: "rgba(100, 116, 139, 0.35)",
  },
];

export default function PracticeHub() {
  const navigate = useNavigate();

  return (
    <Box sx={{ width: "100%", minWidth: 0 }}>
      <DashboardNavbar title="Practice hub" />
      <Card
        sx={{
          mb: 3,
          borderRadius: 2,
          overflow: "hidden",
          background: (t) =>
            `linear-gradient(125deg, ${t.palette.primary.dark} 0%, ${t.palette.primary.main} 48%, #2DD4BF 100%)`,
          color: "#fff",
          boxShadow: "0 8px 32px rgba(13, 148, 136, 0.35)",
        }}
      >
        <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
          <Typography variant="overline" sx={{ opacity: 0.95, letterSpacing: "0.12em", fontWeight: 800 }}>
            IELTS preparation
          </Typography>
          <Typography component="h1" variant="h4" sx={{ fontWeight: 800, mt: 0.5, letterSpacing: "-0.03em" }}>
            Build skills, not just scores
          </Typography>
          <Typography variant="body1" sx={{ mt: 1.25, opacity: 0.95, maxWidth: 640, lineHeight: 1.7 }}>
            Each session shows which sub-skills move — and suggests what to do next. Use the skill map to see
            how Reading, Listening, Writing, and Speaking connect to your target band.
          </Typography>
        </CardContent>
      </Card>

      <Box sx={{ mb: 1.5 }}>
        <NextBestPracticeCard module="reading" />
      </Box>

      <Card
        sx={{
          borderRadius: 2,
          mb: 3,
          bgcolor: "background.paper",
          background: (t) =>
            `linear-gradient(135deg, ${t.palette.grey[50]} 0%, ${t.palette.common.white} 100%)`,
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 2.5 }, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2 }}>
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Typography variant="subtitle1" fontWeight={700} color="text.primary">
              Baseline diagnostic
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.65 }}>
              A short check across all four skills. We save your estimated level so practice matches your current band.
            </Typography>
          </Box>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate("/practice/diagnostic")}
            sx={{ borderRadius: "10px", fontWeight: 700, px: 2.5, py: 1 }}
          >
            Start diagnostic
          </Button>
        </CardContent>
      </Card>

      <Typography variant="h5" fontWeight={700} color="text.primary" sx={{ mb: 0.5 }}>
        Choose a paper
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.65 }}>
        The four IELTS papers — work through them the same way you will on test day.
      </Typography>

      <Grid container spacing={2.5}>
        {SKILLS.map((s) => {
          const IconComp = s.Icon;
          return (
            <Grid item xs={12} sm={6} key={s.key}>
              <Card
                sx={{
                  height: "100%",
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: s.border,
                  background: s.tint,
                  transition: "transform 0.2s, box-shadow 0.2s",
                  "&:hover": {
                    transform: "translateY(-2px)",
                    boxShadow: "0 12px 28px rgba(15, 23, 42, 0.08)",
                  },
                }}
              >
                <CardContent sx={{ p: 3, display: "flex", flexDirection: "column", height: "100%" }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: "12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      mb: 1.5,
                      bgcolor: "background.paper",
                      color: s.iconColor,
                      boxShadow: "0 2px 8px rgba(15, 23, 42, 0.06)",
                    }}
                  >
                    <IconComp sx={{ fontSize: 28 }} />
                  </Box>
                  <Typography variant="h6" fontWeight={700} color="text.primary">
                    {s.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ flex: 1, my: 1.5, lineHeight: 1.7 }}>
                    {s.desc}
                  </Typography>
                  <Button
                    variant="contained"
                    color={s.accent}
                    onClick={() => navigate(s.route)}
                    fullWidth
                    sx={{ borderRadius: "10px", fontWeight: 700, py: 1.1 }}
                  >
                    Start
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}
