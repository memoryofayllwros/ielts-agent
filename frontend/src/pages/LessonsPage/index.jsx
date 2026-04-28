import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import DashboardNavbar from "components/Navbars/DashboardNavbar";
import { dashboardPage } from "utils/pageLayout";
import { IELTS_PAPERS } from "constants/ieltsPapers";

export default function LessonsPage() {
  const navigate = useNavigate();

  return (
    <Box component="main" id="main-lessons" sx={dashboardPage.root} aria-label="Lessons content">
      <DashboardNavbar title="Lessons" />
      <Card
        sx={{
          mb: 3,
          borderRadius: 2,
          overflow: "hidden",
          background: "linear-gradient(125deg, #F8F8F8 0%, #f4f4f4 52%, #ececec 100%)",
          color: "text.primary",
          boxShadow: "0 8px 32px rgba(15, 23, 42, 0.08)",
        }}
      >
        <CardContent sx={{ p: { xs: 2.25, sm: 2.75, md: 3.5 } }}>
          <Typography
            variant="overline"
            sx={{
              color: "text.secondary",
              letterSpacing: { xs: "0.1em", sm: "0.12em" },
              fontWeight: 800,
              lineHeight: 1.2,
            }}
          >
            Lessons
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
            Structured paths across all four papers
          </Typography>
          <Typography
            variant="body1"
            component="p"
            sx={{
              mt: { xs: 1, sm: 1.25 },
              m: 0,
              color: "text.secondary",
              maxWidth: "min(100%, 52ch)",
              lineHeight: 1.6,
              overflowWrap: "anywhere",
              fontSize: { xs: "0.9375rem", sm: "1rem" },
            }}
          >
            Short AI videos target weaker micro-skills from your practice data. Pick a paper to generate or watch lessons.
          </Typography>
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
        Same four papers as practice — open a paper to generate a lesson from your current weakness ranking.
      </Typography>

      <Grid container spacing={{ xs: 2, sm: 2.5 }} sx={{ width: 1, minWidth: 0 }}>
        {IELTS_PAPERS.map((s) => {
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
                  WebkitTapHighlightColor: "rgba(15, 23, 42, 0.08)",
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
                    onClick={() => navigate(s.lessonsRoute)}
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
                    Open {s.title} lessons
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
