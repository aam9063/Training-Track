import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';
import Pricing from '../components/landing/Pricing';
import useSEO from '../hooks/useSEO';

export default function PricingPage() {
  const [searchParams] = useSearchParams();
  const initialAudience = searchParams.get('audience') || 'coach';
  const [audience, setAudience] = useState(initialAudience);

  useSEO({
    title: 'Precios — TrainingTrack',
    description: 'Planes y precios de TrainingTrack. Prueba gratuita de 14 días. Desde 0€ hasta planes profesionales.',
    path: '/pricing',
  });

  return (
    <div className="min-h-screen bg-white dark:bg-coach-base">
      <Navbar />
      <div className="pt-20">
        <Pricing audience={audience} onAudienceChange={setAudience} />
      </div>
      <Footer />
    </div>
  );
}
