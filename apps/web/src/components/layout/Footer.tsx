import Link from "next/link";
import { cn } from "@cortex/ui";

const LINKS = {
  Product:  ["Features", "Pricing", "Changelog", "Roadmap"],
  Company:  ["About", "Blog", "Careers", "Press"],
  Legal:    ["Privacy", "Terms", "Security"],
  Socials:  ["Twitter", "GitHub", "Discord"],
};

export function Footer() {
  return (
    <footer
      className={cn(
        "border-t border-white/[0.06]",
        "py-16 px-6 lg:px-10",
        "bg-bg",
      )}
    >
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-16">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <span className="text-sm font-semibold text-primary">Cortex</span>
            <p className="mt-3 text-xs text-muted leading-relaxed max-w-[160px]">
              Your brain, perfectly indexed.
            </p>
          </div>

          {/* Links */}
          {Object.entries(LINKS).map(([group, items]) => (
            <div key={group}>
              <p className="text-2xs font-semibold uppercase tracking-widest text-muted mb-4">
                {group}
              </p>
              <ul className="space-y-2.5">
                {items.map((item) => (
                  <li key={item}>
                    <Link
                      href="#"
                      className="text-sm text-secondary hover:text-primary transition-colors duration-200 ease-snappy"
                    >
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-white/[0.06]">
          <p className="text-xs text-muted">
            © {new Date().getFullYear()} Cortex. All rights reserved.
          </p>
          <p className="text-xs text-muted">
            Built with care in San Francisco.
          </p>
        </div>
      </div>
    </footer>
  );
}
