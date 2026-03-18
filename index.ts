import type { ChannelPlugin, OpenClawExtension, OpenClawPluginApi } from "./src/plugin-sdk.js";
import { emptyPluginConfigSchema } from "./src/plugin-sdk.js";
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
