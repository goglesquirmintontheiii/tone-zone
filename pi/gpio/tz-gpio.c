// tz-gpio: small GPIO helper for the Tone Zone Pi agent. Talks to the kernel GPIO character device
// (/dev/gpiochipN, uAPI v2, the same interface libgpiod uses) so it works the same on Pi 3, 4 and 5 (RP1)
// and on any libgpiod version. Footswitch inputs with pull-up and edge events, outputs, and software PWM
// for LEDs on pins without hardware PWM.
//
// Commands on stdin, one per line:
//   chips                      list chips: "chip <path> <name> <label> <lines>", then "chips-end"
//   open <path>                use this chip (default /dev/gpiochip0)
//   in <offset> <up|down|off> <debounce_us>
//   out <offset> <0|1>
//   pwm <offset> <duty 0..1000>   software PWM at 200 Hz (0 and 1000 are plain off / on)
//   get <offset>
//   release <offset>
// Output: "ok <cmd> <offset> [level]", "err <cmd> <offset> <message>", "e <offset> <0|1> <ns>" for edges.
#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <linux/gpio.h>
#include <poll.h>
#include <pthread.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <time.h>
#include <unistd.h>
#include <dirent.h>

#define MAXL 64
typedef struct {
  int used, offset, fd, output, duty; // duty 0..1000 for outputs
} line_t;

static line_t lines[MAXL];
static int chipfd = -1;
static pthread_mutex_t mu = PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t cv = PTHREAD_COND_INITIALIZER;
static pthread_mutex_t outmu = PTHREAD_MUTEX_INITIALIZER;

static void say(const char* fmt, ...) __attribute__((format(printf, 1, 2)));
#include <stdarg.h>
static void say(const char* fmt, ...) {
  va_list ap;
  va_start(ap, fmt);
  pthread_mutex_lock(&outmu);
  vprintf(fmt, ap);
  putchar('\n');
  fflush(stdout);
  pthread_mutex_unlock(&outmu);
  va_end(ap);
}

static line_t* find(int off) {
  for (int i = 0; i < MAXL; i++)
    if (lines[i].used && lines[i].offset == off) return &lines[i];
  return NULL;
}
static line_t* slot(void) {
  for (int i = 0; i < MAXL; i++)
    if (!lines[i].used) return &lines[i];
  return NULL;
}

static int set_value(int fd, int v) {
  struct gpio_v2_line_values vals;
  memset(&vals, 0, sizeof vals);
  vals.mask = 1;
  vals.bits = v ? 1 : 0;
  return ioctl(fd, GPIO_V2_LINE_SET_VALUES_IOCTL, &vals);
}
static int get_value(int fd) {
  struct gpio_v2_line_values vals;
  memset(&vals, 0, sizeof vals);
  vals.mask = 1;
  if (ioctl(fd, GPIO_V2_LINE_GET_VALUES_IOCTL, &vals) < 0) return -1;
  return (int)(vals.bits & 1);
}

static int request(int off, uint64_t flags, unsigned debounce_us) {
  struct gpio_v2_line_request req;
  memset(&req, 0, sizeof req);
  req.offsets[0] = (uint32_t)off;
  req.num_lines = 1;
  strncpy(req.consumer, "tonezone", sizeof req.consumer - 1);
  req.config.flags = flags;
  if (debounce_us) {
    req.config.num_attrs = 1;
    req.config.attrs[0].attr.id = GPIO_V2_LINE_ATTR_ID_DEBOUNCE;
    req.config.attrs[0].attr.debounce_period_us = debounce_us;
    req.config.attrs[0].mask = 1;
  }
  if (flags & (GPIO_V2_LINE_FLAG_EDGE_RISING | GPIO_V2_LINE_FLAG_EDGE_FALLING)) req.event_buffer_size = 16;
  if (ioctl(chipfd, GPIO_V2_GET_LINE_IOCTL, &req) < 0) {
    if (debounce_us) return request(off, flags, 0); // chip without debounce support: the agent debounces too
    return -1;
  }
  return req.fd;
}

static void release(line_t* l) {
  if (!l) return;
  if (l->fd >= 0) close(l->fd);
  l->used = 0;
  l->fd = -1;
}

