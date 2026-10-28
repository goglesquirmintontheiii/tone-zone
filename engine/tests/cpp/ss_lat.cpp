#include "signalsmith-stretch.h"
#include <cstdio>
int main(){
  for (double b : {0.02,0.03,0.04,0.06,0.08,0.12}) for (double iv : {0.25, 0.5}) {
    signalsmith::stretch::SignalsmithStretch<float> s;
    int bs = int(48000*b); s.configure(1, bs, int(bs*iv), false);
    printf("block %.0fms interval %.2f -> in %d out %d total %.1f ms\n", b*1000, iv, s.inputLatency(), s.outputLatency(), (s.inputLatency()+s.outputLatency())/48.0);
  }
}
