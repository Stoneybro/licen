import Navigation from '@/components/home/Navigation';
import Hero from '@/components/home/Hero';
import Problem from '@/components/home/Problem';
import Features from '@/components/home/Features';
import HowItWorks from '@/components/home/HowItWorks';
import UseCases from '@/components/home/UseCases';
import Technology from '@/components/home/Technology';
import FinalCTA from '@/components/home/FinalCTA';
import Footer from '@/components/home/Footer';

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-x-clip bg-background text-foreground antialiased dark">
      <Navigation />
      <Hero />
      <Problem />
      <HowItWorks />
      <UseCases />
      <Features />
      <Technology />
      <FinalCTA />
      <Footer />
    </main>
  );
}