import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import PersonIcon from "@mui/icons-material/Person";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import LogoutIcon from "@mui/icons-material/Logout";
import AnalyticsIcon from "@mui/icons-material/Analytics";
import SpellcheckIcon from "@mui/icons-material/Spellcheck";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import PropTypes from "prop-types";
import { useAuth } from "context/AuthContext";

function DashboardNavbar({ title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const accountLabel = user ? (user.email || user.username || "").trim() : "";
  const displayName = user ? String(user.display_name || "").trim() : "";
  const profileButtonLabel = displayName || accountLabel || "Account";
  const [profileAnchor, setProfileAnchor] = useState(null);
  const profileOpen = Boolean(profileAnchor);

  const onOpenProfile = (event) => {
    setProfileAnchor(event.currentTarget);
  };
  const onCloseProfile = () => {
    setProfileAnchor(null);
  };

  const goFromMenu = (path) => {
    navigate(path);
    onCloseProfile();
  };

  const onProfilePage = location.pathname === "/profile";
  const onDiagnostic = location.pathname.startsWith("/practice/diagnostic");
  const onVocab = location.pathname === "/vocab" || location.pathname.startsWith("/vocab/");

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
      <Toolbar sx={{ px: { xs: 2, md: 2.5 }, py: 0.5, gap: 2, minHeight: 64, maxWidth: "100%", boxSizing: "border-box" }}>
        <Box sx={{ flex: "1 1 auto", minWidth: 0, overflow: "hidden" }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              color: "text.primary",
              letterSpacing: "-0.02em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary", display: { xs: "none", sm: "block" } }}>
            Academic English · IELTS-style tasks
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: "0 1 auto", minWidth: 0 }}>
          {user && (
            <>
              <Button
                id="dashboard-profile-button"
                size="small"
                color="inherit"
                onClick={onOpenProfile}
                aria-controls={profileOpen ? "dashboard-profile-menu" : undefined}
                aria-haspopup="true"
                aria-expanded={profileOpen ? "true" : undefined}
                startIcon={<PersonIcon sx={{ color: "primary.main", fontSize: "1.1rem" }} />}
                endIcon={
                  <KeyboardArrowDownIcon
                    sx={{
                      fontSize: "1.1rem",
                      color: "text.secondary",
                      transform: profileOpen ? "rotate(180deg)" : "none",
                      transition: "transform 0.2s ease",
                    }}
                  />
                }
                sx={{
                  flexShrink: 1,
                  minWidth: 0,
                  maxWidth: { xs: 200, sm: 280 },
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  borderRadius: "10px",
                  border: "1px solid",
                  borderColor: "rgba(13, 148, 136, 0.25)",
                  color: "text.primary",
                  backgroundColor: "rgba(13, 148, 136, 0.06)",
                  px: 1.5,
                  py: 0.5,
                  textTransform: "none",
                  "& .MuiButton-endIcon": { ml: 0.25, flexShrink: 0 },
                  "& .MuiButton-startIcon": { mr: 0.5, flexShrink: 0 },
                }}
              >
                <Box
                  component="span"
                  sx={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                    textAlign: "left",
                  }}
                >
                  {profileButtonLabel}
                </Box>
              </Button>
              <Menu
                id="dashboard-profile-menu"
                anchorEl={profileAnchor}
                open={profileOpen}
                onClose={onCloseProfile}
                MenuListProps={{ "aria-labelledby": "dashboard-profile-button" }}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                PaperProps={{
                  sx: {
                    minWidth: 260,
                    maxWidth: "min(100vw - 24px, 320px)",
                    borderRadius: "12px",
                    mt: 0.5,
                  },
                }}
              >
                <Box
                  sx={{
                    px: 2,
                    py: 1.5,
                    borderBottom: 1,
                    borderColor: "divider",
                    bgcolor: "grey.50",
                  }}
                >
                  <Typography variant="caption" color="text.secondary" fontWeight={700} letterSpacing={0.3}>
                    Your account
                  </Typography>
                  {accountLabel ? (
                    <>
                      {displayName ? (
                        <Typography variant="body2" color="text.primary" fontWeight={700} sx={{ mt: 0.5, wordBreak: "break-word" }}>
                          {displayName}
                        </Typography>
                      ) : null}
                      <Typography
                        variant="body2"
                        color="text.primary"
                        fontWeight={displayName ? 500 : 600}
                        sx={{ mt: 0.5, wordBreak: "break-word" }}
                      >
                        {accountLabel}
                      </Typography>
                    </>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      Baseline and vocabulary live here
                    </Typography>
                  )}
                </Box>
                <MenuItem
                  onClick={() => goFromMenu("/profile")}
                  selected={onProfilePage}
                  sx={{ borderRadius: 1, mx: 0.5, my: 0.25, py: 1, minHeight: 48 }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <AccountCircleIcon fontSize="small" color="primary" />
                  </ListItemIcon>
                  Personal profile
                </MenuItem>
                <MenuItem
                  onClick={() => goFromMenu("/practice/diagnostic")}
                  selected={onDiagnostic}
                  sx={{ borderRadius: 1, mx: 0.5, my: 0.25, py: 1, minHeight: 48 }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <AnalyticsIcon fontSize="small" color="primary" />
                  </ListItemIcon>
                  Baseline diagnostic
                </MenuItem>
                <MenuItem
                  onClick={() => goFromMenu("/vocab")}
                  selected={onVocab}
                  sx={{ borderRadius: 1, mx: 0.5, my: 0.25, py: 1, minHeight: 48 }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <SpellcheckIcon fontSize="small" color="primary" />
                  </ListItemIcon>
                  Vocabulary test
                </MenuItem>
              </Menu>
            </>
          )}
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            startIcon={<LogoutIcon />}
            onClick={logout}
            aria-label="Sign out"
            sx={{
              flexShrink: 0,
              fontWeight: 600,
              borderRadius: "10px",
              fontSize: "0.8rem",
              borderColor: "divider",
              color: "text.secondary",
              "&:hover": { borderColor: "primary.main", color: "primary.dark", bgcolor: "rgba(13, 148, 136, 0.06)" },
            }}
          >
            <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
              Sign out
            </Box>
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
