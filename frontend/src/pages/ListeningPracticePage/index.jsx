import ObjectivePracticePage from "pages/ObjectivePracticePage";

export default function ListeningPracticePage() {
  return (
    <ObjectivePracticePage
      skill="listening"
      navbarTitle="Listening"
      contentLabel="Listening script"
      intro="Listen using browser text-to-speech or optional server voice (OpenRouter), then answer questions on what you heard."
      loadingBlurb="Generating listening script and questions…"
    />
  );
}
