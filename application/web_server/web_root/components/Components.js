"use strict";
import { h, html } from "../bundle.js";

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

export function Header({ user, onLogout }) {
  return html`
    <header class="bg-white shadow-sm fixed top-0 right-0 left-64 h-16">
      <div class="h-full mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-full items-center">
          <div class="flex-1"></div>
          <div class="flex items-center space-x-4">
            <div class="flex items-center">
              <span class="text-gray-700 text-sm">
                <i class="fas fa-user-circle text-xl mr-2"></i>
                ${user}
              </span>
            </div>
            <button
              onClick=${onLogout}
              class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <${Icons.LogoutIcon} className="h-5 w-5 mr-2" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  `;
}

export function Sidebar({ currentRoute }) {
  const links = [
    {
      path: "/",
      label: "Home",
      icon: html`<${Icons.HomeIcon} className="w-5 h-5" />`,
    },
    {
      path: "/network",
      label: "Network",
      icon: html`<${Icons.NetworkIcon} className="w-5 h-5" />`,
    },
    {
      path: "/devices",
      label: "Devices",
      icon: html`<${Icons.DevicesIcon} className="w-5 h-5" />`,
    },
    {
      path: "/system",
      label: "System",
      icon: html`<${Icons.SettingsIcon} className="w-5 h-5" />`,
    },
  ];

  return html`
    <aside
      class="fixed left-0 top-0 h-screen w-64 bg-gray-800 text-white p-4 overflow-y-auto"
    >
      <div class="text-2xl font-bold mb-8">Gateway Config</div>
      <nav>
        <ul class="space-y-2">
          ${links.map(
            (link) => html`
              <li>
                <a
                  href="#${link.path}"
                  class=${`flex items-center px-4 py-2 rounded transition-colors ${
                    currentRoute === link.path
                      ? "bg-blue-600"
                      : "hover:bg-gray-700"
                  }`}
                >
                  <span class="w-6 h-6 mr-3 flex items-center justify-center">
                    ${link.icon}
                  </span>
                  <span>${link.label}</span>
                </a>
              </li>
            `
          )}
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
              class=${`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
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
