import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import { ScoreCircle } from "components/PracticeQuestions";

/**
 * @param {object} props
 * @param {object} props.results – submit response (objective practice)
 */
export default function ResultSummary({ results }) {
  const n = results?.question_results?.length ?? 0;
  const correct = results?.question_results?.filter((r) => r.is_correct).length ?? 0;
  const band = results?.estimated_band;

  return (
    <Card sx={{ borderRadius: "16px" }}>
      <CardContent sx={{ p: 3, display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" }}>
        <ScoreCircle percentage={results.percentage} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="overline" color="text.secondary" fontWeight={700} letterSpacing={0.5}>
            Result summary
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, my: 0.5 }}>
            <Chip label={results.topic} size="small" sx={{ background: "#f0f2f5", fontWeight: 600 }} />
            {band != null && (
              <Typography component="span" variant="h6" fontWeight={800} color="primary">
                ~ Band {band} <Typography component="span" variant="caption" color="text.secondary" fontWeight={600}>(est.)</Typography>
              </Typography>
            )}
          </Box>
          <Typography variant="body1" color="text.secondary">
            {results.total_score} / {results.max_score} points · {correct} of {n} correct
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
