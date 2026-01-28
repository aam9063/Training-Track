import Navbar from '../components/landing/Navbar';
import Hero from '../components/landing/Hero';
import About from '../components/landing/About';
import Testimonials from '../components/landing/Testimonials';
import Pricing from '../components/landing/Pricing';
import FAQ from '../components/landing/FAQ';
import FinalCTA from '../components/landing/FinalCTA';
import Footer from '../components/landing/Footer';
import ScrollToTop from '../components/landing/ScrollToTop';

export default function Landing() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Navbar />
      <Hero />
      <About />
      <Testimonials />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
      <ScrollToTop />
    </div>
  );
}
