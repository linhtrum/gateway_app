"use strict";
import { h, html, useState, useEffect } from "../../bundle.js";
import { Icons, Button } from "../Components.js";

// Constants and configuration
const CONFIG = {
  API_TIMEOUT: 10000, // 10 seconds
  REBOOT_DELAY: 3000, // 3 seconds
};

function Management() {
  const [isRestoring, setIsRestoring] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  // Handle factory reset
  const handleFactoryReset = async () => {
    if (!confirm("Are you sure you want to reset to factory settings? This action cannot be undone.")) {
      return;
    }

    setIsRestoring(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT);

      const response = await fetch("/api/factory/set", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to perform factory reset: ${response.statusText}`);
      }

      setMessage({
        type: "success",
        text: "Factory reset successful. The system will restart...",
      });

      // Refresh the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, CONFIG.REBOOT_DELAY);
    } catch (error) {
      console.error("Error performing factory reset:", error);
      setMessage({
        type: "error",
        text: error.name === "AbortError" 
          ? "Request timed out. Please try again." 
          : "Failed to perform factory reset",
      });
    } finally {
      setIsRestoring(false);
    }
  };

  // Handle server reboot
  const handleReboot = async () => {
    if (!confirm("Are you sure you want to reboot the server?")) {
      return;
    }

    setIsRestoring(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT);

      const response = await fetch("/api/reboot/set", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to reboot server: ${response.statusText}`);
      }

      setMessage({
        type: "success",
        text: "Server is rebooting. Please wait...",
      });

      // Refresh the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, CONFIG.REBOOT_DELAY);
    } catch (error) {
      console.error("Error rebooting server:", error);
      setMessage({
        type: "error",
        text: error.name === "AbortError" 
          ? "Request timed out. Please try again." 
          : "Failed to reboot server",
      });
    } finally {
      setIsRestoring(false);
    }
  };

  // Render message component
  const renderMessage = () => {
    if (!message.text) return null;
    const bgColor = message.type === "success" ? "bg-green-100" : "bg-red-100";
    const textColor = message.type === "success" ? "text-green-800" : "text-red-800";
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

      <div class="space-y-8">
        <!-- System Maintenance Section -->
        <div class="bg-white rounded-lg shadow-md p-6">
          <h2 class="text-lg font-medium text-gray-900 mb-4">System Maintenance</h2>
          
          <!-- Reboot Section -->
          <div class="mb-8">
            <h3 class="text-md font-medium text-gray-700 mb-2">System Reboot</h3>
            <p class="text-sm text-gray-600 mb-4">
              Reboot the system to apply any pending changes or to resolve system issues.
            </p>
            <${Button}
              onClick=${handleReboot}
              disabled=${isRestoring}
              loading=${isRestoring}
              variant="warning"
              icon="RefreshIcon"
            >
              ${isRestoring ? "Rebooting..." : "Reboot System"}
            <//>
          </div>

          <!-- Factory Reset Section -->
          <div>
            <h3 class="text-md font-medium text-gray-700 mb-2">Factory Reset</h3>
            <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
              <div class="flex">
                <div class="flex-shrink-0">
                  <${Icons.WarningIcon} className="h-5 w-5 text-yellow-400" />
                </div>
                <div class="ml-3">
                  <p class="text-sm text-yellow-700">
                    Warning: Restoring factory settings will erase all configurations and cannot be undone. This action will:
                  </p>
                  <ul class="mt-2 text-sm text-yellow-700 list-disc list-inside">
                    <li>Reset all device settings to default values</li>
                    <li>Clear all user configurations</li>
                    <li>Restart the device</li>
                  </ul>
                </div>
              </div>
            </div>
            <${Button}
              onClick=${handleFactoryReset}
              disabled=${isRestoring}
              loading=${isRestoring}
              variant="danger"
              icon="ResetIcon"
            >
              ${isRestoring ? "Restoring..." : "Restore Factory Settings"}
            <//>
          </div>
        </div>
      </div>
    </div>
  `;
}

export default Management; 