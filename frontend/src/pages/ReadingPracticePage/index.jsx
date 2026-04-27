import { useSearchParams } from "react-router-dom";
import ObjectivePracticePage from "pages/ObjectivePracticePage";

export default function ReadingPracticePage() {
  const [sp] = useSearchParams();
  const useAdaptive = sp.get("adaptive") === "1";
  const focusSkill = sp.get("focus") || sp.get("focus_skill") || null;
  return (
    <ObjectivePracticePage
      skill="reading"
      useAdaptive={useAdaptive}
      focusSkill={focusSkill}
      navbarTitle="Reading"
      contentLabel="Reading passage"
      intro="AI generates an academic passage with IELTS-style questions (gaps and multiple choice). Each item is tagged with a micro-skill for your skill map and adaptive next steps."
      loadingBlurb="Generating passage and questions…"
    />
  );
}
