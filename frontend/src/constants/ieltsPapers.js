import MenuBook from "@mui/icons-material/MenuBook";
import Headphones from "@mui/icons-material/Headphones";
import EditNote from "@mui/icons-material/EditNote";
import Mic from "@mui/icons-material/Mic";

/** Shared IELTS paper tiles for Practice hub and Lessons hub. */
export const IELTS_PAPERS = [
  {
    key: "reading",
    title: "Reading",
    desc: "Passages, gap-fill, multiple choice, exam style.",
    practiceRoute: "/practice/reading",
    lessonsRoute: "/lessons/reading",
    Icon: MenuBook,
    accent: "primary",
    iconColor: "primary.main",
    tint: "rgba(13, 148, 136, 0.08)",
    border: "rgba(13, 148, 136, 0.35)",
  },
  {
    key: "listening",
    title: "Listening",
    desc: "Audio, questions, script when you need it.",
    practiceRoute: "/practice/listening",
    lessonsRoute: "/lessons/listening",
    Icon: Headphones,
    accent: "primary",
    iconColor: "primary.dark",
    tint: "rgba(14, 116, 144, 0.08)",
    border: "rgba(14, 116, 144, 0.35)",
  },
  {
    key: "writing",
    title: "Writing",
    desc: "Task 1 or 2, rubric-style feedback.",
    practiceRoute: "/practice/writing",
    lessonsRoute: "/lessons/writing",
    Icon: EditNote,
    accent: "warning",
    iconColor: "warning.dark",
    tint: "rgba(217, 119, 6, 0.1)",
    border: "rgba(217, 119, 6, 0.4)",
  },
  {
    key: "speaking",
    title: "Speaking",
    desc: "Part 2 cue card, record or dictate.",
    practiceRoute: "/practice/speaking",
    lessonsRoute: "/lessons/speaking",
    Icon: Mic,
    accent: "secondary",
    iconColor: "secondary.main",
    tint: "rgba(100, 116, 139, 0.1)",
    border: "rgba(100, 116, 139, 0.35)",
  },
];
