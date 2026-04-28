import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import Fab from "@mui/material/Fab";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Slide from "@mui/material/Slide";
import Zoom from "@mui/material/Zoom";
import Stack from "@mui/material/Stack";
import CircularProgress from "@mui/material/CircularProgress";
import ChatRoundedIcon from "@mui/icons-material/ChatRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import { alpha } from "@mui/material/styles";

import { useAuth } from "context/AuthContext";
import { sendAssistantChat } from "services/api";

export default function AiChatWidget() {
  const { pathname } = useLocation();
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  const showWidget = isAuthenticated && pathname !== "/login";

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, open]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const history = [...messages, { role: "user", content: text }];
    setMessages(history);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const { message } = await sendAssistantChat(history);
      setMessages([...history, { role: "assistant", content: message }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  if (!showWidget) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        right: { xs: 16, sm: 24 },
        bottom: { xs: 16, sm: 24 },
        zIndex: (theme) => theme.zIndex.drawer + 10,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 2,
        pointerEvents: "none",
        "& > *": { pointerEvents: "auto" },
      }}
    >
      <Slide direction="up" in={open} mountOnEnter unmountOnExit>
        <Paper
          elevation={0}
          sx={{
            position: "fixed",
            top: { xs: "max(12px, env(safe-area-inset-top, 0px))", sm: 24 },
            bottom: { xs: "max(12px, env(safe-area-inset-bottom, 0px))", sm: 24 },
            right: { xs: 16, sm: 24 },
            width: { xs: "calc(100vw - 32px)", sm: 400 },
            maxWidth: { xs: "calc(100vw - 32px)", sm: 440 },
            display: "flex",
            flexDirection: "column",
            borderRadius: "14px",
            overflow: "hidden",
            border: "1px solid rgba(15, 23, 42, 0.08)",
            boxShadow:
              "0 8px 24px rgba(15, 23, 42, 0.1), 0 2px 8px rgba(15, 23, 42, 0.06)",
            bgcolor: "background.paper",
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1.75,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
              background: "#F8F8F8",
              color: "text.primary",
              borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
              boxShadow: "none",
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                IELTS coach
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 500 }}>
                Ask about skills, strategy, or this app
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              sx={{
                color: "text.primary",
                bgcolor: "rgba(15, 23, 42, 0.06)",
                "&:hover": { bgcolor: "rgba(15, 23, 42, 0.1)" },
              }}
            >
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Box>

          <Box
            ref={scrollRef}
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              px: 2,
              py: 2,
              bgcolor: alpha("#404040", 0.03),
              backgroundImage:
                "radial-gradient(circle at 20% 10%, rgba(15, 23, 42, 0.04) 0%, transparent 45%)",
            }}
          >
            {messages.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>
                Hi — I&apos;m here to help with IELTS prep: task types, timing, band descriptors,
                study plans, or anything in Band Booster. What would you like to work on?
              </Typography>
            )}

            <Stack spacing={1.5}>
              {messages.map((m, i) => (
                <Box
                  key={`${m.role}-${i}`}
                  sx={{
                    display: "flex",
                    justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  <Box
                    sx={{
                      maxWidth: "88%",
                      px: 1.5,
                      py: 1,
                      borderRadius: 2,
                      ...(m.role === "user"
                        ? {
                            background: "#F8F8F8",
                            color: "text.primary",
                            border: "1px solid rgba(15, 23, 42, 0.1)",
                            boxShadow: "0 2px 8px rgba(15, 23, 42, 0.06)",
                          }
                        : {
                            bgcolor: "background.paper",
                            border: "1px solid rgba(15, 23, 42, 0.08)",
                            boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)",
                          }),
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        lineHeight: 1.65,
                        color: "text.primary",
                      }}
                    >
                      {m.content}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Stack>

            {loading && (
              <Box sx={{ display: "flex", justifyContent: "flex-start", mt: 1.5, pl: 0.5 }}>
                <CircularProgress size={22} thickness={5} sx={{ color: "primary.main" }} />
              </Box>
            )}

            {error && (
              <Typography variant="caption" color="error" sx={{ display: "block", mt: 2 }}>
                {error}
              </Typography>
            )}
          </Box>

          <Box
            sx={{
              p: 2,
              pt: 1.5,
              borderTop: "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper",
            }}
          >
            <Stack direction="row" spacing={1} alignItems="flex-end">
              <TextField
                fullWidth
                multiline
                maxRows={4}
                size="small"
                placeholder="Message…"
                value={input}
                disabled={loading}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    bgcolor: alpha("#64748B", 0.06),
                  },
                }}
              />
              <IconButton
                color="primary"
                onClick={handleSend}
                disabled={loading || !input.trim()}
                aria-label="Send message"
                sx={{
                  mb: 0.25,
                  bgcolor: alpha("#404040", 0.12),
                  "&:hover": { bgcolor: alpha("#404040", 0.2) },
                  "&.Mui-disabled": { bgcolor: alpha("#64748B", 0.08) },
                }}
              >
                <SendRoundedIcon />
              </IconButton>
            </Stack>
          </Box>
        </Paper>
      </Slide>

      <Zoom in={!open} unmountOnExit>
        <Fab
          color="primary"
          aria-label="Open IELTS coach chat"
          onClick={() => {
            setOpen(true);
            setError(null);
          }}
          sx={{
            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.15)",
            "&:hover": {
              boxShadow: "0 10px 28px rgba(15, 23, 42, 0.18)",
            },
          }}
        >
          <ChatRoundedIcon />
        </Fab>
      </Zoom>
    </Box>
  );
}
