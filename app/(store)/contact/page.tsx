import { PageHero, GradientTitle } from '@/components/site/PageHero';
import { ContactForm } from '@/components/site/ContactForm';

export const metadata = { title: 'Contact Us' };

export default function Contact() {
  return (
    <>
      <PageHero title="Contact Us" />
      <section className="mx-auto max-w-[560px] px-4 py-10">
        <GradientTitle first="Submit Your" rest="Research Inquiry" className="text-center text-3xl" />
        <ContactForm />
      </section>
    </>
  );
}
