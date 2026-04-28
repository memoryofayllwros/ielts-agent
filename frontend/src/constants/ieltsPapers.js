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
    tint: "#F8F8F8",
    border: "rgba(15, 23, 42, 0.12)",
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
    tint: "#F8F8F8",
    border: "rgba(15, 23, 42, 0.12)",
  },
  {
    key: "writing",
    title: "Writing",
    desc: "Task 1 or 2, rubric-style feedback.",
    practiceRoute: "/practice/writing",
    lessonsRoute: "/lessons/writing",
    Icon: EditNote,
    accent: "primary",
    iconColor: "primary.main",
    tint: "#F8F8F8",
    border: "rgba(15, 23, 42, 0.12)",
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
    tint: "#F8F8F8",
    border: "rgba(15, 23, 42, 0.12)",
  },
];
