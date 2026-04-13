import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import DashboardNavbar from "components/Navbars/DashboardNavbar";

const SKILLS = [
  { key: "reading", title: "Reading", desc: "Academic passage, gap-fill and multiple choice.", route: "/practice/reading", emoji: "📄" },
  { key: "listening", title: "Listening", desc: "Script + playback; questions on details.", route: "/practice/listening", emoji: "🎧" },
  { key: "writing", title: "Writing", desc: "Task 1 or Task 2 with rubric feedback.", route: "/practice/writing", emoji: "✍️" },
  { key: "speaking", title: "Speaking", desc: "Part 2 cue card; record or dictate your answer.", route: "/practice/speaking", emoji: "🎤" },
];

export default function PracticeHub() {
  const navigate = useNavigate();
  return (
    <Box>
      <DashboardNavbar title="Practice" />
      <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>Choose a skill</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Full IELTS practice: reading, listening, writing, and speaking in one place.
      </Typography>
      <Card sx={{ borderRadius: "16px", mb: 3, background: "linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%)" }}>
        <CardContent sx={{ p: 2.5, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2 }}>
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Typography variant="subtitle1" fontWeight={700}>Baseline diagnostic</Typography>
            <Typography variant="body2" color="text.secondary">
              Short assessment across all four skills. Your estimated level is saved to guide practice difficulty.
            </Typography>
          </Box>
          <Button variant="contained" color="secondary" onClick={() => navigate("/practice/diagnostic")} sx={{ borderRadius: "10px", fontWeight: 700 }}>
            Start diagnostic
          </Button>
        </CardContent>
      </Card>
      <Grid container spacing={2}>
        {SKILLS.map((s) => (
          <Grid item xs={12} sm={6} key={s.key}>
            <Card sx={{ borderRadius: "16px", height: "100%" }}>
              <CardContent sx={{ p: 3, display: "flex", flexDirection: "column", height: "100%" }}>
                <Typography variant="h3" sx={{ mb: 1 }}>{s.emoji}</Typography>
                <Typography variant="h6" fontWeight={700}>{s.title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ flex: 1, my: 1 }}>{s.desc}</Typography>
                <Button variant="contained" onClick={() => navigate(s.route)} sx={{ borderRadius: "10px", fontWeight: 700 }}>
                  Start
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
