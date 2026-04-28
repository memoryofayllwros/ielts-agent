import { createTheme } from "@mui/material/styles";

/** Demo-neutral palette: #F8F8F8 surfaces; charcoal primary (replaces former slate / “dark green-grey”). */
const theme = createTheme({
  palette: {
    primary: {
      main: "#404040",
      light: "#6b7280",
      dark: "#2d2d2d",
      contrastText: "#fff",
    },
    secondary: {
      main: "#525252",
      light: "#787878",
      dark: "#3d3d3d",
      contrastText: "#fff",
    },
    info: {
      main: "#404040",
      light: "#6b7280",
      dark: "#2d2d2d",
      contrastText: "#fff",
    },
    success: {
      main: "#16a34a",
      light: "#4ade80",
      dark: "#15803d",
      contrastText: "#fff",
    },
    warning: {
      main: "#D97706",
      light: "#FBBF24",
      dark: "#B45309",
      contrastText: "#fff",
    },
    error: {
      main: "#DC2626",
      light: "#F87171",
      dark: "#B91C1C",
      contrastText: "#fff",
    },
    background: {
      default: "#F8F8F8",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#1E293B",
      secondary: "#64748B",
    },
    divider: "rgba(15, 23, 42, 0.08)",
  },
  typography: {
    fontFamily: '"Source Sans 3", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h1: { fontSize: "2.5rem", fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.02em" },
    h2: { fontSize: "2rem", fontWeight: 700, lineHeight: 1.25, letterSpacing: "-0.015em" },
    h3: { fontSize: "1.5rem", fontWeight: 700, lineHeight: 1.3 },
    h4: { fontSize: "1.25rem", fontWeight: 700, lineHeight: 1.35 },
    h5: { fontSize: "1.125rem", fontWeight: 600, lineHeight: 1.4 },
    h6: { fontSize: "1rem", fontWeight: 600, lineHeight: 1.5 },
    body1: { fontSize: "1rem", fontWeight: 400, lineHeight: 1.7 },
    body2: { fontSize: "0.875rem", fontWeight: 400, lineHeight: 1.65 },
    button: { fontSize: "0.875rem", fontWeight: 600, textTransform: "none", letterSpacing: "0.01em" },
    caption: { fontSize: "0.75rem", lineHeight: 1.5 },
    overline: { fontWeight: 700, letterSpacing: "0.08em" },
  },
  shape: {
    borderRadius: 10,
  },
  shadows: [
    "none",
    "0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)",
    "0 2px 4px rgba(15, 23, 42, 0.06), 0 2px 8px rgba(15, 23, 42, 0.04)",
    "0 4px 8px rgba(15, 23, 42, 0.06), 0 2px 6px rgba(15, 23, 42, 0.04)",
    "0 6px 12px rgba(15, 23, 42, 0.07), 0 2px 8px rgba(15, 23, 42, 0.05)",
    "0 8px 16px rgba(15, 23, 42, 0.08), 0 3px 10px rgba(15, 23, 42, 0.05)",
    "0 10px 20px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(15, 23, 42, 0.05)",
    "0 12px 24px rgba(15, 23, 42, 0.09), 0 4px 14px rgba(15, 23, 42, 0.06)",
    "0 14px 28px rgba(15, 23, 42, 0.09), 0 5px 16px rgba(15, 23, 42, 0.06)",
    "0 16px 32px rgba(15, 23, 42, 0.1), 0 6px 18px rgba(15, 23, 42, 0.07)",
    "0 18px 36px rgba(15, 23, 42, 0.1), 0 7px 20px rgba(15, 23, 42, 0.07)",
    "0 20px 40px rgba(15, 23, 42, 0.11), 0 8px 22px rgba(15, 23, 42, 0.08)",
    "0 22px 44px rgba(15, 23, 42, 0.11), 0 9px 24px rgba(15, 23, 42, 0.08)",
    "0 24px 48px rgba(15, 23, 42, 0.12), 0 10px 26px rgba(15, 23, 42, 0.08)",
    "0 26px 52px rgba(15, 23, 42, 0.12), 0 11px 28px rgba(15, 23, 42, 0.09)",
    "0 28px 56px rgba(15, 23, 42, 0.13), 0 12px 30px rgba(15, 23, 42, 0.09)",
    "0 30px 60px rgba(15, 23, 42, 0.13), 0 13px 32px rgba(15, 23, 42, 0.1)",
    "0 32px 64px rgba(15, 23, 42, 0.14), 0 14px 34px rgba(15, 23, 42, 0.1)",
    "0 34px 68px rgba(15, 23, 42, 0.14), 0 15px 36px rgba(15, 23, 42, 0.1)",
    "0 36px 72px rgba(15, 23, 42, 0.15), 0 16px 38px rgba(15, 23, 42, 0.11)",
    "0 38px 76px rgba(15, 23, 42, 0.15), 0 17px 40px rgba(15, 23, 42, 0.11)",
    "0 40px 80px rgba(15, 23, 42, 0.16), 0 18px 42px rgba(15, 23, 42, 0.12)",
    "0 42px 84px rgba(15, 23, 42, 0.16), 0 19px 44px rgba(15, 23, 42, 0.12)",
    "0 44px 88px rgba(15, 23, 42, 0.17), 0 20px 46px rgba(15, 23, 42, 0.12)",
    "0 46px 92px rgba(15, 23, 42, 0.17), 0 21px 48px rgba(15, 23, 42, 0.13)",
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: "#F8F8F8",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06), 0 4px 14px rgba(15, 23, 42, 0.04)",
          border: "1px solid rgba(15, 23, 42, 0.06)",
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 10,
          textTransform: "none",
          fontWeight: 600,
          fontSize: "0.875rem",
        },
        containedPrimary: {
          boxShadow: "none",
          "&:hover": {
            boxShadow: "0 4px 14px rgba(15, 23, 42, 0.12)",
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
        },
      },
    },
  },
});

export default theme;
