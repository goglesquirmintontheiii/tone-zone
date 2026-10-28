#include "dsp/tonestack.h"
#include <cstdio>
#include <array>
using namespace tz;
int main(){ ToneStack t; 
 for (auto cfg: {std::array<double,3>{0.5,0.5,0.5},{1,0,1},{0,1,0},{0.5,1,0.5}}) { t.set(cfg[0],cfg[1],cfg[2],48000); printf("t%.1f m%.1f l%.1f: ",cfg[0],cfg[1],cfg[2]); for(double f: {50.,100.,200.,400.,800.,1600.,3200.,6400.}) printf("%5.0fHz %6.1f ",f,20*log10(t.mag(f))); printf("\n"); }
 // impulse stability
 t.set(0.5,0.5,0.5,48000); float s=0; for(int i=0;i<48000;i++){ float y=t.process(i==0?1:0); s+=y*y;} printf("energy %f\n",s);
}
