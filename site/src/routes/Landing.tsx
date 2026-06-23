import '../styles/landing.css';
import { useReveal } from '../components/landing/useReveal';
import { Nav } from '../components/landing/Nav';
import { Hero } from '../components/landing/Hero';
import { SpeaksStrip } from '../components/landing/SpeaksStrip';
import { Problem } from '../components/landing/Problem';
import { HowItWorks } from '../components/landing/HowItWorks';
import { Features } from '../components/landing/Features';
import { Manifesto } from '../components/landing/Manifesto';
import { Pricing } from '../components/landing/Pricing';
import { Faq } from '../components/landing/Faq';
import { FinalCta } from '../components/landing/FinalCta';
import { Footer } from '../components/landing/Footer';

export function Landing() {
  useReveal();
  return (
    <div className="landing">
      <Nav />
      <div className="nav-sentinel" aria-hidden="true" />
      <Hero />
      <SpeaksStrip />
      <Problem />
      <HowItWorks />
      <Features />
      <Manifesto />
      <Pricing />
      <Faq />
      <FinalCta />
      <Footer />
    </div>
  );
}
