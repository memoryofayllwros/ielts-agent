import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import FormGroup from "@mui/material/FormGroup";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";

export function optionKey(opt) {
  return opt.match(/^([A-E])\./)?.[1] || opt[0];
}

export function FillInBlanksQuestion({ question, answers, onAnswer, submitted, result }) {
  const blanks = (question.passage_with_blanks?.match(/\[BLANK_\d+\]/g) || []);
  const wordBank = question.word_bank || [];
  const parts = question.passage_with_blanks?.split(/(\[BLANK_\d+\])/) || [];
  const ansList = Array.isArray(answers) ? answers : [];

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
        Fill in the Blanks
      </Typography>
      <Typography variant="body1" sx={{ lineHeight: 2.2, color: "#344767" }} component="div">
        {parts.map((part, i) => {
          const match = part.match(/\[BLANK_(\d+)\]/);
          if (match) {
            const idx = parseInt(match[1], 10) - 1;
            const userVal = ansList[idx] || "";
            const isCorrect = result?.correct_answers[idx]?.toLowerCase() === userVal.toLowerCase();
            const correctVal = result?.correct_answers[idx];
            return (
              <Box key={i} component="span" sx={{ display: "inline-block", mx: 0.5, verticalAlign: "middle" }}>
                {submitted ? (
                  <Box
                    component="span"
                    sx={{
                      px: 1.5,
                      py: 0.25,
                      borderRadius: "6px",
                      background: isCorrect ? "#e8f5e9" : "#ffebee",
                      color: isCorrect ? "#2e7d32" : "#c62828",
                      fontWeight: 600,
                      border: `1px solid ${isCorrect ? "#a5d6a7" : "#ef9a9a"}`,
                    }}
                  >
                    {userVal || <em style={{ opacity: 0.5 }}>empty</em>}
                    {!isCorrect && (
                      <Typography component="span" variant="caption" sx={{ ml: 0.75, color: "#2e7d32", fontWeight: 500 }}>
                        → {correctVal}
                      </Typography>
                    )}
                  </Box>
                ) : (
                  <FormControl size="small" sx={{ minWidth: 130 }}>
                    <Select
                      value={userVal}
                      onChange={(e) => {
                        const base = ansList.length ? [...ansList] : Array(blanks.length).fill("");
                        const newAnswers = [...base];
                        while (newAnswers.length < blanks.length) newAnswers.push("");
                        newAnswers[idx] = e.target.value;
                        onAnswer(newAnswers);
                      }}
                      displayEmpty
                      sx={{ borderRadius: "8px", fontSize: "0.875rem" }}
                    >
                      <MenuItem value=""><em>Select word</em></MenuItem>
                      {wordBank.map((w) => (
                        <MenuItem key={w} value={w}>{w}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </Box>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </Typography>
      {!submitted && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            Word Bank:
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 0.75 }}>
            {wordBank.map((w) => (
              <Chip key={w} label={w} size="small" variant="outlined" sx={{ borderRadius: "6px" }} />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}

export function McSingleQuestion({ question, answers, onAnswer, submitted, result }) {
  const userAns = answers?.[0] || "";
  const correctAns = result?.correct_answers?.[0] || "";
  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
        Multiple Choice — Single Answer
      </Typography>
      <Typography variant="body1" sx={{ mb: 2, color: "#344767", fontWeight: 500 }}>
        {question.question}
      </Typography>
      <RadioGroup value={userAns} onChange={(e) => !submitted && onAnswer([e.target.value])}>
        {(question.options || []).map((opt) => {
          const key = optionKey(opt);
          const isCorrect = correctAns === key;
          const isSelected = userAns === key;
          let bgColor = "transparent";
          if (submitted) {
            if (isCorrect) bgColor = "#e8f5e9";
            else if (isSelected && !isCorrect) bgColor = "#ffebee";
          }
          return (
            <FormControlLabel
              key={opt}
              value={key}
              control={<Radio size="small" disabled={submitted} />}
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <span>{opt}</span>
                  {submitted && isCorrect && <CheckCircleIcon sx={{ color: "#4CAF50", fontSize: "1rem" }} />}
                  {submitted && isSelected && !isCorrect && <CancelIcon sx={{ color: "#F44335", fontSize: "1rem" }} />}
                </Box>
              }
              sx={{ borderRadius: "8px", px: 1, py: 0.25, mb: 0.5, background: bgColor, transition: "background 0.2s" }}
            />
          );
        })}
      </RadioGroup>
    </Box>
  );
}

export function McMultipleQuestion({ question, answers, onAnswer, submitted, result }) {
  const userSet = new Set(answers || []);
  const correctSet = new Set(result?.correct_answers || []);
  const toggle = (k) => {
    if (submitted) return;
    const next = new Set(userSet);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    onAnswer([...next]);
  };
  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
        Multiple Choice — Multiple Answers
      </Typography>
      <Typography variant="body1" sx={{ mb: 2, color: "#344767", fontWeight: 500 }}>
        {question.question}
      </Typography>
      <FormGroup>
        {(question.options || []).map((opt) => {
          const key = optionKey(opt);
          const isCorrect = correctSet.has(key);
          const isSelected = userSet.has(key);
          let bgColor = "transparent";
          if (submitted) {
            if (isCorrect) bgColor = "#e8f5e9";
            else if (isSelected && !isCorrect) bgColor = "#ffebee";
          }
          return (
            <FormControlLabel
              key={opt}
              control={<Checkbox size="small" checked={isSelected} onChange={() => toggle(key)} disabled={submitted} />}
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <span>{opt}</span>
                  {submitted && isCorrect && <CheckCircleIcon sx={{ color: "#4CAF50", fontSize: "1rem" }} />}
                  {submitted && isSelected && !isCorrect && <CancelIcon sx={{ color: "#F44335", fontSize: "1rem" }} />}
                </Box>
              }
              sx={{ borderRadius: "8px", px: 1, py: 0.25, mb: 0.5, background: bgColor, transition: "background 0.2s" }}
            />
          );
        })}
      </FormGroup>
    </Box>
  );
}

const KNOWN_TYPES = new Set(["fill_in_blanks", "mc_single", "mc_multiple"]);

export function QuestionCard({ question, index, answers, onAnswer, submitted, result }) {
  const known = KNOWN_TYPES.has(question?.type);
  return (
    <Card sx={{ mb: 2, borderRadius: "16px" }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: "block" }}>
          Question {index + 1}
        </Typography>
        {question.type === "fill_in_blanks" && (
          <FillInBlanksQuestion question={question} answers={answers} onAnswer={onAnswer} submitted={submitted} result={result} />
        )}
        {question.type === "mc_single" && (
          <McSingleQuestion question={question} answers={answers} onAnswer={onAnswer} submitted={submitted} result={result} />
        )}
        {question.type === "mc_multiple" && (
          <McMultipleQuestion question={question} answers={answers} onAnswer={onAnswer} submitted={submitted} result={result} />
        )}
        {!known && (
          <Box sx={{ py: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              This question uses an unsupported format ({String(question?.type || "unknown")}). Start a new session or update the app.
            </Typography>
            {question?.question && (
              <Typography variant="body2" sx={{ color: "#344767" }}>{question.question}</Typography>
            )}
          </Box>
        )}
        {submitted && result?.explanation && (
          <Box sx={{ mt: 2, p: 2, background: "#f8f9fa", borderRadius: "10px", borderLeft: "3px solid #1A73E8" }}>
            <Typography variant="caption" color="primary" fontWeight={700} display="block" sx={{ mb: 0.5 }}>
              Explanation
            </Typography>
            <Typography variant="body2" color="text.secondary">{result.explanation}</Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export function ScoreCircle({ percentage }) {
  const color = percentage >= 70 ? "#4CAF50" : percentage >= 40 ? "#FB8C00" : "#F44335";
  return (
    <Box
      sx={{
        width: 100,
        height: 100,
        borderRadius: "50%",
        border: `6px solid ${color}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Typography variant="h5" fontWeight={700} sx={{ color, lineHeight: 1 }}>{percentage}%</Typography>
      <Typography variant="caption" color="text.secondary">Score</Typography>
    </Box>
  );
}
