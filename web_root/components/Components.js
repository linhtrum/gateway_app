import { h, html, useState, useEffect } from "../../bundle.js";
import Home from "./pages/Home.js";
import Network from "./pages/Network.js";
import Devices from "./pages/Devices.js";
import IOFunction from "./pages/IOFunction.js";
import MQTT from "./pages/MQTT.js";
import System from "./pages/System.js";
import Serial from "./pages/Serial.js";
import Logs from "./pages/Logs.js";
import Login from "./pages/Login.js";
import Status from "./pages/Status.js";
import { useLanguage } from "./LanguageContext.js";

export const Icons = {
  // Loading spinner icon
  SpinnerIcon: ({ className = "h-5 w-5" }) => html`
    <svg
      class=${className + " animate-spin"}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      ></circle>
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  `,

  // Plus icon
  PlusIcon: ({ className = "h-5 w-5" }) => html`
    <svg
      class=${className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  `,

  // Search icon
  SearchIcon: ({ className = "h-5 w-5" }) => html`
    <svg
      class=${className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  `,

  // Close/Cross icon
  CloseIcon: ({ className = "h-5 w-5" }) => html`
    <svg
      class=${className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  `,

  // Save icon
  SaveIcon: ({ className = "h-5 w-5" }) => html`
    <svg
      class=${className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
      />
    </svg>
  `,

  // Settings/Cogs icon
  SettingsIcon: ({ className = "h-5 w-5" }) => html`
    <svg
      class=${className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
      />
    </svg>
  `,

  // Link icon
  LinkIcon: ({ className = "h-5 w-5" }) => html`
    <svg
      class=${className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  `,

  // Home icon
  HomeIcon: ({ className = "h-5 w-5" }) => html`
    <svg
      class=${className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  `,

  // Network icon
  NetworkIcon: ({ className = "h-5 w-5" }) => html`
    <svg
      class=${className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
      <line x1="12" y1="10" x2="12" y2="14" />
    </svg>
  `,

  // Devices icon
  DevicesIcon: ({ className = "h-5 w-5" }) => html`
    <svg
      class=${className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="2" x2="9" y2="4" />
      <line x1="15" y1="2" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="22" />
      <line x1="15" y1="20" x2="15" y2="22" />
      <line x1="20" y1="9" x2="22" y2="9" />
      <line x1="20" y1="15" x2="22" y2="15" />
      <line x1="2" y1="9" x2="4" y2="9" />
      <line x1="2" y1="15" x2="4" y2="15" />
    </svg>
  `,

  // User icon
  UserIcon: ({ className = "h-5 w-5" }) => html`
    <svg
      class=${className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  `,

  // Lock icon
  LockIcon: ({ className = "h-5 w-5" }) => html`
    <svg
      class=${className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  `,

  // Eye icon
  EyeIcon: ({ className = "h-5 w-5" }) => html`
    <svg
      class=${className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  `,

  // Login icon
  LoginIcon: ({ className = "h-5 w-5" }) => html`
    <svg
      class=${className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  `,

  // Edit icon
  EditIcon: ({ className = "h-5 w-5" }) => html`
    <svg
      class=${className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  `,

  // Trash icon
  TrashIcon: ({ className = "h-5 w-5" }) => html`
    <svg
      class=${className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  `,

  // Clock icon
  ClockIcon: ({ className = "h-5 w-5" }) => html`
    <svg
      class=${className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  `,

  // Refresh icon
  RefreshIcon: ({ className }) => html`
    <svg
      class=${className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  `,

  // Reset icon
  ResetIcon: ({ className }) => html`
    <svg
      class=${className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  `,

  // Logout icon
  LogoutIcon: ({ className = "h-6 w-6" }) => html`
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      class=${className}
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    </svg>
  `,

  // Serial icon
  SerialIcon: ({ className = "h-5 w-5" }) => html`
    <svg
      class=${className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M12 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
      <path d="M12 17v-11.5" />
      <path d="M7 10v3l5 3" />
      <path d="M12 14.5l5 -2v-2.5" />
      <path d="M16 10h2v-2h-2z" />
      <path d="M7 9m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
      <path d="M10 5.5h4l-2 -2.5z" />
    </svg>
  `,

  // IO Function icon
  IOFunctionIcon: ({ className = "h-5 w-5" }) => html`
    <svg
      class=${className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="2" y="2" width="20" height="20" rx="2" ry="2" />
      <line x1="7" y1="7" x2="17" y2="7" />
      <line x1="7" y1="12" x2="17" y2="12" />
      <line x1="7" y1="17" x2="17" y2="17" />
    </svg>
  `,

  // Control center icon
  ControlCenterIcon: ({ className = "h-5 w-5" }) => html`
    <svg
      class=${className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
      <g
        id="SVGRepo_tracerCarrier"
        stroke-linecap="round"
        stroke-linejoin="round"
      ></g>
      <g id="SVGRepo_iconCarrier">
        <title id="controlCentreIconTitle">Control Centre</title>
        <path
          d="M4 6.5C4 4.567 5.567 3 7.5 3L16.5 3C18.433 3 20 4.567 20 6.5V6.5C20 8.433 18.433 10 16.5 10L7.5 10C5.567 10 4 8.433 4 6.5V6.5Z"
        ></path>
        <path
          d="M20 17.5C20 19.433 18.433 21 16.5 21L7.5 21C5.567 21 4 19.433 4 17.5V17.5C4 15.567 5.567 14 7.5 14L16.5 14C18.433 14 20 15.567 20 17.5V17.5Z"
        ></path>
        <circle cx="16.5" cy="17.5" r="1"></circle>
        <circle cx="7.5" cy="6.5" r="1"></circle>
      </g>
    </svg>
  `,
  MqttIcon: ({ className = "h-5 w-5" }) => html`
    <svg
      class=${className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path
        d="M6.657 16c-2.572 0 -4.657 -2.007 -4.657 -4.483c0 -2.475 2.085 -4.482 4.657 -4.482c.393 -1.762 1.794 -3.2 3.675 -3.773c1.88 -.572 3.956 -.193 5.444 1c1.488 1.19 2.162 3.007 1.77 4.769h.99c1.913 0 3.464 1.56 3.464 3.486c0 1.927 -1.551 3.487 -3.465 3.487h-11.878"
      />
      <path d="M12 16v5" />
      <path d="M16 16v4a1 1 0 0 0 1 1h4" />
      <path d="M8 16v4a1 1 0 0 1 -1 1h-4" />
    </svg>
  `,
  StatusIcon: ({ className = "h-5 w-5" }) => html`
    <svg
      class=${className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" />
      <path d="M12 9h.01" />
      <path d="M11 12h1v4h1" />
    </svg>
  `,
};

