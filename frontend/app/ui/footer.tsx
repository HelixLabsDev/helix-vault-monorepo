import Link from "next/link";
import { FaXTwitter, FaGithub, FaDiscord, FaLinkedin } from "react-icons/fa6";
// import { SpinningText } from "./circular-test";

export default function Footer() {
  return (
    <div className="flex px-6 justify-between items-center w-full max-w-5xl mx-auto">
      <p className="w-[152px] text-muted-foreground/80">All Rights Reserved</p>

      {/* <Link
        href="https://helixlabs.org/"
        target="_blank"
        className="py-4 text-muted-foreground/90"
      >
        <SpinningText>Helix • Labs</SpinningText>
      </Link> */}

      <div>Helix Labs</div>

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
