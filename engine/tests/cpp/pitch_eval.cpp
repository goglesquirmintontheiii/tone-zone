#include "dsp/pitch.h"
#include "signalsmith-stretch.h"
#include <cstdio>
#include <array>
#include <cstdlib>
#include <vector>
#include <cmath>
using namespace tz;
const float SR=48000;
std::vector<float> tone(std::vector<float> f0s, float dur){
  int n=int(dur*SR); std::vector<float> x(n,0.f);
  for(float f0: f0s) for(int k=1;k<=12;k++){ float f=f0*k; if(f>SR/2) break; float a=0.25f/k/f0s.size(); float ph=k*0.7f;
    for(int i=0;i<n;i++) x[i]+=a*std::sin(2*M_PI*f*i/SR+ph);} return x; }
struct Res{double ripple, purity;};
Res measure(const std::vector<float>& y, std::vector<float> f0s, float ratio, int lat){
  // steady part: 0.5s .. end
  int s0=int(0.5*SR)+lat; int n=y.size()-s0; int fr=int(SR*2.0/ (f0s[0]*ratio)); std::vector<double> e;
  for(int i=s0;i+fr<=(int)y.size();i+=fr){double a=0; for(int k=0;k<fr;k++) a+=y[i+k]*y[i+k]; e.push_back(10*log10(a/fr+1e-12));}
  double m=0; for(double v:e) m+=v; m/=e.size(); double sd=0; for(double v:e) sd+=(v-m)*(v-m); sd=sqrt(sd/e.size());
  // DFT-based purity using goertzel at expected partials vs total energy
  int N=1<<16; if(N>n) N=1<<15; double tot=0; for(int i=0;i<N;i++){double w=0.5-0.5*cos(2*M_PI*i/N); tot+=pow(y[s0+i]*w,2);} 
  double harm=0;
  // sum energy in bins near expected partials using direct DFT over a small band
  for(float f0: f0s) for(int k=1;k<=12;k++){ double f=f0*ratio*k; if(f>SR/2) break;
    for(double df=-2.0; df<=2.0; df+=SR/(double)N){ double re=0,im=0; double ff=f+df; for(int i=0;i<N;i++){double w=0.5-0.5*cos(2*M_PI*i/N); double v=y[s0+i]*w; re+=v*cos(2*M_PI*ff*i/SR); im-=v*sin(2*M_PI*ff*i/SR);} harm+=2*(re*re+im*im)/N; } }
  return {sd, 10*log10(harm/tot+1e-12)};
}
int main(){
  float semis=atof(getenv("SEMIS")); float ratio=pow(2,semis/12.f);
  std::vector<std::vector<float>> tests={{110.f},{82.41f,123.47f,164.81f,207.65f},{41.2f}};
  const char* names[]={"A2 note","E chord","bass E1"};
  for(int t=0;t<3;t++){
    auto x=tone(tests[t],3.0);
    { std::vector<float> fs; for(float f:tests[t]) fs.push_back(f*ratio); auto id=tone(fs,3.0); auto r=measure(id,tests[t],ratio,0); printf("%-8s IDEAL ripple %.2f purity %.2f\n",names[t],r.ripple,r.purity);}
    for (auto cfg : std::vector<std::array<float,3>>{{2.5f,22.f,7.f},{2.5f,30.f,10.f},{2.5f,40.f,12.f},{2.5f,30.f,15.f},{2.f,18.f,6.f},{2.5f,60.f,15.f},{3.f,50.f,8.f}}) { WsolaShifter w; w.prepare(SR,cfg[0],cfg[1],cfg[2]); printf("[%g/%g/%g] ",cfg[0],cfg[1],cfg[2]); std::vector<float> y(x.size()); for(size_t i=0;i<x.size();i++) y[i]=w.process(x[i],ratio);
      auto r=measure(y,tests[t],ratio,w.latency()); printf("%-8s WSOLA lat %.1fms ripple %.2f dB purity %.2f dB\n",names[t],w.latency()/48.0,r.ripple,r.purity);}
    for(double b: {0.02,0.03,0.045,0.06}){ signalsmith::stretch::SignalsmithStretch<float> s; int bs=int(SR*b); s.configure(1,bs,bs/4,false); s.setTransposeFactor(ratio);
      std::vector<float> y(x.size()); int blk=64; for(size_t i=0;i+blk<=x.size();i+=blk){ float* ip[1]={x.data()+i}; float* op[1]={y.data()+i}; s.process(ip,blk,op,blk);} 
      auto r=measure(y,tests[t],ratio,s.inputLatency()+s.outputLatency()); printf("%-8s SS %2.0fms lat %.1fms ripple %.2f dB purity %.2f dB\n",names[t],b*1000,(s.inputLatency()+s.outputLatency())/48.0,r.ripple,r.purity);}
  }
}
