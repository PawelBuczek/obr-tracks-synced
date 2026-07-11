import React from "react"
import ReactDOM from "react-dom/client"
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
  void import("./ui/app/E2ELayoutHarness").then(({ E2ELayoutHarness }) => {
    root.render(
      <React.StrictMode>
        <E2ELayoutHarness />
      </React.StrictMode>,
    )
  })
} else {
  void Promise.all([
    import("./ui/app"),
    import("./room/library"),
    import("./infra/time"),
  ]).then(([appModule, libraryModule, timeModule]) => {
      // clean the library before starting the app
      libraryModule.cleanLibrary()

      timeModule.setSkew(() =>
        root.render(
          <React.StrictMode>
            <PluginGate>
              <PluginThemeProvider>
                <MessageProvider>
                  <RoleProvider>
                    <appModule.App />
                  </RoleProvider>
                </MessageProvider>
              </PluginThemeProvider>
            </PluginGate>
          </React.StrictMode>,
        ),
      )
    })
}
