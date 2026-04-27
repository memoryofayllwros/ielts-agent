import Box from "@mui/material/Box";
import PropTypes from "prop-types";
import { useMaterialUIController } from "context";

const DRAWER_WIDTH = 250;
const MINI_DRAWER_WIDTH = 72;

function DashboardLayout({ children }) {
  return (
    <Box
      sx={{
        display: "flex",
        width: "100%",
        minWidth: 0,
        minHeight: "100vh",
        background: (t) =>
          `linear-gradient(165deg, ${t.palette.background.default} 0%, #E8EBEF 55%, #E5E1DA 100%)`,
      }}
    >
      {children}
    </Box>
  );
}

DashboardLayout.propTypes = {
  children: PropTypes.node.isRequired,
};

export function MainContent({ children }) {
  const [controller] = useMaterialUIController();
  const { miniSidenav } = controller;
  const drawerW = miniSidenav ? MINI_DRAWER_WIDTH : DRAWER_WIDTH;

  return (
    <Box
      component="main"
      sx={{
        flex: "1 1 auto",
        alignSelf: "stretch",
        ml: `${drawerW}px`,
        width: `calc(100% - ${drawerW}px)`,
        maxWidth: `calc(100% - ${drawerW}px)`,
        minWidth: 0,
        boxSizing: "border-box",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        p: { xs: 2, md: 3 },
        transition: "margin-left 0.3s ease, width 0.3s ease, max-width 0.3s ease",
      }}
    >
      {children}
    </Box>
  );
}

MainContent.propTypes = {
  children: PropTypes.node.isRequired,
};

export default DashboardLayout;
