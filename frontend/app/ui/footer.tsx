import CircularText from "@/app/ui/circular-test";
import Link from "next/link";
import { FaXTwitter, FaGithub, FaDiscord, FaLinkedin } from "react-icons/fa6";

export default function Footer() {
  return (
    <div className="fixed bottom-1 left-0 right-0 z-50 flex justify-between items-center px-12">
      <p className="w-[152px] text-muted-foreground/80">All Rights Reserved</p>

      <Link href="https://helixlabs.org/" target="_blank">
        <CircularText
          text="HELIX*LABS*2025*"
          onHover="goBonkers"
          spinDuration={20}
          className=""
        />
      </Link>

      <div className="gap-6 font-thin text-muted-foreground/70 flex items-center">
        {socials.map((social) => (
          <Link key={social.name} href={social.href}>
            <social.icon className="w-5 h-5" />
          </Link>
        ))}
      </div>
    </div>
  );
}

export const socials = [
  {
    name: "Twitter",
    href: "https://x.com/zkhelixlabs",
    icon: FaXTwitter,
  },
  {
    name: "Linkedin",
    href: "https://www.linkedin.com/company/zkhelixlabs",
    icon: FaLinkedin,
  },
  {
    name: "Github",
    href: "https://github.com/HelixLabsDev",
    icon: FaGithub,
  },
  {
    name: "Discord",
    href: "https://discord.com/invite/MKPfssK985",
    icon: FaDiscord,
  },
];
