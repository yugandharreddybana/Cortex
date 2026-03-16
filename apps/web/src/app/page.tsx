import type { Metadata } from "next";
import { Nav } from "@/components/layout/Nav";
import { Hero } from "@/components/sections/Hero";
import { ShowcasesSection } from "@/components/sections/Showcases";
import { BentoGrid } from "@/components/sections/BentoGrid";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Cortex — Your brain, perfectly indexed.",
};

export default function HomePage() {
  return (
    <>
      <Nav />
      <main>
        <section id="product" className="scroll-mt-14">
          <Hero />
        </section>
        <section id="features" className="scroll-mt-14">
          <ShowcasesSection />
          <BentoGrid />
        </section>
      </main>
      <Footer />
    </>
  );
}
