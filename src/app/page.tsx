import Hero from "@/components/Hero";
import LegalWorkflowFeatures from "@/components/LegalWorkflowFeatures";
import {VideoSection} from "@/components/videoSection";
import LegalCaseStudies from "@/components/LegalCaseStudies";
import Footer from "@/components/Footer";

export default function Page() {
  return (
    <>
      <main id="top">
        <Hero />
        <VideoSection />
        <LegalWorkflowFeatures />
        <LegalCaseStudies />
      </main>
      <Footer />
    </>
  );
}