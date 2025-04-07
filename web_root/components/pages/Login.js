"use strict";
import { h, html, useState, useEffect } from "../../bundle.js";
import { Icons, Button } from "../Components.js";

function Login({ onLogin }) {
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = function (e) {
    e.preventDefault();
    setIsLoading(true);

    const authhdr =
      "Basic " + btoa(credentials.username + ":" + credentials.password);
    const headers = { Authorization: authhdr };
    return fetch("/api/login", {
      method: "POST",
      headers: headers,
    })
      .then(onLogin)
      .finally(() => setIsLoading(false));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  useEffect(() => {
    document.title = "SBIOT-Login";
  }, []);

  return html`
    <div
      class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8"
    >
      <div class="max-w-md w-full space-y-8">
        <div>
          <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Gateway Login
          </h2>
        </div>
        <form class="mt-8 space-y-6" onSubmit=${handleSubmit}>
          <div class="rounded-md shadow-sm -space-y-px">
            <div class="relative">
              <label for="username" class="sr-only">Username</label>
              <div
                class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
              >
                <${Icons.UserIcon} className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="username"
                name="username"
                type="text"
                required
                class="appearance-none rounded-none relative block w-full pl-10 pr-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Username"
                value=${credentials.username}
                onChange=${handleChange}
              />
            </div>
            <div class="relative">
              <label for="password" class="sr-only">Password</label>
              <div
                class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
              >
                <${Icons.LockIcon} className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="password"
                name="password"
                type="password"
                required
                class="appearance-none rounded-none relative block w-full pl-10 pr-10 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value=${credentials.password}
                onChange=${handleChange}
              />
              <div class="absolute inset-y-0 right-0 pr-3 flex items-center">
                <button
                  type="button"
                  onClick=${() => {
                    const input = document.getElementById("password");
                    input.type =
                      input.type === "password" ? "text" : "password";
                  }}
                  class="text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  <${Icons.EyeIcon}
                    className="h-5 w-5 text-gray-400 hover:text-gray-600"
                  />
                </button>
              </div>
            </div>
          </div>

          ${
            error &&
            html` <div class="text-red-500 text-sm text-center">${error}</div> `
          }

          <div class="mt-6">
            <${Button}
              type="submit"
              variant="primary"
              loading=${isLoading}
              disabled=${isLoading}
              icon="LoginIcon"
              className="w-full"
            >
              ${isLoading ? "Signing in..." : "Sign in"}
            </${Button}>
          </div>
        </form>
      </div>
    </div>
  `;
}

export default Login;