const VARIANTS = {
  primary: "bg-blue-600 hover:bg-blue-700 text-white",
  secondary: "bg-gray-100 hover:bg-gray-200 text-gray-600",
  success: "bg-green-600 hover:bg-green-700 text-white",
  danger: "bg-red-600 hover:bg-red-700 text-white",
  warning: "bg-yellow-600 hover:bg-yellow-700 text-white",
};

const SIZES = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2",
  lg: "px-6 py-3 text-lg",
};

export function Button({
  type = "button",
  variant = "primary",
  size = "md",
  icon = null,
  iconPosition = "left",
  loading = false,
  disabled = false,
  className = "",
  onClick,
  children,
}) {
  const baseClasses =
    "inline-flex items-center justify-center font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2";
  const variantClasses = VARIANTS[variant] || VARIANTS.primary;
  const sizeClasses = SIZES[size] || SIZES.md;
  const disabledClasses = "disabled:opacity-50 disabled:cursor-not-allowed";
  const focusRingColor = {
    primary: "focus:ring-blue-500",
    secondary: "focus:ring-gray-500",
    success: "focus:ring-green-500",
    danger: "focus:ring-red-500",
    warning: "focus:ring-yellow-500",
  }[variant];

  const renderIcon = () => {
    if (loading) {
      return html`<${Icons.SpinnerIcon} className="h-5 w-5" />`;
    }
    if (icon) {
      const Icon = Icons[icon];
      return Icon ? html`<${Icon} className="h-5 w-5" />` : null;
    }
    return null;
  };

  return html`
    <button
      type=${type}
      onClick=${onClick}
      disabled=${disabled || loading}
      class=${[
        baseClasses,
        variantClasses,
        sizeClasses,
        disabledClasses,
        focusRingColor,
        className,
      ].join(" ")}
    >
      ${iconPosition === "left" &&
      renderIcon() &&
      html` <span class="mr-2">${renderIcon()}</span> `}
      ${loading ? "Loading..." : children}
      ${iconPosition === "right" &&
      renderIcon() &&
      html` <span class="ml-2">${renderIcon()}</span> `}
    </button>
  `;
}

