#include "jack_dl.h"
#include <dlfcn.h>
#include <vector>

JackApi& jackApi()
{
  static JackApi api;
  return api;
}

bool JackApi::load(std::string& err)
{
  if (loaded)
    return true;
  // Prefer PipeWire's JACK implementation, then whatever the system provides.
  const std::vector<std::string> candidates = {
    "/usr/lib64/pipewire-0.3/jack/libjack.so.0",
    "/usr/lib/pipewire-0.3/jack/libjack.so.0",
    "/usr/lib/x86_64-linux-gnu/pipewire-0.3/jack/libjack.so.0",
    "libjack.so.0",
    "libjack.so",
  };
  void* h = nullptr;
  for (auto& c : candidates)
  {
    h = dlopen(c.c_str(), RTLD_NOW | RTLD_LOCAL);
    if (h)
    {
      libPath = c;
      break;
    }
  }
  if (!h)
  {
    err = "Could not load libjack.so.0. On Nobara/Fedora install 'pipewire-jack-audio-connection-kit-libs'.";
    return false;
  }
  bool ok = true;
  auto sym = [&](auto& fn, const char* name, bool required = true) {
    fn = reinterpret_cast<std::remove_reference_t<decltype(fn)>>(dlsym(h, name));
    if (!fn && required)
    {
      ok = false;
      err += std::string("missing symbol ") + name + "; ";
    }
  };
  sym(client_open, "jack_client_open");
  sym(client_close, "jack_client_close");
  sym(activate, "jack_activate");
  sym(deactivate, "jack_deactivate");
  sym(set_process_callback, "jack_set_process_callback");
  sym(set_buffer_size_callback, "jack_set_buffer_size_callback");
  sym(set_sample_rate_callback, "jack_set_sample_rate_callback");
  sym(set_xrun_callback, "jack_set_xrun_callback");
  sym(on_shutdown, "jack_on_shutdown");
  sym(set_port_registration_callback, "jack_set_port_registration_callback", false);
  sym(set_port_connect_callback, "jack_set_port_connect_callback", false);
  sym(port_register, "jack_port_register");
  sym(port_get_buffer, "jack_port_get_buffer");
  sym(port_name, "jack_port_name");
  sym(port_set_alias, "jack_port_set_alias", false);
  sym(connect, "jack_connect");
  sym(disconnect, "jack_disconnect");
  sym(get_ports, "jack_get_ports");
  sym(port_by_name, "jack_port_by_name");
  sym(port_flags, "jack_port_flags");
  sym(port_get_all_connections, "jack_port_get_all_connections");
  sym(free, "jack_free");
  sym(get_sample_rate, "jack_get_sample_rate");
  sym(get_buffer_size, "jack_get_buffer_size");
  sym(set_buffer_size, "jack_set_buffer_size", false);
  sym(cpu_load, "jack_cpu_load", false);
  sym(port_get_latency_range, "jack_port_get_latency_range", false);
  sym(get_client_name, "jack_get_client_name", false);
  loaded = ok;
  return ok;
}
