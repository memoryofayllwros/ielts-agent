import Box from "@mui/material/Box";
import PropTypes from "prop-types";
import { useMaterialUIController } from "context";

const DRAWER_WIDTH = 250;
const MINI_DRAWER_WIDTH = 72;

function DashboardLayout({ children }) {
  const [controller] = useMaterialUIController();
  const { miniSidenav } = controller;

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        background: "#F0F2F5",
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

  return (
    <Box
      component="main"
      sx={{
        flexGrow: 1,
        ml: `${miniSidenav ? MINI_DRAWER_WIDTH : DRAWER_WIDTH}px`,
        transition: "margin-left 0.3s ease",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        p: { xs: 2, md: 3 },
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
