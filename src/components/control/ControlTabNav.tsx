import { ControlActionLink } from "@/components/control/ControlActionButton";
import { controlTheme as t } from "@/components/control/controlTheme";

export type ControlTabNavItem = {
  key: string;
  label: string;
  href: string;
};

export default function ControlTabNav({
  activeKey,
  items,
}: {
  activeKey: string;
  items: ControlTabNavItem[];
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        flexWrap: "wrap",
        padding: 5,
        borderRadius: t.radius.md,
        border: `1px solid ${t.color.softBorder}`,
        background: t.color.elevated,
      }}
    >
      {items.map((item) => (
        <ControlActionLink key={item.key} href={item.href} tone={item.key === activeKey ? "primary" : "ghost"}>
          {item.label}
        </ControlActionLink>
      ))}
    </div>
  );
}
