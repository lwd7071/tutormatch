import Image from "next/image";
import heroIllustration from "@/assets/hero-illustration.png";

export function HeroIllustration() {
  return <Image src={heroIllustration} alt="" priority />;
}
