// Hello World
import type { SVGProps } from "react";

/**
 * Conjunto de ícones próprio da PRX.
 * Desenhados em grade 24×24 com traço reto, cantos vivos e diagonais de 45° —
 * a mesma gramática do símbolo da marca — para fugir dos pacotes genéricos.
 * Usar com parcimônia: tipografia e espaço conduzem a interface.
 */
type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  size?: number;
  /** Rótulo acessível. Sem ele o ícone é decorativo (aria-hidden). */
  label?: string;
};

function createIcon(displayName: string, paths: ReadonlyArray<string>, filled: ReadonlyArray<string> = []) {
  function Icon({ size = 20, label, strokeWidth = 1.75, ...rest }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="square"
        strokeLinejoin="miter"
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        focusable="false"
        {...rest}
      >
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
        {filled.map((d) => (
          <path key={d} d={d} fill="currentColor" stroke="none" />
        ))}
      </svg>
    );
  }
  Icon.displayName = displayName;
  return Icon;
}

/* Navegação principal */
export const IconHome = createIcon("IconHome", ["M3 11.5 12 3l9 8.5", "M6 9.5V21h12V9.5", "M10 21v-5h4v5"]);
export const IconPass = createIcon("IconPass", ["M3 6h18v4l-2 2 2 2v4H3v-4l2-2-2-2z", "M9.5 6v2.5M9.5 11v2M9.5 15.5V18"]);
export const IconBank = createIcon("IconBank", ["M6.5 5H22l-4.5 14H2z", "M4.8 10h15.5"], ["M5.5 14.5h4l-.6 2h-4z"]);
export const IconLive = createIcon("IconLive", ["M7.5 7 3 12l4.5 5", "M16.5 7 21 12l-4.5 5"], ["M12 9l3 3-3 3-3-3z"]);
export const IconProfile = createIcon("IconProfile", ["M8.5 3.5h7v7h-7z", "M4 21l3-6.5h10l3 6.5"]);

