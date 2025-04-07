"use strict";
import { h, html, useState } from "../../bundle.js";
import { Icons, Button } from "../Components.js";

// Constants and configuration
const CONFIG = {
  API_TIMEOUT: 10000, // 10 seconds
  REBOOT_DELAY: 3000, // 3 seconds
};

function Management() {
  const [isRestoring, setIsRestoring] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Handle factory reset
  const factoryReset = async () => {
    if (
      !confirm(
        "Are you sure you want to perform a factory reset? This will erase all settings and reboot the device."
      )
    ) {
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      setSuccess(false);

      const [factoryResponse, rebootResponse] = await Promise.all([
        fetch("/api/factory/set", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }),
        fetch("/api/reboot/set", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }),
      ]);

      if (!factoryResponse.ok || !rebootResponse.ok) {
        throw new Error("Failed to perform factory reset");
      }

      setSuccess(true);
      setMessage({
        type: "success",
        text: "Factory reset successful. Device is rebooting...",
      });

      setTimeout(() => {
        window.location.reload();
      }, CONFIG.REBOOT_DELAY);
    } catch (err) {
      setError(err.message);
      setMessage({
        type: "error",
        text: err.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle server reboot
  const handleReboot = async () => {
    if (!confirm("Are you sure you want to reboot the device?")) {
      return;
    }

    setIsRestoring(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        CONFIG.API_TIMEOUT
      );

      const response = await fetch("/api/reboot/set", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to reboot device: ${response.statusText}`);
      }

      setMessage({
        type: "success",
        text: "Device is rebooting. Please wait...",
      });

      // Refresh the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, CONFIG.REBOOT_DELAY);
    } catch (error) {
      console.error("Error rebooting device:", error);
      setMessage({
        type: "error",
        text:
          error.name === "AbortError"
            ? "Request timed out. Please try again."
            : "Failed to reboot device",
      });
    } finally {
      setIsRestoring(false);
    }
  };

  // Render message component
  const renderMessage = () => {
    if (!message.text) return null;
    const bgColor = message.type === "success" ? "bg-green-100" : "bg-red-100";
    const textColor =
      message.type === "success" ? "text-green-800" : "text-red-800";
    return html`
      <div class="mb-4 p-4 rounded-lg ${bgColor} ${textColor}">
        ${message.text}
      </div>
    `;
  };

  return html`
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-6">System Management</h1>
      ${renderMessage()}
      <div class="max-w-2xl mx-auto">
        <div class="space-y-6">
          <!-- Reboot Section -->
          <div class="bg-white rounded-lg shadow-md p-6">
            <h2 class="text-lg font-medium text-gray-900 mb-4">
              Device Reboot
            </h2>
            <p class="text-gray-600 mb-4">
              Restart the device. This will temporarily disconnect all
              connections.
            </p>
            <${Button}
              onClick=${handleReboot}
              disabled=${isRestoring}
              loading=${isRestoring}
              variant="warning"
              icon="RefreshIcon"
            >
              ${isRestoring ? "Rebooting..." : "Reboot Device"}
            <//>
          </div>

          <!-- Factory Reset Section -->
          <div class="bg-white rounded-lg shadow-md p-6">
            <h2 class="text-lg font-medium text-gray-900 mb-4">
              Factory Reset
            </h2>
            <p class="text-gray-600 mb-4">
              Reset all settings to factory defaults. This action cannot be
              undone.
            </p>
            <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
              <div class="flex">
                <div class="flex-shrink-0">
                  <svg
                    class="h-5 w-5 text-yellow-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </div>
                <div class="ml-3">
                  <p class="text-sm text-yellow-700">
                    Warning: This will erase all settings and restore the device
                    to factory defaults. The device will reboot after the reset.
                  </p>
                </div>
              </div>
            </div>
            <${Button}
              onClick=${factoryReset}
              disabled=${isSaving}
              loading=${isSaving}
              variant="danger"
              icon="ResetIcon"
            >
              ${isSaving ? "Resetting..." : "Factory Reset"}
            <//>
          </div>
        </div>
      </div>
    </div>
  `;
}

export default Management;
