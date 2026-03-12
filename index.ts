import type { ChannelPlugin, OpenClawExtension, OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { maxPlugin } from "./src/channel.js";
import { setMaxRuntime } from "./src/runtime.js";

const extension: OpenClawExtension = {
  id: "max",
  name: "MAX Messenger",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setMaxRuntime(api.runtime);
    api.registerChannel({ plugin: maxPlugin as ChannelPlugin });
  },
};

export default extension;
