import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import PersonIcon from "@mui/icons-material/Person";
import LogoutIcon from "@mui/icons-material/Logout";
import PropTypes from "prop-types";
import { useAuth } from "context/AuthContext";

function DashboardNavbar({ title }) {
  const { user, logout } = useAuth();

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        width: "100%",
        maxWidth: "100%",
        background: "rgba(253, 252, 250, 0.92)",
        backdropFilter: "saturate(180%) blur(16px)",
        borderBottom: "1px solid",
        borderColor: "divider",
        mb: 3,
        borderRadius: "0 0 14px 14px",
        color: "text.primary",
      }}
    >
      <Toolbar sx={{ px: { xs: 2, md: 2.5 }, py: 0.5, gap: 2, minHeight: 64 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: "text.primary", letterSpacing: "-0.02em" }}>
            {title}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary", display: { xs: "none", sm: "block" } }}>
            Academic English · IELTS-style tasks
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexShrink: 0 }}>
          {user && (
            <Chip
              icon={<PersonIcon sx={{ fontSize: "1rem !important", color: "primary.main" }} />}
              label={user.email || user.username}
              size="small"
              sx={{
                background: "rgba(13, 148, 136, 0.08)",
                color: "text.primary",
                fontWeight: 500,
                fontSize: "0.8rem",
                border: "1px solid",
                borderColor: "rgba(13, 148, 136, 0.2)",
                maxWidth: { xs: 140, sm: 260 },
                "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" },
              }}
            />
          )}
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            startIcon={<LogoutIcon />}
            onClick={logout}
            sx={{
              fontWeight: 600,
              borderRadius: "10px",
              fontSize: "0.8rem",
              borderColor: "divider",
              color: "text.secondary",
              "&:hover": { borderColor: "primary.main", color: "primary.dark", bgcolor: "rgba(13, 148, 136, 0.06)" },
            }}
          >
            Sign out
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
}

DashboardNavbar.propTypes = {
  title: PropTypes.string,
};

DashboardNavbar.defaultProps = {
  title: "",
};

export default DashboardNavbar;
