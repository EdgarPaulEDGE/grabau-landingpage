import Header from "@/components/Header";
import Hero from "@/components/Hero";
import TrustMarquee from "@/components/TrustMarquee";
import Stats from "@/components/Stats";
import ProblemSolution from "@/components/ProblemSolution";
import Location from "@/components/Location";
import KorridorScroll from "@/components/KorridorScroll";
import TerrainFlight from "@/components/TerrainFlight";
import SitePlan from "@/components/SitePlan";
import Industries from "@/components/Industries";
import Process from "@/components/Process";
import FactsData from "@/components/FactsData";
import Faq from "@/components/Faq";
import LeadForm from "@/components/LeadForm";
import Footer from "@/components/Footer";
import MobileCta from "@/components/MobileCta";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <KorridorScroll />
        <TrustMarquee />
        <Stats />
        <Location />
        <ProblemSolution />
        <TerrainFlight />
        <SitePlan />
        <FactsData />
        <Industries />
        <Process />
        <Faq />
        <LeadForm />
      </main>
      <Footer />
      <MobileCta />
    </>
  );
}
