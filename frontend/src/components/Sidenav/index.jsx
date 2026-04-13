import { useEffect } from "react";
import { useLocation, NavLink } from "react-router-dom";
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
      {/* Brand */}
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
            width: 36,
            height: 36,
            borderRadius: "10px",
            background: "linear-gradient(195deg, #42424a, #191919)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.2rem",
          }}
        >
          📖
        </Box>
        {!miniSidenav && (
          <Typography
            variant="h6"
            sx={{ fontWeight: 700, color: "#344767", lineHeight: 1.2 }}
          >
            IELTS Reading
            <Typography
              component="span"
              variant="caption"
              display="block"
              sx={{ color: "#7B809A", fontWeight: 400 }}
            >
              Practice
            </Typography>
          </Typography>
        )}
      </Box>

      <Divider sx={{ mb: 1 }} />

      {/* Nav items */}
      <List sx={{ flex: 1, px: 1 }}>
        {routes.map((route) => {
          const isActive = pathname === route.route || pathname.startsWith(route.route + "/");
          return (
            <ListItem key={route.key} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={NavLink}
                to={route.route}
                sx={{
                  borderRadius: "8px",
                  px: 2,
                  py: 1,
                  minHeight: 44,
                  background: isActive
                    ? "linear-gradient(195deg, #42424a, #191919)"
                    : "transparent",
                  "&:hover": {
                    background: isActive
                      ? "linear-gradient(195deg, #42424a, #191919)"
                      : "rgba(0,0,0,0.04)",
                  },
                  transition: "background 0.2s",
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: miniSidenav ? 0 : 36,
                    color: isActive ? "#fff" : "#7B809A",
                    justifyContent: "center",
                  }}
                >
                  <Icon fontSize="small">{route.icon}</Icon>
                </ListItemIcon>
                {!miniSidenav && (
                  <ListItemText
                    primary={route.name}
                    primaryTypographyProps={{
                      fontSize: "0.875rem",
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? "#fff" : "#344767",
                    }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
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
          boxShadow: "0 20px 27px 0 rgba(0,0,0,0.05)",
          background: "#fff",
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
    })
  ).isRequired,
};

export default Sidenav;
