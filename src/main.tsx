import React from "react"
import ReactDOM from "react-dom/client"
import { App } from "./ui/app"
import { E2ELayoutHarness } from "./ui/app/E2ELayoutHarness"
import {
  MessageProvider,
  PluginGate,
  PluginThemeProvider,
  RoleProvider,
} from "./ui/providers"
import "./infra/firebase"

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement)
const isE2EMode =
  import.meta.env.DEV && new URLSearchParams(window.location.search).has("e2e")

if (isE2EMode) {
  root.render(
    <React.StrictMode>
      <E2ELayoutHarness />
    </React.StrictMode>,
  )
} else {
  void Promise.all([import("./room/library"), import("./infra/time")]).then(
    ([libraryModule, timeModule]) => {
      // clean the library before starting the app
      libraryModule.cleanLibrary()

      timeModule.setSkew(() =>
        root.render(
          <React.StrictMode>
            <PluginGate>
              <PluginThemeProvider>
                <MessageProvider>
                  <RoleProvider>
                    <App />
                  </RoleProvider>
                </MessageProvider>
              </PluginThemeProvider>
            </PluginGate>
          </React.StrictMode>,
        ),
      )
    },
  )
}
