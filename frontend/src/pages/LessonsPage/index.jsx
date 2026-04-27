import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import DashboardNavbar from "components/Navbars/DashboardNavbar";
import { dashboardPage } from "utils/pageLayout";

export default function LessonsPage() {
  return (
    <Box component="main" id="main-lessons" sx={dashboardPage.root} aria-label="Lessons content">
      <DashboardNavbar title="Lessons" />
      <Card sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
        <CardContent sx={{ p: { xs: 2.25, sm: 3 } }}>
          <Typography
            component="h1"
            variant="h5"
            fontWeight={800}
            color="text.primary"
            sx={{ letterSpacing: "-0.02em", mb: 1 }}
          >
            Structured lessons
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65, maxWidth: "65ch", m: 0 }}>
            Guided IELTS topics and skills will be listed here as they are added.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
