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
import { useMaterialUIController } from "context";

const DRAWER_WIDTH = 250;
const MINI_DRAWER_WIDTH = 72;

function DashboardNavbar({ title }) {
  const { user, logout } = useAuth();
  const [controller] = useMaterialUIController();
  const { miniSidenav } = controller;

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        background: "rgba(255,255,255,0.8)",
        backdropFilter: "saturate(200%) blur(30px)",
        borderBottom: "1px solid rgba(0,0,0,0.05)",
        mb: 3,
        borderRadius: "0 0 16px 16px",
        color: "text.primary",
      }}
    >
      <Toolbar sx={{ px: { xs: 2, md: 3 }, gap: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: "#344767", flex: 1 }}>
          {title}
        </Typography>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          {user && (
            <Chip
              icon={<PersonIcon sx={{ fontSize: "1rem !important" }} />}
              label={user.username || user.email}
              size="small"
              sx={{
                background: "#f0f2f5",
                color: "#344767",
                fontWeight: 500,
                fontSize: "0.8rem",
              }}
            />
          )}
          <Button
            size="small"
            variant="outlined"
            color="secondary"
            startIcon={<LogoutIcon />}
            onClick={logout}
            sx={{ fontWeight: 600, borderRadius: "8px", fontSize: "0.75rem" }}
          >
            Sign Out
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
