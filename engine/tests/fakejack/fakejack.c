// Minimal fake libjack for headless testing: runs the process callback on a timer thread and feeds
// a WAV file (TZ_FAKE_INPUT, mono float/16-bit) or a test tone into the first input port.
#define _GNU_SOURCE
#include <pthread.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>
#include <math.h>
typedef uint32_t jack_nframes_t;
typedef int (*ProcCb)(jack_nframes_t, void*);
typedef struct { char name[128]; int flags; float buf[8192]; } port_t;
typedef struct { int dummy; } client_t;
static client_t g_client;
static port_t ports[64];
static int nports = 0;
static ProcCb proc_cb = 0; static void* proc_arg = 0;
static jack_nframes_t bufsize = 64, srate = 48000;
static float* input = 0; static long inLen = 0, inPos = 0;
static volatile int running = 0;
static pthread_t thr;
static void load_input(void) {
  const char* p = getenv("TZ_FAKE_INPUT");
  if (!p) return;
  FILE* f = fopen(p, "rb"); if (!f) return;
  fseek(f, 0, SEEK_END); long n = ftell(f); fseek(f, 0, SEEK_SET);
  unsigned char* d = malloc(n); fread(d, 1, n, f); fclose(f);
  long pos = 12; int bits = 16, fmt = 1, ch = 1;
  while (pos + 8 < n) {
    uint32_t len = d[pos+4] | (d[pos+5]<<8) | (d[pos+6]<<16) | ((uint32_t)d[pos+7]<<24);
    if (!memcmp(d+pos, "fmt ", 4)) { fmt = d[pos+8] | (d[pos+9]<<8); ch = d[pos+10]; bits = d[pos+22]; }
    if (!memcmp(d+pos, "data", 4)) {
      long frames = len / (bits/8) / ch; input = malloc(frames * sizeof(float)); inLen = frames;
      for (long i = 0; i < frames; i++) {
        unsigned char* s = d + pos + 8 + i * ch * (bits/8);
        if (fmt == 3) { float v; memcpy(&v, s, 4); input[i] = v; }
        else { int16_t v; memcpy(&v, s, 2); input[i] = v / 32768.f; }
      }
      break;
    }
    pos += 8 + len + (len & 1);
  }
  free(d);
}
static void* loop(void* a) {
  struct timespec next; clock_gettime(CLOCK_MONOTONIC, &next);
  long periodNs = (long)(1e9 * bufsize / srate);
  double ph = 0;
  while (running) {
    for (int i = 0; i < nports; i++) if (ports[i].flags & 1) {
      if (i == 0) for (jack_nframes_t k = 0; k < bufsize; k++) {
        if (input && inLen) { ports[i].buf[k] = input[inPos]; inPos = (inPos + 1) % inLen; }
        else { ports[i].buf[k] = 0.2f * sinf(ph); ph += 2 * M_PI * 110.0 / srate; }
      }
    }
    if (proc_cb) proc_cb(bufsize, proc_arg);
    next.tv_nsec += periodNs; while (next.tv_nsec >= 1000000000) { next.tv_nsec -= 1000000000; next.tv_sec++; }
    clock_nanosleep(CLOCK_MONOTONIC, TIMER_ABSTIME, &next, 0);
  }
  return 0;
}
void* jack_client_open(const char* n, int o, int* st, ...) { load_input(); if (st) *st = 0; return &g_client; }
int jack_client_close(void* c) { running = 0; return 0; }
int jack_activate(void* c) { running = 1; pthread_create(&thr, 0, loop, 0); return 0; }
int jack_deactivate(void* c) { running = 0; pthread_join(thr, 0); return 0; }
int jack_set_process_callback(void* c, ProcCb cb, void* a) { proc_cb = cb; proc_arg = a; return 0; }
int jack_set_buffer_size_callback(void* c, void* cb, void* a) { return 0; }
int jack_set_sample_rate_callback(void* c, void* cb, void* a) { return 0; }
int jack_set_xrun_callback(void* c, void* cb, void* a) { return 0; }
void jack_on_shutdown(void* c, void* cb, void* a) {}
void* jack_port_register(void* c, const char* name, const char* t, unsigned long flags, unsigned long b) {
  port_t* p = &ports[nports++]; snprintf(p->name, sizeof p->name, "Tone Zone:%s", name); p->flags = (int)flags; return p; }
void* jack_port_get_buffer(void* p, jack_nframes_t n) { return ((port_t*)p)->buf; }
const char* jack_port_name(const void* p) { return ((const port_t*)p)->name; }
int jack_port_set_alias(void* p, const char* a) { return 0; }
int jack_connect(void* c, const char* a, const char* b) { return 0; }
int jack_disconnect(void* c, const char* a, const char* b) { return 0; }
const char** jack_get_ports(void* c, const char* a, const char* b, unsigned long f) {
  const char** r = calloc(nports + 3, sizeof(char*)); int k = 0;
  if (f & 0x4) { if (f & 0x2) r[k++] = "system:capture_1"; else { r[k++] = "system:playback_1"; r[k++] = "system:playback_2"; } return r; }
  for (int i = 0; i < nports; i++) if (!f || (ports[i].flags & f)) r[k++] = ports[i].name;
  if (f & 0x2) r[k++] = "system:capture_1"; else if (f & 0x1) r[k++] = "system:playback_1";
  return r; }
void* jack_port_by_name(void* c, const char* n) { for (int i = 0; i < nports; i++) if (!strcmp(ports[i].name, n)) return &ports[i]; return 0; }
int jack_port_flags(const void* p) { return p ? ((const port_t*)p)->flags : 0x4; }
const char** jack_port_get_all_connections(const void* c, const void* p) { return 0; }
void jack_free(void* p) { free(p); }
jack_nframes_t jack_get_sample_rate(void* c) { return srate; }
jack_nframes_t jack_get_buffer_size(void* c) { return bufsize; }
int jack_set_buffer_size(void* c, jack_nframes_t n) { bufsize = n; return 0; }
float jack_cpu_load(void* c) { return 0; }
void jack_port_get_latency_range(void* p, int m, jack_nframes_t* r) { r[0] = r[1] = bufsize; }
const char* jack_get_client_name(void* c) { return "Tone Zone"; }