export const Header = ({ user, onLogout }) => {
  const { t, language, changeLanguage } = useLanguage();

  return html`
    <header class="fixed top-0 right-0 left-64 bg-white shadow-sm z-10">
      <div class="flex items-center justify-between px-6 py-4">
        <div class="flex items-center space-x-4">
          <h1 class="text-xl font-semibold">${t("appName")}</h1>
        </div>
        <div class="flex items-center space-x-4">
          <div class="relative">
            <select
              value=${language}
              onChange=${(e) => changeLanguage(e.target.value)}
              class="px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="en">${t("english")}</option>
              <option value="vi">${t("vietnamese")}</option>
            </select>
          </div>
          ${user &&
          html`
            <div class="flex items-center space-x-4">
              <span class="text-gray-700">${user.username}</span>
              <button
                onClick=${onLogout}
                class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <${Icons.LogoutIcon} className="h-5 w-5 mr-2" />
                ${t("logout")}
              </button>
            </div>
          `}
        </div>
      </div>
    </header>
  `;
};

export function Sidebar({ currentRoute }) {
  const { t } = useLanguage();
  const [expandedMenus, setExpandedMenus] = useState(new Set());

  const menuItems = [
    {
      path: "/",
      label: t("home"),
      icon: html`<${Icons.HomeIcon} className="w-5 h-5" />`,
    },
    {
      path: "/status",
      label: t("status"),
      icon: html`<${Icons.StatusIcon} className="w-5 h-5" />`,
    },
    {
      path: "/network",
      label: t("network"),
      icon: html`<${Icons.NetworkIcon} className="w-5 h-5" />`,
    },
    {
      label: t("port"),
      icon: html`<${Icons.SerialIcon} className="w-5 h-5" />`,
      children: [
        {
          path: "/serial1",
          label: t("serial1"),
        },
        {
          path: "/serial2",
          label: t("serial2"),
        },
        {
          path: "/logs",
          label: t("logs"),
        },
      ],
    },
    {
      label: t("gateway"),
      icon: html`<${Icons.DevicesIcon} className="w-5 h-5" />`,
      children: [
        {
          path: "/mqtt",
          label: t("mqttGateway"),
        },
        {
          path: "/devices",
          label: t("edgeComputing"),
        },
        {
          path: "/io-function",
          label: t("ioFunction"),
        },
      ],
    },
    {
      label: t("system"),
      icon: html`<${Icons.SettingsIcon} className="w-5 h-5" />`,
      children: [
        {
          path: "/system",
          label: t("settings"),
        },
        {
          path: "/management",
          label: t("management"),
        },
      ],
    },
  ];

  const renderMenuItem = (item, level = 0) => {
    const isActive =
      item.path === currentRoute ||
      (item.children &&
        item.children.some((child) => child.path === currentRoute));
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedMenus.has(item.label);

    // Auto-expand parent menu if child is active and menu is not explicitly collapsed
    useEffect(() => {
      if (isActive && hasChildren && !expandedMenus.has(item.label)) {
        setExpandedMenus((prev) => new Set([...prev, item.label]));
      }
    }, [isActive, hasChildren, item.label]);

    return html`
      <li>
        <div class="relative">
          <a
            href=${item.path ? `#${item.path}` : "#"}
            class=${`flex items-center px-4 py-2 rounded transition-colors ${
              isActive ? "bg-blue-600" : "hover:bg-gray-700"
            }`}
            onClick=${(e) => {
              if (!item.path) {
                e.preventDefault();
                setExpandedMenus((prev) => {
                  const newSet = new Set(prev);
                  if (newSet.has(item.label)) {
                    newSet.delete(item.label);
                  } else {
                    newSet.add(item.label);
                  }
                  return newSet;
                });
              }
            }}
          >
            <span class="w-6 h-6 mr-3 flex items-center justify-center">
              ${item.icon}
            </span>
            <span>${item.label}</span>
            ${hasChildren &&
            html`
              <span class="ml-auto">
                <svg
                  class="w-4 h-4 transform transition-transform ${isExpanded
                    ? "rotate-180"
                    : ""}"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </span>
            `}
          </a>
          ${hasChildren &&
          html`
            <ul
              class="submenu ${isExpanded ? "" : "hidden"} pl-4 mt-1 space-y-1"
            >
              ${item.children.map(
                (child) => html`
                  <li>
                    <a
                      href="#${child.path}"
                      class=${`flex items-center px-4 py-2 rounded transition-colors ${
                        currentRoute === child.path
                          ? "bg-blue-600"
                          : "hover:bg-gray-700"
                      }`}
                    >
                      <span>${child.label}</span>
                    </a>
                  </li>
                `
              )}
            </ul>
          `}
        </div>
      </li>
    `;
  };

  return html`
    <aside
      class="fixed left-0 top-0 h-screen w-64 bg-gray-800 text-white p-4 overflow-y-auto"
    >
      <div class="text-2xl font-bold mb-8">Gateway Config</div>
      <nav>
        <ul class="space-y-2">
          ${menuItems.map((item) => renderMenuItem(item))}
        </ul>
      </nav>
    </aside>
  `;
}

export function Tabs({ tabs, activeTab, onTabChange }) {
  return html`
    <div class="border-b border-gray-200 mb-6">
      <nav class="-mb-px flex space-x-8">
        ${tabs.map(
          (tab) => html`
            <button
              onClick=${() => onTabChange(tab.id)}
              disabled=${tab.disabled}
              class=${`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              } ${
                tab.disabled
                  ? "opacity-50 cursor-not-allowed pointer-events-none"
                  : ""
              }`}
            >
              ${tab.label}
            </button>
          `
        )}
      </nav>
    </div>
  `;
}

export function Card({ card, onDelete, onTitleUpdate, onEdit }) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(card.t);
  const [lastUpdate, setLastUpdate] = useState(card.lastUpdate);

  // Update local state when props change
  useEffect(() => {
    setTitle(card.t);
    setLastUpdate(card.lastUpdate);
  }, [card.t, card.lastUpdate]);

  const handleTitleUpdate = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      alert("Title cannot be empty");
      return;
    }

    if (trimmedTitle.length > 20) {
      alert("Title must not exceed 20 characters");
      return;
    }

    onTitleUpdate(trimmedTitle);
    setIsEditing(false);
  };

  const handleTitleKeyPress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleTitleUpdate();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setTitle(card.t);
    }
  };

  const handleTitleChange = (e) => {
    const newTitle = e.target.value;
    if (newTitle.length <= 20) {
      setTitle(newTitle);
    }
  };

  const formatTime = (date) => {
    if (!date) return "Never";
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleString();
  };

  return html`
    <div class="bg-white rounded-lg shadow-md overflow-hidden">
      <div
        class="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center"
      >
        ${isEditing
          ? html`
              <div class="flex items-center flex-1 gap-2">
                <input
                  type="text"
                  value=${title}
                  onChange=${handleTitleChange}
                  onKeyDown=${handleTitleKeyPress}
                  maxlength="20"
                  class="flex-1 px-2 py-1 text-lg font-semibold text-gray-800 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autofocus
                />
                <button
                  onClick=${handleTitleUpdate}
                  class="p-1.5 bg-green-500 text-white rounded hover:bg-green-600 flex items-center justify-center"
                  title="Save changes"
                >
                  <${Icons.SaveIcon} className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick=${() => {
                    setIsEditing(false);
                    setTitle(card.t);
                  }}
                  class="p-1.5 bg-red-500 text-red-100 rounded hover:bg-red-600 flex items-center justify-center"
                  title="Discard changes"
                >
                  <${Icons.CloseIcon} className="w-3.5 h-3.5" />
                </button>
              </div>
            `
          : html`
              <div class="flex items-center flex-1 min-w-0">
                <h2 class="text-lg font-semibold text-gray-800 truncate">
                  ${title}
                </h2>
              </div>
            `}
        <div class="flex items-center space-x-2">
          <button
            onClick=${onEdit}
            class="w-8 h-8 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-blue-500 transition-all flex-shrink-0"
            title="Edit card configuration"
          >
            <${Icons.SettingsIcon} className="w-3.5 h-3.5" />
          </button>
          <button
            onClick=${onDelete}
            class="w-8 h-8 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-red-500 transition-all flex-shrink-0"
            title="Delete card"
          >
            <${Icons.TrashIcon} className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div class="p-4">
        <div class="text-sm text-gray-500 mb-2 truncate">${card.dn}</div>
        <div class="grid grid-cols-2 gap-4">
          <div class="bg-gray-50 p-3 rounded-md shadow-sm">
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-500">Temperature</span>
              <span class="text-xs text-gray-400">${card.tn.a}</span>
            </div>
            <div class="mt-1 flex items-baseline">
              <span class="text-2xl font-semibold text-blue-600">
                ${card.tn.v || "N/A"}
              </span>
              <span class="ml-1 text-gray-600">°C</span>
            </div>
          </div>
          <div class="bg-gray-50 p-3 rounded-md shadow-sm">
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-500">Humidity</span>
              <span class="text-xs text-gray-400">${card.hn.a}</span>
            </div>
            <div class="mt-1 flex items-baseline">
              <span class="text-2xl font-semibold text-green-600">
                ${card.hn.v || "N/A"}
              </span>
              <span class="ml-1 text-gray-600">%</span>
            </div>
          </div>
        </div>
        <div class="mt-3 text-xs text-gray-400 flex items-center">
          <${Icons.ClockIcon} className="w-3.5 h-3.5 mr-1" />
          Last updated: ${formatTime(lastUpdate)}
        </div>
      </div>
    </div>
  `;
}

const navigation = [
  { name: "Home", href: "/", icon: "home" },
  { name: "Status", href: "/status", icon: "chart-bar" },
  { name: "Network", href: "/network", icon: "network-wired" },
  { name: "Devices", href: "/devices", icon: "server" },
  { name: "IO Function", href: "/io-function", icon: "cog" },
  { name: "MQTT", href: "/mqtt", icon: "cloud" },
  { name: "System", href: "/system", icon: "cogs" },
  { name: "Serial", href: "/serial", icon: "terminal" },
  { name: "Logs", href: "/logs", icon: "clipboard-list" },
];

const renderContent = () => {
  switch (currentPath) {
    case "/":
      return html`<${Home} />`;
    case "/status":
      return html`<${Status} />`;
    case "/network":
      return html`<${Network} />`;
    case "/devices":
      return html`<${Devices} />`;
    case "/io-function":
      return html`<${IOFunction} />`;
    case "/mqtt":
      return html`<${MQTT} />`;
    case "/system":
      return html`<${System} />`;
    case "/serial":
      return html`<${Serial} />`;
    case "/logs":
      return html`<${Logs} />`;
    default:
      return html`<${Home} />`;
  }
};

export const Input = ({
  type,
  name,
  label,
  value,
  onChange,
  extra,
  min,
  max,
  maxLength,
  note,
  disabled,
  required,
  placeholder,
  readonly,
  step,
  key,
}) => {
  return html`
    <div key=${key}>
      ${label &&
      html`
        <label class="block text-sm font-medium text-gray-700 mb-1"
          >${label}${required ? html`<span class="text-red-500">*</span>` : ""}
          ${extra
            ? html`<span class="text-sm text-gray-500"> ${extra}</span>`
            : ""}</label
        >
      `}
      <div class="flex items-center space-x-2">
        <input
          type=${type || "text"}
          name=${name}
          value=${value}
          onChange=${onChange}
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          min=${min}
          max=${max}
          maxlength=${maxLength}
          required=${required}
          disabled=${disabled}
          placeholder=${placeholder}
          readonly=${readonly}
          ${type === "number" ? `step=${step}` : ""}
        />
      </div>
      ${note && html`<p class="mt-1 text-sm text-gray-500">${note}</p>`}
    </div>
  `;
};

export const Select = ({
  name,
  label,
  value,
  onChange,
  options,
  options_extra,
  required,
  disabled,
  key,
}) => {
  return html`
    <div key=${key}>
      ${label &&
      html`
        <label class="block text-sm font-medium text-gray-700 mb-1"
          >${label}${required &&
          html`<span class="text-red-500">*</span>`}</label
        >
      `}
      <div>
        <select
          name=${name}
          value=${value}
          onChange=${onChange}
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required=${required}
          disabled=${disabled}
        >
          ${options_extra
            ? html`
                ${options_extra.map(
                  (option) =>
                    html`<option value=${option.value}>${option.label}</option>`
                )}
              `
            : options.map(
                (option) =>
                  html`<option value=${option[0]}>${option[1]}</option>`
              )}
        </select>
      </div>
    </div>
  `;
};

export const Checkbox = ({
  name,
  label,
  value,
  onChange,
  key,
  label_extra,
}) => {
  return html`
    <div key=${key} class="flex items-center">
      <input
        type="checkbox"
        name=${name}
        checked=${value}
        onChange=${onChange}
        class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
      />
      ${label_extra
        ? html`
            <h2 class="ml-2 block text-sm text-gray-700 font-semibold">
              ${label_extra}
            </h2>
          `
        : label &&
          html`
            <label class="ml-2 block text-sm text-gray-700">${label}</label>
          `}
    </div>
  `;
};

export const FileInput = ({
  name,
  label,
  value,
  onChange,
  note,
  accept,
  disabled,
  onUpload,
  isUploading,
  key,
}) => {
  const [hasFile, setHasFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setHasFile(!!file);
    setSelectedFile(file);
    if (onChange) onChange(e);
  };

  const handleUploadClick = (e) => {
    e.preventDefault();
    if (selectedFile && onUpload) {
      onUpload(selectedFile);
    }
  };

  return html`
    <div key=${key}>
      ${label &&
      html`
        <label class="block text-sm font-medium text-gray-700 mb-1"
          >${label}</label
        >
      `}
      <div class="flex items-center space-x-2">
        <input
          type="file"
          name=${name}
          onChange=${handleFileChange}
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled=${disabled}
          accept=${accept}
        />
        <button
          class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick=${handleUploadClick}
          disabled=${isUploading || !hasFile}
        >
          ${isUploading ? "Uploading..." : "Upload"}
        </button>
      </div>
      ${note && html`<p class="mt-1 text-sm text-gray-500">${note}</p>`}
    </div>
  `;
};
