import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import useSEO from '../hooks/useSEO';
import Navbar from '../components/landing/Navbar';
import Hero from '../components/landing/Hero';
import AppShowcase from '../components/landing/AppShowcase';
import MobileShowcase from '../components/landing/MobileShowcase';
import About from '../components/landing/About';
import AIReports from '../components/landing/AIReports';
import AITrainingSection from '../components/landing/AITrainingSection';
import Testimonials from '../components/landing/Testimonials';
import Pricing from '../components/landing/Pricing';
import FAQ from '../components/landing/FAQ';
import BlogPreview from '../components/landing/BlogPreview';
import FinalCTA from '../components/landing/FinalCTA';
import Footer from '../components/landing/Footer';
import ScrollToTop from '../components/landing/ScrollToTop';
import PromoBanner from '../components/landing/PromoBanner';
import CookieConsent from '../components/landing/CookieConsent';

export default function Landing() {
  const location = useLocation();
  const [audience, setAudience] = useState('coach');

  useSEO({
    title: 'Plataforma de entrenamiento de running y atletismo con IA',
    description: 'Plataforma para entrenadores de running y atletismo. Planifica entrenamientos, controla la carga con ACWR y TSB, sincroniza Strava, genera informes IA semanales y comunícate con tus atletas. Desde 800m hasta maratón. Gratis durante la beta.',
    path: '/',
  });

  useEffect(() => {
    if (location.hash) {
      setTimeout(() => {
        const element = document.querySelector(location.hash);
        if (element) element.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [location.hash]);

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A]">
      <Navbar />
      <Hero audience={audience} onSelectAudience={setAudience} />
      <AppShowcase />
      <MobileShowcase />
      <About />
      <AIReports />
      <AITrainingSection />
      <Testimonials />
      <Pricing audience={audience} onAudienceChange={setAudience} />
      <FAQ />
      <BlogPreview />
      <FinalCTA audience={audience} />
      <Footer />
      <ScrollToTop />
      <PromoBanner />
      <CookieConsent />
    </div>
  );
}
