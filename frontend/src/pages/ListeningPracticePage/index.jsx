import ObjectivePracticePage from "pages/ObjectivePracticePage";

export default function ListeningPracticePage() {
  return (
    <ObjectivePracticePage
      skill="listening"
      navbarTitle="Listening"
      contentLabel="Audio"
      intro="Use the audio controls to listen — the full script stays hidden during the test. Then answer the questions."
      loadingBlurb="Generating listening task and questions…"
    />
  );
}
