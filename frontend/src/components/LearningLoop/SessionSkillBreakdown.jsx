import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { humanizeSkillId } from "utils/skillLabel";

/**
 * @param {object} props
 * @param {string[]} props.strengthenedSkills
 * @param {string[]} props.needsWorkSkills
 */
export default function SessionSkillBreakdown({ strengthenedSkills = [], needsWorkSkills = [] }) {
  if (!strengthenedSkills.length && !needsWorkSkills.length) {
    return null;
  }

  return (
    <Card sx={{ borderRadius: "16px" }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="overline" color="text.secondary" fontWeight={700} letterSpacing={0.5} display="block" sx={{ mb: 1.5 }}>
          Skills in this session
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          How micro-skills moved from this set — not just right or wrong.
        </Typography>
        {strengthenedSkills.length > 0 && (
          <Box sx={{ mb: needsWorkSkills.length ? 2 : 0 }}>
            {strengthenedSkills.map((id) => (
              <Box key={id} sx={{ display: "flex", alignItems: "flex-start", gap: 1, py: 0.5 }}>
                <CheckCircleIcon sx={{ color: "success.main", fontSize: 20, mt: 0.15 }} />
                <Box>
                  <Typography variant="body2" fontWeight={600} sx={{ color: "success.main" }}>
                    {humanizeSkillId(id)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Stronger on every tagged question for this skill
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        )}
        {needsWorkSkills.length > 0 && (
          <Box>
            {needsWorkSkills.map((id) => (
              <Box key={id} sx={{ display: "flex", alignItems: "flex-start", gap: 1, py: 0.5 }}>
                <WarningAmberIcon sx={{ color: "warning.main", fontSize: 20, mt: 0.15 }} />
                <Box>
                  <Typography variant="body2" fontWeight={600} sx={{ color: "warning.dark" }}>
                    {humanizeSkillId(id)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    At least one miss — extra reps help here
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
