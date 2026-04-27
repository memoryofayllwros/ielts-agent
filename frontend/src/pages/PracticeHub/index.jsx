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
import { dashboardPage } from "utils/pageLayout";

const SKILLS = [
  {
    key: "reading",
    title: "Reading",
    desc: "Passages, gap-fill, multiple choice, exam style.",
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
    desc: "Audio, questions, script when you need it.",
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
    desc: "Task 1 or 2, rubric-style feedback.",
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
    desc: "Part 2 cue card, record or dictate.",
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
    <Box component="main" id="main-practice-hub" sx={dashboardPage.root} aria-label="Practice hub content">
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
        <CardContent sx={{ p: { xs: 2.25, sm: 2.75, md: 3.5 } }}>
          <Typography
            variant="overline"
            sx={{ opacity: 0.95, letterSpacing: { xs: "0.1em", sm: "0.12em" }, fontWeight: 800, lineHeight: 1.2 }}
          >
            Practice
          </Typography>
          <Typography
            component="h1"
            variant="h4"
            sx={{
              fontWeight: 800,
              mt: 0.5,
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
              fontSize: { xs: "1.3rem", sm: "1.5rem", md: "1.75rem" },
            }}
          >
            Target the skills that still cost you points
          </Typography>
          <Typography
            variant="body1"
            component="p"
            sx={{
              mt: { xs: 1, sm: 1.25 },
              m: 0,
              opacity: 0.95,
              maxWidth: "min(100%, 52ch)",
              lineHeight: 1.6,
              overflowWrap: "anywhere",
              fontSize: { xs: "0.9375rem", sm: "1rem" },
            }}
          >
            See what moved last time, get a clear next focus, and keep the four papers tied to your goal.
          </Typography>
        </CardContent>
      </Card>

      <Box sx={{ mb: { xs: 2, sm: 1.5 } }}>
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
        <CardContent
          sx={{
            p: { xs: 2, sm: 2.5 },
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            flexWrap: "wrap",
            alignItems: { xs: "stretch", sm: "center" },
            gap: { xs: 2, sm: 2 },
          }}
        >
          <Box sx={{ flex: "1 1 auto", minWidth: 0, maxWidth: { sm: "100%" } }}>
            <Typography
              component="h2"
              variant="subtitle1"
              fontWeight={800}
              color="text.primary"
              sx={{ overflowWrap: "anywhere", lineHeight: 1.3, letterSpacing: "-0.01em" }}
            >
              Baseline diagnostic
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              component="p"
              sx={{ mt: 0.5, mb: 0, lineHeight: 1.65, maxWidth: "65ch", overflowWrap: "anywhere", wordBreak: "break-word" }}
            >
              Quick baseline across all four skills. We save it so practice matches your level.
            </Typography>
          </Box>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate("/practice/diagnostic")}
            fullWidth
            sx={{
              borderRadius: "10px",
              fontWeight: 700,
              minHeight: 48,
              px: 2.5,
              py: 1.25,
              flexShrink: 0,
              alignSelf: { xs: "stretch", sm: "center" },
              width: { xs: "100%", sm: "auto" },
              touchAction: "manipulation",
            }}
          >
            Start diagnostic
          </Button>
        </CardContent>
      </Card>

      <Box sx={{ width: 1, minWidth: 0, mb: 0.5 }}>
        <Typography
          component="h2"
          variant="h5"
          color="text.primary"
          sx={{
            fontWeight: 800,
            lineHeight: 1.25,
            letterSpacing: "-0.015em",
            fontSize: { xs: "1.15rem", sm: "1.5rem" },
          }}
        >
          Choose a paper
        </Typography>
      </Box>
      <Typography
        component="p"
        variant="body2"
        color="text.secondary"
        sx={{ mb: { xs: 2, sm: 2.5 }, lineHeight: 1.65, maxWidth: "65ch", overflowWrap: "anywhere" }}
      >
        Pick a paper, same structure as on test day.
      </Typography>

      <Grid container spacing={{ xs: 2, sm: 2.5 }} sx={{ width: 1, minWidth: 0 }}>
        {SKILLS.map((s) => {
          const IconComp = s.Icon;
          return (
            <Grid item xs={12} sm={6} key={s.key} sx={{ minWidth: 0 }}>
              <Card
                sx={{
                  height: "100%",
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: s.border,
                  background: s.tint,
                  transition: "transform 0.2s ease-out, box-shadow 0.2s ease-out",
                  WebkitTapHighlightColor: "rgba(13, 148, 136, 0.1)",
                  "@media (prefers-reduced-motion: reduce)": {
                    transition: "none",
                  },
                  "@media (hover: hover) and (pointer: fine)": {
                    "&:hover": {
                      boxShadow: "0 12px 28px rgba(15, 23, 42, 0.08)",
                      "@media (prefers-reduced-motion: no-preference)": {
                        transform: "translateY(-2px)",
                      },
                    },
                  },
                }}
              >
                <CardContent
                  sx={{
                    p: { xs: 2.25, sm: 3 },
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    minWidth: 0,
                  }}
                >
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: "12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      mb: 1.5,
                      flexShrink: 0,
                      bgcolor: "background.paper",
                      color: s.iconColor,
                      boxShadow: "0 2px 8px rgba(15, 23, 42, 0.06)",
                    }}
                    aria-hidden
                  >
                    <IconComp sx={{ fontSize: 28 }} />
                  </Box>
                  <Typography
                    variant="h6"
                    component="h3"
                    fontWeight={800}
                    color="text.primary"
                    sx={{ overflowWrap: "anywhere", lineHeight: 1.3, letterSpacing: "-0.01em" }}
                  >
                    {s.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      flex: 1,
                      my: 1.5,
                      lineHeight: 1.65,
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                    }}
                  >
                    {s.desc}
                  </Typography>
                  <Button
                    variant="contained"
                    color={s.accent}
                    onClick={() => navigate(s.route)}
                    fullWidth
                    sx={{
                      borderRadius: "10px",
                      fontWeight: 700,
                      minHeight: 48,
                      py: 1.25,
                      flexShrink: 0,
                      touchAction: "manipulation",
                    }}
                  >
                    Start {s.title}
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