// software PWM: one thread for all PWM lines, 200 Hz frame
static void* pwm_thread(void* arg) {
  (void)arg;
  const long frame = 5000000; // ns
  struct timespec t;
  for (;;) {
    pthread_mutex_lock(&mu);
    int active = 0;
    for (int i = 0; i < MAXL; i++)
      if (lines[i].used && lines[i].output && lines[i].duty > 0 && lines[i].duty < 1000) active++;
    if (!active) {
      pthread_cond_wait(&cv, &mu);
      pthread_mutex_unlock(&mu);
      continue;
    }
    // snapshot: offsets sorted by duty
    int fds[MAXL], duty[MAXL], n = 0;
    for (int i = 0; i < MAXL; i++)
      if (lines[i].used && lines[i].output && lines[i].duty > 0 && lines[i].duty < 1000) {
        fds[n] = lines[i].fd;
        duty[n] = lines[i].duty;
        n++;
      }
    pthread_mutex_unlock(&mu);
    for (int a = 1; a < n; a++)
      for (int b = a; b > 0 && duty[b] < duty[b - 1]; b--) {
        int x = duty[b]; duty[b] = duty[b - 1]; duty[b - 1] = x;
        x = fds[b]; fds[b] = fds[b - 1]; fds[b - 1] = x;
      }
    clock_gettime(CLOCK_MONOTONIC, &t);
    struct timespec start = t;
    for (int i = 0; i < n; i++) set_value(fds[i], 1);
    for (int i = 0; i < n; i++) {
      struct timespec off = start;
      off.tv_nsec += frame / 1000 * duty[i];
      while (off.tv_nsec >= 1000000000) { off.tv_nsec -= 1000000000; off.tv_sec++; }
      clock_nanosleep(CLOCK_MONOTONIC, TIMER_ABSTIME, &off, NULL);
      set_value(fds[i], 0);
    }
    struct timespec end = start;
    end.tv_nsec += frame;
    while (end.tv_nsec >= 1000000000) { end.tv_nsec -= 1000000000; end.tv_sec++; }
    clock_nanosleep(CLOCK_MONOTONIC, TIMER_ABSTIME, &end, NULL);
  }
  return NULL;
}

static void list_chips(void) {
  DIR* d = opendir("/dev");
  if (d) {
    struct dirent* e;
    while ((e = readdir(d))) {
      if (strncmp(e->d_name, "gpiochip", 8)) continue;
      char p[300];
      snprintf(p, sizeof p, "/dev/%s", e->d_name);
      int fd = open(p, O_RDONLY | O_CLOEXEC);
      if (fd < 0) continue;
      struct gpiochip_info info;
      memset(&info, 0, sizeof info);
      if (ioctl(fd, GPIO_GET_CHIPINFO_IOCTL, &info) == 0) say("chip %s %s %s %u", p, info.name, info.label[0] ? info.label : "-", info.lines);
      close(fd);
    }
    closedir(d);
  }
  say("chips-end");
}

static int open_chip(const char* p) {
  int fd = open(p, O_RDWR | O_CLOEXEC);
  if (fd < 0) return -1;
  pthread_mutex_lock(&mu);
  for (int i = 0; i < MAXL; i++) if (lines[i].used) release(&lines[i]);
  if (chipfd >= 0) close(chipfd);
  chipfd = fd;
  pthread_mutex_unlock(&mu);
  return 0;
}

