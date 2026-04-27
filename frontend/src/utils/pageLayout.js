/**
 * Shared dashboard page shells: predictable width, bottom scroll padding, and loading regions.
 * Spacing uses the MUI 8px step (1 unit = 8px).
 * @see .agents/skills/impeccable/reference/layout.md
 */
export const dashboardPage = {
  root: {
    width: "100%",
    minWidth: 0,
    pb: { xs: 4, sm: 5 },
  },
  content: {
    width: "100%",
    minWidth: 0,
  },
  loading: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: { xs: 220, sm: "min(42vh, 400px)" },
    py: 5,
    px: 1,
  },
  loadingPadded: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: { xs: 200, sm: "min(38vh, 360px)" },
    py: 4,
    px: 1,
  },
  /**
   * Primary column + right rail, full width of dashboard main (sidenav is offset by `MainContent` in DashboardLayout).
   * Tweak `gridTemplateColumns` per page if a different breakpoint (e.g. `lg`) is preferred.
   */
  splitMainAside: {
    display: "grid",
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    alignItems: "start",
    gap: { xs: 2.5, md: 3 },
    gridTemplateColumns: {
      xs: "1fr",
      md: "minmax(0, 1fr) minmax(280px, min(36vw, 440px))",
    },
  },
  /** Same intent as `splitMainAside` but two columns only from `lg` (wider main before the split). */
  splitMainAsideLg: {
    display: "grid",
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    alignItems: "start",
    gap: { xs: 2.5, sm: 3, lg: 3 },
    gridTemplateColumns: {
      xs: "1fr",
      lg: "minmax(0, 1fr) minmax(300px, min(32vw, 440px))",
    },
  },
};
