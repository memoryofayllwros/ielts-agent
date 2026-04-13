import ObjectivePracticePage from "pages/ObjectivePracticePage";

export default function ReadingPracticePage() {
  return (
    <ObjectivePracticePage
      skill="reading"
      navbarTitle="Reading"
      contentLabel="Reading passage"
      intro="AI generates an academic passage with IELTS-style questions (gaps and multiple choice)."
      loadingBlurb="Generating passage and questions…"
    />
  );
}
