export const metadata = { title: 'Privacy Policy' };

export default function Privacy() {
  return (
    <section className="mx-auto max-w-[1140px] space-y-4 px-4 py-10 text-sm leading-relaxed text-white/85">
      <h1 className="font-head text-3xl font-extrabold">Privacy Policy</h1>
      <p className="rounded-lg border border-yellow-400/40 bg-yellow-400/10 p-3 text-xs text-yellow-100">
        Template — have the client&apos;s counsel review and complete this page before launch.
      </p>
      <h2 className="font-bold text-cyan-text">What we collect</h2>
      <p>
        Researcher verification confirmations (with a timestamp), cart contents, and the contact details you choose to give us (name, email, institution, shipping address, and your WhatsApp number only if you agree to be contacted there).
      </p>
      <h2 className="font-bold text-cyan-text">Voice assistant</h2>
      <p>
        When you start the assistant, your microphone audio is streamed to Google&apos;s Gemini API to generate spoken replies. We store the text transcript of the conversation and a short summary to improve service and follow up on quotes. We do not store audio recordings. The assistant does not ask for, and we do not collect, age, gender or health information. You can close a session at any time.
      </p>
      <h2 className="font-bold text-cyan-text">How we use it</h2>
      <p>To answer research inquiries, prepare quotes, process order requests, and aggregate anonymous product analytics. We do not sell personal information.</p>
      <h2 className="font-bold text-cyan-text">Your choices</h2>
      <p>Contact us to access or delete your data, or to withdraw WhatsApp consent.</p>
    </section>
  );
}
