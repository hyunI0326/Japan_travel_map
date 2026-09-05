import SiteLink from "./site-link";

const links = [
  { href: "/guide", label: "여행 가이드" },
  { href: "/about", label: "서비스 소개" },
  { href: "/contact", label: "문의" },
  { href: "/privacy", label: "개인정보 처리방침" },
  { href: "/terms", label: "이용약관" },
];

export default function PolicyLinks() {
  return (
    <nav aria-label="정책 및 안내">
      {links.map((link) => (
        <SiteLink key={link.href} href={link.href}>
          {link.label}
        </SiteLink>
      ))}
    </nav>
  );
}
