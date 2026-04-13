import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: {
      main: "#1A73E8",
      light: "#4A90D9",
      dark: "#1558B0",
      contrastText: "#fff",
    },
    secondary: {
      main: "#7B809A",
      light: "#9899AD",
      dark: "#5C6070",
      contrastText: "#fff",
    },
    info: {
      main: "#1A73E8",
      light: "#4A90D9",
      dark: "#0D47A1",
      contrastText: "#fff",
    },
    success: {
      main: "#4CAF50",
      light: "#81C784",
      dark: "#388E3C",
      contrastText: "#fff",
    },
    warning: {
      main: "#FB8C00",
      light: "#FFB74D",
      dark: "#E65100",
      contrastText: "#fff",
    },
    error: {
      main: "#F44335",
      light: "#EF5350",
      dark: "#D32F2F",
      contrastText: "#fff",
    },
    background: {
      default: "#F0F2F5",
      paper: "#fff",
    },
    text: {
      primary: "#344767",
      secondary: "#7B809A",
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontSize: "3rem", fontWeight: 700, lineHeight: 1.25 },
    h2: { fontSize: "2.25rem", fontWeight: 700, lineHeight: 1.3 },
    h3: { fontSize: "1.875rem", fontWeight: 700, lineHeight: 1.375 },
    h4: { fontSize: "1.5rem", fontWeight: 700, lineHeight: 1.375 },
    h5: { fontSize: "1.25rem", fontWeight: 600, lineHeight: 1.375 },
    h6: { fontSize: "1rem", fontWeight: 600, lineHeight: 1.625 },
    body1: { fontSize: "1rem", fontWeight: 400, lineHeight: 1.625 },
    body2: { fontSize: "0.875rem", fontWeight: 400, lineHeight: 1.6 },
    button: { fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase" },
  },
  shape: {
    borderRadius: 8,
  },
  shadows: [
    "none",
    "0 2px 1px -1px rgba(0,0,0,0.1), 0 1px 1px 0 rgba(0,0,0,0.07), 0 1px 3px 0 rgba(0,0,0,0.06)",
    "0 3px 1px -2px rgba(0,0,0,0.1), 0 2px 2px 0 rgba(0,0,0,0.07), 0 1px 5px 0 rgba(0,0,0,0.06)",
    "0 3px 3px -2px rgba(0,0,0,0.1), 0 3px 4px 0 rgba(0,0,0,0.07), 0 1px 8px 0 rgba(0,0,0,0.06)",
    "0 2px 4px -1px rgba(0,0,0,0.1), 0 4px 5px 0 rgba(0,0,0,0.07), 0 1px 10px 0 rgba(0,0,0,0.06)",
    "0 3px 5px -1px rgba(0,0,0,0.1), 0 5px 8px 0 rgba(0,0,0,0.07), 0 1px 14px 0 rgba(0,0,0,0.06)",
    "0 3px 5px -1px rgba(0,0,0,0.1), 0 6px 10px 0 rgba(0,0,0,0.07), 0 1px 18px 0 rgba(0,0,0,0.06)",
    "0 4px 5px -2px rgba(0,0,0,0.1), 0 7px 10px 1px rgba(0,0,0,0.07), 0 2px 16px 1px rgba(0,0,0,0.06)",
    "0 5px 5px -3px rgba(0,0,0,0.1), 0 8px 10px 1px rgba(0,0,0,0.07), 0 3px 14px 2px rgba(0,0,0,0.06)",
    "0 5px 6px -3px rgba(0,0,0,0.1), 0 9px 12px 1px rgba(0,0,0,0.07), 0 3px 16px 2px rgba(0,0,0,0.06)",
    "0 6px 6px -3px rgba(0,0,0,0.1), 0 10px 14px 1px rgba(0,0,0,0.07), 0 4px 18px 3px rgba(0,0,0,0.06)",
    "0 6px 7px -4px rgba(0,0,0,0.1), 0 11px 15px 1px rgba(0,0,0,0.07), 0 4px 20px 3px rgba(0,0,0,0.06)",
    "0 7px 8px -4px rgba(0,0,0,0.1), 0 12px 17px 2px rgba(0,0,0,0.07), 0 5px 22px 4px rgba(0,0,0,0.06)",
    "0 7px 8px -4px rgba(0,0,0,0.1), 0 13px 19px 2px rgba(0,0,0,0.07), 0 5px 24px 4px rgba(0,0,0,0.06)",
    "0 7px 9px -4px rgba(0,0,0,0.1), 0 14px 21px 2px rgba(0,0,0,0.07), 0 5px 26px 4px rgba(0,0,0,0.06)",
    "0 8px 9px -5px rgba(0,0,0,0.1), 0 15px 22px 2px rgba(0,0,0,0.07), 0 6px 28px 5px rgba(0,0,0,0.06)",
    "0 8px 10px -5px rgba(0,0,0,0.1), 0 16px 24px 2px rgba(0,0,0,0.07), 0 6px 30px 5px rgba(0,0,0,0.06)",
    "0 8px 11px -5px rgba(0,0,0,0.1), 0 17px 26px 2px rgba(0,0,0,0.07), 0 6px 32px 5px rgba(0,0,0,0.06)",
    "0 9px 11px -5px rgba(0,0,0,0.1), 0 18px 28px 2px rgba(0,0,0,0.07), 0 7px 34px 6px rgba(0,0,0,0.06)",
    "0 9px 12px -6px rgba(0,0,0,0.1), 0 19px 29px 2px rgba(0,0,0,0.07), 0 7px 36px 6px rgba(0,0,0,0.06)",
    "0 10px 13px -6px rgba(0,0,0,0.1), 0 20px 31px 3px rgba(0,0,0,0.07), 0 8px 38px 7px rgba(0,0,0,0.06)",
    "0 10px 13px -6px rgba(0,0,0,0.1), 0 21px 33px 3px rgba(0,0,0,0.07), 0 8px 40px 7px rgba(0,0,0,0.06)",
    "0 10px 14px -6px rgba(0,0,0,0.1), 0 22px 35px 3px rgba(0,0,0,0.07), 0 8px 42px 7px rgba(0,0,0,0.06)",
    "0 11px 14px -7px rgba(0,0,0,0.1), 0 23px 36px 3px rgba(0,0,0,0.07), 0 9px 44px 8px rgba(0,0,0,0.06)",
    "0 11px 15px -7px rgba(0,0,0,0.1), 0 24px 38px 3px rgba(0,0,0,0.07), 0 9px 46px 8px rgba(0,0,0,0.06)",
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: "#F0F2F5",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: "16px",
          boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: "8px",
          textTransform: "uppercase",
          fontWeight: 700,
          fontSize: "0.75rem",
        },
        containedPrimary: {
          boxShadow: "0 4px 7px -1px rgba(26,115,232,0.4)",
          "&:hover": {
            boxShadow: "0 4px 7px -1px rgba(26,115,232,0.55)",
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: "8px",
        },
      },
    },
  },
});

export default theme;
