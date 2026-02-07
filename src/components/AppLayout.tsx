import { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Sprout, Scissors, CheckSquare, User } from "lucide-react";

interface AppLayoutProps {
  children: ReactNode;
}

const navItems = [
  { to: "/", icon: Sprout, label: "Ферма" },
  { to: "/stitch", icon: Scissors, label: "Вышивка" },
  { to: "/review", icon: CheckSquare, label: "Проверка" },
  { to: "/profile", icon: User, label: "Профиль" },
];

const AppLayout = ({ children }: AppLayoutProps) => {
  const location = useLocation();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1 pb-20">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-md items-center justify-around px-2 py-2">
          {navItems.map(({ to, icon: Icon, label }) => {
            const isActive = location.pathname === to;
            return (
              <NavLink
                key={to}
                to={to}
                className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
                  isActive
                    ? "text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default AppLayout;
