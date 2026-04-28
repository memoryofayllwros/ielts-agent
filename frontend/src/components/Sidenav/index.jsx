import { useEffect } from "react";
import { useLocation, NavLink, matchPath } from "react-router-dom";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Icon from "@mui/material/Icon";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import PropTypes from "prop-types";
import { useMaterialUIController, setMiniSidenav } from "context";

const DRAWER_WIDTH = 250;

const ACTIVE_NAV = {
  background: "linear-gradient(145deg, #0F766E 0%, #0D9488 55%, #14B8A6 100%)",
  boxShadow: "0 4px 14px rgba(13, 148, 136, 0.35)",
};

function Sidenav({ routes }) {
  const [controller, dispatch] = useMaterialUIController();
  const { miniSidenav } = controller;
  const { pathname } = useLocation();

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1200) {
        setMiniSidenav(dispatch, true);
      } else {
        setMiniSidenav(dispatch, false);
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, [dispatch]);

  const drawerContent = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box
        sx={{
          px: 2,
          py: 3,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            minWidth: 52,
            height: 40,
            px: 1,
            borderRadius: "12px",
            background: "linear-gradient(145deg, #0F766E 0%, #0D9488 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 12px rgba(13, 148, 136, 0.35)",
            color: "#fff",
            fontSize: "0.6875rem",
            fontWeight: 800,
            letterSpacing: "0.06em",
            fontFamily: '"Source Sans 3", system-ui, sans-serif',
          }}
        >
          IELTS
        </Box>
        {!miniSidenav && (
          <Typography variant="h6" sx={{ fontWeight: 700, color: "text.primary", lineHeight: 1.25 }}>
            IELTS Band Booster
            <Typography
              component="span"
              variant="caption"
              display="block"
              sx={{ color: "text.secondary", fontWeight: 500, mt: 0.25 }}
            >
              Listening · Reading · Writing · Speaking
            </Typography>
          </Typography>
        )}
      </Box>

      <Divider sx={{ mb: 1, opacity: 0.7 }} />

      <List sx={{ flex: 1, px: 1 }}>
        {routes.map((route) => {
          const isActive =
            matchPath({ path: route.route, end: route.end === true, caseSensitive: false }, pathname) != null;
          return (
            <ListItem key={route.key} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={NavLink}
                to={route.route}
                end={route.end === true}
                sx={{
                  borderRadius: "10px",
                  px: 2,
                  py: 1.125,
                  minHeight: 46,
                  background: isActive ? ACTIVE_NAV.background : "transparent",
                  boxShadow: isActive ? ACTIVE_NAV.boxShadow : "none",
                  "&:hover": {
                    background: isActive ? ACTIVE_NAV.background : "rgba(13, 148, 136, 0.08)",
                  },
                  transition: "background 0.2s, box-shadow 0.2s",
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: miniSidenav ? 0 : 38,
                    color: isActive ? "#fff" : "text.secondary",
                    justifyContent: "center",
                  }}
                >
                  <Icon fontSize="small">{route.icon}</Icon>
                </ListItemIcon>
                {!miniSidenav && (
                  <ListItemText
                    primary={route.name}
                    primaryTypographyProps={{
                      fontSize: "0.9rem",
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? "#fff" : "text.primary",
                    }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      {!miniSidenav && (
        <Box sx={{ px: 2, pb: 2.5, pt: 1 }}>
          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", lineHeight: 1.5 }}>
            Exam-style practice with feedback on skills and band-level difficulty.
          </Typography>
        </Box>
      )}
    </Box>
  );

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: miniSidenav ? 72 : DRAWER_WIDTH,
        flexShrink: 0,
        transition: "width 0.3s ease",
        "& .MuiDrawer-paper": {
          width: miniSidenav ? 72 : DRAWER_WIDTH,
          boxSizing: "border-box",
          border: "none",
          borderRadius: "0 16px 16px 0",
          boxShadow: "4px 0 24px rgba(15, 23, 42, 0.06)",
          background: "#FDFCFA",
          overflowX: "hidden",
          transition: "width 0.3s ease",
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
}

Sidenav.propTypes = {
  routes: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      icon: PropTypes.string.isRequired,
      route: PropTypes.string.isRequired,
      end: PropTypes.bool,
    })
  ).isRequired,
};

export default Sidenav;
