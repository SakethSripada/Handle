import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import Lenis from 'lenis';
import '@fontsource-variable/manrope';
import './styles.css';
import { Hero, Nav } from './Hero';
import { HowItWorks } from './HowItWorks';
import { Features } from './Features';
import { Finale, Footer, Gallery } from './Sections';

const App: React.FC = () => {
  useEffect(() => {
    const lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), anchors: true });
    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <Gallery />
        <Finale />
      </main>
      <Footer />
    </>
  );
};

createRoot(document.getElementById('root')!).render(<App />);