/* Ações */
export const IconSend = createIcon("IconSend", ["M6 18 18 6", "M8.5 6H18v9.5"]);
export const IconReceive = createIcon("IconReceive", ["M18 6 6 18", "M15.5 18H6V8.5"]);
export const IconPix = createIcon("IconPix", ["M12 2.5 21.5 12 12 21.5 2.5 12z", "M8 12l4-4 4 4-4 4z"]);
export const IconScan = createIcon("IconScan", ["M3 8V3h5", "M16 3h5v5", "M21 16v5h-5", "M8 21H3v-5", "M3 12h18"]);
export const IconQr = createIcon(
  "IconQr",
  ["M3 3h7v7H3z", "M14 3h7v7h-7z", "M3 14h7v7H3z"],
  ["M14 14h3v3h-3z", "M18 18h3v3h-3z", "M5.5 5.5h2v2h-2z", "M16.5 5.5h2v2h-2z", "M5.5 16.5h2v2h-2z"]
);
export const IconCopy = createIcon("IconCopy", ["M8 8h13v13H8z", "M16 8V3H3v13h5"]);
export const IconCheck = createIcon("IconCheck", ["M4 12.5 9.5 18 20 6.5"]);
export const IconClose = createIcon("IconClose", ["M5 5l14 14", "M19 5 5 19"]);
export const IconPlus = createIcon("IconPlus", ["M12 4v16", "M4 12h16"]);
export const IconArrowRight = createIcon("IconArrowRight", ["M4 12h15", "M13 6l6 6-6 6"]);
export const IconArrowLeft = createIcon("IconArrowLeft", ["M20 12H5", "M11 6l-6 6 6 6"]);
export const IconChevronRight = createIcon("IconChevronRight", ["M9 5l7 7-7 7"]);
export const IconChevronDown = createIcon("IconChevronDown", ["M5 9l7 7 7-7"]);
export const IconBell = createIcon("IconBell", ["M6 17V10l2-4h8l2 4v7", "M4 17h16", "M10 20.5h4"]);
export const IconSearch = createIcon("IconSearch", ["M4 4h11v11H4z", "M15 15l5.5 5.5"]);
export const IconLock = createIcon("IconLock", ["M4 11h16v10H4z", "M8 11V5h8v6"], ["M11 14.5h2v3h-2z"]);
export const IconUnlock = createIcon("IconUnlock", ["M4 11h16v10H4z", "M8 11V5h8v2"], ["M11 14.5h2v3h-2z"]);
export const IconEye = createIcon("IconEye", ["M2 12 7 6h10l5 6-5 6H7z"], ["M10 10h4v4h-4z"]);
export const IconEyeOff = createIcon("IconEyeOff", ["M2 12 7 6h10l5 6-5 6H7z", "M3 21 21 3"]);
export const IconCard = createIcon("IconCard", ["M2.5 5h19v14h-19z", "M2.5 9.5h19"], ["M5.5 13.5h5v2h-5z"]);
export const IconTruck = createIcon("IconTruck", ["M2 5h12v11H2z", "M14 9h4.5l3.5 4v3h-8", "M5 19h2M16 19h2"]);
export const IconCalendar = createIcon("IconCalendar", ["M3 5h18v16H3z", "M3 10h18", "M8 3v4M16 3v4"]);
export const IconPin = createIcon("IconPin", ["M12 21 5 12V3h14v9z"], ["M10 7h4v4h-4z"]);
export const IconClock = createIcon("IconClock", ["M3 3h18v18H3z", "M12 7v5h4"]);
export const IconRun = createIcon("IconRun", ["M13 6h3v3h-3z", "M5 12l4-3h5l2 4h4", "M10 9l-2 6-4 5", "M12 15l3 2v4"]);
export const IconRocket = createIcon("IconRocket", ["M12 2.5 17 9v8H7V9z", "M7 13l-3 3v4l3-3", "M17 13l3 3v4l-3-3"], ["M11 9h2v2h-2z"]);
export const IconUpload = createIcon("IconUpload", ["M12 16V3", "M6.5 8.5 12 3l5.5 5.5", "M3 15v6h18v-6"]);
export const IconLogout = createIcon("IconLogout", ["M10 3H3v18h7", "M9 12h12", "M16 7l5 5-5 5"]);
export const IconRefresh = createIcon("IconRefresh", ["M20 4v6h-6", "M20 10 16 5.5H4v5", "M4 20v-6h6", "M4 14l4 4.5h12v-5"]);
export const IconGift = createIcon("IconGift", ["M3 9h18v4H3z", "M5 13v8h14v-8", "M12 9v12", "M12 9 8 4.5 5.5 7 8 9M12 9l4-4.5L18.5 7 16 9"]);
export const IconUsers = createIcon("IconUsers", ["M4 4h6v6H4z", "M1.5 21l2.5-6h6l2.5 6", "M15 4h6v6h-6", "M15.5 15H20l2.5 6"]);
export const IconLevel = createIcon("IconLevel", ["M5 13l7-7 7 7", "M5 19l7-7 7 7"]);
export const IconTicket = createIcon("IconTicket", ["M3 6h18v4l-2 2 2 2v4H3v-4l2-2-2-2z"], ["M9 11h6v2H9z"]);
export const IconFilter = createIcon("IconFilter", ["M3 5h18", "M6.5 12h11", "M10 19h4"]);
export const IconDownload = createIcon("IconDownload", ["M12 3v13", "M6.5 10.5 12 16l5.5-5.5", "M3 15v6h18v-6"]);
export const IconShield = createIcon("IconShield", ["M12 2.5 20 6v6.5L12 21.5 4 12.5V6z", "M8.5 12l2.5 2.5 4.5-5"]);
export const IconAlert = createIcon("IconAlert", ["M12 3 22 20H2z", "M12 10v4.5"], ["M11 16.5h2v2h-2z"]);
export const IconEdit = createIcon("IconEdit", ["M15 4l5 5L9 20H4v-5z", "M13 6l5 5"]);
export const IconTrash = createIcon("IconTrash", ["M3 6h18", "M9 6V3h6v3", "M5 6l1 15h12l1-15"]);
export const IconExternal = createIcon("IconExternal", ["M14 3h7v7", "M21 3 11 13", "M18 14v7H3V6h7"]);
export const IconImage = createIcon("IconImage", ["M3 4h18v16H3z", "M3 17l6-6 5 5 3-3 4 4"], ["M15 7h2.5v2.5H15z"]);