static void command(char* s) {
  char cmd[16] = {0}, a[256] = {0}, b[32] = {0};
  long c = 0;
  int n = sscanf(s, "%15s %255s %31s %ld", cmd, a, b, &c);
  if (n < 1) return;
  if (!strcmp(cmd, "chips")) { list_chips(); return; }
  if (!strcmp(cmd, "open")) {
    if (open_chip(a) < 0) say("err open %s %s", a, strerror(errno));
    else say("ok open %s", a);
    return;
  }
  if (chipfd < 0 && open_chip("/dev/gpiochip0") < 0) { say("err %s %s no gpio chip: %s", cmd, a, strerror(errno)); return; }
  int off = atoi(a);
  pthread_mutex_lock(&mu);
  line_t* l = find(off);
  if (!strcmp(cmd, "in")) {
    release(l);
    uint64_t f = GPIO_V2_LINE_FLAG_INPUT | GPIO_V2_LINE_FLAG_EDGE_RISING | GPIO_V2_LINE_FLAG_EDGE_FALLING;
    if (!strcmp(b, "up")) f |= GPIO_V2_LINE_FLAG_BIAS_PULL_UP;
    else if (!strcmp(b, "down")) f |= GPIO_V2_LINE_FLAG_BIAS_PULL_DOWN;
    else f |= GPIO_V2_LINE_FLAG_BIAS_DISABLED;
    int fd = request(off, f, (unsigned)(n >= 4 ? c : 0));
    l = slot();
    if (fd < 0 || !l) say("err in %d %s", off, fd < 0 ? strerror(errno) : "too many lines");
    else {
      *l = (line_t){1, off, fd, 0, 0};
      say("ok in %d %d", off, get_value(fd));
    }
  } else if (!strcmp(cmd, "out") || !strcmp(cmd, "pwm")) {
    int v = atoi(b);
    int duty = !strcmp(cmd, "pwm") ? (v < 0 ? 0 : v > 1000 ? 1000 : v) : (v ? 1000 : 0);
    if (!l || !l->output) {
      release(l);
      int fd = request(off, GPIO_V2_LINE_FLAG_OUTPUT, 0);
      l = slot();
      if (fd < 0 || !l) { say("err %s %d %s", cmd, off, fd < 0 ? strerror(errno) : "too many lines"); pthread_mutex_unlock(&mu); return; }
      *l = (line_t){1, off, fd, 1, 0};
    }
    l->duty = duty;
    if (duty == 0 || duty == 1000) set_value(l->fd, duty == 1000);
    pthread_cond_signal(&cv);
    say("ok %s %d %d", cmd, off, duty);
  } else if (!strcmp(cmd, "get")) {
    if (!l) say("err get %d not requested", off);
    else say("ok get %d %d", off, get_value(l->fd));
  } else if (!strcmp(cmd, "release")) {
    release(l);
    say("ok release %d", off);
  } else say("err %s %d unknown command", cmd, off);
  pthread_mutex_unlock(&mu);
}

int main(int argc, char** argv) {
  if (argc > 1 && !strcmp(argv[1], "--version")) { puts("tz-gpio 1 (gpio uAPI v2)"); return 0; }
  setvbuf(stdout, NULL, _IOLBF, 0);
  for (int i = 0; i < MAXL; i++) lines[i].fd = -1;
  pthread_t th;
  pthread_create(&th, NULL, pwm_thread, NULL);
  char buf[512];
  size_t have = 0;
  for (;;) {
    struct pollfd pf[MAXL + 1];
    int np = 0;
    pf[np].fd = 0; pf[np].events = POLLIN; np++;
    pthread_mutex_lock(&mu);
    for (int i = 0; i < MAXL; i++)
      if (lines[i].used && !lines[i].output) { pf[np].fd = lines[i].fd; pf[np].events = POLLIN; np++; }
    pthread_mutex_unlock(&mu);
    if (poll(pf, np, 500) < 0) { if (errno == EINTR) continue; break; }
    if (pf[0].revents & (POLLIN | POLLHUP)) {
      ssize_t r = read(0, buf + have, sizeof buf - 1 - have);
      if (r <= 0) break; // agent gone
      have += (size_t)r;
      buf[have] = 0;
      char* nl;
      while ((nl = memchr(buf, '\n', have))) {
        *nl = 0;
        command(buf);
        size_t used = (size_t)(nl - buf) + 1;
        memmove(buf, nl + 1, have - used);
        have -= used;
        buf[have] = 0;
      }
      if (have >= sizeof buf - 1) have = 0;
    }
    for (int k = 1; k < np; k++) {
      if (!(pf[k].revents & POLLIN)) continue;
      struct gpio_v2_line_event ev[16];
      ssize_t r = read(pf[k].fd, ev, sizeof ev);
      if (r <= 0) continue;
      int cnt = (int)(r / (ssize_t)sizeof ev[0]);
      for (int i = 0; i < cnt; i++)
        say("e %u %d %llu", ev[i].offset, ev[i].id == GPIO_V2_LINE_EVENT_RISING_EDGE ? 1 : 0, (unsigned long long)ev[i].timestamp_ns);
    }
  }
  return 0;
}
