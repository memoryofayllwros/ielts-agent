import { useSearchParams } from "react-router-dom";
import ObjectivePracticePage from "pages/ObjectivePracticePage";

export default function ListeningPracticePage() {
  const [sp] = useSearchParams();
  const useAdaptive = sp.get("adaptive") === "1";
  const focusSkill = sp.get("focus") || sp.get("focus_skill") || null;
  return (
    <ObjectivePracticePage
      skill="listening"
      useAdaptive={useAdaptive}
      focusSkill={focusSkill}
      navbarTitle="Listening"
      contentLabel="Audio"
      intro="Use the audio controls to listen — the full script stays hidden during the test. Then answer the questions. Items are micro-skill tagged for analytics."
      loadingBlurb="Generating listening task and questions…"
    />
  );
}
