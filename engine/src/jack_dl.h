// Minimal runtime-loaded JACK API (works with PipeWire's libjack implementation).
// We dlopen libjack at runtime so the AppImage never bundles a JACK library and
// always talks to the system's PipeWire graph.
#pragma once
#include <cstdint>
#include <string>

extern "C" {
typedef struct _jack_client jack_client_t;
typedef struct _jack_port jack_port_t;
typedef uint32_t jack_nframes_t;
typedef float jack_default_audio_sample_t;
typedef enum { JackCaptureLatency, JackPlaybackLatency } jack_latency_callback_mode_t;
typedef struct { jack_nframes_t min; jack_nframes_t max; } jack_latency_range_t;
typedef int (*JackProcessCallback)(jack_nframes_t nframes, void* arg);
typedef int (*JackBufferSizeCallback)(jack_nframes_t nframes, void* arg);
typedef int (*JackSampleRateCallback)(jack_nframes_t nframes, void* arg);
typedef int (*JackXRunCallback)(void* arg);
typedef void (*JackShutdownCallback)(void* arg);
typedef void (*JackPortRegistrationCallback)(uint32_t port, int reg, void* arg);
typedef void (*JackPortConnectCallback)(uint32_t a, uint32_t b, int connect, void* arg);
}

enum JackOpts { JackNullOption = 0, JackNoStartServer = 0x01, JackUseExactName = 0x02 };
enum JackPortFl { JackPortIsInput = 0x1, JackPortIsOutput = 0x2, JackPortIsPhysical = 0x4, JackPortCanMonitor = 0x8, JackPortIsTerminal = 0x10 };
#define JACK_DEFAULT_AUDIO_TYPE "32 bit float mono audio"

struct JackApi
{
  bool loaded = false;
  std::string libPath;
  jack_client_t* (*client_open)(const char*, int, int*, ...) = nullptr;
  int (*client_close)(jack_client_t*) = nullptr;
  int (*activate)(jack_client_t*) = nullptr;
  int (*deactivate)(jack_client_t*) = nullptr;
  int (*set_process_callback)(jack_client_t*, JackProcessCallback, void*) = nullptr;
  int (*set_buffer_size_callback)(jack_client_t*, JackBufferSizeCallback, void*) = nullptr;
  int (*set_sample_rate_callback)(jack_client_t*, JackSampleRateCallback, void*) = nullptr;
  int (*set_xrun_callback)(jack_client_t*, JackXRunCallback, void*) = nullptr;
  void (*on_shutdown)(jack_client_t*, JackShutdownCallback, void*) = nullptr;
  int (*set_port_registration_callback)(jack_client_t*, JackPortRegistrationCallback, void*) = nullptr;
  int (*set_port_connect_callback)(jack_client_t*, JackPortConnectCallback, void*) = nullptr;
  jack_port_t* (*port_register)(jack_client_t*, const char*, const char*, unsigned long, unsigned long) = nullptr;
  void* (*port_get_buffer)(jack_port_t*, jack_nframes_t) = nullptr;
  const char* (*port_name)(const jack_port_t*) = nullptr;
  int (*port_unregister)(jack_client_t*, jack_port_t*) = nullptr;
  int (*port_set_alias)(jack_port_t*, const char*) = nullptr;
  int (*connect)(jack_client_t*, const char*, const char*) = nullptr;
  int (*disconnect)(jack_client_t*, const char*, const char*) = nullptr;
  const char** (*get_ports)(jack_client_t*, const char*, const char*, unsigned long) = nullptr;
  jack_port_t* (*port_by_name)(jack_client_t*, const char*) = nullptr;
  int (*port_flags)(const jack_port_t*) = nullptr;
  const char** (*port_get_all_connections)(const jack_client_t*, const jack_port_t*) = nullptr;
  void (*free)(void*) = nullptr;
  jack_nframes_t (*get_sample_rate)(jack_client_t*) = nullptr;
  jack_nframes_t (*get_buffer_size)(jack_client_t*) = nullptr;
  int (*set_buffer_size)(jack_client_t*, jack_nframes_t) = nullptr;
  float (*cpu_load)(jack_client_t*) = nullptr;
  void (*port_get_latency_range)(jack_port_t*, jack_latency_callback_mode_t, jack_latency_range_t*) = nullptr;
  const char* (*get_client_name)(jack_client_t*) = nullptr;

  bool load(std::string& err);
};

JackApi& jackApi();
