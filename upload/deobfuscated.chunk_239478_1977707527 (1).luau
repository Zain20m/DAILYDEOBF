return setmetatable({Z=function(Q,e,Y,x,_,O,y,W,q,p)
if e<=143 then 
if e<=142 then 
local w=Q[23](x,W+1);
return not(128<=w)and 141 or 257,W,y,w,Y,O;else 
local w=(O-128)*16384;
local c=p-128+q*128+w;
return 18,W,3+y,_,Y,c;end;
elseif e<=144 then 
local e=Q[23](x,W);
return not not(128<=e)and 176 or 258,W,y,_,e,O;else 
local e=Q[23](x,y+2);
return not(e<128)and 200 or 90,e,y,_,Y,O;end;end,[56]=string.rep,[125]=string.sub,[2]=bit32.band,[29]=function(Q,Q)
return function(Q,e,e)
local e=Q[1];
local Y=Q[2];
return function()
local Q=0;
while true do 
local x=Q<=0;
if x then 
local x;
e[5][e[4]]=e[5][e[4]]-e[5][e[4]]%2+1;
local e;
Y[5][Y[4]],Q=(241153*Y[5][Y[4]]+233817333)%268435456,1;else 
return;end;end;end;end;end,[24]=(0),c=function(Q,Q,e,Y,x)
if Q<=139 then 
if Q<=138 then 
return 94,Y,1+x;else 
return 120,Y,x+1;end;
elseif Q<=140 then 
return not(1==Y)and 111 or 202,Y,x;else 
local Q=(x-128)*128+e;
return 87,2+Y,Q;end;end,[74]=function(Q,e,Y,x,x,_,_,O,y,W,q,q,p,p,w,c,c,c)
local c,a,s,u,v,k,M,r,U,X,N,z,C=Q[60],Q[25],Q[102],Q[28],Q[2],Q[65],Q[19],Q[121],Q[23],Q[82],Q[42],Q[126],Q[107];
return function(V,d,d)
local d,j,J,t,F,K,b,n,G,P,I,f,B=c,a,s,u,v,k,M,r,U,X,N,z,C;
return function(...)
local c,a,s,u,v,k,M=d(Y),j(),W;
local Y,W,r,U,X,N,z,C,d=2371559567;
while true do 
local j=p[s];
if j>=28 then 
local D;
if j>=42 then 
if j>=49 then 
if j<52 then 
if j>=50 then 
if j~=51 then 
u=2;
c[2]=a[e[s]];
c[6]=c[2][O[s+1]];
c[2]=a[w[s+1]];
c[2]=c[2][O[s]];
c[4]=5;
c[3]=c[5];
v=c[u];
k,c[u]=1,v(c[3],c[4]);
c[39]=c[p[s+1]];
v=c[39];
c[39]=v;
c[38]=v[w[s]];
u,v=38,q[s+1];
M=u+v;
c[u]=J(c[u](t(c,39,M)));
s=s+1;else 
local S,o,h=p[s+3],c[5];
repeat 
local A=o%4294967296;
if A~=A then 
h=0;
break;end;
h=A-A%1;until true;
c[S]=h;
c[4]=c[p[s+4]]+e[s+1];
h,o=w[s+3],s+2;
local A,L=c[p[o]],F(h,4294967295);
S,h,o=F(A,4294967295),F(L,65535),K(L,16);
local L,E=F(S,65535),K(S,16);
S=F(h*L+b(F(h*E+o*L,65535),16),4294967295);
h=nil;
repeat 
A=S%4294967296;
if A~=A then 
h=0;
break;end;
h=A-A%1;until true;
c[3]=h;
c[9]=p[s+1]+c[3];
c[4]=c[5]+e[s+2];
c[2]=Q[4];
c[3]=O[s+4];
u=_[s+2];
c[u]=c[u](c[u+1],c[u+2]);
u=2;
A,S,h=y[s],O[s+3],c[2];
local L,E=F(S,4294967295),F(h,4294967295);
local Z,g,i,l=F(L,65535),K(L,16),F(E,65535),K(E,16);
h=F(Z*i+b(F(Z*l+g*i,65535),16),4294967295);
S=nil;
repeat 
o=h%4294967296;
if o~=o then 
S=0;
break;end;
S=o-o%1;until true;
c[A]=S;
c[4]=c[5]+O[s];
c[2]=Q[121];
c[3]=e[s];
v,k,M=c[u],c[3],c[4];
c[u]=v(k,M);
A,o=w[s+4],c[2];
h,S=F(A,4294967295),F(o,4294967295);
local o,L,E,Z=F(h,65535),K(h,16),F(S,65535),K(S,16);
S=F(o*E+b(F(o*Z+L*E,65535),16),4294967295);
A=nil;
repeat 
h=S%4294967296;
if h~=h then 
A=0;
break;end;
A=h-h%1;until true;
c[2]=A;
c[2]=c[12]+c[y[s+2]];
s=_[s+1]-4+4;end;else 
u=7;
c[10]=c[2][O[s+1]];
c[2]=a[O[s]];
c[7]=c[2][O[s+2]];
c[p[s+2]]=13;
v,k=c[u],c[8];
v,c[u]=2,v(k,c[9]);
M,u=6,4;
c[2]=a[e[s+2]];
c[4]=c[2][w[s]];
c[6]=c[p[s+1]];
c[u]=J(c[u](t(c,5,M)));
c[2]=c[10];
s,k=q[s+1]-2+2,1;end;else 
if j>=54 then 
if j~=55 then 
u=V[y[s+1]];
c[p[s+1]]=u[5][u[4]];
c[_[s]]=not c[6];
s=(if c[4]then _[s+1]-1 else q[s]-1)+1;else 
local S,o,h=y[s],n(q[s],(F(n(Y,(F(K(Y,29),7))),536870911))),x[6];
local A=n(h[S],143377016);
h[S]=A;
h,S=x[5],A+1;
A=G(h,S);
local L,E;
if A<128 then 
L,E=A,S+1;else 
local Z=G(h,S+1);
if Z<128 then 
L,E=(A-128)*128+Z,S+2;else 
local g=G(h,S+2);
if g<128 then 
L,E=(A-128)*16384+(Z-128)+g*128,S+3;else 
local i=G(h,S+3);
L,E=(A-128)*2097152+(Z-128)*128+(g-128)*16384+i%128+(i-i%128)*2097152,S+4;end;end;end;
A,S=o*16843009,E+L;
local Z=S-L%4;
for L=E,Z-1,4 do 
P(h,L,(n(I(h,L),A)));end;
for A=Z,S-1,1 do 
f(h,A,(n(G(h,A),o)));end;
y[s]=248;
q[s]=175;
_[s]=249;
p[s]=4;end;else 
if j~=53 then 
u=V[y[s+1]];
c[4]=u[5][u[4]];
c[4]=c[p[s+1]]+1;
u=V[q[s]];
u[5][u[4]]=c[4];
u=V[_[s]];
c[6]=u[5][u[4]];
c[6]=c[6]%3294;
s=(if 0~=c[_[s+1]]then q[s+1]-1 else s)+1;else 
local S,o,h=p[s+1],c[2];
repeat 
local A=o%4294967296;
if A~=A then 
h=0;
break;end;
h=A-A%1;until true;
c[S]=h;
h,S,o=y[s],c[4];
repeat 
local A=S%4294967296;
if A~=A then 
o=0;
break;end;
o=A-A%1;until true;
c[h]=o;
S,o=c[5];
repeat 
h=S%4294967296;
if h~=h then 
o=0;
break;end;
o=h-h%1;until true;
c[7]=o;
h,S=c[8];
repeat 
o=h%4294967296;
if o~=o then 
S=0;
break;end;
S=o-o%1;until true;
c[8]=S;
h,o,S=q[s+1],c[9];
repeat 
local A=o%4294967296;
if A~=A then 
S=0;
break;end;
S=A-A%1;until true;
c[h]=S;
c[y[s+1]]=q[s];
Y=c[2];
c[2]=Q[121];
s=_[s+1]-1+1;end;end;end;else 
if j>=45 then 
if j<47 then 
if j~=46 then 
u,r,U,X,W=37,W[8],W[5],W[7],W[9];
c[38]=#c[36];
c[37]=1;
c[39]=1;
W,X,U={[8]=r,[7]=X,[5]=U,[9]=W},c[39]+0,c[38]+0;
r=c[u]-X;
s=q[s];else 
u,c[3]=2,c[p[s+1]]+c[4];
c[p[s+2]]=c[2]+c[_[s+1]];
c[2]=c[12]+c[2];
local S,o=c[2];
repeat 
local h=S%4294967296;
if h~=h then 
o=0;
break;end;
o=h-h%1;until true;
c[5]=o;
c[2]=c[y[s]];
o,S=c[2];
repeat 
local h=o%4294967296;
if h~=h then 
S=0;
break;end;
S=h-h%1;until true;
c[6]=S;
c[y[s+1]]=c[_[s+2]]+48021109;
S,o=y[s+2],c[4];
local h,A=F(S,4294967295),F(o,4294967295);
local L,E,Z,g=F(h,65535),K(h,16),F(A,65535),K(A,16);
o=F(L*Z+b(F(L*g+E*Z,65535),16),4294967295);
S=nil;
repeat 
local h=o%4294967296;
if h~=h then 
S=0;
break;end;
S=h-h%1;until true;
c[3]=S;
c[7]=e[s]+c[3];
c[4]=c[6]+q[s+1];
c[2]=Q[4];
c[3]=85596795;
v,k,M=c[u],c[3],c[4];
c[u]=v(k,M);
o,S=e[s+2],c[2];
local h,A=F(o,4294967295),F(S,4294967295);
local L,E,Z,g=F(h,65535),K(h,16),F(A,65535),K(A,16);
S=F(L*Z+b(F(L*g+E*Z,65535),16),4294967295);
o=nil;
repeat 
local h=S%4294967296;
if h~=h then 
o=0;
break;end;
o=h-h%1;until true;
c[8]=o;
c[3]=c[1]+201900778;
S,o=c[3];
repeat 
local h=S%4294967296;
if h~=h then 
o=0;
break;end;
o=h-h%1;until true;
c[1]=o;
s=_[s]-2+2;end;else 
if j==48 then 
u=37;
c[37]=q[s];
c[38]=216;
c[39]=1;
D=W;
W,X,U={[8]=r,[7]=X,[5]=U,[9]=D},c[39]+0,c[38]+0;
r=c[u]-X;
s=_[s];else 
k,N,u=1,10,V[q[s]];
u,c[6]=6,u[5][u[4]];
c[7]=22424525;
c[9]=p[s+1];
c[10]=412821314;
M=u+q[s+1];
v,M,c[u]=4,6,J(c[u](t(c,7,M)));
u=6;
c[7]=_[s];
c[9]=y[s+1];
c[10]=c[6];
c[6]=c[3];
z=c[N];
C=z.n;
z.n=v+C-1;
B(z,1,C,v,z);
B(c,7,9,1,z);
d=J(c[u](t(z,1,z.n)));
B(d,1,k,u,c);
s=y[s]-1+1;end;end;else 
if j<43 then 
c[3]=w[s+1];
u=p[s+2];
c[u]=c[u](c[u+1],c[u+2]);
u=2;
local S,o,h=p[s+1],e[s],c[2];
local A,L=F(o,4294967295),F(h,4294967295);
local E,Z,g,i=F(A,65535),K(A,16),F(L,65535),K(L,16);
h=F(E*g+b(F(E*i+Z*g,65535),16),4294967295);
o=nil;
repeat 
local A=h%4294967296;
if A~=A then 
o=0;
break;end;
o=A-A%1;until true;
c[S]=o;
c[2]=c[1]-12674830;
S,h=c[2];
repeat 
o=S%4294967296;
if o~=o then 
h=0;
break;end;
h=o-o%1;until true;
c[1]=h;
c[p[s+3]]=c[8]+y[s+2];
c[2]=Q[_[s+3]];
c[y[s]]=O[s];
v,k,M=c[u],c[3],c[4];
c[u]=v(k,M);
o,S=w[s+3],c[2];
local A,L=F(o,4294967295),F(S,4294967295);
local E,Z,g,i=F(A,65535),K(A,16),F(L,65535),K(L,16);
h=F(E*g+b(F(E*i+Z*g,65535),16),4294967295);
S=nil;
repeat 
o=h%4294967296;
if o~=o then 
S=0;
break;end;
S=o-o%1;until true;
c[2]=S;
c[2]=c[10]+c[2];
c[2]=c[9]+c[2];
S,o,h=q[s+1],c[2];
repeat 
local A=o%4294967296;
if A~=A then 
h=0;
break;end;
h=A-A%1;until true;
c[S]=h;
s=q[s+3]-3+3;else 
if j~=44 then 
c[4]=2*c[p[s+1]];
c[3]=1-c[4];
c[2]=c[3]*c[q[s+1]];
c[3]=e[s];
Y=c[3];
c[11]=c[38]~=c[y[s]];
s=(if c[11]then _[s+1]-1 else y[s+1]-1)+1;else 
c[4]=w[s+2];
c[2]=c[2](c[3],c[4]);
u,c[p[s+2]]=3,Q[p[s+3]];
c[5]=w[s+3];
c[4]=c[6];
c[u]=c[u](c[4],c[5]);
c[2]=c[p[s+1]]+c[3];
c[10]=O[s+3]+c[2];
c[y[s]]=Q[q[s+2]];
c[4]=O[s+1];
c[q[s+1]]=c[7];
u=_[s];
v,k,M=c[u],c[u+1],c[u+2];
c[u]=v(k,M);
s=_[s+2]-3+3;end;end;end;end;else 
if j>=35 then 
if j<38 then 
if j>=36 then 
if j==37 then 
v,r,u,U,X,k,N,W=2,W[8],4,W[5],W[7],1,4,W[9];
c[p[s+2]]=a[w[s]];
c[2]=c[p[s+1]][e[s]];
c[3]=a[w[s+1]];
c[6]=c[1]+132906819;
local S,o=c[6];
repeat 
local h=S%4294967296;
if h~=h then 
o=0;
break;end;
o=h-h%1;until true;
c[1]=o;
c[y[s+2]]=c[3][e[s+2]];
c[6]=_[s+1];
M,c[u]=2,J(c[u](t(c,5,6)));
u=2;
c[3]=c[5];
z=c[N];
C=z.n;
d=v+C-1;
z.n=d;
B(z,1,C,v,z);
B(c,3,3,1,z);
v=J(c[u](t(z,1,z.n)));
B(v,1,k,u,c);
u=V[_[s]];
c[3]=u[5][u[4]];
s=q[s+1]-2+2;else 
v,u=(n(q[s],(F(n(Y,(F(K(Y,29),7))),536870911)))),y[s]+1;
for S=1,_[s],1 do 
v=F(n(v,(b(v,13))),536870911);
v=n(v,(K(v,13)));
v=F(n(v,(b(v,14))),536870911);
y[u]=n(y[u],(F(K(v,0),127)));
q[u]=n(q[u],(F(K(v,7),127)));
_[u]=n(_[u],(F(K(v,14),127)));
p[u]=n(p[u],(F(K(v,21),127)));
u=u+1;end;
p[s]=4;end;else 
u=2;
local S,o=c[5];
repeat 
local h=S%4294967296;
if h~=h then 
o=0;
break;end;
o=h-h%1;until true;
c[5]=o;
c[p[s+1]]=c[p[s+3]]+w[s+2];
o,S=c[4],F(285744509,4294967295);
local h,A,L=F(o,4294967295),F(S,65535),K(S,16);
o,S=F(h,65535),K(h,16);
local h=F(A*o+b(F(A*S+L*o,65535),16),4294967295);
S=nil;
repeat 
o=h%4294967296;
if o~=o then 
S=0;
break;end;
S=o-o%1;until true;
c[3]=S;
c[p[s+2]]=492287275;
Y=c[q[s+2]];
c[9]=w[s+1]+c[q[s]];
c[4]=c[5]+O[s+1];
c[2]=Q[4];
c[3]=w[s+3];
v,k,M=c[u],c[3],c[4];
c[u]=v(k,M);
h,o,S=q[s+3],O[s+2],c[2];
local A,L=F(o,4294967295),F(S,4294967295);
local E,Z,g,i=F(A,65535),K(A,16),F(L,65535),K(L,16);
S=F(E*g+b(F(E*i+Z*g,65535),16),4294967295);
o=nil;
repeat 
local A=S%4294967296;
if A~=A then 
o=0;
break;end;
o=A-A%1;until true;
c[h]=o;
c[4]=c[5]+O[s+3];
c[2]=Q[2];
s=s+3;end;else 
if j<40 then 
if j~=39 then 
u=2;
c[p[s+1]]=476128311;
c[4]=0;
c[_[s]]=c[5];
v,k,M=c[u],c[3],c[4];
c[u]=v(k,M);
c[1]=c[2];
c[2]=Q[86];
c[4]=Q[61];
c[q[s+1]]=Q[120];
c[y[s+1]]=Q[119];
c[y[s]]=Q[106];
s=q[s]-1+1;else 
u=2;
c[p[s+1]]=w[s];
v,k,M=c[u],c[3],c[4];
c[u]=v(k,M);
local S,o=w[s+1],c[_[s]];
local h,A=F(S,4294967295),F(o,4294967295);
local L,E,Z,g=F(h,65535),K(h,16),F(A,65535),K(A,16);
h=F(L*Z+b(F(L*g+E*Z,65535),16),4294967295);
S=nil;
repeat 
o=h%4294967296;
if o~=o then 
S=0;
break;end;
S=o-o%1;until true;
c[2]=S;
c[3]=462287001;
Y=c[q[s]];
c[2]=c[12]+c[2];
c[2]=c[9]+c[2];
L,S,E=_[s+1],c[2];
repeat 
g=S%4294967296;
if g~=g then 
E=0;
break;end;
E=g-g%1;until true;
c[L]=E;
s=q[s+1]-1+1;end;else 
if j==41 then 
u=2;
c[p[s+2]]=c[6]+48021109;
c[p[s+1]]=Q[p[s+3]];
c[3]=_[s];
v,k,M=c[u],c[3],c[4];
c[u]=v(k,M);
local S,o=e[s+1],c[2];
local h,A=F(S,4294967295),F(o,4294967295);
local L,E,Z,g=F(h,65535),K(h,16),F(A,65535),K(A,16);
S=F(L*Z+b(F(L*g+E*Z,65535),16),4294967295);
o=nil;
repeat 
local h=S%4294967296;
if h~=h then 
o=0;
break;end;
o=h-h%1;until true;
c[2]=o;
c[y[s+3]]=c[8]+c[_[s+2]];
c[2]=c[7]+c[y[s]];
local h,A,L=y[s+1],c[2];
repeat 
o=A%4294967296;
if o~=o then 
L=0;
break;end;
L=o-o%1;until true;
c[h]=L;
c[2]=c[q[s]];
o,S=c[2];
repeat 
h=o%4294967296;
if h~=h then 
S=0;
break;end;
S=h-h%1;until true;
c[7]=S;
c[4]=c[7]+e[s+2];
L,h,A=_[s+1],c[4],F(209507537,4294967295);
local o,E,Z=F(h,4294967295),F(A,65535),K(A,16);
S,A=F(o,65535),K(o,16);
h=F(E*S+b(F(E*A+Z*S,65535),16),4294967295);
S=nil;
repeat 
A=h%4294967296;
if A~=A then 
S=0;
break;end;
S=A-A%1;until true;
c[L]=S;
s=_[s+3]-3+3;else 
u=V[_[s]];
c[q[s]]=u[5][u[4]];end;end;end;else 
if j<31 then 
if j>=29 then 
if j==30 then 
c[6]=V[q[s+1]][w[s+1]];
c[p[s+1]]=c[6]~=w[s];
s=q[s]-1+1;else 
c[6]=a[w[s+1]];
c[6]=c[p[s+1]][e[s]];
c[6]=c[6]();
c[8]=V[_[s+1]];
c[y[s]]=c[6]-c[8];
c[q[s+1]]=c[6]>=_[s];
s+=1;end;else 
s=if c[y[s]]then q[s]else _[s];end;else 
if j>=33 then 
if j==34 then 
r+=X;
u=if X<=0 then r>=U else r<=U;
if u then 
c[q[s]]=r;
s=_[s];else end;else 
u,v,k,M=q[s],n(Y,F(K(Y,14),262143),(F(K(Y,28),15))),_[s],y[s];
N=k<16384 and 7 or(k<2097152 and 14 or 21);
z,C=K(k,N),F(k,b(1,N)-1);
_[s]=n(C,58,(F(K(v,14),127)));
p[s]=n(z,37,(F(K(v,21),127)));
q[s]=n(u,83,(F(K(v,7),127)));
y[s]=n(M,16,(F(v,127)));
s=s-1;end;else 
if j~=32 then 
return;else 
u=2;
c[3]=#c[37];
c[2]=1;
c[4]=1;
c[p[s+1]]=O[s+1];
c[8]=e[s];
D=W;
W,X,U={[8]=r,[7]=X,[5]=U,[9]=D},c[4]+0,c[3]+0;
r,s=c[u]-X,y[s+1]-1+1;end;end;end;end;end;else 
if j<14 then 
if j<7 then 
if j<3 then 
if j<1 then 
c[2](e[s]);
s=y[s];else 
if j==2 then 
r,U,X,W=W[8],W[5],W[7],W[9];
s=y[s];else 
u=p[s+4];
c[u]=c[u](c[u+1],c[u+2]);
local W,r=O[s+2],c[2];
local U,X=F(W,4294967295),F(r,4294967295);
local D,S,o,h=F(U,65535),K(U,16),F(X,65535),K(X,16);
W=F(D*o+b(F(D*h+S*o,65535),16),4294967295);
r=nil;
repeat 
local U=W%4294967296;
if U~=U then 
r=0;
break;end;
r=U-U%1;until true;
c[9]=r;
c[p[s+3]]=c[7]+O[s];
c[p[s+1]]=Q[2];
c[3]=3854354;
u=p[s+2];
v,k,M=c[u],c[u+1],c[u+2];
c[u]=v(k,M);
r,W=e[s],c[2];
local U,X=F(r,4294967295),F(W,4294967295);
local D,S,o,h=F(U,65535),K(U,16),F(X,65535),K(X,16);
W=F(D*o+b(F(D*h+S*o,65535),16),4294967295);
r=nil;
repeat 
local U=W%4294967296;
if U~=U then 
r=0;
break;end;
r=U-U%1;until true;
c[2]=r;
c[2]=c[9]+c[2];
c[2]=c[8]+c[_[s+3]];
local U,X,D=y[s+2],c[q[s+2]];
repeat 
W=X%4294967296;
if W~=W then 
D=0;
break;end;
D=W-W%1;until true;
c[U]=D;
c[q[s+4]]=c[5];
r,X,W=q[s+3],c[2];
repeat 
U=X%4294967296;
if U~=U then 
W=0;
break;end;
W=U-U%1;until true;
c[r]=W;
c[4]=c[8]+332179032;
r,D=w[s+1],c[4];
X,U=F(r,4294967295),F(D,4294967295);
local S,o,h,A=F(X,65535),K(X,16),F(U,65535),K(U,16);
r=F(S*h+b(F(S*A+o*h,65535),16),4294967295);
W=nil;
repeat 
D=r%4294967296;
if D~=D then 
W=0;
break;end;
W=D-D%1;until true;
c[3]=W;
c[9]=w[s+4]+c[3];
c[4]=c[8]+q[s+1];
c[2]=Q[4];
s=_[s+1]-4+4;end;end;else 
if j<5 then 
if j~=4 then 
c[_[s]](e[s]);end;else 
if j==6 then 
u,k=9,1;
c[q[s]]=307912020;
c[12]=431290692;
c[9]=c[2];
c[11]=c[6];
c[13]=c[_[s]];
z=J(c[u](t(c,10,13)));
B(z,1,k,u,c);
c[8]=c[9];
s,v,M,N=y[s],4,9,13;else 
u,c[2]=2,Q[2];
c[p[s+3]]=w[s];
v,k,M=c[u],c[3],c[4];
c[u]=v(k,M);
local W,r=e[s+2],c[2];
local U,X=F(W,4294967295),F(r,4294967295);
local D,S,o,h=F(U,65535),K(U,16),F(X,65535),K(X,16);
W=F(D*o+b(F(D*h+S*o,65535),16),4294967295);
r=nil;
repeat 
local U=W%4294967296;
if U~=U then 
r=0;
break;end;
r=U-U%1;until true;
c[2]=r;
c[p[s+2]]=c[8]+c[2];
c[p[s+1]]=c[7]+c[2];
local U,X,D=_[s+2],c[2];
repeat 
W=X%4294967296;
if W~=W then 
D=0;
break;end;
D=W-W%1;until true;
c[U]=D;
c[2]=c[5];
D,r=c[_[s+1]];
repeat 
W=D%4294967296;
if W~=W then 
r=0;
break;end;
r=W-W%1;until true;
c[7]=r;
c[4]=c[_[s]]+e[s+3];
D,U=c[4],F(458038139,4294967295);
r,X,W=F(D,4294967295),F(U,65535),K(U,16);
D,U=F(r,65535),K(r,16);
r=F(X*D+b(F(X*U+W*D,65535),16),4294967295);
W=nil;
repeat 
U=r%4294967296;
if U~=U then 
W=0;
break;end;
W=U-U%1;until true;
c[3]=W;
c[8]=w[s+2]+c[3];
c[q[s+1]]=c[7]+O[s+3];
c[y[s+3]]=Q[4];
c[3]=3854354;
s=y[s+1]-3+3;end;end;end;else 
if j>=10 then 
if j<12 then 
if j~=11 then 
s=q[s];else 
u=2;
c[p[s+1]]=O[s+2];
v,k,M=c[u],c[3],c[4];
c[u]=v(k,M);
local W,r,U=p[s+2],w[s+2],c[2];
local X,D=F(r,4294967295),F(U,4294967295);
local S,o,h,A=F(X,65535),K(X,16),F(D,65535),K(D,16);
r=F(S*h+b(F(S*A+o*h,65535),16),4294967295);
A=nil;
repeat 
o=r%4294967296;
if o~=o then 
A=0;
break;end;
A=o-o%1;until true;
c[W]=A;
c[2]=c[10]+c[2];
c[p[s+3]]=c[q[s+2]]+c[2];
U,D,W=y[s+1],c[2];
repeat 
S=D%4294967296;
if S~=S then 
W=0;
break;end;
W=S-S%1;until true;
c[U]=W;
c[3]=c[8]*67108864;
c[2]=c[3]+c[_[s+3]];
c[2]=c[2]/e[s+3];
c[_[s]]=y[s]+c[2];
c[q[s+1]]=c[7]-_[s+1];
c[3]=q[s]^c[4];
c[2]=c[2]*c[3];
s=s+3;end;else 
if j==13 then 
u=V[q[s]];
c[p[s+1]]=u[5][u[4]];
c[q[s+1]]=c[4]<3410;
s=(if c[y[s]]then _[s+1]-1 else _[s]-1)+1;else 
c[34]=c[36];
v=c[34];
c[34]=v;
c[33]=v[O[s+2]];
c[32]=c[33];
c[33]=c[34];
c[p[s+1]]=c[p[s+2]];
c[32]=c[32](c[33],c[34]);
v,u=4,V[y[s]];
c[2]=u[5][u[4]];
u=V[y[s+1]];
c[q[s+2]]=u[5][u[4]];
u=3;
c[4]=_[s];
c[6]=5;
c[7]=224938499;
B(J(c[u](t(c,4,7))),1,1,u,c);
c[29]=307912020;
k=1;
c[31]=131864277;
c[28]=c[2];
c[30]=c[3];
u=q[s];
M,N,z=u+k-1,u+v,J(c[u](t(c,u+1,u+v)));
B(z,1,k,u,c);
c[_[s+1]]=c[28];
c[2]=a[w[s+2]];
s=q[s+1]-2+2;end;end;else 
if j>=8 then 
if j~=9 then 
u=2;
c[2]=c[9]+c[p[s+3]];
c[p[s+1]]=c[8]+c[2];
local W,r=c[p[s+2]];
repeat 
local U=W%4294967296;
if U~=U then 
r=0;
break;end;
r=U-U%1;until true;
c[7]=r;
c[2]=c[5];
W,r=c[2];
repeat 
local U=W%4294967296;
if U~=U then 
r=0;
break;end;
r=U-U%1;until true;
c[8]=r;
c[4]=c[8]+e[s+2];
r,W=w[s],c[4];
local U,X=F(r,4294967295),F(W,4294967295);
local D,S,o,h=F(U,65535),K(U,16),F(X,65535),K(X,16);
W=F(D*o+b(F(D*h+S*o,65535),16),4294967295);
r=nil;
repeat 
local U=W%4294967296;
if U~=U then 
r=0;
break;end;
r=U-U%1;until true;
c[3]=r;
c[9]=w[s+1]+c[3];
c[4]=c[y[s+3]]+O[s+3];
c[2]=Q[q[s]];
c[3]=e[s+3];
v,k,M=c[u],c[3],c[4];
c[u]=v(k,M);
W,r=e[s+1],s+1;
local U,X=c[_[r]],F(W,4294967295);
local D,S,o=F(U,4294967295),F(X,65535),K(X,16);
U,r=F(D,65535),K(D,16);
W=F(S*U+b(F(S*r+o*U,65535),16),4294967295);
U=nil;
repeat 
r=W%4294967296;
if r~=r then 
U=0;
break;end;
U=r-r%1;until true;
c[12]=U;
c[4]=c[8]+O[s];
c[2]=Q[121];
s=s+3;else 
u=2;
c[3]=c[7];
v,k=2,p[s+1];
M,z=u+k-1,c[4];
C=z.n;
d=v+C-1;
z.n=d;
B(z,1,C,v,z);
B(c,3,3,1,z);
N=J(c[u](t(z,1,z.n)));
B(N,1,k,u,c);
c[y[s+1]]=c[_[s+1]];
s=q[s+1]-1+1;end;else 
v,u=y[s],_[s]+1;
for W=1,q[s],1 do 
v=F(n(v,(b(v,13))),536870911);
v=n(v,(K(v,13)));
v=F(n(v,(b(v,14))),536870911);
y[u]=n(y[u],(F(K(v,0),127)));
q[u]=n(q[u],(F(K(v,7),127)));
_[u]=n(_[u],(F(K(v,14),127)));
p[u]=n(p[u],(F(K(v,21),127)));
u=u+1;end;
p[s]=4;end;end;end;else 
if j<21 then 
if j<17 then 
if j>=15 then 
if j~=16 then 
c[10]=a[O[s+1]];
c[2]=Q[86];
c[4]=Q[61];
c[5]=Q[120];
c[8]=Q[119];
c[9]=Q[106];
local W,r,U=p[s+1],c[q[s+1]];
repeat 
local X=r%4294967296;
if X~=X then 
U=0;
break;end;
U=X-X%1;until true;
c[W]=U;
r,U=c[4];
repeat 
W=r%4294967296;
if W~=W then 
U=0;
break;end;
U=W-W%1;until true;
c[6]=U;
U,W,r=q[s],c[5];
repeat 
local X=W%4294967296;
if X~=X then 
r=0;
break;end;
r=X-X%1;until true;
c[U]=r;
U,r=c[8];
repeat 
W=U%4294967296;
if W~=W then 
r=0;
break;end;
r=W-W%1;until true;
c[8]=r;
U,W=c[9];
repeat 
r=U%4294967296;
if r~=r then 
W=0;
break;end;
W=r-r%1;until true;
c[9]=W;
s=_[s]-1+1;else 
local W,r=c[2];
repeat 
local U=W%4294967296;
if U~=U then 
r=0;
break;end;
r=U-U%1;until true;
c[1]=r;
c[2]=O[s];
Y=c[2];
s=q[s];end;else 
c[2]=a[e[s]];
c[3]=w[s+1];
Y=c[3];
c[2]=c[p[s+1]](c[38]);
c[11]=c[2]~=O[s+1];
c[2]=O[s];
Y=c[q[s+1]];
s=y[s]-1+1;end;else 
if j>=19 then 
if j==20 then 
B({...},1,3,36,c);
u=V[y[s+1]];
c[2]=u[5][u[4]];
u=2;
local W,r=c[2];
repeat 
local U=W%4294967296;
if U~=U then 
r=0;
break;end;
r=U-U%1;until true;
c[3]=r;
c[2]=Q[p[s+1]];
c[4]=q[s];
v,k,M=c[u],c[3],c[4];
c[u]=v(k,M);
Y=c[2];
c[5]=Q[121];
s=_[s+1]-1+1;else 
k,v=1,2;
c[3]=c[2];
c[4]=c[38];
c[p[s+3]]=c[6];
u=p[s+2];
M,N=u+k-1,u+v;
z=c[N];
C=z.n;
d=v+C-1;
z.n=d;
B(z,1,C,v,z);
B(c,u+1,N-1,1,z);
C=J(c[u](t(z,1,z.n)));
B(C,1,k,u,c);
k,c[p[s+1]]=1,c[2];
u=V[y[s+2]];
c[q[s]]=u[5][u[4]];
u=V[_[s+3]];
u,c[6]=6,u[5][u[4]];
c[_[s]]=q[s+3];
c[y[s]]=y[s+1];
c[10]=_[s+1];
z=J(c[u](t(c,7,10)));
B(z,1,k,u,c);
s,v,M,N=q[s+2]-3+3,4,6,10;end;else 
if j==18 then 
c[8]=e[s+3]+c[p[s+1]];
c[4]=c[7]+e[s+2];
c[p[s+3]]=Q[p[s+2]];
c[3]=w[s+3];
c[2]=c[2](c[3],c[4]);
local W,r=e[s],s+1;
local U,X=c[_[r]],F(W,4294967295);
local N,z,C=F(U,4294967295),F(X,65535),K(X,16);
W,U=F(N,65535),K(N,16);
r=F(z*W+b(F(z*U+C*W,65535),16),4294967295);
U=nil;
repeat 
W=r%4294967296;
if W~=W then 
U=0;
break;end;
U=W-W%1;until true;
c[9]=U;
c[4]=c[7]+w[s+2];
c[2]=Q[2];
c[3]=e[s+1];
u=_[s+3];
v,k,M=c[u],c[u+1],c[u+2];
c[u]=v(k,M);
U,W=w[s+1],c[_[s]];
local X,N=F(U,4294967295),F(W,4294967295);
local z,C,V,d=F(X,65535),K(X,16),F(N,65535),K(N,16);
W=F(z*V+b(F(z*d+C*V,65535),16),4294967295);
U=nil;
repeat 
r=W%4294967296;
if r~=r then 
U=0;
break;end;
U=r-r%1;until true;
c[2]=U;
s=_[s+2]-3+3;else 
c[p[s+1]]=a[O[s+1]];
c[y[s]]=c[q[s]][e[s+1]];
c[4]=w[s+1];
c[5]=c[2];
return c[3](t(c,4,6));end;end;end;else 
if j>=24 then 
if j<26 then 
if j==25 then 
c[2]=Q[121];
c[4]=w[s+3];
c[2]=c[2](c[3],c[4]);
u,c[3]=3,Q[p[s+3]];
c[p[s+1]]=e[s+3];
c[4]=c[p[s+2]];
c[u]=c[u](c[4],c[5]);
u,c[2]=2,c[y[s+2]]+c[q[s+1]];
c[_[s+2]]=O[s+1]+c[2];
c[2]=Q[y[s+1]];
c[4]=O[s];
c[3]=c[7];
v,k,M=c[u],c[3],c[4];
c[u]=v(k,M);
c[3]=Q[121];
c[5]=w[s];
c[4]=c[8];
s=_[s+3]-3+3;else 
c[p[s+2]]=c[p[s+1]]+c[2];
local W,a=c[2];
repeat 
local r=W%4294967296;
if r~=r then 
a=0;
break;end;
a=r-r%1;until true;
c[2]=a;
c[3]=c[8]*67108864;
c[2]=c[3]+c[2];
c[p[s+3]]=c[2]/w[s+3];
c[2]=1+c[2];
c[4]=c[7]-1023;
c[3]=2^c[4];
c[q[s+3]]=c[2]*c[y[s+1]];
c[_[s]]=2*c[6];
c[_[s+3]]=1-c[y[s+2]];
c[q[s+2]]=e[s];
Y=c[4];
s=_[s+1]-3+3;end;else 
if j==27 then 
u=2;
c[4]=c[3]*c[2];
c[2]=c[p[s+1]]+y[s+1];
local W,a,r=q[s],c[2];
repeat 
local U=a%4294967296;
if U~=U then 
r=0;
break;end;
r=U-U%1;until true;
c[W]=r;
c[2]=c[10];
c[3]=c[38];
v,k,M=c[u],c[3],c[4];
c[u]=v(k,M);
c[q[s+1]]=not c[2];
c[2]=c[y[s]]-280019426;
s=_[s]-1+1;else 
u=2;
c[2]=c[p[s+1]];
local W,a,r=p[s+4],c[p[s+3]];
repeat 
local U=a%4294967296;
if U~=U then 
r=0;
break;end;
r=U-U%1;until true;
c[W]=r;
c[4]=c[p[s+2]]+e[s+3];
W,r,a=q[s+1],c[4],F(33268194,4294967295);
local U,X,N=F(r,4294967295),F(a,65535),K(a,16);
r,a=F(U,65535),K(U,16);
local U=F(X*r+b(F(X*a+N*r,65535),16),4294967295);
r=nil;
repeat 
a=U%4294967296;
if a~=a then 
r=0;
break;end;
r=a-a%1;until true;
c[W]=r;
c[7]=q[s+2]+c[3];
c[4]=c[6]+e[s];
c[2]=Q[4];
c[3]=w[s+1];
v,k,M=c[u],c[3],c[4];
c[u]=v(k,M);
r,U=O[s+3],c[2];
a,W=F(r,4294967295),F(U,4294967295);
local X,N,z,C=F(a,65535),K(a,16),F(W,65535),K(W,16);
a=F(X*z+b(F(X*C+N*z,65535),16),4294967295);
r=nil;
repeat 
U=a%4294967296;
if U~=U then 
r=0;
break;end;
r=U-U%1;until true;
c[8]=r;
c[y[s+4]]=c[_[s+1]]+w[s+3];
c[2]=266234259;
Y=c[2];
c[2]=c[q[s+4]]+171445790;
r,U=c[_[s+4]];
repeat 
a=r%4294967296;
if a~=a then 
U=0;
break;end;
U=a-a%1;until true;
c[1]=U;
s=_[s+2]-4+4;end;end;else 
if j<22 then 
c[3]=Q[121];
c[5]=w[s+1];
c[4]=c[8];
c[3]=c[3](c[4],c[5]);
u=4;
c[4]=Q[121];
c[p[s+1]]=O[s];
c[5]=c[9];
v,k,M=c[u],c[5],c[6];
c[u]=v(k,M);
c[p[s+2]]=c[3]+c[q[s+1]];
c[2]=c[2]+c[3];
c[y[s]]=c[q[s+2]]+c[_[s+1]];
local W,w=c[2];
repeat 
local a=W%4294967296;
if a~=a then 
w=0;
break;end;
w=a-a%1;until true;
c[5]=w;
s=s+2;else 
if j~=23 then 
c[3]=c[3](c[4],c[5]);
c[4]=O[s+1];
Y=c[4];
c[4]=Q[121];
c[6]=e[s+1];
c[5]=c[9];
u=p[s+1];
v,k,M=c[u],c[u+1],c[u+2];
c[u]=v(k,M);
c[5]=c[1]-_[s];
local Q,e,Y=y[s+1],c[5];
repeat 
local O=e%4294967296;
if O~=O then 
Y=0;
break;end;
Y=O-O%1;until true;
c[Q]=Y;
s=q[s]-1+1;else 
local Q,e,Y=q[s],_[s],x[6];
local O=n(Y[Q],143377016);
Y[Q]=O;
Q,Y=x[5],O+1;
O=G(Q,Y);
local x,W;
if O<128 then 
x,W=O,Y+1;else 
local w=G(Q,Y+1);
if w<128 then 
x,W=(O-128)*128+w,Y+2;else 
local c=G(Q,Y+2);
if c<128 then 
x,W=(O-128)*16384+(w-128)+c*128,Y+3;else 
local a=G(Q,Y+3);
x,W=(O-128)*2097152+(w-128)*128+(c-128)*16384+a%128+(a-a%128)*2097152,Y+4;end;end;end;
O,Y=e*16843009,W+x;
local w=Y-x%4;
for x=W,w-1,4 do 
P(Q,x,(n(I(Q,x),O)));end;
for x=w,Y-1,1 do 
f(Q,x,(n(G(Q,x),e)));end;
q[s]=134;
_[s]=215;
y[s]=116;
p[s]=4;end;end;end;end;end;end;
s=s+1;end;end;end;end,L7=function(Q,e,Y,x,_,O,y)
if Y<=4 then 
local Y=Q[23](y,3+e);
local W,q,p,w=2097152*(x-128),(_-128)*128,16384*(O-128),Y%128;
local _=(Y-Y%128)*2097152+p+(q+W+w);
return 30,y,4+e,_,O;else 
local Y=Q[23](y,e+2);
if not(Y<128)then 
return 33,y,e,x,Y;else 
return 21,Y,e,x,O;end;end;end,n7=function(Q,Q,e)
return Q[5][Q[4]+e];end,[20]=select,[57]=tostring,f={},S7=function(Q,e,Y,x,_,O,y,W,q,p,w,c,a)
if p<=5 then 
if p<=4 then 
W[O]=e;
local s,u,v=Q:T7(W,Y);
local k=Q[23](Y,v);
return not(128>k)and 11 or 26,s,u,v,k,q,a;else 
local s=Q[23](x,1+w);
return not(128>s)and 22 or 14,W,O,e,y,s,a;end;
elseif p<=6 then 
local x,w=16384*(q-128),c-128;
local c=a*128+x+w;
return 9,W,O,3+e,y,c,a;
elseif p<=7 then 
local x=Q[23](Y,2+e);
return not(x>=128)and 6 or 31,W,O,e,y,q,x;else 
return 4,W,O,Q[14](_),y,q,a;end;end,Ot=function(Q,...)
local e,Y,x,_,O,y,W,q,p,w,c=Q:W7();
local a,s,u,v,k,M,r,U,X,N,z=Y,x,Q[102](...),_,O,y,W,q,p,w,c;
while e do 
if a<=17 then 
if a<=8 then 
if a<=3 then 
_=Q[102](Q:y7(r,v,k,s,N,M,a,U,Q:w7(u)));
O,Y,w,q,p,x,W,c=Q:w7(_);
a,s,v,k,M,r,U,N=O,Y,w,q,p,x,W,c;
elseif a<=5 then 
a,v,k,r,X=Q:L7(k,a,r,U,X,v);else 
a,k,r,U,X=Q:h7(X,a,k,z,v,r,U,N);end;
elseif a<=12 then 
local e,Y,x,_,O,y=Q:A7(X,U,r,s,a,N,k);
if e==1 then 
a,s,k,r,X=Y,x,_,O,y;
elseif e==2 then 
return v;end;
elseif a<=14 then 
a,v,k,r=Q:i7(U,r,M,v,k,a);else 
a,k,M,U,X=Q:C7(a,v,N,M,U,k,z,X,s);end;
elseif a<=26 then 
if a<=21 then 
a,v,k,U,X=Q:Y7(v,k,U,X,r,a);else 
a,v,k,r,U,z=Q:c7(k,z,v,s,a,r,U);end;
elseif a<=31 then 
a,s,k,r,U,X=Q:Z7(U,a,s,r,M,N,k,X,v);else 
a,s,v,k,N=Q:M7(a,X,r,k,N,s,v,U);end;end;end,E=function(Q,e,Y,x,_,O,y,W)
if Y<=90 then 
if Y<=89 then 
return 19,O,_,1+e,y;else 
local q,p=16384*(O-128),_-128;
return 218,128*e+(p+q),W+3,e,y;end;
elseif Y<=91 then 
local Y=Q[23](x,W);
return not not(Y>=128)and 215 or 248,O,Y,e,y;else 
local Y=Q[23](x,2+W);
return Y<128 and 62 or 46,O,_,e,Y;end;end,[48]=pairs,[51]=buffer.fill,z7=function(Q,Q,e,Y,x,_,O,y,W,q,p)
if x<=236 then 
if x<=235 then 
local w,c=(Y-128)*16384,q-128;
return 70,O*128+c+w,3+W,e,Y,_,p;else 
local q,w,c=Q[2],Q[4],Q[5];
local a,s=q+w,w<=0;
q,w=a>=c,a<=c;
c=s and q or not s and w;
Q[2]=a;
if c then 
return 253,O,W,e,a,_,p;else 
return 210,O,W,e,Y,_,p;end;end;
elseif x<=237 then 
local Q,x=(_-128)*16384,p-128;
local q=y*128+(Q+x);
return 119,O,W,3+e,Y,q,p;else 
local Q=128*(p-128)+y;
return 180,O,W,e+2,Y,_,Q;end;end,[81]=string.unpack,Q7=function(Q,e,Y,x,_,O,y,W,q,p,w,c,a,s,u,v,k,M,r)
if v<=246 then 
if v<=244 then 
if v<=243 then 
return 25,w[2],k,a,x,y,_,r,O;else 
local U=Q[23](k,a+1);
return not(128>U)and 2 or 182,w,k,a,x,U,_,r,W;end;
elseif v<=245 then 
local U=Q[23](k,O);
return U<128 and 139 or 135,w,k,a,x,O,_,U,W;else 
return 147,w,k,a,x+1,O,_,r,W;end;
elseif v<=248 then 
if v<=247 then 
u[0]=M;
s[0]=p;
Q[34](u,r);
Q[34](s,r);
return 8,w,W,a,x,x,Q[e](Q,u,p,_,Y,c,s,nil,nil,M,nil,y,O,a,q),r,W;else 
return 146,w,k,a,O+1,O,_,r,W;end;
elseif v<=249 then 
return 119,w,k,a,x,1+O,_,r,W;else 
return 88,w,k,a+1,x,O,_,r,W;end;end,b=function(Q,e,Y,x,_,O,y,W,q,p,w,c)
if w<=163 then 
if w<=162 then 
local a,s,u=16384*(O-128),Y-128,x*128;
local Y=s+a+u;
return 180,p,3+y,c,e,Y;else 
local Y=(c-128)*16384;
local x=_-128+(Y+W*128);
return 50,p+3,y,x,e,O;end;
elseif w<=164 then 
local Y=Q[23](q,y+2);
return not not(128<=Y)and 171 or 230,p,y,c,Y,O;else 
return 74,p+1,y,c,e,O;end;end,G7=function(Q,e,Y,x,_,O,y,W,q,p)
if _<=175 then 
if _<=174 then 
local w=Q[23](e,1+p);
return not(w<128)and 212 or 209,p,q,Y,w;else 
local w,c=16384*(q-128),W-128;
local W=128*O+c+w;
return 169,3+p,W,Y,y;end;
elseif _<=176 then 
local _=Q[23](e,q+1);
return 128>_ and 16 or 69,p,q,Y,_;else 
local _=Q[23](e,3+p);
local Q,e,O,W,w=2097152*(Y-128),128*(y-128),(x-128)*16384,_%128,_%128;
local Y=(_-w)*2097152;
w=Q+O+(Y+e+W);
return 88,p+4,q,w,y;end;end,M=function(Q,e,Y,x,_,O,y,W,q,p)
if Y<=147 then 
if Y<=146 then 
local w=Q[23](e,p);
return 128>w and 167 or 142,O,p,w,y,x,_,W;else 
local e=y-4891;
local w,c,a=Q[60](e),Q[60](e),1+0;
return 76,{1-a,e+0,nil,a,O},p,q,w,c,_,W;end;
elseif Y<=148 then 
local e=(_-128)*128+W;
return 149,O,2+p,q,y,x,e,W;else 
local e=_-4891;
local Y,_,W=Q[60](e),Q[60](e),1+0;
return 47,{nil,1-W,O,e+0,W},p,q,y,x,Y,_;end;end,m7=function(Q,e,Y,x)
local _;
local O,y,W,q,p,w,c,a,s,u,v,k,M,r,U,X,N,z,C,V,d,j,J,t,F,K,b=Q[23],Q[56],Q[82],Q[42],Q.J7,Q[121],Q.X7,Q.k7,Q[1],Q[9821],Q[126],Q[84],Q[7],Q[60],Q[17],Q[125],Q[37],Q[127],Q[2],Q[65],Q[11800],Q[93],Q.m7,Q.l,Q[108],15;
local n;
local G,P,I,f,B,D,S,o,h,A,L,E=e,Y,x;
while true do 
if K<=17 then 
if K<=8 then 
if K<=3 then 
if K<=1 then 
if K<=0 then 
Y=b[2];
_=G;
K,b,P=not _[4]and 32 or 8,Y,7;else 
K,o=Q:P7(h,I);end;else 
local e,Y,Z=Q:N7(K,I);
if e==1 then 
return G,P;
elseif e==2 then 
K,I=Y,Z;end;end;else 
K,G,P,I,D,S,A=Q:S7(I,h,f,_,P,D,G,S,K,B,o,A);end;
elseif K<=12 then 
if K<=10 then 
if K<=9 then 
K=Q:_7(D,B,S,I,h,f);else 
n=_[6];
x={__index=function(e,Y)
local Z,g=14;
local i,l,m,T,H,R,Qe,ee,Ye,xe,_e,Oe,ye,We=e,Y;
while true do 
local qe,pe,we,ce;
if Z<=93 then 
Y=nil;
if Z<=46 then 
if Z<=22 then 
if Z<=10 then 
if Z<=4 then 
if Z<=1 then 
if Z<=0 then 
local ae,se,ue=g[2],g[5],g[1];
local ve,ke=ae+se,se<=0;
ae,se=ve>=ue,ve<=ue;
e=ke and ae or not ke and se;
g[2]=ve;
if e then 
Z,Qe=152,ve;else 
Z=95;end;else 
local e=O(_e,2);
Z,H=not(128>e)and 150 or 38,e;end;
elseif Z<=2 then 
local e,ae,se,ue=16384*(ee-128),Ye-128,xe*128;
ue,Z,T=se+(e+ae),91,T+3;
ee=ue;
elseif Z<=3 then 
local e,ae,se=g[5],ee(_e),T+H;
local ue=O(R,se);
if not(ue<128)then 
Z,g,m,T,H,Qe=78,e,ae,y,se,ue;else 
Z,g,m,T,H,R=119,e,ae,y,se,ue;end;else 
local e=q(R,T+We);
W(_e,We,(w(Oe,p[m],e)));
qe=c[m];
Z,m=148,qe;end;
elseif Z<=7 then 
if Z<=5 then 
local e=O(_e,1+T);
Z,Ye=not(128<=e)and 83 or 142,e;
elseif Z<=6 then 
Z=ee<=65 and 93 or 57;else 
local e=O(_e,T);
Z,ee=not not(128<=e)and 5 or 98,e;end;
elseif Z<=8 then 
local e=O(Qe,1+T);
Z,R=128>e and 54 or 99,e;
elseif Z<=9 then 
Z,m,T=164,128*(m-128)+T,2;else 
local e,y,ae=g[5],g[2],g[4];
local se,ue=e+y,y<=0;
e,y=se>=ae,se<=ae;
ae=ue and e or not ue and y;
g[5]=se;
if ae then 
Z,H=160,se;else 
Z=122;end;end;
elseif Z<=16 then 
if Z<=13 then 
if Z<=11 then 
Ye(xe,ee,(ye(T,Oe,_e)));
local e,y=c[H],8;
W(a,y,(w(q(Qe,y+m),p[e],T)));
local y,y=c[e],u(s(a,R),s(a,4),(s(a,8)));
Z,T=31,y;
elseif Z<=12 then 
_e(Oe,Ye,(We(xe,T,ye)));
local e,y=1,(xe*Qe+ee)%256;
v(a,e,(w(O(R,e+m),y,T)));
Z,T=31,k(a,H);else 
local e=O(R,2+T);
if not not(128<=e)then 
Z,Ye=187,e;else 
Z,R=45,e;end;end;
elseif Z<=14 then 
local e=i[0][l];
local y,u,k=n[e],_,0;
local n=u[5];
local ae,se=O(n,y),y+1;
if not not(ae>121)then 
Z,m,T,H,R,Qe=116,e,y,k,n,ae;else 
Z,m,T,H,R,Qe,ee=6,e,y,u,k,n,ae;end;
elseif Z<=15 then 
local e,y,u,k=(H-128)*16384,Qe-128,128*ee;
k,Z,T=u+e+y,84,3+T;
H=k;else 
local e=O(R,T+1);
Z,Qe=not(128>e)and 18 or 149,e;end;
elseif Z<=19 then 
if Z<=17 then 
local e=O(R,T+3);
local y,u,k,n,ae=(H-128)*2097152,128*(Qe-128),(ee-128)*16384,e%128,e%128;
local se,ue,ve=2097152*(e-ae),u+(y+n);
ve,Z,T=se+(k+ue),117,T+4;
H=ve;
elseif Z<=18 then 
local e=O(R,2+T);
Z,ee=not(128>e)and 178 or 175,e;else 
local e=O(Qe,m+3);
local y,u,k,n,ae=(T-128)*2097152,(H-128)*128,(R-128)*16384,e%128,e%128;
local se,ue,ve=(e-ae)*2097152,u+(y+k);
ve,Z,m=ue+(se+n),155,m+4;
T=ve;end;
elseif Z<=20 then 
local e,y=109,159;
pe=(235+m)%256;
local u,k,n=M(Qe),3958107115,Qe-Qe%4;
local ae,se=n-1,4+0;
local ue=0-se;
local ve={ae+0,ue,se,g,nil};
Z,g,m,ee,Ye,xe,_e,Oe,ye=118,ve,pe,235,e,y,u,k,n;
elseif Z<=21 then 
local e,y=r(R),1+0;
local u=1-y;
local k={y,nil,g,R+0,u};
Z,g,Qe=28,k,e;else 
_e(Oe,Ye,(We(xe,ye,T)));
local e=1;
v(a,e,(w((xe*H+ee)%256,T,(O(Qe,m+e)))));
Z,T=31,U(a,R);end;
elseif Z<=34 then 
if Z<=28 then 
if Z<=25 then 
if Z<=23 then 
Z,m=97,m+1;
elseif Z<=24 then 
Z=not not(Qe<=149)and 158 or 115;else 
local e,y,u=X(m,Qe%H+1,2+Qe%H),1+Qe,1+0;
local k=y-u;
y={u,g,R+0,nil,k};
Z,g,Qe=167,y,e;end;
elseif Z<=26 then 
local e=g[3];
Z,g,T=31,e,ee(_e);
elseif Z<=27 then 
local e=1+T;
local y,u,u=O(R,e),1+e,2+T;
e=O(R,u);
Z,m,T,H=not(e>=128)and 184 or 137,y,u,e;else 
local e,y,u=g[5],g[1],g[4];
local k,U=e+y,y<=0;
y,e=k>=u,k<=u;
u=U and y or not U and e;
g[5]=k;
if u then 
Z,ee=145,k;else 
Z=76;end;end;
elseif Z<=31 then 
if Z<=29 then 
local e=g[1];
Z,g=31,e;
elseif Z<=30 then 
local e=O(_e,T+3);
local y,u,k,U,n=2097152*(ee-128),128*(Ye-128),(xe-128)*16384,e%128,e-e%128;
local e,ae,se=2097152*n+k,u+U;
se,Z,T=y+(e+ae),91,T+4;
ee=se;else 
i[l]=T;
Z=168;end;
elseif Z<=32 then 
Z=248~=Qe and 90 or 174;
elseif Z<=33 then 
local e,y=109,159;
we=(m+30)%256;
local u,k,U=M(H),505290270,H-H%4;
local n,i=U-1,4+0;
local l=0-i;
local ae={n+0,l,nil,g,i};
Z,g,m,R,ee,Ye,xe,_e,Oe,ye=68,ae,we,30,N,e,y,u,k,U;else 
Z,T,m=97,16384*(T-128)+(H-128+128*R),3+m;end;
elseif Z<=40 then 
if Z<=37 then 
if Z<=35 then 
Z,T=33,T+1;
elseif Z<=36 then 
local e=g[5];
Z,g=52,e;else 
local e,y,u=g[2],g[5],g[4];
local k,U=e+y,y<=0;
y,e=k>=u,k<=u;
u=U and y or not U and e;
g[2]=k;
if u then 
Z,H=43,k;else 
Z=26;end;end;
elseif Z<=38 then 
Z,m,T=164,16384*(m-128)+(T-128+H*128),3;
elseif Z<=39 then 
local e=O(R,T+2);
Z,Ye=128>e and 100 or 67,e;else 
local e,y=H-1,1+0;
local u=ye-y;
local k={e+0,y,u,nil,g};
Z,g=130,k;end;
elseif Z<=43 then 
if Z<=41 then 
local e=O(R,3+H);
local y,u,k,U,n,i=(Qe-128)*2097152,128*(ee-128),16384*(Ye-128),e%128,e%128;
i,Z,H=(e-n)*2097152+(U+k)+y+u,109,H+4;
R=i;
elseif Z<=42 then 
local e=g[4];
Z,g=58,e;else 
we=(xe+Ye*m)%256;
v(_e,H,(w(R,we,(O(Qe,H+T)))));
Z,m=37,we;end;
elseif Z<=44 then 
local e=1+T;
local y=O(Qe,e);
Z,m,T=not(128>y)and 156 or 23,e,y;
elseif Z<=45 then 
local e,y,u,k,U=(Qe-128)*16384,ee-128,128*R;
k,U,Z=y+(u+e),T+3,56;
R=k;else 
Z,T=84,1+T;end;
elseif Z<=69 then 
if Z<=57 then 
if Z<=51 then 
if Z<=48 then 
if Z<=47 then 
qe=(xe+Ye*m)%256;
v(_e,Oe,(w(qe,O(R,Oe+T),Qe)));
Z,m=130,qe;else 
Y=1+T;
Z,T=167,Y;end;
elseif Z<=49 then 
local e,y,u=g[1],ee(_e),H+T;
local k=O(R,u);
if not(128<=k)then 
Z,g,m,T,R=157,e,y,u,k;else 
Z,g,m,T,Qe=86,e,y,u,k;end;
elseif Z<=50 then 
Z=ee<=111 and 113 or 69;else 
local e,y,u=1+T,(116+m)%256,0;
W(a,0,(w(q(R,e+0),1953789044,p[y])));
e=c[y];
Z,T=31,q(a,H);end;
elseif Z<=54 then 
if Z<=52 then 
local e,y=H-1,1+0;
local u={g,nil,y,ye-y,e+0};
Z,g=134,u;
elseif Z<=53 then 
Z=not(Qe~=X(m,1+ee%H,2+ee%H))and 48 or 167;else 
Z,H,T=33,R+(H-128)*128,2+T;end;
elseif Z<=55 then 
local e=O(R,T+2);
Z,ee=not not(128<=e)and 17 or 172,e;
elseif Z<=56 then 
local e,y=r(H),1+0;
local u=1-y;
local k={g,H+0,nil,y,u};
Z,g,T=125,k,e;else 
Z=not(86>=ee)and 50 or 107;end;
elseif Z<=63 then 
if Z<=60 then 
if Z<=58 then 
local e,y=H-1,1+0;
local u={nil,ye-y,g,e+0,y};
Z,g=37,u;
elseif Z<=59 then 
Z,m=155,m+1;else 
local e=O(_e,T+3);
local y,u,k,U,X=2097152*(R-128),128*(Qe-128),(ee-128)*16384,e%128,e%128;
local n,i,l=(e-X)*2097152,u+U;
l,Z,T=i+(y+n+k),70,4+T;
R=l;end;
elseif Z<=61 then 
Z,T=70,1+T;
elseif Z<=62 then 
Z=not(Qe~=189)and 51 or 173;else 
local e,y,u,k=16384*(R-128),Qe-128,ee*128;
k,Z,T=y+(u+e),70,T+3;
R=k;end;
elseif Z<=66 then 
if Z<=64 then 
local e,y,u=1+T,(36+m)%256,0;
local u=q(Qe,0+e);
W(a,0,(w(606348324,p[y],u)));
u=c[y];
Z,T=31,z(a,R);
elseif Z<=65 then 
local e,y,u=1+T,109,159;
local k,U=0,(u+(97+m)%256*y)%256;
Z,m,T,H,ee,Ye,xe,_e,Oe,ye,We=22,e,97,y,u,k,U,v,a,O(Qe,k+e),w;else 
local e;
R,Z,e=R+128*(Qe-128),81,2+T;end;
elseif Z<=67 then 
local e=O(R,3+T);
local y,u,k,U,X=2097152*(Qe-128),128*(ee-128),(Ye-128)*16384,e%128,e%128;
local z,n=(e-X)*2097152;
n,Z,T=U+u+z+(y+k),20,T+4;
Qe=n;
elseif Z<=68 then 
local e,y,u=g[2],g[5],g[1];
local k,U=e+y,y<=0;
e,y=k>=u,k<=u;
u=U and e or not U and y;
g[2]=k;
if u then 
Z,We=123,k;else 
Z=42;end;else 
Z=not(ee>=121)and 44 or 73;end;
elseif Z<=81 then 
if Z<=75 then 
if Z<=72 then 
if Z<=70 then 
local e,y,u=C(3,R),V(R,2),7797;
if not(e~=0)then 
Z,R,Qe=7,e,y;else 
Z,R,Qe,ee=183,e,y,u;end;
elseif Z<=71 then 
local e,y,u,k,U=(Qe-128)*16384,ee-128,128*R;
k,U,Z=u+(e+y),3+T,81;
R=k;else 
local e,y=Qe-1,1+0;
local u=ye-y;
local k={e+0,u,g,nil,y};
Z,g=0,k;end;
elseif Z<=73 then 
local e,y,y=T+1,0,(159+(m+39)%256*109)%256;
v(a,0,(w(y,39,(O(Qe,0+e)))));
e=-O(a,R);
Z,T=31,e;
elseif Z<=74 then 
local e=T+1;
local y=O(Qe,e);
Z,T,H=not not(128<=y)and 8 or 35,e,y;else 
Z=not(234>=Qe)and 32 or 176;end;
elseif Z<=78 then 
if Z<=76 then 
local e=g[3];
T[H]=Qe;
Z,g=125,e;
elseif Z<=77 then 
local e=O(R,1+T);
if not not(e>=128)then 
Z,ee=13,e;else 
Z,R=106,e;end;else 
local e=O(R,H+1);
if not(128>e)then 
Z,ee=79,e;else 
Z,R=94,e;end;end;
elseif Z<=79 then 
local e=O(R,H+2);
if 128>e then 
Z,R=147,e;else 
Z,Ye=41,e;end;
elseif Z<=80 then 
W(a,ee,(w(q(R,ee+m),T,p[Qe])));
local e,e=c[Qe],d(s(a,H),(s(a,4)));
Z,T=31,e;else 
Y=0;
local e=1+0;
local y=1-e;
local u={g,e,R+0,nil,y};
Z,g,T=165,u,Y;end;
elseif Z<=87 then 
if Z<=84 then 
if Z<=82 then 
local e=g[2];
Z,g=165,e;
elseif Z<=83 then 
Z,ee,T=91,Ye+128*(ee-128),2+T;else 
local e,Y=109,159;
ce=(30+m)%256;
local y,u,k=M(H),505290270,H-H%4;
local U,X=k-1,4+0;
local z={X,0-X,nil,U+0,g};
Z,g,m,Qe,ee,Ye,xe,_e,Oe,ye=114,z,ce,30,N,e,Y,y,u,k;end;
elseif Z<=85 then 
local e=g[1];
Z,g=31,e;
elseif Z<=86 then 
local e=O(R,1+T);
if not(128<=e)then 
Z,R=66,e;else 
Z,ee=131,e;end;else 
local e,Y,y=1+T,109,159;
local u,k=0,(y+Y*((m+34)%256))%256;
Z,m,T,Qe,ee,Ye,xe,_e,Oe,ye,We=12,e,34,Y,y,u,k,v,a,O(R,u+e),w;end;
elseif Z<=90 then 
if Z<=88 then 
local e,Y=r(m*3),1+0;
local y=1-Y;
local u={nil,Y,g,m+0,y};
Z,g,m=10,u,e;
elseif Z<=89 then 
local e=O(R,T+3);
local Y,y,u,k,U=2097152*(H-128),(Qe-128)*128,(ee-128)*16384,e%128,e%128;
local X,z=(e-U)*2097152;
z,Z,T=k+Y+X+y+u,84,T+4;
H=z;else 
local e,Y,y=T+1,(111+m)%256,0;
W(a,0,(w(1869573999,q(R,e+0),p[Y])));
e=c[Y];
Z,T=31,s(a,H);end;
elseif Z<=91 then 
local e=ee+1;
Z,ee=183,e;
elseif Z<=92 then 
local e,Y,Y=1+T,0,((72+m)%256*109+159)%256;
v(a,0,(w(O(Qe,0+e),72,Y)));
Z,T=31,O(a,R);else 
Z=not(ee>19)and 185 or 162;end;
elseif Z<=140 then 
if Z<=116 then 
if Z<=104 then 
if Z<=98 then 
if Z<=95 then 
if Z<=94 then 
Z,R,H=109,(Qe-128)*128+R,H+2;else 
local e,Y=g[3],O(_e,H);
Z,g,m=not(128<=Y)and 171 or 132,e,Y;end;
elseif Z<=96 then 
local e=T+1;
local Y=O(R,e);
Z,T,Qe=128>Y and 140 or 146,e,Y;
elseif Z<=97 then 
Z,T=31,j(Qe,m,T);else 
Z,T=91,1+T;end;
elseif Z<=101 then 
if Z<=99 then 
local e=O(Qe,2+T);
Z,ee=not(128<=e)and 139 or 163,e;
elseif Z<=100 then 
Z,Qe,T=20,(Qe-128)*16384+(ee-128+Ye*128),T+3;else 
local e,Y=109,159;
qe=(30+m)%256;
local y,s,u=M(H),505290270,H-H%4;
local k,M=u-1,4+0;
local U=0-M;
local X={g,k+0,M,nil,U};
Z,g,m,Qe,ee,Ye,xe,_e,Oe,ye=148,X,qe,30,N,e,Y,y,s,u;end;
elseif Z<=102 then 
Z,H,T=84,Qe+(H-128)*128,T+2;
elseif Z<=103 then 
W(a,ee,(w(T,q(R,m+ee),p[Qe])));
local e,e,Y=c[Qe],q(a,H),q(a,4);
if Y==0 then 
Z,T=31,e;else 
Z,m,T=121,e,Y;end;else 
local e=O(Qe,3+m);
local Y,y,s,u,k=2097152*(T-128),(H-128)*128,(R-128)*16384,e%128,e%128;
local M,U=2097152*(e-k);
U,Z,m=Y+y+M+(u+s),97,m+4;
T=U;end;
elseif Z<=110 then 
if Z<=107 then 
if Z<=105 then 
local e,Y,y,s=T+1,(m+115)%256,1936946035,0;
local u=q(Qe,e+s);
W(a,s,(w(p[Y],u,y)));
u=c[Y];
s=4;
Z,m,T,H,ee,Ye,xe,_e,Oe,ye=11,e,y,u,s,W,a,q(Qe,e+s),p[u],w;
elseif Z<=106 then 
local e;
R,Z,e=(Qe-128)*128+R,56,2+T;else 
Z=not(ee==72)and 64 or 133;end;
elseif Z<=108 then 
local e=O(Qe,m+2);
Z,R=not not(e>=128)and 104 or 34,e;
elseif Z<=109 then 
local e=T(m,R,H);
Z,T=31,e;else 
local e=g[4];
Z,g=72,e;end;
elseif Z<=113 then 
if Z<=111 then 
Z,R,T=70,Qe+(R-128)*128,2+T;
elseif Z<=112 then 
local e=T+1;
local Y=O(Qe,e);
Z,m,T=not(128<=Y)and 59 or 186,e,Y;else 
local e,Y,Y=T+1,0,(159+(21+m)%256*109)%256;
v(a,0,(w(O(Qe,e+0),21,Y)));
e=57~=O(a,R);
Z,T=31,e;end;
elseif Z<=114 then 
local e,Y,y=g[2],g[1],g[4];
local s,u=e+Y,Y<=0;
e,Y=s>=y,s<=y;
y=u and e or not u and Y;
g[2]=s;
if y then 
Z,We=136,s;else 
Z=36;end;
elseif Z<=115 then 
Z=not(172>=Qe)and 96 or 154;else 
Z=not(186>=Qe)and 159 or 179;end;
elseif Z<=128 then 
if Z<=122 then 
if Z<=119 then 
if Z<=117 then 
local e=O(R,T);
if 128>e then 
Z,R=120,e;else 
Z,Qe=77,e;end;
elseif Z<=118 then 
local e,Y,y=g[2],g[3],g[1];
local s,u=e+Y,Y<=0;
Y,e=s>=y,s<=y;
y=u and Y or not u and e;
g[2]=s;
if y then 
Z,We=151,s;else 
Z=110;end;else 
Z,H=109,1+H;end;
elseif Z<=120 then 
local e,e=T+1;do 
e=true;end;
Z=e and 56 or 125;
elseif Z<=121 then 
Z=not not(T<2147483648)and 180 or 143;else 
local e=g[3];
Z,g,T=31,e,m;end;
elseif Z<=125 then 
if Z<=123 then 
local e=q(Qe,We+T);
W(_e,We,(w(p[m],Oe,e)));
we=c[m];
Z,m=68,we;
elseif Z<=124 then 
Z=43>=ee and 112 or 74;else 
local e,Y,y=g[5],g[4],g[2];
local s,u=e+Y,Y<=0;
Y,e=s>=y,s<=y;
y=u and Y or not u and e;
g[5]=s;
if y then 
Z,H=21,s;else 
Z=85;end;end;
elseif Z<=126 then 
ce=(Ye*m+xe)%256;
v(_e,Oe,(w(O(R,T+Oe),ce,Qe)));
Z,m=134,ce;
elseif Z<=127 then 
local e=O(Qe,2+m);
Z,R=128>e and 181 or 19,e;else 
local e=g[1];
Z,g=40,e;end;
elseif Z<=134 then 
if Z<=131 then 
if Z<=129 then 
Z,T,m=97,(T-128)*128+H,m+2;
elseif Z<=130 then 
local e,Y,y=g[3],g[2],g[1];
local s,u=e+Y,Y<=0;
Y,e=s>=y,s<=y;
y=u and Y or not u and e;
g[3]=s;
if y then 
Z,Oe=47,s;else 
Z=3;end;else 
local e=O(R,2+T);
if not(128<=e)then 
Z,R=71,e;else 
Z,Ye=169,e;end;end;
elseif Z<=132 then 
local e=O(_e,1);
Z,T=not(e>=128)and 9 or 1,e;
elseif Z<=133 then 
local e=J(Q,H,m,180);
Z,T=31,e;else 
local e,Y,y=g[4],g[3],g[5];
local s,u=e+Y,Y<=0;
Y,e=s>=y,s<=y;
y=u and Y or not u and e;
g[4]=s;
if y then 
Z,Oe=126,s;else 
Z=49;end;end;
elseif Z<=137 then 
if Z<=135 then 
Z,H,T=117,128*(H-128)+Qe,T+2;
elseif Z<=136 then 
local e=q(R,We+T);
W(_e,We,(w(p[m],Oe,e)));
ce=c[m];
Z,m=114,ce;else 
local e=O(R,1+T);
Z,Qe=128>e and 135 or 55,e;end;
elseif Z<=138 then 
local e=O(R,1+T);
Z,Qe=not not(e>=128)and 166 or 102,e;
elseif Z<=139 then 
local e,Y,y,s=16384*(H-128),R-128,128*ee;
s,Z,T=y+(Y+e),33,3+T;
H=s;else 
Z,T=20,T+1;end;
elseif Z<=163 then 
if Z<=151 then 
if Z<=145 then 
if Z<=142 then 
if Z<=141 then 
Z,Qe,T=20,128*(Qe-128)+ee,T+2;else 
local e=O(_e,T+2);
Z,xe=128>e and 2 or 30,e;end;
elseif Z<=143 then 
local e=T-4294967296;
Z,T=180,e;
elseif Z<=144 then 
Z,T=101,T+1;else 
Qe[ee]=w(ee*H,m);
Z=28;end;
elseif Z<=148 then 
if Z<=146 then 
local e=O(R,1+T);
Z,ee=e<128 and 141 or 39,e;
elseif Z<=147 then 
local e,Y,y,s=(Qe-128)*16384,ee-128,R*128;
s,Z,H=Y+(e+y),109,3+H;
R=s;else 
local e,Y,y=g[5],g[3],g[2];
local s,u=e+Y,Y<=0;
e,Y=s>=y,s<=y;
y=u and e or not u and Y;
g[5]=s;
if y then 
Z,We=4,s;else 
Z=128;end;end;
elseif Z<=149 then 
Z,H,T=101,(H-128)*128+Qe,T+2;
elseif Z<=150 then 
local e=O(_e,3);
local Y,y,s,u;
Y,y,s,u,Z=2097152*(m-128),(T-128)*128,16384*(H-128),e%128,164;
m,T=Y+(e-e%128)*2097152+(y+(s+u)),4;else 
local e=q(R,T+We);
W(_e,We,(w(p[m],Oe,e)));
pe=c[m];
Z,m=118,pe;end;
elseif Z<=157 then 
if Z<=154 then 
if Z<=152 then 
pe=(xe+Ye*m)%256;
v(_e,Qe,(w(ee,pe,(O(R,T+Qe)))));
Z,m=0,pe;
elseif Z<=153 then 
local e=O(_e,1+T);
Z,Qe=not not(e>=128)and 161 or 111,e;else 
local e,Y,y,s=T+1,(9+m)%256,151587081,0;
local u=q(R,e+s);
W(a,s,(w(y,p[Y],u)));
u=c[Y];
s=4;
Z,m,T,Qe,ee=80,e,y,u,s;end;
elseif Z<=155 then 
local e=r(T,O(Qe,m),m+1);
Z,T=31,e;
elseif Z<=156 then 
local e=O(Qe,m+1);
Z,H=not(e>=128)and 129 or 108,e;else 
local e,e=T+1;do 
e=true;end;
Z=e and 81 or 33;end;
elseif Z<=160 then 
if Z<=158 then 
local e=T+1;
local Y=O(R,e);
Z,T,H=Y<128 and 46 or 138,e,Y;
elseif Z<=159 then 
Z=not(Qe<=209)and 75 or 62;else 
local e,Y=(H-1)*3,O(_e,T);
Z,H,R=not(Y<128)and 153 or 61,e,Y;end;
elseif Z<=161 then 
local e=O(_e,2+T);
Z,ee=not(e>=128)and 63 or 60,e;
elseif Z<=162 then 
Z=not not(ee<=27)and 105 or 124;else 
local e=O(Qe,3+T);
local Y,y,s,u,v=2097152*(H-128),128*(R-128),(ee-128)*16384,e%128,e%128;
local k,M,r=2097152*(e-v),y+(s+Y);
r,Z,T=M+(u+k),33,T+4;
H=r;end;
elseif Z<=175 then 
if Z<=169 then 
if Z<=166 then 
if Z<=164 then 
if not not(m<=0)then 
Z,T=31,t;else 
Z=88;end;
elseif Z<=165 then 
local e,Y,y=g[5],g[2],g[3];
local s,u=e+Y,Y<=0;
e,Y=s>=y,s<=y;
y=u and e or not u and Y;
g[5]=s;
if y then 
Z,Qe=25,s;else 
Z=29;end;else 
local e=O(R,T+2);
Z,ee=not not(128<=e)and 89 or 15,e;end;
elseif Z<=167 then 
local e,Y,y=g[5],g[1],g[3];
local s,u=e+Y,Y<=0;
Y,e=s>=y,s<=y;
y=u and Y or not u and e;
g[5]=s;
if y then 
Z,ee=53,s;else 
Z=82;end;
elseif Z<=168 then 
return T;else 
local e=O(R,3+T);
local Y,y,s,u,v=2097152*(Qe-128),128*(ee-128),16384*(Ye-128),e%128,e%128;
local k,M,r,U=(e-v)*2097152,u+y+s;
r,U,Z=k+(M+Y),4+T,81;
R=r;end;
elseif Z<=172 then 
if Z<=170 then 
local e,Y=c[T],4;
W(a,Y,(w(Qe,q(R,m+Y),p[e])));
Y=c[e];
Z,T=31,F(a,H);
elseif Z<=171 then 
Z,T=164,1;else 
local e,Y,y,s=16384*(H-128),Qe-128,ee*128;
s,Z,T=Y+(e+y),117,T+3;
H=s;end;
elseif Z<=173 then 
local e=1+T;
local Y=O(R,e);
Z,T,H=128>Y and 144 or 16,e,Y;
elseif Z<=174 then 
local e,Y,y,s=T+1,(236+m)%256,3974950124,0;
local u=q(R,s+e);
W(a,s,(w(p[Y],y,u)));
u=c[Y];
s=4;
Z,m,T,Qe,ee=103,e,y,u,s;else 
local e,Y,y,c=16384*(H-128),Qe-128,ee*128;
c,Z,T=e+(y+Y),101,T+3;
H=c;end;
elseif Z<=181 then 
if Z<=178 then 
if Z<=176 then 
local e,Y,y,c=T+1,(36+m)%256,606348324,0;
local s=q(R,c+e);
W(a,c,(w(p[Y],y,s)));
Z,m,T,Qe=170,e,Y,y;
elseif Z<=177 then 
Z,T,m=155,128*(T-128)+H,2+m;else 
local e=O(R,3+T);
local Y,y,W,q,p=(H-128)*2097152,128*(Qe-128),16384*(ee-128),e%128,e%128;
local w,c,a=2097152*(e-p),Y+q;
a,Z,T=c+(W+w+y),101,4+T;
H=a;end;
elseif Z<=179 then 
Z=not not(Qe>142)and 24 or 182;
elseif Z<=180 then 
Z,T=31,4294967296*T+m;else 
local e,Y,y,W=(T-128)*16384,H-128,128*R;
W,Z,m=y+(Y+e),155,m+3;
T=W;end;
elseif Z<=184 then 
if Z<=182 then 
Z=not(132==Qe)and 27 or 87;
elseif Z<=183 then 
m[H+3]=ee;
m[H+2]=R;
m[1+H]=Qe;
Z=10;else 
Z,T=117,1+T;end;
elseif Z<=185 then 
Z=not not(ee==2)and 92 or 65;
elseif Z<=186 then 
local e=O(Qe,m+1);
Z,H=not(e>=128)and 177 or 127,e;else 
local e=O(R,3+T);
local Y,O,y,W,q=(Qe-128)*2097152,128*(ee-128),16384*(Ye-128),e%128,e%128;
local p,w,c,a,s=2097152*(e-q),O+W,y+Y;
a,s,Z=w+c+p,T+4,56;
R=a;end;end;end};
_[7]=x;
K,I=33,x;end;else 
K,I,D,S=Q:p7(h,K,D,I,o,S);end;else 
K,b,f,B,D=Q:a7(B,D,P,b,K,L,G,f,S,o);end;
elseif K<=26 then 
if K<=21 then 
K,P,I,B,D=Q:D7(I,E,f,P,K,h,B,S,o,D,A);else 
K,I,B,S,o=Q:E7(o,h,K,S,I,B,f);end;
elseif K<=30 then 
if K<=28 then 
K,b,P,S,o,h,A,L,E=Q:I7(S,o,E,b,P,A,I,h,K,D,L);else 
K,I,D=Q:d7(b,S,I,D,K);end;else 
K,I,S=Q:v7(h,K,_,S,o,A,I);end;end;end,[37]=buffer.tostring,[4]=bit32.bor,t=function(Q,e,Y,x,_,O,y,W,q)
if e<=41 then 
if e<=40 then 
return 17,(W-128)*128+Y,q+2,_,O;else 
return 226,W,1,_,O;end;
elseif e<=42 then 
local e=y+(O-128)*128;
return 233,W,q+2,_,e;else 
local e=Q[23](x,W+1);
return not not(128<=e)and 60 or 99,W,q,e,O;end;end,Z7=function(Q,e,Y,x,_,O,y,W,q,p)
if Y<=28 then 
if Y<=27 then 
local w=Q[23](p,W);
return not(128<=w)and 19 or 36,x,W,_,e,w;else 
return 30,x,W+1,_,e,q;end;
elseif Y<=29 then 
local w,c=16384*(e-128),q-128;
local a=w+(y*128+c);
return 13,x,W+3,_,a,q;
elseif Y<=30 then 
local Y=_-25229;
local y=Q[60](Y);
O[6]=y;
local O=1+0;
return 23,{1-O,O,nil,Y+0,x},W,y,e,q;else 
local Y=Q[23](p,W+1);
return Y<128 and 15 or 1,x,W,_,e,Y;end;end,[89]=function(Q,e,e)
return function(e,Y,Y)
local Y=e[1];
local x=e[2];
return function(e,_,O)
local y,W=10;
local q,p,w,c,a,s,u,v,k,M,r,U=e,_,O;
while true do 
O,e=y<=14;
if O then 
if y<=6 then 
if y<=2 then 
if y<=0 then 
local O,X=Q[23](k,w),w+1;
Q[51](c,a+s,O,u);
y=25;
elseif y<=1 then 
local O,X,N=W[1],W[2],W[4];
local z,C=O+X,X<=0;
O,_=z>=N,z<=N;
N=C and O or not C and _;
W[1]=z;
if N then 
y,U=20,z;else 
y=14;end;else 
local _=Q[23](k,w+3);
y,u,w=0,(u-128)*2097152+(v-128)*128+(M-128)*16384+_%128+(_-_%128)*2097152,w+4;end;
elseif y<=4 then 
if y<=3 then 
local _=Q[23](k,w+2);
y,M=_<128 and 30 or 2,_;else 
local _=Q[23](k,w+1);
y,v=_<128 and 9 or 3,_;end;
elseif y<=5 then 
local _=Q[23](k,w);
y,u=_<128 and 17 or 4,_;else 
local _,O=s-1,1+0;
local X=r-O;
local N={_+0,nil,O,W,X};
y,W=12,N;end;
elseif y<=10 then 
if y<=8 then 
if y<=7 then 
y,s,w=5,(s-128)*16384+(u-128)+v*128,w+3;else 
local _,O=185,119;
e=(w+p)%256;
local X,N,z=Q[7](s),w*16843009,s-s%4;
local C,V=z-1,4+0;
local d={0-V,V,W,C+0,nil};
y,W,p,u,v,k,M,r=1,d,e,_,O,X,N,z;end;
elseif y<=9 then 
y,u,w=0,(u-128)*128+v,w+2;else 
local _,O=q[6][p],q[5];
local r=_+1;
_=Q[23](O,r);
y,c,a,s=_<128 and 27 or 29,O,r,_;end;
elseif y<=12 then 
if y<=11 then 
local _=Q[23](k,w+3);
y,s,w=5,(s-128)*2097152+(u-128)*128+(v-128)*16384+_%128+(_-_%128)*2097152,w+4;else 
local _,O,r=W[5],W[3],W[1];
local X,N=_+O,O<=0;
_,O=X>=r,X<=r;
r=N and _ or not N and O;
W[5]=X;
if r then 
y,s=18,X;else 
y=28;end;end;
elseif y<=13 then 
y,a=8,a+2;else 
local _=W[3];
y,W=6,_;end;else 
local _=y<=22;
if _ then 
local _=y<=18;
if _ then 
if y<=16 then 
if y<=15 then 
y,s=13,(s-128)*128+u;else 
local _=Q[23](c,a+3);
y,s,a=8,(s-128)*2097152+(u-128)*128+(v-128)*16384+_%128+(_-_%128)*2097152,a+4;end;
elseif y<=17 then 
y,w=0,w+1;else 
e=(u*p+v)%256;
Q[126](k,s,(Q[121](Q[23](c,a+s),w,e)));
y,p=12,e;end;else 
local _=y<=20;
if _ then 
local _=y<=19;
if _ then 
y,s,a=8,(s-128)*16384+(u-128)+v*128,a+3;else 
local _,O=Q[82],Q[42](c,a+U);
local r;
local r=Y[5][Y[4]][p];
_(k,U,(Q[121](O,r,M)));
local Y;
e=x[5][x[4]][p];
y,p=1,e;end;
elseif y<=21 then 
y,s,w=5,(s-128)*128+u,w+2;else 
local e=Q[23](k,w+2);
y,v=e<128 and 7 or 11,e;end;end;
elseif y<=26 then 
if y<=24 then 
if y<=23 then 
local e=Q[23](c,a+2);
y,v=e<128 and 19 or 16,e;else 
y,w=5,w+1;end;
elseif y<=25 then 
return q,p;else 
local e=Q[23](k,w+1);
y,u=e<128 and 21 or 22,e;end;
elseif y<=28 then 
if y<=27 then 
y,a=8,a+1;else 
local e=W[4];
q[7]=Q[14](q);
local Y,x,_=Q:T7(q,k);
local O=Q[23](k,_);
y,W,q,p,w,s=O<128 and 24 or 26,e,Y,x,_,O;end;
elseif y<=29 then 
local e=Q[23](c,a+1);
y,u=e<128 and 15 or 23,e;else 
y,u,w=0,(u-128)*16384+(v-128)+M*128,w+3;end;end;end;end;end;end,A7=function(Q,Q,e,Y,x,_,O,y)
if _<=10 then 
if _<=9 then 
local W=128*(Q-128)+O;
return 1,32,x,y+2,Y,W;else 
return 2;end;
elseif _<=11 then 
return 1,24,x[5],y,Y,Q;else 
local _=(Y-128)*16384;
local Y=e-128+Q*128+_;
return 1,30,x,3+y,Y,Q;end;end,[7]=buffer.create,F=function(Q,e,Y,x,_,O,y,W,q)
if _<=25 then 
if _<=24 then 
local p=Q[23](x,O);
return not(p<128)and 13 or 98,y,q,p,Y,e;else 
return 130,y,1+q,W,Y,e;end;
elseif _<=26 then 
local _=Q[23](x,2+y);
return 128>_ and 163 or 39,y,q,_,Y,e;else 
local _,O=Q[42](x,y),4+y;
local Q=_/2;
if not(0==_%2)then 
return 181,O,q,W,Q,e;else 
return 121,O,q,W,Y,Q;end;end;end,[31]=coroutine.resume,v7=function(Q,e,Y,x,_,O,y,W)
if Y<=32 then 
if Y<=31 then 
local q=Q[23](e,3+W);
local p,w,c,a=2097152*(_-128),128*(O-128),(y-128)*16384,q%128;
local O=c+(w+(q-q%128)*2097152+(p+a));
return 9,W+4,O;else 
return 35,W,_;end;
elseif Y<=33 then 
return 4,W,_;
elseif Y<=34 then 
local Y=Q[23](e,W);
return not(128<=Y)and 3 or 1,W,Y;else 
local Q=x[7];
if not not Q then 
return 33,Q,_;else 
return 10,W,_;end;end;end,A=function(Q,e,Y,x,_,O)
if _<=125 then 
return 24,Y+1,e;else 
local e=Q[23](x,O);
return not not(e>=128)and 132 or 4,Y,e;end;end,[10]=UDim2.new,[96]=buffer.writeu16,[64]=buffer.fromstring,Bt=function(Q,e,Y,x)
local _=Q[85];
_();
for Q,O,y,W,q,p,w,c,a,s in e,Y,x do 
_(true,{Q,O,y,W,q,p,w,c,a,s});end;end,[1]=buffer.readf32,X=function(Q,e,Y,x,_,O,y,W,q,p,w,c)
if e<=49 then 
if e<=48 then 
local a,s,u=Y[2],Y[1],Y[3];
local v,k=a+s,s<=0;
s,a=v>=u,v<=u;
u=k and s or not k and a;
Y[2]=v;
if u then 
return 54,y,v,x,O;else 
return 113,y,p,x,O;end;else 
local Y=128*(O-128)+c;
return 74,y+2,p,x,Y;end;
elseif e<=50 then 
local e=Q[23](q,y);
return not(128>e)and 199 or 89,y,p,e,O;else 
_[W]=w;
return 76,y,p,x,O;end;end,p7=function(Q,e,Y,x,_,O,y)
if Y<=11 then 
local Y=Q[23](e,1+_);
return Y<128 and 29 or 24,_,x,Y;else 
local Y=Q[23](e,_+3);
local Q,e,W,q=2097152*(x-128),(y-128)*128,(O-128)*16384,Y%128;
local x=2097152*(Y-Y%128)+e+(W+q)+Q;
return 34,_+4,x,y;end;end,[9821]=Vector3.new,[68]=rawset,h=function(Q,e,Y,x,_,O,y,W,q,p)
if q<=122 then 
if q<=121 then 
Y[p]=_-_%1;
return 239,e,y,_;else 
local Y=Q[23](x,W+1);
return not(128>Y)and 11 or 117,e,Y,_;end;
elseif q<=123 then 
local Y=Q[23](x,2+O);
return not(128<=Y)and 237 or 128,e,y,Y;else 
local e=Q[23](x,O+1);
return e<128 and 40 or 80,e,y,_;end;end,I=function(Q,e,Y,x,_,O,y,W,q)
if W<=94 then 
if W<=93 then 
local p,w=16384*(e-128),_-128;
return 36,p+(Y*128+w),y,3+O,x,q;else 
local e=Q[23](Y,O);
return 128>e and 125 or 38,Y,y,O,e,q;end;
elseif W<=95 then 
return 149,Y,y+1,O,x,q;else 
local e=Q[23](Y,O+2);
if not(e<128)then 
return 242,Y,y,O,x,e;else 
return 93,e,y,O,x,q;end;end;end,_=function(Q,e,Y,x,_,O,y,W,q,p)
if O<=74 then 
if O<=73 then 
local w=Q[23](y,1+Y);
return not(128<=w)and 79 or 137,_,e,w;else 
e[x]=q;
return 47,_,e,p;end;
elseif O<=75 then 
local Y=Q[23](y,2);
return not(Y<128)and 29 or 68,Y,e,p;else 
local Q,Y,x=W[1],W[4],W[2];
local O,y=Q+Y,Y<=0;
Q,Y=O>=x,O<=x;
x=y and Q or not y and Y;
W[1]=O;
if x then 
return 58,_,O,p;else 
return 191,_,e,p;end;end;end,B={63503,634132657,2193364216,2000630371,1521012063,3134978881,1442581902,3870060342,2179653160},[112]=coroutine.close,X7={},[94]=buffer.copy,[22]=table.insert,P=function(Q,e,Y,x,_,O,y,W,q,p,w,c)
if x<=61 then 
if x<=60 then 
local a=Q[23](w,q+2);
return a<128 and 10 or 127,e,q,a,y,W;else 
local a=Q[23](w,q+1);
return not(a>=128)and 49 or 173,e,q,_,y,a;end;
elseif x<=62 then 
local a,s=(e-128)*16384,q-128;
return 146,a+(128*c+s),3+Y,_,y,W;
elseif x<=63 then 
local x=Q[23](w,Y);
return not(128>x)and 186 or 118,e,q,_,x,W;else 
O[p]=_;
return 157,e,q,_,y,W;end;end,U=function(Q,...)
return(...)[...];end,I7=function(Q,e,Y,x,_,O,y,W,q,p,w,c)
if p<=27 then 
local p,a,s=_[4],_[5],_[3];
local u,v=p+a,a<=0;
a,p=u>=s,u<=s;
s=v and a or not v and p;
_[4]=u;
if s then 
return 21,_,O,e,Y,q,y,c,u;else 
return 13,_,O,e,Y,q,y,c,x;end;else 
local e,Y,y,q=(O+W)%256,Q[7](w),W*16843009,w-w%4;
local Q,O=q-1,4+0;
local W=0-O;
return 27,{nil,_,Q+0,W,O},e,109,159,Y,y,q,x;end;end,o=function(Q,...)
return(...)();end,d7=function(Q,Q,e,Y,x,_)
if _<=29 then 
local _=e+128*(x-128);
return 34,Y+2,_;else 
local e,_,O=Q[5],Q[1],Q[4];
local y,W=e+_,_<=0;
_,e=y>=O,y<=O;
O=W and _ or not W and e;
Q[5]=y;
if O then 
return 20,Y,y;else 
return 0,Y,x;end;end;end,[43]=assert,e=function(Q,e,Y,x,_,O,y,W,q,p)
if y<=5 then 
if y<=4 then 
return 50,O,1+p,_,W,x;else 
return 156,O[4],p,_,W,x;end;
elseif y<=6 then 
local y=Q[23](q,3+_);
local Q,q,w,c,a=2097152*(W-128),128*(e-128),16384*(x-128),y%128,y%128;
local e=2097152*(y-a);
y=c+w+(Q+(e+q));
return 110,O,p,_+4,y,x;else 
local Q=128*(x-128)+Y;
return 147,O,p+2,_,W,Q;end;end,w=function(Q,e,Y,x,_,O,y,W,q,p,w,c)
if e<=110 then 
if e<=109 then 
local a=Q[23](_,O+3);
local Q,s,u,v=2097152*(c-128),128*(p-128),(Y-128)*16384,a%128;
local Y=Q+(a-a%128)*2097152+u+(s+v);
return 169,_,4+O,Y,y;else 
x[w]=W;
return 48,_,O,c,y;end;
elseif e<=111 then 
if not not(c~=2)then 
return 8,O,O,c,y;else 
return 91,_,O,c,y;end;else 
local Q,e,Y=q[4],q[1],q[3];
local x,W=Q+e,e<=0;
Q,e=x>=Y,x<=Y;
Y=W and Q or not W and e;
q[4]=x;
if Y then 
return 27,_,O,c,x;else 
return 172,_,O,c,y;end;end;end,w7=function(Q,e)
return Q[28](e,1,e.n);end,[121]=bit32.bxor,[75]=setfenv,l={},[113]=buffer.writebits,N=function(Q,e,Y,x,_,O,y,W,q,p,w,c)
if q<=66 then 
if q<=65 then 
local a=(e-128)*128+x;
return 19,c+2,Y,a,O,p;else 
local x=Q[23](_,Y);
return x<128 and 252 or 44,c,Y,e,x,p;end;
elseif q<=67 then 
local x=Q[23](_,Y+3);
local Q,_,q,a,s=2097152*(p-128),128*(W-128),(w-128)*16384,x%128,x%128;
local W=(x-s)*2097152;
x=_+a+(Q+W)+q;
return 116,c,Y+4,e,O,x;else 
local Q,x=(c-128)*16384,Y-128;
return 226,Q+(y*128+x),3,e,O,p;end;end,[102]=table.pack,[85]=coroutine.yield,[120]=3.588035741E9,[42]=buffer.readu32,T7=function(Q,e,Y)
local x,_,O,y,W,q,p,w,c,a,s,u,v,k,M,r,U,X,N,z,C,V=Q:g();
local d,j,J,t,F,K,b,n,G,P,I,f,B,D,S,o,h,A,L,E,Z,g,i=_,O,Y,e,y,W,q,p,w,c,a,s,u,v,k,M,r,U,X,N,z,C,V;
while x do 
if d<=129 then 
if d<=64 then 
if d<=31 then 
if d<=15 then 
if d<=7 then 
if d<=3 then 
d,K,b,n,h,Z=Q:x(n,b,h,L,d,K,Z,g,J,F,A);else 
d,j,K,b,f,D=Q:e(B,S,D,b,j,d,f,J,K);end;
elseif d<=11 then 
Y,C,O,w,a,z,X=Q:V(A,K,P,B,I,J,L,E,n,d,b);
if Y==1 then 
return n,J,b;
elseif Y==2 then 
d,K,b,n,B,A=C,O,w,a,z,X;end;else 
d,F,K,B,S,L=Q:r(J,L,b,d,D,S,K,F,B);end;
elseif d<=23 then 
if d<=19 then 
d,j,K,n,P,D,S=Q:u(n,S,d,J,K,D,b,I,j,P);else 
d,J,K,b,n,A=Q:K(b,K,F,n,A,d,J);end;
elseif d<=27 then 
d,K,I,D,o,A=Q:F(A,o,J,d,b,K,D,I);
elseif d<=29 then 
d,K,b,L=Q:s(n,d,L,j,b,K,J);else 
d,J,F,K,b=Q:z(d,F,J,b,n,P,K,I);end;
elseif d<=47 then 
if d<=39 then 
if d<=35 then 
d,F,b,P,I,o,L=Q:H(L,E,F,d,Z,b,o,I,J,f,j,P);else 
d,K,n,f,D=Q:Q(F,J,A,h,d,b,S,G,n,L,P,f,D,t,I,B,K,o);end;
elseif d<=43 then 
d,K,b,P,A=Q:t(d,n,J,P,A,L,K,b);
elseif d<=45 then 
d,b,h,A=Q:R(h,L,b,A,d,J);else 
d,F,K,L=Q:J(b,n,J,F,j,d,K,L);end;
elseif d<=55 then 
if d<=51 then 
d,K,I,B,E=Q:X(d,j,B,D,E,K,o,J,I,h,Z);else 
d,K,I,f,E=Q:k(J,I,B,f,b,d,E,K);end;
elseif d<=59 then 
d,j,F,K,o,h=Q:m(F,o,h,d,j,L,J,K,A);else 
d,F,K,I,L,Z=Q:P(F,b,d,I,f,L,Z,K,D,J,n);end;
elseif d<=96 then 
if d<=80 then 
if d<=72 then 
if d<=68 then 
d,K,b,B,h,Z=Q:N(B,b,D,J,h,n,g,d,Z,i,K);else 
d,J,K,b,n,f,D,L=Q:S(b,F,o,K,d,L,t,J,n,D,f,G,S);end;
elseif d<=76 then 
d,n,o,A=Q:_(o,K,L,n,d,J,j,E,A);else 
d,F,K,G,h,L=Q:p(K,d,F,L,A,b,J,h,G);end;
elseif d<=88 then 
if d<=84 then 
d,j,J,K,b,P,I,f,o=Q:a(P,o,J,b,j,A,d,L,F,G,f,K,I,n);else 
d,n,I=Q:D(n,I,P,d,b,K,J);end;
elseif d<=92 then 
d,t,F,K,n=Q:E(K,d,J,F,t,n,b);else 
d,J,K,b,B,g=Q:I(E,J,B,Z,b,K,d,g);end;
elseif d<=112 then 
if d<=104 then 
if d<=100 then 
d,K,b,n,D=Q:d(n,K,o,S,b,P,J,d,D);else 
d,t,F,K,b,n,B=Q:v(S,t,D,F,b,K,d,G,B,J,P,n);end;
elseif d<=108 then 
d,j,b,i=Q:W(f,I,J,b,B,j,d,i);else 
d,J,F,K,A=Q:w(d,n,G,J,F,A,f,j,b,I,K);end;
elseif d<=120 then 
if d<=116 then 
d,j,J,b,B,E=Q:y(E,j,B,Z,J,A,d,b,D);else 
d,j,K,b,G,P,I,o,h=Q:L(K,P,d,j,f,G,I,b,h,o);end;
elseif d<=124 then 
d,n,f,A=Q:h(n,h,J,A,b,f,K,d,o);
elseif d<=126 then 
d,b,f=Q:A(f,b,J,d,K);else 
d,K,b,n,I,o=Q:i(d,D,B,J,K,b,h,A,P,n,I,o);end;
elseif d<=194 then 
if d<=161 then 
if d<=145 then 
if d<=137 then 
if d<=133 then 
d,F,B=Q:C(j,B,K,d,J,b,F);else 
d,b,G,P,A,L=Q:Y(G,K,d,b,E,I,L,J,A,P);end;
elseif d<=141 then 
d,K,b=Q:c(d,n,K,b);else 
d,K,b,n,P,D=Q:Z(d,P,J,n,D,b,K,o,S);end;
elseif d<=153 then 
if d<=149 then 
d,j,K,b,D,S,o,A=Q:M(J,d,S,o,j,D,A,b,K);else 
d,K,G,o,h=Q:T(d,J,b,K,h,o,G);end;
elseif d<=157 then 
d,D,o,A,Z=Q:n(d,b,D,J,Z,j,A,o);else 
d,b,f,D,g=Q:j(d,D,B,f,J,b,g);end;
elseif d<=177 then 
if d<=169 then 
if d<=165 then 
d,K,b,f,S,h=Q:b(S,A,L,B,h,b,D,J,K,d,f);else 
d,j,J,F,K,b,I,B=Q:B7(J,j,K,I,b,n,B,d,F);end;
elseif d<=173 then 
d,j,b,B,S,g=Q:O7(D,d,K,J,B,b,g,j,S);else 
d,F,K,P,I=Q:G7(J,P,f,d,n,I,b,K,F);end;
elseif d<=185 then 
if d<=181 then 
d,j,F,K,b,o,A,Z=Q:q7(Z,A,F,j,i,g,d,o,D,h,J,b,K);else 
d,j,J,F,K,b,I,B,Z=Q:U7(L,d,Z,J,o,B,I,h,F,b,j,K);end;
elseif d<=189 then 
d,J,F,K,P,I,E=Q:o7(b,E,d,f,J,P,K,F,I);else 
d,j,K,b,o,h,L=Q:f7(d,L,E,K,b,A,h,j,o,J);end;
elseif d<=226 then 
if d<=210 then 
if d<=202 then 
if d<=198 then 
d,J,F,b,D=Q:l7(J,S,b,E,D,d,F);else 
d,t,K,D,E=Q:g7(d,D,t,g,K,Z,E,J,b,F);end;
elseif d<=206 then 
d,j,K,D,E=Q:x7(j,b,D,g,d,Z,E,J,K);else 
d,j,F,K,b,P=Q:e7(d,K,P,F,G,j,b,J,I,n);end;
elseif d<=218 then 
if d<=214 then 
u=d<=212;
y,M,V,W,N=Q:V7(u,b,G,J,n,f,S,F,d,P,o,D);
d,b,n,f,D=y,M,V,W,N;else 
d,j,K,b,o,L=Q:r7(K,E,L,A,J,Z,o,d,j,F,b);end;
elseif d<=222 then 
d,j,K,P,o,A=Q:u7(J,P,I,o,j,A,f,K,d);else 
d,F,K,b,n,G,o=Q:K7(d,J,K,o,G,t,F,b,I,P,n);end;
elseif d<=242 then 
if d<=234 then 
if d<=230 then 
d,K,b,f,B,S=Q:F7(J,K,S,b,B,d,D,f);else 
d,j,b,I,B,A,L,Z=Q:s7(Z,I,j,D,B,L,d,J,b,A);end;
elseif d<=238 then 
d,J,F,b,n,o,h=Q:z7(j,b,n,d,o,J,A,F,P,h);else 
d,J,b,o=Q:H7(b,h,Z,g,E,d,J,o);end;
elseif d<=250 then 
d,j,J,F,K,b,n,G,I=Q:Q7(f,h,K,n,b,B,I,t,o,j,P,F,A,S,d,J,D,G);
elseif d<=254 then 
d,b,P,I,E=Q:t7(j,b,J,F,I,E,d,B,P);else 
d,K,b,G,P,I,f=Q:R7(P,K,I,J,f,B,b,d,G);end;end;end,[58]=string.pack,o7=function(Q,e,Y,x,_,O,y,W,q,p)
if x<=187 then 
if x<=186 then 
local w=Q[23](O,e+1);
return not(128<=w)and 190 or 155,O,q,W,y,p,w;else 
local w=Q[23](O,q+2);
if 128>w then 
return 235,w,q,W,y,p,Y;else 
return 30,O,q,W,y,w,Y;end;end;
elseif x<=188 then 
local Q,x,w=16384*(y-128),p-128,_*128;
local _=x+Q+w;
return 85,O,q,3+W,_,p,Y;else 
return 146,O,W+(q-128)*128,2+e,y,p,Y;end;end,S=function(Q,e,Y,x,_,O,y,W,q,p,w,c,a,s)
if O<=70 then 
if O<=69 then 
local u=Q[23](q,2+_);
return not(128>u)and 222 or 188,q,_,e,p,u,w,y;else 
e[0]=_;
Q[34](e,a);
return 8,W,_,Y,Q[q](Q,e),c,w,y;end;
elseif O<=71 then 
local Y,O=16384*(w-128),s-128;
local W=Y+(x*128+O);
return 147,q,3+_,e,p,c,W,y;else 
local Y=Q[23](q,2+e);
return 128>Y and 162 or 45,q,_,e,p,c,w,Y;end;end,[39]=buffer.writef64,D=function(Q,e,Y,x,_,O,y,W)
if _<=86 then 
if _<=85 then 
local q=Q[23](W,y);
return not(q>=128)and 227 or 122,e,q;else 
local q=Q[23](W,2+O);
return q<128 and 134 or 224,e,q;end;
elseif _<=87 then 
local _=Q[23](W,y);
return not not(_>=128)and 43 or 223,_,Y;else 
y[e]=x;
return 236,e,Y;end;end,[66]=xpcall,p=function(Q,e,Y,x,_,O,y,W,q,p)
if Y<=78 then 
if Y<=77 then 
return 70,x+1,e,p,q,_;else 
local w=Q[23](W,2+e);
return 128>w and 57 or 81,x,e,p,q,w;end;
elseif Y<=79 then 
local Y=(q-128)*128+O;
return 51,x,2+e,p,Y,_;else 
local Y=Q[23](W,y+2);
return not not(128<=Y)and 208 or 83,x,e,Y,q,_;end;end,z=function(Q,e,Y,x,_,O,y,W,q)
if e<=30 then 
local e,p,w,c=Q[23](x,3+Y),2097152*(O-128),(y-128)*128,(q-128)*16384;
return 70,e%128+((e-e%128)*2097152+p+w)+c,4+Y,W,_;else 
local e=Q[23](x,3+W);
local Q,q,p,w=(_-128)*2097152,128*(O-128),16384*(y-128),e%128;
local _=q+(p+((e-e%128)*2097152+(Q+w)));
return 87,x,Y,4+W,_;end;end,[91]=buffer.writei8,[44]=bit32.bnot,[62]=type,[90]=buffer.readbits,[11800]=Vector2.new,[9]=buffer.writei32,y=function(Q,e,Y,x,_,O,y,W,q,p)
if W<=114 then 
if W<=113 then 
return 84,Y[4],O,q,x,e;else 
local w=Q[23](O,q);
if not(128<=w)then 
return 105,Y,w,q,x,e;else 
return 184,Y,O,q,x,w;end;end;
elseif W<=115 then 
local Q=128*(x-128)+p;
return 24,Y,O,2+q,Q,e;else 
y[e]=_;
return 251,Y,O,q,x,e;end;end,k=function(Q,e,Y,x,_,O,y,W,q)
if y<=53 then 
if y<=52 then 
local p=Q[23](e,q);
return not not(p>=128)and 61 or 165,q,Y,_,p;else 
local p,w,c=(Y-128)*16384,_-128,x*128;
local x=w+p+c;
return 126,q+3,x,_,W;end;
elseif y<=54 then 
local x=Q[23](e,O);
return x<128 and 20 or 234,q,Y,x,W;else 
local x=Q[23](e,O);
return 128>x and 0 or 124,x,Y,_,W;end;end,[104]=buffer.writef32,g=function(Q)
return true,179,nil,nil,nil,nil,nil,nil,nil,nil,nil,nil,nil,nil,nil,nil,nil,nil,nil,nil,nil,nil;end,m=function(Q,e,Y,x,_,O,y,W,q,p)
if _<=57 then 
if _<=56 then 
return 114,O[4],e,q,Y,x;else 
local w,c,a=16384*(Y-128),p-128,128*y;
local y=c+w+a;
return 149,O,e,q+3,y,x;end;
elseif _<=58 then 
local _=Q[23](W,q);
return not not(_>=128)and 73 or 151,O,e,q,Y,_;else 
return 169,O,1+e,q,Y,x;end;end,j=function(Q,e,Y,x,_,O,y,W)
if e<=159 then 
if e<=158 then 
local q,p=(_-128)*16384,x-128;
local x=128*Y+(p+q);
return 110,y+3,x,Y,W;else 
local x=Q[23](O,y+2);
return not(128<=x)and 129 or 231,y,_,x,W;end;
elseif e<=160 then 
return 116,1+y,_,Y,W;else 
local e=Q[23](O,1+y);
return not(e<128)and 106 or 3,y,_,Y,e;end;end,e7=function(Q,e,Y,x,_,O,y,W,q,p,w)
if e<=208 then 
if e<=207 then 
local c=Q[23](q,2+W);
return not(128>c)and 211 or 104,y,_,Y,W,c;else 
local c,a,s,u=Q[23](q,3+W),2097152*(Y-128),(w-128)*128,(O-128)*16384;
return 17,y,_,c%128+(s+(u+(c-c%128)*2097152)+a),4+W,x;end;
elseif e<=209 then 
local Q=p+128*(x-128);
return 88,y,_+2,Y,W,Q;else 
return 23,y[1],_,Y,W,x;end;end,O7=function(Q,e,Y,x,_,O,y,W,q,p)
if Y<=171 then 
if Y<=170 then 
local w=Q[23](_,1+x);
return not(w<128)and 225 or 7,q,y,O,w,W;else 
local w=Q[23](_,3+y);
local c,a,s,u=(O-128)*2097152,(e-128)*128,(p-128)*16384,w%128;
local e=a+(w-w%128)*2097152+c+(u+s);
return 24,q,4+y,e,p,W;end;
elseif Y<=172 then 
return 220,q[5],y,O,p,W;else 
local e=Q[23](_,2+x);
return e<128 and 201 or 206,q,y,O,p,e;end;end,R=function(Q,e,Y,x,_,O,y)
if O<=44 then 
local O=Q[23](y,x+1);
return not(128<=O)and 238 or 72,x,e,O;else 
local O=Q[23](y,3+x);
local Q,y,W,q=2097152*(e-128),(_-128)*128,16384*(Y-128),O%128;
local e=2097152*(O-O%128)+(W+(Q+q))+y;
return 180,x+4,e,_;end;end,[87]=function(Q,e,Y,x,x,_,_,O,y,W,q,p,w,w,c,a,s,s)
local s,u,v,k,M,r,U,X,N,z,C,V,d,j,J,t,F,K=Q[60],Q[25],Q[65],Q[2],Q[121],Q[19],Q[107],Q[28],Q[102],Q[36],Q[23],Q[82],Q[42],Q[126],Q[55],Q.j7,Q[75],Q[20];
return function(b,n,n)
local n,G,P,I,f,B,D,S,o,h,A,L,E,Z,g,i,l,m=s,u,v,k,M,r,U,X,N,z,C,V,d,j,J,t,F,K;
return function(...)
local s,u;
local v,k,M,r,U=911271170;
local X=n(Y);
local Y,N,z,C,V;
local d,j,J,t,F=1990728145;
local K,T=1529199205,G();
local G,H;
if a==99 then 
G,H=W,a;
while true do 
local R=w[G];
if R<93 then 
if R>=46 then 
if R>=69 then 
if R<81 then 
if R>=75 then 
if R<78 then 
if R<76 then 
z,t=(f(_[G],(I(f(d,(I(P(d,29),7))),536870911)))),y[G]+1;
for Qe=1,p[G],1 do 
z=I(f(z,(B(z,13))),536870911);
z=f(z,(P(z,13)));
z=I(f(z,(B(z,14))),536870911);
y[t]=f(y[t],(I(P(z,0),127)));
_[t]=f(_[t],(I(P(z,7),127)));
p[t]=f(p[t],(I(P(z,14),127)));
w[t]=f(w[t],(I(P(z,21),127)));
t=t+1;end;
w[G]=89;else 
if R==77 then 
X[_[G]]=v;else 
X[y[G]]=X[p[G]]/O[G];end;end;else 
if R<79 then 
G=if not(p[G]<=X[_[G]])then y[G]else G;else 
if R==80 then 
b[y[G]][O[G]]=e[G];else 
X[_[G]]=X[p[G]]*c[G];end;end;end;else 
if R<72 then 
G=if R>=70 then if R~=71 then if not(y[G]<X[p[G]])then _[G]else G else y[G]else X[_[G]];else 
local Qe=G;
if R>=73 then 
if R==74 then 
H=y[Qe];
G=p[Qe]+1;
break;else 
X[p[Qe]][_[Qe]]=X[y[Qe]];end;else 
X[y[Qe]]=X[p[Qe]]+X[_[Qe]];end;end;end;else 
if R<87 then 
if R<84 then 
if R<82 then 
X[y[G]]=X[_[G]]/p[G];else 
if R~=83 then 
t=b[p[G]];
X[y[G]]=t[5][t[4]][O[G]];else 
X[y[G]]=X[_[G]]/X[p[G]];end;end;else 
if R>=85 then 
if R==86 then 
X[p[G]]=X[y[G]]>=X[_[G]];else 
X[p[G]]=O[G];end;else 
X[p[G]]=X[_[G]]==c[G];end;end;else 
if R>=90 then 
if R>=91 then 
if R~=92 then 
t=b[_[G]];
t[5][t[4]][X[y[G]]]=e[G];else 
t,z,M=p[G],y[G],_[G];
k=X[t];
D(X,t+1,t+z,M+1,k);end;else 
t=b[p[G]];
X[y[G]]=t[5][t[4]];end;else 
if R<88 then 
X[p[G]]=X[_[G]]-X[y[G]];
elseif not(R==89)then 
X[_[G]]=b[p[G]][X[y[G]]];end;end;end;end;else 
if R<57 then 
if R>=51 then 
if R>=54 then 
if R>=55 then 
if R~=56 then 
X[_[G]]=X[y[G]]>p[G];else 
G=if X[p[G]]<X[_[G]]then y[G]else G;end;else 
X[_[G]](X[y[G]],S(X[p[G]],1,X[p[G]].n));end;else 
if R<52 then 
X[_[G]]=X[y[G]](X[p[G]]);
elseif R==53 then 
local Qe,ee,Ye=y[G],_[G],e[G];
local xe,_e=I(ee,4294967295),I(Ye,4294967295);
local ee,Oe,ye,We=I(xe,65535),P(xe,16),I(_e,65535),P(_e,16);
_e=I(ee*ye+B(I(ee*We+Oe*ye,65535),16),4294967295);
Ye=nil;
repeat 
ee=_e%4294967296;
if ee~=ee then 
Ye=0;
break;end;
Ye=ee-ee%1;until true;
X[Qe]=Ye;else 
X[_[G]]=X[y[G]]~=e[G];end;end;else 
if R<48 then 
if R~=47 then 
X[y[G]]=X[p[G]];else 
X[y[G]]=o(X[_[G]](X[p[G]]));end;else 
if R<49 then 
X[_[G]]=X[y[G]]();else 
if R~=50 then 
G=if X[_[G]]<y[G]then p[G]else G;else 
X[_[G]]=#X[y[G]];end;end;end;end;else 
if R<63 then 
if R<60 then 
if R<58 then 
G=if X[y[G]]~=X[p[G]]then _[G]else G;
elseif R==59 then 
if J then 
for Qe in h,J,nil do 
if J then 
local ee=J[Qe];
if ee then 
ee[5]=ee;
ee[6]=X[Qe];
ee[4]=6;
J[Qe]=nil;end;end;end;end;
if j then 
for Qe,ee in h,j,nil do 
local Ye=ee[6];
if j then 
local ee=j[Qe];
if ee then 
local xe,_e=Qe+Ye-1,n(Ye);
D(X,Qe,xe,1,_e);
ee[5]=_e;
ee[4]=1;
j[Qe]=nil;end;end;end;end;
return X[p[G]](X[_[G]]);else 
if J then 
for Qe in h,J,nil do 
if J then 
local ee=J[Qe];
if ee then 
ee[5]=ee;
ee[6]=X[Qe];
ee[4]=6;
J[Qe]=nil;end;end;end;end;
if j then 
for Qe,ee in h,j,nil do 
local Ye=ee[6];
if j then 
local ee=j[Qe];
if ee then 
local xe=n(Ye);
D(X,Qe,Qe+Ye-1,1,xe);
ee[5]=xe;
ee[4]=1;
j[Qe]=nil;end;end;end;end;
return X[p[G]];end;else 
if R>=61 then 
if R==62 then 
X[y[G]]=f(X[p[G]],X[_[G]]);else 
t=_[G];
z,M,k=X[t],X[t+1],X[t+2];
X[t]=z(M,k);end;else 
local Qe,ee,Ye=_[G],c[G],p[G];
local xe,_e=I(ee,4294967295),I(Ye,4294967295);
local Oe,ye,We,qe=I(xe,65535),P(xe,16),I(_e,65535),P(_e,16);
ee=I(Oe*We+B(I(Oe*qe+ye*We,65535),16),4294967295);
ye=nil;
repeat 
Ye=ee%4294967296;
if Ye~=Ye then 
ye=0;
break;end;
ye=Ye-Ye%1;until true;
X[Qe]=ye;end;end;else 
if R<66 then 
if R>=64 then 
if R==65 then 
X[p[G]]=X[_[G]]~=y[G];else 
X[p[G]][O[G]]=y[G];end;else 
X[_[G]]=X[y[G]]>=p[G];end;else 
if R>=67 then 
if R~=68 then 
X[_[G]]=w;else 
local Qe,ee,Ye=p[G],y[G],x[6];
local xe=f(Ye[Qe],143377016);
Ye[Qe]=xe;
Ye,Qe=x[5],xe+1;
xe=A(Ye,Qe);
local _e,Oe;
if xe<128 then 
_e,Oe=xe,Qe+1;else 
local ye=A(Ye,Qe+1);
if ye<128 then 
_e,Oe=(xe-128)*128+ye,Qe+2;else 
local We=A(Ye,Qe+2);
if We<128 then 
_e,Oe=(xe-128)*16384+(ye-128)+We*128,Qe+3;else 
local qe=A(Ye,Qe+3);
_e,Oe=(xe-128)*2097152+(ye-128)*128+(We-128)*16384+qe%128+(qe-qe%128)*2097152,Qe+4;end;end;end;
Qe,xe=ee*16843009,Oe+_e;
local ye=xe-_e%4;
for _e=Oe,ye-1,4 do 
L(Ye,_e,(f(E(Ye,_e),Qe)));end;
for Qe=ye,xe-1,1 do 
Z(Ye,Qe,(f(A(Ye,Qe),ee)));end;
p[G]=125;
y[G]=82;
_[G]=38;
w[G]=89;end;else 
t,z,M=_[G],y[G],p[G];
k=t+z;
X[t]=o(X[t](S(X,t+1,k)));end;end;end;end;end;else 
if R>=23 then 
if R>=34 then 
if R<40 then 
if R<37 then 
if R>=35 then 
if R~=36 then 
X[_[G]]=e[G]==c[G];else 
if J then 
for Qe in h,J,nil do 
if J then 
local ee=J[Qe];
if ee then 
ee[5]=ee;
ee[6]=X[Qe];
ee[4]=6;
J[Qe]=nil;end;end;end;end;
if j then 
for Qe,ee in h,j,nil do 
local Ye=ee[6];
if j then 
local ee=j[Qe];
if ee then 
local xe=n(Ye);
D(X,Qe,Qe+Ye-1,1,xe);
ee[5]=xe;
ee[4]=1;
j[Qe]=nil;end;end;end;end;
return;end;else 
X[y[G]]=X[p[G]]<X[_[G]];end;else 
if R>=38 then 
if R==39 then 
G=if X[y[G]]==X[_[G]]then p[G]else G;else 
local Qe,ee,Ye=_[G],e[G],c[G];
local xe,_e=I(ee,4294967295),I(Ye,4294967295);
local Ye,Oe,ye,We=I(xe,65535),P(xe,16),I(_e,65535),P(_e,16);
_e=I(Ye*ye+B(I(Ye*We+Oe*ye,65535),16),4294967295);
ee=nil;
repeat 
ye=_e%4294967296;
if ye~=ye then 
ee=0;
break;end;
ee=ye-ye%1;until true;
X[Qe]=ee;end;else 
X[y[G]][e[G]]=O[G];end;end;else 
if R<43 then 
if R<41 then 
X[_[G]]=X[p[G]](c[G]);else 
if R~=42 then 
X[_[G]]=c[G]+e[G];else 
G=if X[p[G]]<c[G]then _[G]else G;end;end;else 
if R<44 then 
X[_[G]](c[G],S(X[p[G]],1,X[p[G]].n));
elseif R~=45 then 
local Qe,ee,Ye=p[G],X[y[G]],O[G];
local xe,_e=I(ee,4294967295),I(Ye,4294967295);
local Ye,Oe,ye,We=I(xe,65535),P(xe,16),I(_e,65535),P(_e,16);
ee=I(Ye*ye+B(I(Ye*We+Oe*ye,65535),16),4294967295);
_e=nil;
repeat 
ye=ee%4294967296;
if ye~=ye then 
_e=0;
break;end;
_e=ye-ye%1;until true;
X[Qe]=_e;else 
b[p[G]][O[G]]=y[G];end;end;end;else 
if R<28 then 
if R<25 then 
if R~=24 then 
b[p[G]][c[G]]=X[_[G]];else 
X[y[G]][X[p[G]]]=O[G];end;else 
if R<26 then 
T[O[G]]=c[G];else 
if R==27 then 
d=X[p[G]];else 
X[_[G]]=y[G]-X[p[G]];end;end;end;else 
if R<31 then 
if R<29 then 
X[_[G]]=X[y[G]]..e[G];else 
if R~=30 then 
G=if not(X[_[G]]<y[G])then p[G]else G;else 
X[p[G]]=c[G]<=O[G];end;end;else 
if R>=32 then 
if R~=33 then 
K=X[p[G]];else 
t=b[_[G]];
t[5][t[4]]=e[G];end;else 
X[p[G]]=X[y[G]]*X[_[G]];end;end;end;end;else 
if R>=11 then 
if R>=17 then 
if R<20 then 
if R<18 then 
X[y[G]]=X[_[G]]==X[p[G]];else 
if R==19 then 
X[_[G]]=X[p[G]]*y[G];else 
t=b[_[G]];
t[5][t[4]]=X[y[G]];end;end;else 
if R>=21 then 
if R~=22 then 
X[_[G]]=X[p[G]]==y[G];else 
G=if X[p[G]]~=O[G]then y[G]else G;end;else 
X[y[G]]=X[_[G]][p[G]];end;end;else 
if R>=14 then 
if R>=15 then 
if R==16 then 
X[_[G]]=e[G]~=X[y[G]];else 
X[y[G]]=O[G]*X[p[G]];end;else 
X[y[G]]=Q[_[G]];end;else 
if R<12 then 
t,z,M,k=_[G],p[G],f(d,I(P(d,14),262143),(I(P(d,28),15))),y[G];
u=k<2097152 and 7 or 14;
N,F=I(k,B(1,u)-1),P(k,u);
y[G]=f(N,124,(I(M,127)));
w[G]=f(F,82,(I(P(M,21),127)));
_[G]=f(t,89,(I(P(M,7),127)));
p[G]=f(z,16,(I(P(M,14),127)));
G=G-1;else 
if R~=13 then 
C+=Y;
t=if Y<=0 then C>=U else C<=U;
if t then 
X[_[G]]=C;
G=p[G];else end;else 
X[_[G]]=X[p[G]][X[y[G]]];end;end;end;end;else 
if R>=5 then 
if R<8 then 
if R>=6 then 
if R~=7 then 
X[_[G]]=K;else 
t,z,M=_[G],p[G],y[G];
k,u=t+M-1,t+z;
N=X[u];
F=N.n;
s=z+F-1;
N.n=s;
D(N,1,F,z,N);
D(X,t+1,u-1,1,N);
r=o(X[t](S(N,1,N.n)));
D(r,1,M,t,X);end;else 
z,t=p[G],_[G]+1;
for Qe=1,y[G],1 do 
z=I(f(z,(B(z,13))),536870911);
z=f(z,(P(z,13)));
z=I(f(z,(B(z,14))),536870911);
y[t]=f(y[t],(I(P(z,0),127)));
_[t]=f(_[t],(I(P(z,7),127)));
p[t]=f(p[t],(I(P(z,14),127)));
w[t]=f(w[t],(I(P(z,21),127)));
t=t+1;end;
w[G]=89;end;else 
if R>=9 then 
if R~=10 then 
X[y[G]]=X[_[G]]-p[G];else 
t,z,M,k=p[G],_[G],y[G],f(d,I(P(d,14),262143),(I(P(d,28),15)));
u=t<16384 and 7 or(t<2097152 and 14 or 21);
N,F=P(t,u),I(t,B(1,u)-1);
_[G]=f(z,32,(I(P(k,7),127)));
y[G]=f(M,83,(I(k,127)));
w[G]=f(N,72,(I(P(k,21),127)));
p[G]=f(F,97,(I(P(k,14),127)));
G=G-1;end;else 
t=b[p[G]];
t[5][t[4]][c[G]]=X[_[G]];end;end;else 
if R>=2 then 
if R>=3 then 
if R==4 then 
t=_[G];
M=t+y[G];
if J then 
for Qe in h,J,nil do 
if J then 
local ee=J[Qe];
if ee then 
ee[5]=ee;
ee[6]=X[Qe];
ee[4]=6;
J[Qe]=nil;end;end;end;end;
if j then 
for Qe,ee in h,j,nil do 
local Ye=ee[6];
if j then 
local ee=j[Qe];
if ee then 
local xe,_e=Qe+Ye,n(Ye);
D(X,Qe,xe-1,1,_e);
ee[5]=_e;
ee[4]=1;
j[Qe]=nil;end;end;end;end;
return X[t](S(X,t+1,M));else 
X[p[G]]=X[_[G]]+y[G];end;else 
X[_[G]]={};end;else 
if R==1 then 
t,z,M=_[G],p[G],y[G];
k,u=X[t],t+z;
N=X[u];
D(X,t+1,u-1,M+1,k);
D(N,1,N.n,M+z,k);else 
G=if _[G]<X[y[G]]then p[G]else G;end;end;end;end;end;end;else 
if R<139 then 
if R<116 then 
if R<104 then 
local Qe;
if R<98 then 
if R<95 then 
if R~=94 then 
Qe=V;
V,t={[9]=Qe,[8]=C,[7]=Y,[5]=U},p[G];
Y,U=X[t+2]+0,X[t+1]+0;
C=X[t]-Y;
G=y[G];else 
X[p[G]](X[_[G]],c[G]);end;else 
if R<96 then 
X[_[G]]=e[G]==X[y[G]];else 
if R~=97 then 
G=if X[y[G]]==_[G]then p[G]else G;else 
X[_[G]]=e[G]+X[y[G]];end;end;end;else 
if R>=101 then 
if R<102 then 
X[p[G]]=p;else 
if R==103 then 
X[y[G]]=X[_[G]]-e[G];else 
Qe=V;
V,t,z={[9]=Qe,[8]=C,[7]=Y,[5]=U},p[G],g(i);
z(Q,X[t],X[t+1],X[t+2]);
G,C=_[G],z;end;end;else 
if R>=99 then 
if R~=100 then 
X[p[G]]=d;else 
if J then 
for Qe in h,J,nil do 
if J then 
local ee=J[Qe];
if ee then 
ee[5]=ee;
ee[6]=X[Qe];
ee[4]=6;
J[Qe]=nil;end;end;end;end;
if j then 
for Qe,ee in h,j,nil do 
local Ye=ee[6];
if j then 
local ee=j[Qe];
if ee then 
local xe,_e=Qe+Ye-1,n(Ye);
D(X,Qe,xe,1,_e);
ee[5]=_e;
ee[4]=1;
j[Qe]=nil;end;end;end;end;
return X[_[G]],X[y[G]];end;else 
if J then 
for Qe in h,J,nil do 
if J then 
local ee=J[Qe];
if ee then 
ee[5]=ee;
ee[6]=X[Qe];
ee[4]=6;
J[Qe]=nil;end;end;end;end;
if j then 
for Qe,ee in h,j,nil do 
local Ye=ee[6];
if j then 
local ee=j[Qe];
if ee then 
local xe=n(Ye);
D(X,Qe,Qe+Ye-1,1,xe);
ee[5]=xe;
ee[4]=1;
j[Qe]=nil;end;end;end;end;
return c[G];end;end;end;else 
if R>=110 then 
if R>=113 then 
if R>=114 then 
if R~=115 then 
X[p[G]]=X[y[G]]//X[_[G]];else 
t,z=p[G],_[G];
M={n=z-t+1};
D(X,t,z,1,M);
X[y[G]]=M;end;else 
X[_[G]][X[y[G]]]=p[G];end;else 
if R<111 then 
X[y[G]]=b[_[G]];
elseif R==112 then 
local Qe,ee,Ye=p[G],X[y[G]];
repeat 
local xe=ee%4294967296;
if xe~=xe then 
Ye=0;
break;end;
Ye=xe-xe%1;until true;
X[Qe]=Ye;else 
X[y[G]](O[G],X[p[G]]);end;end;else 
if R<107 then 
if R<105 then 
t,z=_[G],X[y[G]];
X[t+1]=z;
X[t]=z[e[G]];else 
if R~=106 then 
X[_[G]](S(X[p[G]],1,X[p[G]].n));else 
if J then 
for Qe in h,J,nil do 
if J then 
local ee=J[Qe];
if ee then 
ee[5]=ee;
ee[6]=X[Qe];
ee[4]=6;
J[Qe]=nil;end;end;end;end;
if j then 
for Qe,ee in h,j,nil do 
local Ye=ee[6];
if j then 
local ee=j[Qe];
if ee then 
local xe=n(Ye);
D(X,Qe,Qe+Ye-1,1,xe);
ee[5]=xe;
ee[4]=1;
j[Qe]=nil;end;end;end;end;
return X[y[G]]();end;end;else 
if R<108 then 
X[y[G]]=X[_[G]]..X[p[G]];else 
if R==109 then 
X[_[G]]=X[p[G]]<=X[y[G]];else 
G=if X[y[G]]<=X[_[G]]then p[G]else G;end;end;end;end;end;else 
if R<127 then 
if R<121 then 
if R>=118 then 
if R<119 then 
X[p[G]][c[G]]=X[_[G]];else 
if R~=120 then 
X[p[G]](X[_[G]],X[y[G]]);else 
t=y[G];
local Qe,ee,Ye=C();
if Qe then 
X[t+1]=ee;
X[t+2]=Ye;
G=_[G];else end;
z,M,k=Qe,ee,Ye;end;end;else 
if R~=117 then 
G=if not(X[p[G]]<X[_[G]])then y[G]else G;else 
X[p[G]]=T[O[G]];end;end;else 
if R<124 then 
if R<122 then 
local Qe,ee,Ye=y[G],f(_[G],(I(f(K,(I(P(K,29),7))),536870911))),x[6];
local xe=f(Ye[Qe],143377016);
Ye[Qe]=xe;
Qe,Ye=x[5],xe+1;
xe=A(Qe,Ye);
local _e,Oe;
if xe<128 then 
_e,Oe=xe,Ye+1;else 
local ye=A(Qe,Ye+1);
if ye<128 then 
_e,Oe=(xe-128)*128+ye,Ye+2;else 
local We=A(Qe,Ye+2);
if We<128 then 
_e,Oe=(xe-128)*16384+(ye-128)+We*128,Ye+3;else 
local qe=A(Qe,Ye+3);
_e,Oe=(xe-128)*2097152+(ye-128)*128+(We-128)*16384+qe%128+(qe-qe%128)*2097152,Ye+4;end;end;end;
Ye,xe=ee*16843009,Oe+_e;
local ye=xe-_e%4;
for _e=Oe,ye-1,4 do 
L(Qe,_e,(f(E(Qe,_e),Ye)));end;
for Ye=ye,xe-1,1 do 
Z(Qe,Ye,(f(A(Qe,Ye),ee)));end;
y[G]=94;
_[G]=77;
p[G]=16;
w[G]=89;else 
if R==123 then 
t=X[y[G]];
X[_[G]]=o(S(t,p[G],t.n));else 
X[_[G]]=X[p[G]]+c[G];end;end;else 
if R<125 then 
local Qe,ee,Ye=_[G],e[G],X[y[G]];
local xe,_e=I(ee,4294967295),I(Ye,4294967295);
local Ye,Oe,ye,We=I(xe,65535),P(xe,16),I(_e,65535),P(_e,16);
_e=I(Ye*ye+B(I(Ye*We+Oe*ye,65535),16),4294967295);
Oe=nil;
repeat 
ee=_e%4294967296;
if ee~=ee then 
Oe=0;
break;end;
Oe=ee-ee%1;until true;
X[Qe]=Oe;else 
if R==126 then 
t,z={...},y[G];
D(t,1,p[G],z,X);else 
X[y[G]]=x;end;end;end;end;else 
if R>=133 then 
if R<136 then 
if R<134 then 
X[y[G]]=_;
elseif R~=135 then 
X[y[G]](O[G]);else 
X[y[G]]=X[p[G]]<=_[G];end;else 
if R>=137 then 
if R~=138 then 
G=X[y[G]];else 
t,z,M=_[G],p[G],y[G];
k,u,N=t+M-1,t+z,o(X[t](S(X,t+1,t+z)));
D(N,1,M,t,X);end;else 
C,U=V[8],V[5];
Y,V=V[7],V[9];end;end;else 
if R<130 then 
if R<128 then 
if J then 
for Qe in h,J,nil do 
if J then 
local ee=J[Qe];
if ee then 
ee[5]=ee;
ee[6]=X[Qe];
ee[4]=6;
J[Qe]=nil;end;end;end;end;
if j then 
for Qe,ee in h,j,nil do 
local Ye=ee[6];
if j then 
local ee=j[Qe];
if ee then 
local xe=n(Ye);
D(X,Qe,Qe+Ye-1,1,xe);
ee[5]=xe;
ee[4]=1;
j[Qe]=nil;end;end;end;end;
return X[y[G]](X[p[G]],X[_[G]]);
elseif R~=129 then 
X[y[G]](X[_[G]]);else 
local Qe,ee,Ye=_[G],c[G];
repeat 
local xe=ee%4294967296;
if xe~=xe then 
Ye=0;
break;end;
Ye=xe-xe%1;until true;
X[Qe]=Ye;end;
elseif R>=131 then 
if R==132 then 
X[p[G]]=X[y[G]]%_[G];else 
X[_[G]]();end;else 
X[_[G]]=e[G]..X[y[G]];end;end;end;end;else 
if R<162 then 
if R<150 then 
if R<144 then 
if R>=141 then 
if R<142 then 
local Qe;
local ee=O[G];
if ee then 
local Ye=#ee/3;
if Ye>0 then 
Qe={};
local xe,_e=J,j;
for Oe=1,Ye,1 do 
local Ye=(Oe-1)*3;
local ye,We=ee[Ye+2],ee[Ye+1];
if ye==1 then 
xe=if not xe then{}else xe;
local qe=xe[We];
if not qe then 
qe={[4]=We,[5]=X};
xe[We]=qe;else end;
Qe[Oe]=qe;else 
if ye==3 then 
Qe[Oe]=X[We];else 
if ye==2 then 
Qe[Oe]=b[We];else 
if ye==0 then 
_e=if not _e then{}else _e;
local ye=_e[We];
if not ye then 
ye={[6]=ee[Ye+3],[5]=X,[4]=We};
_e[We]=ye;else end;
Qe[Oe]=ye;else end;end;end;end;end;
J,j=xe,_e;else end;else end;
z=c[G](Qe);
l(z,T);
X[p[G]]=z;
t=Qe;else 
if R==143 then 
local Qe,ee,Ye=_[G],X[p[G]],X[y[G]];
local xe,_e=I(ee,4294967295),I(Ye,4294967295);
local Oe,ye,We,qe=I(xe,65535),P(xe,16),I(_e,65535),P(_e,16);
ee=I(Oe*We+B(I(Oe*qe+ye*We,65535),16),4294967295);
Ye=nil;
repeat 
xe=ee%4294967296;
if xe~=xe then 
Ye=0;
break;end;
Ye=xe-xe%1;until true;
X[Qe]=Ye;else 
v=X[_[G]];end;end;else 
if R==140 then 
local Qe,ee,Ye=y[G],_[G],X[p[G]];
local xe,_e=I(ee,4294967295),I(Ye,4294967295);
local Ye,Oe,ye,We=I(xe,65535),P(xe,16),I(_e,65535),P(_e,16);
ee=I(Ye*ye+B(I(Ye*We+Oe*ye,65535),16),4294967295);
ye=nil;
repeat 
Ye=ee%4294967296;
if Ye~=Ye then 
ye=0;
break;end;
ye=Ye-Ye%1;until true;
X[Qe]=ye;else 
X[y[G]]=X[_[G]](S(X[p[G]],1,X[p[G]].n));end;end;else 
if R>=147 then 
if R>=148 then 
if R~=149 then 
local Qe,ee,Ye=_[G],X[p[G]],y[G];
local xe,_e=I(ee,4294967295),I(Ye,4294967295);
local Oe,ye,We,qe=I(xe,65535),P(xe,16),I(_e,65535),P(_e,16);
ee=I(Oe*We+B(I(Oe*qe+ye*We,65535),16),4294967295);
Ye=nil;
repeat 
qe=ee%4294967296;
if qe~=qe then 
Ye=0;
break;end;
Ye=qe-qe%1;until true;
X[Qe]=Ye;else 
local Qe,ee,Ye=y[G],_[G],p[G];
local xe,_e=I(ee,4294967295),I(Ye,4294967295);
local Ye,Oe,ye,We=I(xe,65535),P(xe,16),I(_e,65535),P(_e,16);
xe=I(Ye*ye+B(I(Ye*We+Oe*ye,65535),16),4294967295);
ee=nil;
repeat 
_e=xe%4294967296;
if _e~=_e then 
ee=0;
break;end;
ee=_e-_e%1;until true;
X[Qe]=ee;end;else 
t=b[_[G]];
t[5][t[4]][X[y[G]]]=X[p[G]];end;else 
if R<145 then 
X[_[G]]=X[y[G]]<p[G];
elseif R==146 then 
X[p[G]]=o(X[_[G]]());else 
X[y[G]]=X[p[G]]>X[_[G]];end;end;end;else 
if R<156 then 
if R<153 then 
if R>=151 then 
if R==152 then 
X[_[G]]=X[p[G]]<c[G];else 
G=if X[y[G]]~=_[G]then p[G]else G;end;else 
X[_[G]]=y[G]*X[p[G]];end;else 
if R>=154 then 
if R~=155 then 
if J then 
for Qe in h,J,nil do 
if J then 
local ee=J[Qe];
if ee then 
ee[5]=ee;
ee[6]=X[Qe];
ee[4]=6;
J[Qe]=nil;end;end;end;end;
if j then 
for Qe,ee in h,j,nil do 
local Ye=ee[6];
if j then 
local ee=j[Qe];
if ee then 
local xe,_e=Qe+Ye-1,n(Ye);
D(X,Qe,xe,1,_e);
ee[5]=_e;
ee[4]=1;
j[Qe]=nil;end;end;end;end;
t=p[G];
return S(X,t,t+y[G]-1);else 
X[p[G]],X[_[G]]=X[y[G]]();end;else 
X[_[G]]=X[y[G]]%X[p[G]];end;end;else 
if R<159 then 
if R<157 then 
t=b[y[G]];
X[_[G]]=t[5][t[4]][X[p[G]]];else 
if R==158 then 
local Qe=y[G];
if J then 
local ee=J[Qe];
if ee then 
ee[5]=ee;
ee[6]=X[Qe];
ee[4]=6;
J[Qe]=nil;end;end;else 
t=b[p[G]];
t[5][t[4]][c[G]]=O[G];end;end;else 
if R<160 then 
z,t=(f(_[G],(I(f(K,(I(P(K,29),7))),536870911)))),y[G]+1;
for Qe=1,p[G],1 do 
z=I(f(z,(B(z,13))),536870911);
z=f(z,(P(z,13)));
z=I(f(z,(B(z,14))),536870911);
y[t]=f(y[t],(I(P(z,0),127)));
_[t]=f(_[t],(I(P(z,7),127)));
p[t]=f(p[t],(I(P(z,14),127)));
w[t]=f(w[t],(I(P(z,21),127)));
t=t+1;end;
w[G]=89;else 
if R==161 then 
G=if y[G]<=X[_[G]]then p[G]else G;else 
X[y[G]]=X[p[G]][O[G]];end;end;end;end;end;else 
if R<174 then 
if R>=168 then 
if R>=171 then 
if R<172 then 
for Qe=_[G],y[G],1 do 
X[Qe]=nil;end;else 
if R==173 then 
t,z,M=y[G],{...},p[G];
D(z,1,t-1,M,X);
X[M+t-1]=o(m(t,...));else 
T[c[G]]=X[_[G]];end;end;else 
if R>=169 then 
if R==170 then 
G=if X[y[G]]then p[G]else _[G];else 
t,z,M=_[G],y[G],p[G];
k=t+z;
u=X[k];
N=u.n;
F=z+N-1;
u.n=F;
D(u,1,N,z,u);
D(X,t+1,k-1,1,u);
X[t]=o(X[t](S(u,1,u.n)));end;else 
X[_[G]]=X[p[G]]>c[G];end;end;else 
if R>=165 then 
if R>=166 then 
if R==167 then 
X[_[G]]=X[y[G]]%e[G];else 
X[p[G]][_[G]]=y[G];end;else 
X[y[G]]=_[G]%X[p[G]];end;else 
if R>=163 then 
if R==164 then 
X[_[G]]=y;else 
X[y[G]](O[G],e[G]);end;else 
G=if X[_[G]]<=p[G]then y[G]else G;end;end;end;else 
if R>=180 then 
if R<183 then 
if R<181 then 
X[_[G]]=y[G]^X[p[G]];
elseif R==182 then 
local m,Qe,ee=y[G],f(_[G],(I(f(d,(I(P(d,29),7))),536870911))),x[6];
local Ye=f(ee[m],143377016);
ee[m]=Ye;
m,ee=x[5],Ye+1;
Ye=A(m,ee);
local xe,_e;
if Ye<128 then 
xe,_e=Ye,ee+1;else 
local Oe=A(m,ee+1);
if Oe<128 then 
xe,_e=(Ye-128)*128+Oe,ee+2;else 
local ye=A(m,ee+2);
if ye<128 then 
xe,_e=(Ye-128)*16384+(Oe-128)+ye*128,ee+3;else 
local We=A(m,ee+3);
xe,_e=(Ye-128)*2097152+(Oe-128)*128+(ye-128)*16384+We%128+(We-We%128)*2097152,ee+4;end;end;end;
ee,Ye=Qe*16843009,_e+xe;
local Oe=Ye-xe%4;
for xe=_e,Oe-1,4 do 
L(m,xe,(f(E(m,xe),ee)));end;
for ee=Oe,Ye-1,1 do 
Z(m,ee,(f(A(m,ee),Qe)));end;
y[G]=192;
_[G]=215;
p[G]=74;
w[G]=89;else 
X[y[G]]=n(p[G]);end;else 
if R>=184 then 
if R==185 then 
X[_[G]]=y[G];else 
G=if X[_[G]]==e[G]then y[G]else G;end;else 
X[p[G]]=b[_[G]][c[G]];end;end;else 
if R>=177 then 
if R<178 then 
X[p[G]]=X[_[G]]//y[G];
elseif R~=179 then 
X[y[G]]=not X[p[G]];else 
X[_[G]]=o(X[y[G]](S(X[p[G]],1,X[p[G]].n)));end;
elseif R<175 then 
X[p[G]]=X[_[G]]~=X[y[G]];
elseif R==176 then 
X[p[G]]=_[G]+X[y[G]];else 
X[p[G]][X[y[G]]]=X[_[G]];end;end;end;end;end;end;
G=G+1;end;else 
G,H=W,a;end;
if H==81 then 
while true do 
local W,a=p[G];
if W>=89 then 
if W>=133 then 
if W>=155 then 
if W<166 then 
if W<160 then 
if W>=157 then 
if W<158 then 
X[y[G]]=X[_[G]]*q[G];
elseif W==159 then 
local m,R,Qe=w[G],O[G],X[y[G]];
local ee,Ye=I(R,4294967295),I(Qe,4294967295);
local R,Qe,xe,_e=I(ee,65535),P(ee,16),I(Ye,65535),P(Ye,16);
ee=I(R*xe+B(I(R*_e+Qe*xe,65535),16),4294967295);
Qe=nil;
repeat 
R=ee%4294967296;
if R~=R then 
Qe=0;
break;end;
Qe=R-R%1;until true;
X[m]=Qe;else 
X[y[G]]=X[w[G]]-_[G];end;
elseif W==156 then 
X[w[G]]=X[_[G]]/c[G];else 
X[_[G]]=o(X[y[G]](X[w[G]]));end;else 
if W<163 then 
if W<161 then 
X[y[G]]=X[_[G]];
t=y[G+1];
z,M,k=X[t],X[t+1],X[t+2];
X[t]=z(M,k);
G=G+1;else 
if W~=162 then 
X[y[G]]=X[_[G]](X[w[G]]);else 
X[y[G]]=X[_[G]]+X[w[G]];end;end;else 
if W<164 then 
X[w[G]](X[y[G]],X[_[G]]);
elseif W==165 then 
X[w[G]]=y[G]*X[_[G]];else 
local m,R,Qe=y[G],O[G],w[G];
local ee,Ye=I(R,4294967295),I(Qe,4294967295);
local xe,_e,Oe,ye=I(ee,65535),P(ee,16),I(Ye,65535),P(Ye,16);
Qe=I(xe*Oe+B(I(xe*ye+_e*Oe,65535),16),4294967295);
R=nil;
repeat 
_e=Qe%4294967296;
if _e~=_e then 
R=0;
break;end;
R=_e-_e%1;until true;
X[m]=R;end;end;end;else 
if W<172 then 
if W>=169 then 
if W<170 then 
X[_[G]]=f(X[y[G]],X[w[G]]);
elseif W~=171 then 
X[y[G]]=X[_[G]]%q[G];else 
X[w[G]][O[G]]=c[G];end;else 
if W>=167 then 
if W~=168 then 
t,z,M=_[G],y[G],w[G];
k,u,N=t+M-1,t+z,o(X[t](S(X,t+1,t+z)));
D(N,1,M,t,X);else 
X[y[G]]=X[_[G]];end;else 
X[w[G]][c[G]]=X[_[G]];end;end;else 
if W>=175 then 
if W<176 then 
t=b[y[G]];
t[5][t[4]][O[G]]=w[G];else 
if W~=177 then 
X[_[G]]=o(X[w[G]]());else 
Q[_[G]]=X[y[G]];end;end;else 
if W>=173 then 
if W~=174 then 
X[_[G]]=X[y[G]]~=w[G];else 
X[y[G]]=X[_[G]]>=X[w[G]];end;else 
X[w[G]]=c[G]==O[G];end;end;end;end;else 
if W>=144 then 
if W>=149 then 
if W>=152 then 
if W<153 then 
X[_[G]]=_;else 
if W~=154 then 
local m;
local R=c[G];
if R then 
local Qe=#R/3;
if Qe>0 then 
m={};
local ee,Ye=J,j;
for xe=1,Qe,1 do 
local Qe=(xe-1)*3;
local _e,Oe=R[Qe+2],R[Qe+1];
if _e==1 then 
ee=if not ee then{}else ee;
local ye=ee[Oe];
if not ye then 
ye={[4]=Oe,[5]=X};
ee[Oe]=ye;else end;
m[xe]=ye;else 
if _e==3 then 
m[xe]=X[Oe];else 
if _e==2 then 
m[xe]=b[Oe];else 
if _e==0 then 
Ye=if not Ye then{}else Ye;
local _e=Ye[Oe];
if not _e then 
_e={[6]=R[Qe+3],[5]=X,[4]=Oe};
Ye[Oe]=_e;else end;
m[xe]=_e;else end;end;end;end;end;
J,j=ee,Ye;else end;else end;
z=q[G](m);
l(z,T);
X[_[G]]=z;
t=m;else 
t=b[_[G]];
t[5][t[4]][X[w[G]]]=c[G];end;end;else 
if W>=150 then 
if W~=151 then 
X[_[G]]=T[c[G]];else 
local m,R,Qe=y[G],O[G],q[G];
local ee,Ye=I(R,4294967295),I(Qe,4294967295);
local Qe,xe,_e,Oe=I(ee,65535),P(ee,16),I(Ye,65535),P(Ye,16);
R=I(Qe*_e+B(I(Qe*Oe+xe*_e,65535),16),4294967295);
_e=nil;
repeat 
xe=R%4294967296;
if xe~=xe then 
_e=0;
break;end;
_e=xe-xe%1;until true;
X[m]=_e;end;else 
X[_[G]](c[G],q[G]);end;end;else 
if W>=146 then 
if W>=147 then 
if W==148 then 
b[w[G]][c[G]]=O[G];else 
local m,R,Qe=_[G],f(y[G],(I(f(K,(I(P(K,29),7))),536870911))),x[6];
local ee=f(Qe[m],143377016);
Qe[m]=ee;
m,Qe=x[5],ee+1;
ee=A(m,Qe);
local Ye,xe;
if ee<128 then 
Ye,xe=ee,Qe+1;else 
local _e=A(m,Qe+1);
if _e<128 then 
Ye,xe=(ee-128)*128+_e,Qe+2;else 
local Oe=A(m,Qe+2);
if Oe<128 then 
Ye,xe=(ee-128)*16384+(_e-128)+Oe*128,Qe+3;else 
local ye=A(m,Qe+3);
Ye,xe=(ee-128)*2097152+(_e-128)*128+(Oe-128)*16384+ye%128+(ye-ye%128)*2097152,Qe+4;end;end;end;
Qe,ee=R*16843009,xe+Ye;
local _e=ee-Ye%4;
for Ye=xe,_e-1,4 do 
L(m,Ye,(f(E(m,Ye),Qe)));end;
for Qe=_e,ee-1,1 do 
Z(m,Qe,(f(A(m,Qe),R)));end;
_[G]=149;
y[G]=3;
w[G]=48;
p[G]=51;end;else 
T[c[G]]=O[G];end;else 
if W==145 then 
local m,R,Qe=_[G],f(y[G],(I(f(d,(I(P(d,29),7))),536870911))),x[6];
local ee=f(Qe[m],143377016);
Qe[m]=ee;
m,Qe=x[5],ee+1;
ee=A(m,Qe);
local Ye,xe;
if ee<128 then 
Ye,xe=ee,Qe+1;else 
local _e=A(m,Qe+1);
if _e<128 then 
Ye,xe=(ee-128)*128+_e,Qe+2;else 
local Oe=A(m,Qe+2);
if Oe<128 then 
Ye,xe=(ee-128)*16384+(_e-128)+Oe*128,Qe+3;else 
local ye=A(m,Qe+3);
Ye,xe=(ee-128)*2097152+(_e-128)*128+(Oe-128)*16384+ye%128+(ye-ye%128)*2097152,Qe+4;end;end;end;
ee,Qe=R*16843009,xe+Ye;
local _e=Qe-Ye%4;
for Ye=xe,_e-1,4 do 
L(m,Ye,(f(E(m,Ye),ee)));end;
for ee=_e,Qe-1,1 do 
Z(m,ee,(f(A(m,ee),R)));end;
_[G]=84;
y[G]=20;
w[G]=188;
p[G]=51;else 
t,z,M=w[G],_[G],y[G];
k=t+z;
X[t]=o(X[t](S(X,t+1,k)));end;end;end;else 
if W<138 then 
if W>=135 then 
if W<136 then 
X[w[G]]=X[_[G]]*y[G];
elseif W==137 then 
X[y[G]]=X[_[G]][q[G]];else 
X[w[G]][O[G]]=y[G];end;else 
if W==134 then 
t,z,M=y[G],w[G],_[G];
k=X[t];
D(X,t+1,t+z,M+1,k);else 
X[w[G]]=p;end;end;else 
if W>=141 then 
if W<142 then 
X[_[G]]=X[w[G]]==c[G];
elseif W==143 then 
t=_[G];
M=t+y[G];
if J then 
for m in h,J,nil do 
if J then 
local R=J[m];
if R then 
R[5]=R;
R[6]=X[m];
R[4]=6;
J[m]=nil;end;end;end;end;
if j then 
for m,R in h,j,nil do 
local Qe=R[6];
if j then 
local R=j[m];
if R then 
local ee,Ye=m+Qe,n(Qe);
D(X,m,ee-1,1,Ye);
R[5]=Ye;
R[4]=1;
j[m]=nil;end;end;end;end;
return X[t](S(X,t+1,M));else 
X[w[G]]=X[y[G]]//X[_[G]];end;
elseif W<139 then 
X[y[G]]=n(w[G]);
elseif W==140 then 
X[w[G]]=X[y[G]]<_[G];else 
X[y[G]]=y;end;end;end;end;else 
if W<111 then 
if W>=100 then 
if W<105 then 
if W<102 then 
if W~=101 then 
t=b[w[G]];
X[y[G]]=t[5][t[4]];else 
X[_[G]]=X[w[G]]>=y[G];end;else 
if W<103 then 
z,t=(f(y[G],(I(f(d,(I(P(d,29),7))),536870911)))),_[G]+1;
for m=1,w[G],1 do 
z=I(f(z,(B(z,13))),536870911);
z=f(z,(P(z,13)));
z=I(f(z,(B(z,14))),536870911);
_[t]=f(_[t],(I(P(z,0),127)));
y[t]=f(y[t],(I(P(z,7),127)));
w[t]=f(w[t],(I(P(z,14),127)));
p[t]=f(p[t],(I(P(z,21),127)));
t=t+1;end;
p[G]=51;else 
if W==104 then 
d=X[w[G]];else 
X[w[G]]=b[y[G]];end;end;end;else 
if W>=108 then 
if W>=109 then 
if W==110 then 
for m=_[G],w[G],1 do 
X[m]=nil;end;else 
X[y[G]]=X[w[G]]<O[G];end;else 
X[_[G]](c[G]);end;
elseif W<106 then 
local m,R,Qe=y[G],X[w[G]],O[G];
local ee,Ye=I(R,4294967295),I(Qe,4294967295);
local R,Qe,xe,_e=I(ee,65535),P(ee,16),I(Ye,65535),P(Ye,16);
Ye=I(R*xe+B(I(R*_e+Qe*xe,65535),16),4294967295);
xe=nil;
repeat 
Qe=Ye%4294967296;
if Qe~=Qe then 
xe=0;
break;end;
xe=Qe-Qe%1;until true;
X[m]=xe;
elseif W==107 then 
X[_[G]][w[G]]=X[y[G]];else 
X[w[G]]=X[y[G]](S(X[_[G]],1,X[_[G]].n));end;end;else 
if W<94 then 
if W<91 then 
if W==90 then 
t=b[_[G]];
t[5][t[4]][c[G]]=X[w[G]];else 
X[_[G]][X[y[G]]]=X[w[G]];end;else 
if W>=92 then 
if W==93 then 
X[w[G]]=y[G];
X[y[G+1]]=X[_[G+1]];
G+=1;else 
X[w[G]][X[y[G]]]=_[G];end;else 
X[y[G]]=X[_[G]]*X[w[G]];end;end;else 
if W>=97 then 
if W<98 then 
X[y[G]]=w;
elseif W~=99 then 
X[w[G]]=d;else 
X[_[G]](X[y[G]],q[G]);end;else 
if W>=95 then 
if W~=96 then 
X[_[G]]=X[w[G]]..X[y[G]];else 
G=y[G];end;else 
X[y[G]]=X[_[G]]==X[w[G]];end;end;end;end;else 
if W<122 then 
if W<116 then 
if W>=113 then 
if W>=114 then 
if W~=115 then 
X[_[G]][w[G]]=c[G];else 
X[y[G]]=v;end;else 
local m,R,Qe=w[G],_[G],x[6];
local ee=f(Qe[m],143377016);
Qe[m]=ee;
Qe,m=x[5],ee+1;
ee=A(Qe,m);
local Ye,xe;
if ee<128 then 
Ye,xe=ee,m+1;else 
local _e=A(Qe,m+1);
if _e<128 then 
Ye,xe=(ee-128)*128+_e,m+2;else 
local Oe=A(Qe,m+2);
if Oe<128 then 
Ye,xe=(ee-128)*16384+(_e-128)+Oe*128,m+3;else 
local ye=A(Qe,m+3);
Ye,xe=(ee-128)*2097152+(_e-128)*128+(Oe-128)*16384+ye%128+(ye-ye%128)*2097152,m+4;end;end;end;
m,ee=R*16843009,xe+Ye;
local _e=ee-Ye%4;
for Ye=xe,_e-1,4 do 
L(Qe,Ye,(f(E(Qe,Ye),m)));end;
for m=_e,ee-1,1 do 
Z(Qe,m,(f(A(Qe,m),R)));end;
w[G]=200;
_[G]=76;
y[G]=160;
p[G]=51;end;
elseif W~=112 then 
X[_[G]]=Q[y[G]];else 
X[_[G]]=q[G];end;else 
if W<119 then 
if W<117 then 
z,t=_[G],y[G]+1;
for m=1,w[G],1 do 
z=I(f(z,(B(z,13))),536870911);
z=f(z,(P(z,13)));
z=I(f(z,(B(z,14))),536870911);
_[t]=f(_[t],(I(P(z,0),127)));
y[t]=f(y[t],(I(P(z,7),127)));
w[t]=f(w[t],(I(P(z,14),127)));
p[t]=f(p[t],(I(P(z,21),127)));
t=t+1;end;
p[G]=51;else 
if W==118 then 
t,z,M=y[G],w[G],_[G];
k,u=t+M-1,t+z;
N=X[u];
F=N.n;
s=z+F-1;
N.n=s;
D(N,1,F,z,N);
D(X,t+1,u-1,1,N);
r=o(X[t](S(N,1,N.n)));
D(r,1,M,t,X);else 
X[_[G]]=X[y[G]]%w[G];end;end;else 
if W>=120 then 
if W~=121 then 
X[w[G]]=X[y[G]]+O[G];else 
X[_[G]]=x;end;else 
a=V;
V,t,z={[9]=a,[8]=C,[7]=Y,[5]=U},y[G],g(i);
z(Q,X[t],X[t+1],X[t+2]);
G,C=_[G],z;end;end;end;else 
if W>=127 then 
if W>=130 then 
if W<131 then 
X[w[G]](X[y[G]],S(X[_[G]],1,X[_[G]].n));
elseif W~=132 then 
X[y[G]]=q[G]+O[G];else 
X[_[G]]=Q;end;
elseif W<128 then 
X[y[G]]=X[w[G]]();
elseif W~=129 then 
local m=_[G];
if J then 
local R=J[m];
if R then 
R[5]=R;
R[6]=X[m];
R[4]=6;
J[m]=nil;end;end;else 
X[_[G]]=X[w[G]]==y[G];end;else 
if W>=124 then 
if W>=125 then 
if W==126 then 
t=y[G];
z,M,k=X[t],X[t+1],X[t+2];
X[t]=z(M,k);else 
if J then 
for m in h,J,nil do 
if J then 
local R=J[m];
if R then 
R[5]=R;
R[6]=X[m];
R[4]=6;
J[m]=nil;end;end;end;end;
if j then 
for m,R in h,j,nil do 
local Qe=R[6];
if j then 
local R=j[m];
if R then 
local ee,Ye=m+Qe-1,n(Qe);
D(X,m,ee,1,Ye);
R[5]=Ye;
R[4]=1;
j[m]=nil;end;end;end;end;
return X[_[G]];end;else 
t=_[G];
local m,R,Qe=C();
if m then 
X[t+1]=R;
X[t+2]=Qe;
G=w[G];else end;
z,M,k=m,R,Qe;end;else 
if W==123 then 
local m,R,Qe=y[G],w[G],X[_[G]];
local ee,Ye=I(R,4294967295),I(Qe,4294967295);
local Qe,xe,_e,Oe=I(ee,65535),P(ee,16),I(Ye,65535),P(Ye,16);
ee=I(Qe*_e+B(I(Qe*Oe+xe*_e,65535),16),4294967295);
R=nil;
repeat 
Ye=ee%4294967296;
if Ye~=Ye then 
R=0;
break;end;
R=Ye-Ye%1;until true;
X[m]=R;else 
X[y[G]]=X[w[G]](O[G]);end;end;end;end;end;end;else 
if W<44 then 
if W<22 then 
if W>=11 then 
if W<16 then 
if W<13 then 
if W~=12 then 
X[y[G]]=O[G]*X[w[G]];else 
X[_[G]]=X[y[G]]%X[w[G]];end;else 
if W>=14 then 
if W~=15 then 
X[w[G]]=X[y[G]]~=O[G];else 
G=if X[y[G]]<=w[G]then _[G]else G;end;else 
t=b[_[G]];
t[5][t[4]][X[y[G]]]=X[w[G]];end;end;else 
if W>=19 then 
if W<20 then 
X[w[G]]=y[G]^X[_[G]];else 
if W==21 then 
X[y[G]]=X[_[G]][X[w[G]]];else 
t,z,M,k=y[G],w[G],f(d,I(P(d,14),262143),(I(P(d,28),15))),_[G];
u=k<16384 and 7 or(k<2097152 and 14 or 21);
N,F=P(k,u),I(k,B(1,u)-1);
w[G]=f(z,92,(I(P(M,14),127)));
y[G]=f(t,79,(I(P(M,7),127)));
_[G]=f(F,88,(I(M,127)));
p[G]=f(N,11,(I(P(M,21),127)));
G=G-1;end;end;else 
if W>=17 then 
if W==18 then 
a=V;
V,t={[9]=a,[8]=C,[7]=Y,[5]=U},w[G];
Y,U=X[t+2]+0,X[t+1]+0;
C=X[t]-Y;
G=_[G];else 
X[w[G]]=y[G]-X[_[G]];end;else 
X[_[G]]=y[G]==X[w[G]];end;end;end;else 
if W<5 then 
if W>=2 then 
if W<3 then 
C+=Y;
t=if Y<=0 then C>=U else C<=U;
if t then 
X[w[G]]=C;
G=y[G];else end;else 
if W~=4 then 
G=if X[w[G]]<=X[y[G]]then _[G]else G;else 
X[w[G]]=c[G]-X[_[G]];end;end;else 
if W==1 then 
G=if X[_[G]]<w[G]then y[G]else G;else 
X[w[G]]=X[y[G]]<=X[_[G]];end;end;else 
if W>=8 then 
if W<9 then 
v=X[y[G]];else 
if W==10 then 
t=b[y[G]];
t[5][t[4]][q[G]]=O[G];else 
C,U,Y=V[8],V[5],V[7];
V=V[9];end;end;else 
if W>=6 then 
if W==7 then 
if J then 
for a in h,J,nil do 
if J then 
local m=J[a];
if m then 
m[5]=m;
m[6]=X[a];
m[4]=6;
J[a]=nil;end;end;end;end;
if j then 
for a,m in h,j,nil do 
local R=m[6];
if j then 
local m=j[a];
if m then 
local Qe,ee=a+R-1,n(R);
D(X,a,Qe,1,ee);
m[5]=ee;
m[4]=1;
j[a]=nil;end;end;end;end;
return;else 
X[y[G]]=X[w[G]]>X[_[G]];end;else 
z,t=(f(y[G],(I(f(K,(I(P(K,29),7))),536870911)))),_[G]+1;
for a=1,w[G],1 do 
z=I(f(z,(B(z,13))),536870911);
z=f(z,(P(z,13)));
z=I(f(z,(B(z,14))),536870911);
_[t]=f(_[t],(I(P(z,0),127)));
y[t]=f(y[t],(I(P(z,7),127)));
w[t]=f(w[t],(I(P(z,14),127)));
p[t]=f(p[t],(I(P(z,21),127)));
t=t+1;end;
p[G]=51;end;end;end;end;else 
if W>=33 then 
if W>=38 then 
if W>=41 then 
if W>=42 then 
if W==43 then 
X[_[G]]=#X[w[G]];else 
X[w[G]]={};end;else 
X[w[G]]=c[G]<=O[G];end;else 
if W>=39 then 
if W~=40 then 
X[_[G]]=X[y[G]]~=X[w[G]];else 
K=X[w[G]];end;else 
X[w[G]]=y[G];end;end;else 
if W<35 then 
G=if W~=34 then X[w[G]]else if X[_[G]]then w[G]else y[G];else 
local a=G;
if W>=36 then 
if W==37 then 
H=_[a];
G=y[a]+1;
break;else 
X[_[a]]=q[a]..X[y[a]];end;else 
local m,R,Qe=w[a],X[y[a]],X[_[a]];
local a,ee=I(R,4294967295),I(Qe,4294967295);
local Qe,Ye,xe,_e=I(a,65535),P(a,16),I(ee,65535),P(ee,16);
R=I(Qe*xe+B(I(Qe*_e+Ye*xe,65535),16),4294967295);
xe=nil;
repeat 
_e=R%4294967296;
if _e~=_e then 
xe=0;
break;end;
xe=_e-_e%1;until true;
X[m]=xe;end;end;end;else 
if W<27 then 
if W<24 then 
if W==23 then 
X[y[G]]=X[_[G]];
X[y[G+1]]=X[_[G+1]];
G+=1;else 
X[_[G]]=X[w[G]][y[G]];end;else 
if W>=25 then 
if W~=26 then 
t=b[w[G]];
t[5][t[4]]=X[_[G]];else 
t,z=y[G],X[w[G]];
X[t+1]=z;
X[t]=z[O[G]];end;else 
G=if X[w[G]]==c[G]then _[G]else G;end;end;else 
if W>=30 then 
if W>=31 then 
if W==32 then 
local a,m,R=_[G],q[G];
repeat 
local Qe=m%4294967296;
if Qe~=Qe then 
R=0;
break;end;
R=Qe-Qe%1;until true;
X[a]=R;else 
t=b[w[G]];
t[5][t[4]][X[y[G]]]=_[G];end;else 
G=if X[_[G]]~=y[G]then w[G]else G;end;else 
if W>=28 then 
if W==29 then 
X[_[G]]=-X[w[G]];else 
t=b[w[G]];
t[5][t[4]]=c[G];end;else 
if J then 
for a in h,J,nil do 
if J then 
local m=J[a];
if m then 
m[5]=m;
m[6]=X[a];
m[4]=6;
J[a]=nil;end;end;end;end;
if j then 
for a,m in h,j,nil do 
local R=m[6];
if j then 
local m=j[a];
if m then 
local Qe=n(R);
D(X,a,a+R-1,1,Qe);
m[5]=Qe;
m[4]=1;
j[a]=nil;end;end;end;end;
return O[G];end;end;end;end;end;else 
if W>=66 then 
if W>=77 then 
if W<83 then 
if W<80 then 
if W<78 then 
G=if X[w[G]]~=X[y[G]]then _[G]else G;else 
if W==79 then 
X[_[G]]=X[y[G]]/X[w[G]];else 
t=b[_[G]];
X[w[G]]=t[5][t[4]][c[G]];end;end;else 
if W<81 then 
X[w[G]]=X[_[G]]..c[G];
elseif W==82 then 
X[_[G]]=c[G]+X[w[G]];else 
X[_[G]]=not X[y[G]];end;end;else 
if W<86 then 
if W<84 then 
X[_[G]]=Q[y[G]];
X[_[G+1]]=q[G+1];
t=y[G+2];
z,M,k=X[t],X[t+1],X[t+2];
X[t]=z(M,k);
G=G+2;else 
if W~=85 then 
X[w[G]]=X[y[G]]/_[G];else 
t,z,M,k=f(d,I(P(d,14),262143),(I(P(d,28),15))),_[G],w[G],y[G];
u=z<2097152 and 7 or 14;
N,F=I(z,B(1,u)-1),P(z,u);
w[G]=f(M,56,(I(P(t,14),127)));
y[G]=f(k,68,(I(P(t,7),127)));
_[G]=f(N,122,(I(t,127)));
p[G]=f(F,97,(I(P(t,21),127)));
G=G-1;end;end;else 
if W<87 then 
X[_[G]]=X[w[G]]<X[y[G]];else 
if W~=88 then 
local a,m,R=_[G],X[y[G]];
repeat 
local Qe=m%4294967296;
if Qe~=Qe then 
R=0;
break;end;
R=Qe-Qe%1;until true;
X[a]=R;else 
G=if not(X[y[G]]<X[_[G]])then w[G]else G;end;end;end;end;else 
if W>=71 then 
if W>=74 then 
if W>=75 then 
if W~=76 then 
X[_[G]]=Q[y[G]];
X[_[G+1]]=q[G+1];
G+=1;else 
X[y[G]]=X[w[G]]>=O[G];end;else 
X[y[G]]=K;end;else 
if W<72 then 
X[w[G]]=_[G]+X[y[G]];
elseif W~=73 then 
X[y[G]]();else 
X[_[G]](S(X[y[G]],1,X[y[G]].n));end;end;else 
if W>=68 then 
if W>=69 then 
if W~=70 then 
X[w[G]]=X[_[G]]-X[y[G]];else 
X[y[G]]=X[_[G]]+w[G];end;else 
if J then 
for a in h,J,nil do 
if J then 
local m=J[a];
if m then 
m[5]=m;
m[6]=X[a];
m[4]=6;
J[a]=nil;end;end;end;end;
if j then 
for a,m in h,j,nil do 
local R=m[6];
if j then 
local m=j[a];
if m then 
local Qe,ee=a+R,n(R);
D(X,a,Qe-1,1,ee);
m[5]=ee;
m[4]=1;
j[a]=nil;end;end;end;end;
return X[w[G]](X[y[G]],O[G]);end;else 
if W~=67 then 
t=y[G];
z,M,k,u=X[t],X[t+1],X[t+2],X[t+3];
X[t]=z(M,k,u);else 
X[w[G]]=b[_[G]][X[y[G]]];end;end;end;end;else 
if W<55 then 
if W>=49 then 
if W<52 then 
if W>=50 then 
if not(W==51)then 
X[w[G]](X[_[G]]);end;else 
X[y[G]]=X[w[G]]-O[G];end;
elseif W<53 then 
local a,m,R=_[G],w[G],c[G];
local Qe,ee=I(m,4294967295),I(R,4294967295);
local m,Ye,xe,_e=I(Qe,65535),P(Qe,16),I(ee,65535),P(ee,16);
Qe=I(m*xe+B(I(m*_e+Ye*xe,65535),16),4294967295);
ee=nil;
repeat 
R=Qe%4294967296;
if R~=R then 
ee=0;
break;end;
ee=R-R%1;until true;
X[a]=ee;
elseif W~=54 then 
X[y[G]+X[_[G]]]=X[w[G]];else 
X[w[G]]=X[y[G]]>O[G];end;else 
if W<46 then 
if W==45 then 
X[w[G]]=X[_[G]]>y[G];else 
G=if X[y[G]]==X[_[G]]then w[G]else G;end;else 
if W<47 then 
local a,m,R=w[G],X[_[G]],y[G];
local Qe,ee=I(m,4294967295),I(R,4294967295);
local m,Ye,xe,_e=I(Qe,65535),P(Qe,16),I(ee,65535),P(ee,16);
Qe=I(m*xe+B(I(m*_e+Ye*xe,65535),16),4294967295);
R=nil;
repeat 
Ye=Qe%4294967296;
if Ye~=Ye then 
R=0;
break;end;
R=Ye-Ye%1;until true;
X[a]=R;else 
G=if W==48 then if X[_[G]]==y[G]then w[G]else G else if X[_[G]]~=q[G]then y[G]else G;end;end;end;else 
if W>=60 then 
if W<63 then 
if W>=61 then 
if W==62 then 
t=b[w[G]];
X[_[G]]=t[5][t[4]][X[y[G]]];else 
X[w[G]]=X[y[G]]//_[G];end;else 
local a,m,R=_[G],y[G],w[G];
local Qe,ee=I(m,4294967295),I(R,4294967295);
local m,R,Ye,xe=I(Qe,65535),P(Qe,16),I(ee,65535),P(ee,16);
ee=I(m*Ye+B(I(m*xe+R*Ye,65535),16),4294967295);
R=nil;
repeat 
m=ee%4294967296;
if m~=m then 
R=0;
break;end;
R=m-m%1;until true;
X[a]=R;end;else 
if W>=64 then 
if W==65 then 
X[y[G]](O[G],X[w[G]]);else 
X[w[G]][X[_[G]]]=c[G];end;else 
X[w[G]]=Q[O[G]];end;end;else 
if W<57 then 
if W==56 then 
X[w[G]]=b[_[G]][c[G]];else 
X[w[G]]=O[G]%X[y[G]];end;else 
if W>=58 then 
if W~=59 then 
T[c[G]]=X[_[G]];else 
X[_[G]]=X[w[G]]<=y[G];end;else 
G=X[w[G]];end;end;end;end;end;end;end;
G=G+1;end;else end;
if H==191 then 
while true do 
local W=y[G];
if W>=92 then 
if W>=138 then 
if W>=161 then 
if W<173 then 
if W<167 then 
if W>=164 then 
if W>=165 then 
if W~=166 then 
X[_[G]]=b[p[G]][q[G]];else 
X[_[G]]=I(X[w[G]],p[G]);end;else 
X[w[G]]=X[_[G]]<X[p[G]];end;else 
if W<162 then 
X[w[G]]=X[p[G]][_[G]];else 
if W==163 then 
X[w[G]]=O[G]+X[p[G]];else 
X[_[G]]=p[G];
X[_[G+1]]=p[G+1];
G+=1;end;end;end;else 
if W<170 then 
if W<168 then 
X[w[G]]=e[G];
elseif W==169 then 
X[p[G]]=X[w[G]]*X[_[G]];else 
local c,a,m=p[G],_[G],q[G];
local R,Qe=I(a,4294967295),I(m,4294967295);
local m,ee,Ye,xe=I(R,65535),P(R,16),I(Qe,65535),P(Qe,16);
a=I(m*Ye+B(I(m*xe+ee*Ye,65535),16),4294967295);
Qe=nil;
repeat 
R=a%4294967296;
if R~=R then 
Qe=0;
break;end;
Qe=R-R%1;until true;
X[c]=Qe;end;
elseif W>=171 then 
if W==172 then 
if J then 
for c in h,J,nil do 
if J then 
local a=J[c];
if a then 
a[5]=a;
a[6]=X[c];
a[4]=6;
J[c]=nil;end;end;end;end;
if j then 
for c,a in h,j,nil do 
local m=a[6];
if j then 
local a=j[c];
if a then 
local R,Qe=c+m-1,n(m);
D(X,c,R,1,Qe);
a[5]=Qe;
a[4]=1;
j[c]=nil;end;end;end;end;
return;else 
X[w[G]]=X[_[G]]/X[p[G]];end;else 
X[w[G]]=X[p[G]](S(X[_[G]],1,X[_[G]].n));end;end;else 
if W>=179 then 
if W<182 then 
if W>=180 then 
if W~=181 then 
X[_[G]]=_;else 
X[p[G]](q[G],S(X[_[G]],1,X[_[G]].n));end;else 
X[_[G]]=Q;end;else 
if W<183 then 
X[p[G]]=X[w[G]](O[G]);else 
if W==184 then 
X[p[G]]=p;else 
G=if X[p[G]]then w[G]else _[G];end;end;end;else 
if W<176 then 
if W<174 then 
if J then 
for c in h,J,nil do 
if J then 
local a=J[c];
if a then 
a[5]=a;
a[6]=X[c];
a[4]=6;
J[c]=nil;end;end;end;end;
if j then 
for c,a in h,j,nil do 
local m=a[6];
if j then 
local a=j[c];
if a then 
local R=n(m);
D(X,c,c+m-1,1,R);
a[5]=R;
a[4]=1;
j[c]=nil;end;end;end;end;
return X[p[G]](X[_[G]]);
elseif W==175 then 
b[p[G]][O[G]]=X[w[G]];else 
G=if X[w[G]]~=O[G]then p[G]else G;end;else 
if W>=177 then 
if W~=178 then 
b[p[G]][X[w[G]]]=X[_[G]];else 
X[p[G]]=X[w[G]]>X[_[G]];end;else 
X[w[G]]=X[p[G]](X[_[G]]);end;end;end;end;else 
if W<149 then 
if W>=143 then 
if W>=146 then 
if W<147 then 
X[_[G]]=Q[q[G]];else 
if W==148 then 
X[p[G]]=X[_[G]]<=q[G];else 
G=if _[G]<X[w[G]]then p[G]else G;end;end;else 
if W<144 then 
X[p[G]]=X[w[G]]..X[_[G]];
elseif W==145 then 
X[p[G]][X[w[G]]]=_[G];else 
X[p[G]]=X[w[G]]+O[G];end;end;else 
if W>=140 then 
if W<141 then 
if J then 
for c in h,J,nil do 
if J then 
local a=J[c];
if a then 
a[5]=a;
a[6]=X[c];
a[4]=6;
J[c]=nil;end;end;end;end;
if j then 
for c,a in h,j,nil do 
local m=a[6];
if j then 
local a=j[c];
if a then 
local R=n(m);
D(X,c,c+m-1,1,R);
a[5]=R;
a[4]=1;
j[c]=nil;end;end;end;end;
t=_[G];
return S(X,t,t+p[G]-1);
elseif W==142 then 
X[w[G]](e[G]);else 
X[w[G]]=X[p[G]]>=_[G];end;else 
if W~=139 then 
X[_[G]]=w[G]^X[p[G]];else 
C,U,Y=V[8],V[5],V[7];
V=V[9];end;end;end;else 
if W>=155 then 
if W<158 then 
if W<156 then 
G=if not(X[p[G]]<_[G])then w[G]else G;else 
if W==157 then 
X[w[G]]=X[_[G]]*e[G];else 
t,z=p[G],X[w[G]];
X[t+1]=z;
X[t]=z[O[G]];end;end;else 
if W>=159 then 
if W==160 then 
X[p[G]]=Q[_[G]];
X[w[G+1]]=e[G+1];
t=w[G+2];
z,M,k=X[t],X[t+1],X[t+2];
X[t]=z(M,k);
G=G+2;else 
X[w[G]]=b[p[G]];end;else 
X[p[G]]=X[_[G]]<=w[G];end;end;else 
if W<152 then 
if W>=150 then 
if W~=151 then 
local c,a,m=_[G],f(w[G],(I(f(d,(I(P(d,29),7))),536870911))),x[6];
local R=f(m[c],143377016);
m[c]=R;
c,m=x[5],R+1;
R=A(c,m);
local Qe,ee;
if R<128 then 
Qe,ee=R,m+1;else 
local Ye=A(c,m+1);
if Ye<128 then 
Qe,ee=(R-128)*128+Ye,m+2;else 
local xe=A(c,m+2);
if xe<128 then 
Qe,ee=(R-128)*16384+(Ye-128)+xe*128,m+3;else 
local _e=A(c,m+3);
Qe,ee=(R-128)*2097152+(Ye-128)*128+(xe-128)*16384+_e%128+(_e-_e%128)*2097152,m+4;end;end;end;
R,m=a*16843009,ee+Qe;
local Ye=m-Qe%4;
for Qe=ee,Ye-1,4 do 
L(c,Qe,(f(E(c,Qe),R)));end;
for R=Ye,m-1,1 do 
Z(c,R,(f(A(c,R),a)));end;
_[G]=206;
w[G]=59;
p[G]=205;
y[G]=26;else 
X[w[G]]=X[_[G]]>=X[p[G]];end;else 
X[_[G]]=X[p[G]]-w[G];end;else 
if W<153 then 
X[w[G]]=X[p[G]]%_[G];else 
if W~=154 then 
X[w[G]](e[G],X[_[G]]);else 
local c;
local a=e[G];
if a then 
local m=#a/3;
if m>0 then 
c={};
local R,Qe=J,j;
for ee=1,m,1 do 
local m=(ee-1)*3;
local Ye,xe=a[m+2],a[m+1];
if Ye==1 then 
R=if not R then{}else R;
local _e=R[xe];
if not _e then 
_e={[4]=xe,[5]=X};
R[xe]=_e;else end;
c[ee]=_e;else 
if Ye==3 then 
c[ee]=X[xe];else 
if Ye==2 then 
c[ee]=b[xe];else 
if Ye==0 then 
Qe=if not Qe then{}else Qe;
local Ye=Qe[xe];
if not Ye then 
Ye={[6]=a[m+3],[5]=X,[4]=xe};
Qe[xe]=Ye;else end;
c[ee]=Ye;else end;end;end;end;end;
J,j=R,Qe;else end;else end;
z=X[_[G]](c);
l(z,T);
X[w[G]]=z;
t=c;end;end;end;end;end;end;else 
local c;
if W>=115 then 
if W<126 then 
if W<120 then 
if W<117 then 
if W~=116 then 
X[p[G]]=w[G]-X[_[G]];else 
t,z,M=w[G],p[G],_[G];
k,u=t+M-1,t+z;
N=X[u];
F=N.n;
s=z+F-1;
N.n=s;
D(N,1,F,z,N);
D(X,t+1,u-1,1,N);
r=o(X[t](S(N,1,N.n)));
D(r,1,M,t,X);end;else 
if W<118 then 
X[w[G]]=b[_[G]][X[p[G]]];else 
if W~=119 then 
c=V;
V,t,z={[9]=c,[8]=C,[7]=Y,[5]=U},w[G],g(i);
z(Q,X[t],X[t+1],X[t+2]);
G,C=p[G],z;else 
X[w[G]]=e[G]==O[G];end;end;end;else 
if W<123 then 
if W<121 then 
X[w[G]]=y;else 
if W==122 then 
G=if not(X[p[G]]<=_[G])then w[G]else G;else 
X[p[G]]={};end;end;else 
if W<124 then 
K=X[p[G]];else 
if W~=125 then 
X[_[G]]=X[w[G]]/e[G];else 
t=b[p[G]];
t[5][t[4]]=X[_[G]];end;end;end;end;else 
if W>=132 then 
if W>=135 then 
if W<136 then 
X[_[G]]=x;else 
if W==137 then 
G=if X[_[G]]==e[G]then w[G]else G;else 
X[_[G]]=X[w[G]];end;end;else 
if W>=133 then 
G=if W==134 then if q[G]~=O[G]then p[G]else G else X[p[G]];else 
X[p[G]](X[_[G]],q[G]);end;end;else 
if W>=129 then 
if W>=130 then 
if W==131 then 
T[e[G]]=q[G];else 
X[p[G]]=X[w[G]]+_[G];end;else 
t,z,M=w[G],p[G],_[G];
k,u=X[t],t+z;
N=X[u];
D(X,t+1,u-1,M+1,k);
D(N,1,N.n,M+z,k);end;else 
if W>=127 then 
if W~=128 then 
t=w[G];
z,M,k=X[t],X[t+1],X[t+2];
X[t]=z(M,k);else 
G=if X[p[G]]~=X[w[G]]then _[G]else G;end;else 
X[_[G]]=-X[p[G]];end;end;end;end;else 
if W>=103 then 
if W>=109 then 
if W>=112 then 
if W<113 then 
t,z,M,k=f(K,I(P(K,14),262143),(I(P(K,28),15))),_[G],p[G],w[G];
u=M<2097152 and 7 or 14;
N,F=I(M,B(1,u)-1),P(M,u);
w[G]=f(k,15,(I(P(t,7),127)));
y[G]=f(F,7,(I(P(t,21),127)));
p[G]=f(N,87,(I(P(t,14),127)));
_[G]=f(z,110,(I(t,127)));
G=G-1;else 
if W~=114 then 
X[p[G]]=q[G]~=O[G];else 
G=if X[w[G]]<X[_[G]]then p[G]else G;end;end;else 
if W>=110 then 
if W~=111 then 
X[w[G]][X[p[G]]]=X[_[G]];else 
X[p[G]]=o(X[w[G]]());end;else 
X[p[G]]=T[O[G]];end;end;else 
if W<106 then 
if W>=104 then 
if W~=105 then 
local a,m,R=_[G],f(w[G],(I(f(K,(I(P(K,29),7))),536870911))),x[6];
local Qe=f(R[a],143377016);
R[a]=Qe;
a,R=x[5],Qe+1;
Qe=A(a,R);
local ee,Ye;
if Qe<128 then 
ee,Ye=Qe,R+1;else 
local xe=A(a,R+1);
if xe<128 then 
ee,Ye=(Qe-128)*128+xe,R+2;else 
local _e=A(a,R+2);
if _e<128 then 
ee,Ye=(Qe-128)*16384+(xe-128)+_e*128,R+3;else 
local Oe=A(a,R+3);
ee,Ye=(Qe-128)*2097152+(xe-128)*128+(_e-128)*16384+Oe%128+(Oe-Oe%128)*2097152,R+4;end;end;end;
Qe,R=m*16843009,Ye+ee;
local xe=R-ee%4;
for ee=Ye,xe-1,4 do 
L(a,ee,(f(E(a,ee),Qe)));end;
for Qe=xe,R-1,1 do 
Z(a,Qe,(f(A(a,Qe),m)));end;
_[G]=194;
w[G]=235;
p[G]=20;
y[G]=26;else 
X[w[G]+X[_[G]]]=X[p[G]];end;else 
X[p[G]]=X[_[G]]*w[G];end;
elseif W>=107 then 
if W==108 then 
X[_[G]]=X[p[G]]~=q[G];else 
X[w[G]]=X[p[G]]==_[G];end;else 
if J then 
for a in h,J,nil do 
if J then 
local m=J[a];
if m then 
m[5]=m;
m[6]=X[a];
m[4]=6;
J[a]=nil;end;end;end;end;
if j then 
for a,m in h,j,nil do 
local R=m[6];
if j then 
local m=j[a];
if m then 
local Qe=n(R);
D(X,a,a+R-1,1,Qe);
m[5]=Qe;
m[4]=1;
j[a]=nil;end;end;end;end;
return X[_[G]]();end;end;else 
if W<97 then 
if W<94 then 
if W~=93 then 
c=V;
V,t={[9]=c,[8]=C,[7]=Y,[5]=U},p[G];
Y,U=X[t+2]+0,X[t+1]+0;
C=X[t]-Y;
G=w[G];else 
X[w[G]]=X[_[G]]==e[G];end;else 
if W>=95 then 
if W==96 then 
X[p[G]](X[w[G]],X[_[G]]);else 
X[p[G]][_[G]]=q[G];end;else 
X[p[G]]=_[G]*X[w[G]];end;end;else 
if W>=100 then 
if W<101 then 
X[p[G]]=X[w[G]][X[_[G]]];
elseif W~=102 then 
X[p[G]][q[G]]=_[G];else 
X[w[G]]=X[p[G]]>O[G];end;
elseif W>=98 then 
if W==99 then 
local c,a,m=w[G],e[G],_[G];
local R,Qe=I(a,4294967295),I(m,4294967295);
local a,ee,Ye,xe=I(R,65535),P(R,16),I(Qe,65535),P(Qe,16);
Qe=I(a*Ye+B(I(a*xe+ee*Ye,65535),16),4294967295);
R=nil;
repeat 
m=Qe%4294967296;
if m~=m then 
R=0;
break;end;
R=m-m%1;until true;
X[c]=R;else 
X[w[G]]=X[_[G]]>p[G];end;else 
X[w[G]]=o(X[p[G]](S(X[_[G]],1,X[_[G]].n)));end;end;end;end;end;else 
if W<46 then 
if W<23 then 
if W>=11 then 
if W<17 then 
if W>=14 then 
local c=G;
if W>=15 then 
if W==16 then 
T[q[c]]=X[_[c]];else 
t=b[w[c]];
X[p[c]]=t[5][t[4]];end;else 
H=w[c];
G=_[c]+1;
break;end;else 
if W<12 then 
G=if not(_[G]<X[p[G]])then w[G]else G;else 
if W==13 then 
X[_[G]]=X[p[G]]<=X[w[G]];else 
X[_[G]][w[G]]=X[p[G]];end;end;end;else 
if W<20 then 
if W<18 then 
z,t=w[G],p[G]+1;
for c=1,_[G],1 do 
z=I(f(z,(B(z,13))),536870911);
z=f(z,(P(z,13)));
z=I(f(z,(B(z,14))),536870911);
_[t]=f(_[t],(I(P(z,0),127)));
w[t]=f(w[t],(I(P(z,7),127)));
p[t]=f(p[t],(I(P(z,14),127)));
y[t]=f(y[t],(I(P(z,21),127)));
t=t+1;end;
y[G]=26;else 
if W~=19 then 
G=if X[w[G]]==_[G]then p[G]else G;else 
X[p[G]](S(X[w[G]],1,X[w[G]].n));end;end;else 
if W<21 then 
t,z,M=_[G],p[G],w[G];
k=t+z;
X[t]=o(X[t](S(X,t+1,k)));else 
if W==22 then 
G=if X[_[G]]<=p[G]then w[G]else G;else 
local c,a,m=_[G],X[p[G]],X[w[G]];
local R,Qe=I(a,4294967295),I(m,4294967295);
local ee,Ye,xe,_e=I(R,65535),P(R,16),I(Qe,65535),P(Qe,16);
m=I(ee*xe+B(I(ee*_e+Ye*xe,65535),16),4294967295);
ee=nil;
repeat 
a=m%4294967296;
if a~=a then 
ee=0;
break;end;
ee=a-a%1;until true;
X[c]=ee;end;end;end;end;else 
if W<5 then 
if W>=2 then 
if W>=3 then 
if W==4 then 
X[_[G]]=p[G];else 
X[_[G]]=X[p[G]]-q[G];end;else 
X[p[G]]=X[w[G]]//_[G];end;
elseif W==1 then 
X[p[G]]=X[_[G]]~=X[w[G]];else 
X[p[G]](X[_[G]],S(X[w[G]],1,X[w[G]].n));end;else 
if W>=8 then 
if W<9 then 
Q[p[G]]=X[_[G]];else 
G=if W~=10 then if not(X[w[G]]<X[_[G]])then p[G]else G else if X[w[G]]~=_[G]then p[G]else G;end;else 
if W<6 then 
t=_[G];
z,M,k,u=X[t],X[t+1],X[t+2],X[t+3];
X[t]=z(M,k,u);else 
if W==7 then 
local c;
local a=O[G];
if a then 
local m=#a/3;
if m>0 then 
c={};
local R,Qe=J,j;
for ee=1,m,1 do 
local m=(ee-1)*3;
local Ye,xe=a[m+2],a[m+1];
if Ye==1 then 
R=if not R then{}else R;
local _e=R[xe];
if not _e then 
_e={[4]=xe,[5]=X};
R[xe]=_e;else end;
c[ee]=_e;else 
if Ye==3 then 
c[ee]=X[xe];else 
if Ye==2 then 
c[ee]=b[xe];else 
if Ye==0 then 
Qe=if not Qe then{}else Qe;
local Ye=Qe[xe];
if not Ye then 
Ye={[6]=a[m+3],[5]=X,[4]=xe};
Qe[xe]=Ye;else end;
c[ee]=Ye;else end;end;end;end;end;
J,j=R,Qe;else end;else end;
z=e[G](c);
l(z,T);
X[w[G]]=z;
t=c;else 
X[p[G]]=X[w[G]]==X[_[G]];end;end;end;end;end;else 
if W>=34 then 
if W>=40 then 
if W<43 then 
if W<41 then 
local c,a,m=p[G],w[G],X[_[G]];
local R,Qe=I(a,4294967295),I(m,4294967295);
local a,ee,Ye,xe=I(R,65535),P(R,16),I(Qe,65535),P(Qe,16);
m=I(a*Ye+B(I(a*xe+ee*Ye,65535),16),4294967295);
a=nil;
repeat 
Qe=m%4294967296;
if Qe~=Qe then 
a=0;
break;end;
a=Qe-Qe%1;until true;
X[c]=a;
elseif W==42 then 
local c,a,m=w[G],O[G],e[G];
local R,Qe=I(a,4294967295),I(m,4294967295);
local a,m,ee,Ye=I(R,65535),P(R,16),I(Qe,65535),P(Qe,16);
R=I(a*ee+B(I(a*Ye+m*ee,65535),16),4294967295);
Qe=nil;
repeat 
m=R%4294967296;
if m~=m then 
Qe=0;
break;end;
Qe=m-m%1;until true;
X[c]=Qe;else 
local c,a,m=p[G],O[G],X[w[G]];
local R,Qe=I(a,4294967295),I(m,4294967295);
local a,m,ee,Ye=I(R,65535),P(R,16),I(Qe,65535),P(Qe,16);
R=I(a*ee+B(I(a*Ye+m*ee,65535),16),4294967295);
Qe=nil;
repeat 
ee=R%4294967296;
if ee~=ee then 
Qe=0;
break;end;
Qe=ee-ee%1;until true;
X[c]=Qe;end;else 
if W>=44 then 
G=if W~=45 then X[_[G]]else if not(X[p[G]]<=X[_[G]])then w[G]else G;else 
local c,a,m=_[G],p[G],x[6];
local R=f(m[c],143377016);
m[c]=R;
m,c=x[5],R+1;
R=A(m,c);
local Qe,ee;
if R<128 then 
Qe,ee=R,c+1;else 
local Ye=A(m,c+1);
if Ye<128 then 
Qe,ee=(R-128)*128+Ye,c+2;else 
local xe=A(m,c+2);
if xe<128 then 
Qe,ee=(R-128)*16384+(Ye-128)+xe*128,c+3;else 
local _e=A(m,c+3);
Qe,ee=(R-128)*2097152+(Ye-128)*128+(xe-128)*16384+_e%128+(_e-_e%128)*2097152,c+4;end;end;end;
c,R=a*16843009,ee+Qe;
local Ye=R-Qe%4;
for Qe=ee,Ye-1,4 do 
L(m,Qe,(f(E(m,Qe),c)));end;
for c=Ye,R-1,1 do 
Z(m,c,(f(A(m,c),a)));end;
_[G]=74;
p[G]=64;
w[G]=69;
y[G]=26;end;end;else 
if W<37 then 
if W<35 then 
local c=_[G];
if J then 
local a=J[c];
if a then 
a[5]=a;
a[6]=X[c];
a[4]=6;
J[c]=nil;end;end;else 
if W==36 then 
t,z,M,k=w[G],p[G],_[G],f(K,I(P(K,14),262143),(I(P(K,28),15)));
u=M<16384 and 7 or(M<2097152 and 14 or 21);
N,F=I(M,B(1,u)-1),P(M,u);
p[G]=f(z,60,(I(P(k,14),127)));
y[G]=f(F,70,(I(P(k,21),127)));
w[G]=f(t,124,(I(P(k,7),127)));
_[G]=f(N,91,(I(k,127)));
G=G-1;else 
X[p[G]]=X[_[G]]..q[G];end;end;else 
if W<38 then 
X[w[G]][X[_[G]]]=e[G];
elseif W==39 then 
if J then 
for c in h,J,nil do 
if J then 
local a=J[c];
if a then 
a[5]=a;
a[6]=X[c];
a[4]=6;
J[c]=nil;end;end;end;end;
if j then 
for c,a in h,j,nil do 
local m=a[6];
if j then 
local a=j[c];
if a then 
local R=n(m);
D(X,c,c+m-1,1,R);
a[5]=R;
a[4]=1;
j[c]=nil;end;end;end;end;
return q[G],X[p[G]],X[_[G]];else 
if J then 
for c in h,J,nil do 
if J then 
local a=J[c];
if a then 
a[5]=a;
a[6]=X[c];
a[4]=6;
J[c]=nil;end;end;end;end;
if j then 
for c,a in h,j,nil do 
local m=a[6];
if j then 
local a=j[c];
if a then 
local R=n(m);
D(X,c,c+m-1,1,R);
a[5]=R;
a[4]=1;
j[c]=nil;end;end;end;end;
return q[G];end;end;end;else 
if W>=28 then 
if W<31 then 
if W<29 then 
X[w[G]]=X;
elseif W==30 then 
local c,a,m=_[G],X[w[G]];
repeat 
local R=a%4294967296;
if R~=R then 
m=0;
break;end;
m=R-R%1;until true;
X[c]=m;else 
X[_[G]]();end;else 
if W<32 then 
v=X[w[G]];else 
if W~=33 then 
X[w[G]]=X[p[G]]%O[G];else 
X[p[G]]=d;end;end;end;else 
if W>=25 then 
if W<26 then 
Q[e[G]]=q[G];
elseif W==27 then 
X[w[G]]=O[G]*X[p[G]];end;else 
if W==24 then 
t=b[_[G]];
t[5][t[4]]=e[G];else 
t=_[G];
M=t+w[G];
if J then 
for c in h,J,nil do 
if J then 
local a=J[c];
if a then 
a[5]=a;
a[6]=X[c];
a[4]=6;
J[c]=nil;end;end;end;end;
if j then 
for c,a in h,j,nil do 
local m=a[6];
if j then 
local a=j[c];
if a then 
local R=n(m);
D(X,c,c+m-1,1,R);
a[5]=R;
a[4]=1;
j[c]=nil;end;end;end;end;
return X[t](S(X,t+1,M));end;end;end;end;end;else 
if W<69 then 
if W>=57 then 
if W<63 then 
if W>=60 then 
if W<61 then 
X[_[G]]=n(p[G]);else 
if W~=62 then 
d=X[p[G]];else 
X[_[G]]=X[w[G]]//X[p[G]];end;end;else 
if W<58 then 
t=b[p[G]];
X[w[G]]=t[5][t[4]][O[G]];else 
if W==59 then 
z,t=(f(w[G],(I(f(K,(I(P(K,29),7))),536870911)))),_[G]+1;
for c=1,p[G],1 do 
z=I(f(z,(B(z,13))),536870911);
z=f(z,(P(z,13)));
z=I(f(z,(B(z,14))),536870911);
_[t]=f(_[t],(I(P(z,0),127)));
w[t]=f(w[t],(I(P(z,7),127)));
p[t]=f(p[t],(I(P(z,14),127)));
y[t]=f(y[t],(I(P(z,21),127)));
t=t+1;end;
y[G]=26;else 
G=_[G];end;end;end;else 
if W>=66 then 
if W>=67 then 
if W~=68 then 
local c,a,m=_[G],X[p[G]],w[G];
local R,Qe=I(a,4294967295),I(m,4294967295);
local a,ee,Ye,xe=I(R,65535),P(R,16),I(Qe,65535),P(Qe,16);
R=I(a*Ye+B(I(a*xe+ee*Ye,65535),16),4294967295);
m=nil;
repeat 
xe=R%4294967296;
if xe~=xe then 
m=0;
break;end;
m=xe-xe%1;until true;
X[c]=m;else 
X[p[G]]=Q[_[G]];
X[w[G+1]]=e[G+1];
G+=1;end;else 
X[w[G]]=X[_[G]]~=p[G];end;else 
if W>=64 then 
if W==65 then 
X[_[G]]=q[G]+e[G];else 
local c,a,m=w[G],e[G];
repeat 
local R=a%4294967296;
if R~=R then 
m=0;
break;end;
m=R-R%1;until true;
X[c]=m;end;else 
t=b[_[G]];
t[5][t[4]][e[G]]=X[w[G]];end;end;end;else 
if W<51 then 
if W<48 then 
if W==47 then 
X[w[G]]=X[_[G]]-X[p[G]];else 
z,t=(f(w[G],(I(f(d,(I(P(d,29),7))),536870911)))),_[G]+1;
for c=1,p[G],1 do 
z=I(f(z,(B(z,13))),536870911);
z=f(z,(P(z,13)));
z=I(f(z,(B(z,14))),536870911);
_[t]=f(_[t],(I(P(z,0),127)));
w[t]=f(w[t],(I(P(z,7),127)));
p[t]=f(p[t],(I(P(z,14),127)));
y[t]=f(y[t],(I(P(z,21),127)));
t=t+1;end;
y[G]=26;end;else 
if W>=49 then 
if W==50 then 
X[p[G]]=f(X[w[G]],X[_[G]]);else 
X[w[G]]=X[p[G]]+X[_[G]];end;else 
X[w[G]](e[G],O[G]);end;end;else 
if W>=54 then 
if W<55 then 
G=if X[p[G]]==X[_[G]]then w[G]else G;else 
if W==56 then 
X[p[G]]=X[w[G]]();else 
t,z,M=p[G],w[G],_[G];
k=t+z;
u=X[k];
N=u.n;
F=z+N-1;
u.n=F;
D(u,1,N,z,u);
D(X,t+1,k-1,1,u);
X[t]=o(X[t](S(u,1,u.n)));end;end;else 
if W<52 then 
X[p[G]][q[G]]=X[_[G]];
elseif W~=53 then 
X[_[G]]=X[w[G]]<p[G];else 
X[_[G]]=X[w[G]]%X[p[G]];end;end;end;end;else 
if W>=80 then 
if W>=86 then 
if W<89 then 
if W<87 then 
X[w[G]]=v;
elseif W~=88 then 
for c=_[G],p[G],1 do 
X[c]=nil;end;else 
X[w[G]]=K;end;else 
if W<90 then 
X[w[G]]=X[_[G]][e[G]];else 
if W~=91 then 
t=b[w[G]];
t[5][t[4]][e[G]]=O[G];else 
X[_[G]]=X[p[G]]/w[G];end;end;end;else 
if W<83 then 
if W<81 then 
t=w[G];
local c,a,m=C();
if c then 
X[t+1]=a;
X[t+2]=m;
G=_[G];else end;
z,M,k=c,a,m;else 
if W~=82 then 
X[p[G]]=q[G]..X[_[G]];else 
X[_[G]][e[G]]=q[G];end;end;else 
if W<84 then 
X[_[G]]=w[G]+X[p[G]];
elseif W==85 then 
b[w[G]][e[G]]=_[G];else 
if J then 
for c in h,J,nil do 
if J then 
local a=J[c];
if a then 
a[5]=a;
a[6]=X[c];
a[4]=6;
J[c]=nil;end;end;end;end;
if j then 
for c,a in h,j,nil do 
local m=a[6];
if j then 
local a=j[c];
if a then 
local R=n(m);
D(X,c,c+m-1,1,R);
a[5]=R;
a[4]=1;
j[c]=nil;end;end;end;end;
return X[w[G]];end;end;end;else 
if W>=74 then 
if W>=77 then 
if W>=78 then 
if W==79 then 
t,z,M=w[G],_[G],p[G];
k=X[t];
D(X,t+1,t+z,M+1,k);else 
X[p[G]]=Q[_[G]];end;else 
if J then 
for c in h,J,nil do 
if J then 
local a=J[c];
if a then 
a[5]=a;
a[6]=X[c];
a[4]=6;
J[c]=nil;end;end;end;end;
if j then 
for c,a in h,j,nil do 
local m=a[6];
if j then 
local a=j[c];
if a then 
local R=n(m);
D(X,c,c+m-1,1,R);
a[5]=R;
a[4]=1;
j[c]=nil;end;end;end;end;
return X[p[G]],X[w[G]];end;else 
if W<75 then 
X[p[G]]=o(X[_[G]](X[w[G]]));
elseif W~=76 then 
X[w[G]]=w;else 
local c,a,m=_[G],p[G],w[G];
local R,Qe=I(a,4294967295),I(m,4294967295);
local a,m,ee,Ye=I(R,65535),P(R,16),I(Qe,65535),P(Qe,16);
R=I(a*ee+B(I(a*Ye+m*ee,65535),16),4294967295);
Qe=nil;
repeat 
ee=R%4294967296;
if ee~=ee then 
Qe=0;
break;end;
Qe=ee-ee%1;until true;
X[c]=Qe;end;end;else 
if W>=71 then 
if W>=72 then 
if W==73 then 
t,z,M=p[G],_[G],w[G];
k,u,N=t+M-1,t+z,o(X[t](S(X,t+1,t+z)));
D(N,1,M,t,X);else 
X[p[G]]=#X[w[G]];end;else 
C+=Y;
t=if Y<=0 then C>=U else C<=U;
if t then 
X[_[G]]=C;
G=w[G];else end;end;else 
if W~=70 then 
X[w[G]]=not X[p[G]];else 
X[w[G]](X[p[G]]);end;end;end;end;end;end;end;
G=G+1;end;else end;
if H==103 then 
while true do 
local W,c=y[G];
if W<82 then 
if W<41 then 
if W<20 then 
if W<10 then 
if W>=5 then 
if W<7 then 
if W==6 then 
G=if X[w[G]]==X[p[G]]then _[G]else G;else 
if J then 
for a in h,J,nil do 
if J then 
local m=J[a];
if m then 
m[5]=m;
m[6]=X[a];
m[4]=6;
J[a]=nil;end;end;end;end;
if j then 
for a,m in h,j,nil do 
local H=m[6];
if j then 
local m=j[a];
if m then 
local R=n(H);
D(X,a,a+H-1,1,R);
m[5]=R;
m[4]=1;
j[a]=nil;end;end;end;end;
return q[G];end;else 
if W>=8 then 
if W==9 then 
if J then 
for a in h,J,nil do 
if J then 
local m=J[a];
if m then 
m[5]=m;
m[6]=X[a];
m[4]=6;
J[a]=nil;end;end;end;end;
if j then 
for a,m in h,j,nil do 
local H=m[6];
if j then 
local m=j[a];
if m then 
local R,Qe=a+H-1,n(H);
D(X,a,R,1,Qe);
m[5]=Qe;
m[4]=1;
j[a]=nil;end;end;end;end;
t=w[G];
return S(X,t,t+_[G]-1);else 
G=if not(X[w[G]]<=X[_[G]])then p[G]else G;end;else 
if J then 
for a in h,J,nil do 
if J then 
local m=J[a];
if m then 
m[5]=m;
m[6]=X[a];
m[4]=6;
J[a]=nil;end;end;end;end;
if j then 
for a,m in h,j,nil do 
local H=m[6];
if j then 
local m=j[a];
if m then 
local R=n(H);
D(X,a,a+H-1,1,R);
m[5]=R;
m[4]=1;
j[a]=nil;end;end;end;end;
return;end;end;else 
if W<2 then 
if W~=1 then 
t=b[_[G]];
t[5][t[4]][q[G]]=X[p[G]];else 
z,t=(f(p[G],(I(f(K,(I(P(K,29),7))),536870911)))),_[G]+1;
for a=1,w[G],1 do 
z=I(f(z,(B(z,13))),536870911);
z=f(z,(P(z,13)));
z=I(f(z,(B(z,14))),536870911);
_[t]=f(_[t],(I(P(z,0),127)));
p[t]=f(p[t],(I(P(z,7),127)));
w[t]=f(w[t],(I(P(z,14),127)));
y[t]=f(y[t],(I(P(z,21),127)));
t=t+1;end;
y[G]=54;end;else 
if W>=3 then 
if W~=4 then 
G=if X[w[G]]~=_[G]then p[G]else G;else 
X[w[G]]=X[p[G]]==X[_[G]];end;else 
Q[w[G]]=X[p[G]];end;end;end;else 
if W<15 then 
if W<12 then 
if W==11 then 
T[e[G]]=O[G];else 
X[_[G]](e[G],X[w[G]]);end;else 
if W<13 then 
local a,m,H=p[G],_[G],w[G];
local R,Qe=I(m,4294967295),I(H,4294967295);
local m,ee,Ye,xe=I(R,65535),P(R,16),I(Qe,65535),P(Qe,16);
H=I(m*Ye+B(I(m*xe+ee*Ye,65535),16),4294967295);
xe=nil;
repeat 
ee=H%4294967296;
if ee~=ee then 
xe=0;
break;end;
xe=ee-ee%1;until true;
X[a]=xe;else 
if W==14 then 
local a,m,H=w[G],X[_[G]];
repeat 
local R=m%4294967296;
if R~=R then 
H=0;
break;end;
H=R-R%1;until true;
X[a]=H;else 
c=V;
V,t,z={[9]=c,[8]=C,[7]=Y,[5]=U},_[G],g(i);
z(Q,X[t],X[t+1],X[t+2]);
G,C=w[G],z;end;end;end;else 
if W>=17 then 
if W<18 then 
local a,g=O[G];
if a then 
local i=#a/3;
if i>0 then 
g={};
local m,H=J,j;
for R=1,i,1 do 
local i=(R-1)*3;
local Qe,ee=a[i+2],a[i+1];
if Qe==1 then 
m=if not m then{}else m;
local Ye=m[ee];
if not Ye then 
Ye={[4]=ee,[5]=X};
m[ee]=Ye;else end;
g[R]=Ye;else 
if Qe==3 then 
g[R]=X[ee];else 
if Qe==2 then 
g[R]=b[ee];else 
if Qe==0 then 
H=if not H then{}else H;
local Qe=H[ee];
if not Qe then 
Qe={[6]=a[i+3],[5]=X,[4]=ee};
H[ee]=Qe;else end;
g[R]=Qe;else end;end;end;end;end;
J,j=m,H;else end;else end;
z=q[G](g);
l(z,T);
X[p[G]]=z;
t=g;else 
if W~=19 then 
b[_[G]][q[G]]=p[G];else 
t,z,M=_[G],w[G],p[G];
k,u,N=t+M-1,t+z,o(X[t](S(X,t+1,t+z)));
D(N,1,M,t,X);end;end;else 
if W==16 then 
if J then 
for a in h,J,nil do 
if J then 
local g=J[a];
if g then 
g[5]=g;
g[6]=X[a];
g[4]=6;
J[a]=nil;end;end;end;end;
if j then 
for a,g in h,j,nil do 
local i=g[6];
if j then 
local g=j[a];
if g then 
local m,H=a+i-1,n(i);
D(X,a,m,1,H);
g[5]=H;
g[4]=1;
j[a]=nil;end;end;end;end;
return O[G],X[p[G]],X[w[G]];else 
G=if X[p[G]]<=w[G]then _[G]else G;end;end;end;end;else 
if W>=30 then 
if W>=35 then 
if W<38 then 
if W>=36 then 
if W~=37 then 
local a,g,i=_[G],p[G],X[w[G]];
local m,H=I(g,4294967295),I(i,4294967295);
local g,R,Qe,ee=I(m,65535),P(m,16),I(H,65535),P(H,16);
m=I(g*Qe+B(I(g*ee+R*Qe,65535),16),4294967295);
R=nil;
repeat 
i=m%4294967296;
if i~=i then 
R=0;
break;end;
R=i-i%1;until true;
X[a]=R;else 
X[w[G]]=X[_[G]]>X[p[G]];end;else 
X[w[G]]=O[G]..X[p[G]];end;else 
if W<39 then 
X[p[G]]=_[G]^X[w[G]];else 
if W==40 then 
v=X[p[G]];else 
if J then 
for a in h,J,nil do 
if J then 
local g=J[a];
if g then 
g[5]=g;
g[6]=X[a];
g[4]=6;
J[a]=nil;end;end;end;end;
if j then 
for a,g in h,j,nil do 
local i=g[6];
if j then 
local g=j[a];
if g then 
local m=n(i);
D(X,a,a+i-1,1,m);
g[5]=m;
g[4]=1;
j[a]=nil;end;end;end;end;
return X[_[G]](q[G],X[p[G]]);end;end;end;else 
if W<32 then 
if W~=31 then 
X[_[G]]=X[w[G]]>p[G];else 
X[w[G]]=X[_[G]]%p[G];end;else 
if W<33 then 
t=b[_[G]];
t[5][t[4]]=q[G];else 
local a,g,i;
if W~=34 then 
if J then 
for m in h,J,nil do 
if J then 
local H=J[m];
if H then 
H[5]=H;
H[6]=X[m];
H[4]=6;
J[m]=nil;end;end;end;end;
if j then 
for m,H in h,j,nil do 
local R=H[6];
if j then 
local H=j[m];
if H then 
local Qe=n(R);
D(X,m,m+R-1,1,Qe);
H[5]=Qe;
H[4]=1;
j[m]=nil;end;end;end;end;
return q[G],X[p[G]];else 
t,a,g,i=w[G],C();
if a then 
X[t+1]=g;
X[t+2]=i;
G=_[G];else end;end;
z,M,k=a,g,i;end;end;end;else 
if W>=25 then 
if W<27 then 
if W~=26 then 
X[_[G]]=p[G]-X[w[G]];else 
X[w[G]]=X[p[G]]>=X[_[G]];end;else 
if W<28 then 
t,z,M,k=_[G],f(K,I(P(K,14),262143),(I(P(K,28),15))),p[G],w[G];
u=M<16384 and 7 or(M<2097152 and 14 or 21);
N,F=I(M,B(1,u)-1),P(M,u);
w[G]=f(k,83,(I(P(z,14),127)));
y[G]=f(F,127,(I(P(z,21),127)));
p[G]=f(N,85,(I(P(z,7),127)));
_[G]=f(t,0,(I(z,127)));
G=G-1;else 
if W~=29 then 
G=X[p[G]];else 
X[w[G]]=X[_[G]](e[G]);end;end;end;else 
if W<22 then 
if W==21 then 
X[p[G]](X[_[G]],X[w[G]]);else 
local a,g,i=_[G],f(p[G],(I(f(d,(I(P(d,29),7))),536870911))),x[6];
local m=f(i[a],143377016);
i[a]=m;
i,a=x[5],m+1;
m=A(i,a);
local H,R;
if m<128 then 
H,R=m,a+1;else 
local Qe=A(i,a+1);
if Qe<128 then 
H,R=(m-128)*128+Qe,a+2;else 
local ee=A(i,a+2);
if ee<128 then 
H,R=(m-128)*16384+(Qe-128)+ee*128,a+3;else 
local Ye=A(i,a+3);
H,R=(m-128)*2097152+(Qe-128)*128+(ee-128)*16384+Ye%128+(Ye-Ye%128)*2097152,a+4;end;end;end;
m,a=g*16843009,R+H;
local Qe=a-H%4;
for H=R,Qe-1,4 do 
L(i,H,(f(E(i,H),m)));end;
for m=Qe,a-1,1 do 
Z(i,m,(f(A(i,m),g)));end;
_[G]=95;
p[G]=14;
w[G]=46;
y[G]=54;end;else 
if W<23 then 
X[w[G]]=X[_[G]]~=p[G];else 
if W==24 then 
X[_[G]]=X[p[G]]%X[w[G]];else 
G=if X[_[G]]==w[G]then p[G]else G;end;end;end;end;end;end;else 
if W<61 then 
if W>=51 then 
if W>=56 then 
if W>=58 then 
if W<59 then 
X[w[G]]={};
elseif W==60 then 
X[w[G]]=X[p[G]](S(X[_[G]],1,X[_[G]].n));else 
X[w[G]]=p;end;
elseif W~=57 then 
X[_[G]]=X[w[G]]/p[G];else 
X[p[G]]=K;end;else 
if W<53 then 
if W==52 then 
X[p[G]]=X[_[G]];else 
C,U,Y=V[8],V[5],V[7];
V=V[9];end;else 
if W>=54 then 
if W==55 then 
X[_[G]](e[G]);end;else 
t=b[_[G]];
X[p[G]]=t[5][t[4]][q[G]];end;end;end;else 
if W<46 then 
if W<43 then 
if W==42 then 
G=if _[G]<X[p[G]]then w[G]else G;else 
X[w[G]][X[p[G]]]=X[_[G]];end;else 
if W<44 then 
X[_[G]]=X[p[G]]~=X[w[G]];else 
if W==45 then 
if J then 
for a in h,J,nil do 
if J then 
local g=J[a];
if g then 
g[5]=g;
g[6]=X[a];
g[4]=6;
J[a]=nil;end;end;end;end;
if j then 
for a,g in h,j,nil do 
local i=g[6];
if j then 
local g=j[a];
if g then 
local m=n(i);
D(X,a,a+i-1,1,m);
g[5]=m;
g[4]=1;
j[a]=nil;end;end;end;end;
return X[w[G]](S(X[_[G]],1,X[_[G]].n));else 
t=b[_[G]];
t[5][t[4]][X[p[G]]]=X[w[G]];end;end;end;else 
if W<48 then 
if W~=47 then 
X[w[G]]=Q[O[G]];else 
X[w[G]]=X[p[G]]*O[G];end;else 
if W<49 then 
X[_[G]]=w[G]*X[p[G]];else 
if W==50 then 
t=X[w[G]];
X[p[G]]=o(S(t,_[G],t.n));else 
if J then 
for a in h,J,nil do 
if J then 
local g=J[a];
if g then 
g[5]=g;
g[6]=X[a];
g[4]=6;
J[a]=nil;end;end;end;end;
if j then 
for a,g in h,j,nil do 
local i=g[6];
if j then 
local g=j[a];
if g then 
local m=n(i);
D(X,a,a+i-1,1,m);
g[5]=m;
g[4]=1;
j[a]=nil;end;end;end;end;
return X[p[G]],X[w[G]],X[_[G]];end;end;end;end;end;else 
if W<71 then 
if W<66 then 
if W>=63 then 
if W>=64 then 
if W~=65 then 
X[p[G]]=w;else 
local a=_[G];
if J then 
local g=J[a];
if g then 
g[5]=g;
g[6]=X[a];
g[4]=6;
J[a]=nil;end;end;end;else 
X[w[G]]=b[p[G]];end;
elseif W~=62 then 
for a=w[G],p[G],1 do 
X[a]=nil;end;else 
t=p[G];
M=t+_[G];
if J then 
for a in h,J,nil do 
if J then 
local g=J[a];
if g then 
g[5]=g;
g[6]=X[a];
g[4]=6;
J[a]=nil;end;end;end;end;
if j then 
for a,g in h,j,nil do 
local i=g[6];
if j then 
local g=j[a];
if g then 
local m=n(i);
D(X,a,a+i-1,1,m);
g[5]=m;
g[4]=1;
j[a]=nil;end;end;end;end;
return X[t](S(X,t+1,M));end;else 
if W<68 then 
if W~=67 then 
b[p[G]][X[_[G]]]=X[w[G]];else 
z,t=(f(p[G],(I(f(d,(I(P(d,29),7))),536870911)))),_[G]+1;
for a=1,w[G],1 do 
z=I(f(z,(B(z,13))),536870911);
z=f(z,(P(z,13)));
z=I(f(z,(B(z,14))),536870911);
_[t]=f(_[t],(I(P(z,0),127)));
p[t]=f(p[t],(I(P(z,7),127)));
w[t]=f(w[t],(I(P(z,14),127)));
y[t]=f(y[t],(I(P(z,21),127)));
t=t+1;end;
y[G]=54;end;else 
if W<69 then 
X[_[G]]=q[G]+X[p[G]];else 
if W~=70 then 
X[w[G]]=X[_[G]]<X[p[G]];else 
t=b[w[G]];
X[p[G]]=t[5][t[4]][X[_[G]]];end;end;end;end;else 
if W<76 then 
if W>=73 then 
if W<74 then 
local a;
local g=q[G];
if g then 
local i=#g/3;
if i>0 then 
a={};
local m,H=J,j;
for R=1,i,1 do 
local i=(R-1)*3;
local Qe,ee=g[i+2],g[i+1];
if Qe==1 then 
m=if not m then{}else m;
local Ye=m[ee];
if not Ye then 
Ye={[4]=ee,[5]=X};
m[ee]=Ye;else end;
a[R]=Ye;else 
if Qe==3 then 
a[R]=X[ee];else 
if Qe==2 then 
a[R]=b[ee];else 
if Qe==0 then 
H=if not H then{}else H;
local Qe=H[ee];
if not Qe then 
Qe={[6]=g[i+3],[5]=X,[4]=ee};
H[ee]=Qe;else end;
a[R]=Qe;else end;end;end;end;end;
J,j=m,H;else end;else end;
z=X[p[G]](a);
l(z,T);
X[_[G]]=z;
t=a;else 
if W==75 then 
X[_[G]]=X[w[G]]%e[G];else 
X[_[G]]=X[p[G]][w[G]];end;end;else 
if W==72 then 
X[p[G]][X[_[G]]]=q[G];else 
X[p[G]]=X[w[G]]*X[_[G]];end;end;else 
if W>=79 then 
if W<80 then 
X[_[G]]=X[p[G]]..X[w[G]];else 
if W~=81 then 
X[p[G]]=X[_[G]]-q[G];else 
G=if not(X[_[G]]<X[p[G]])then w[G]else G;end;end;else 
if W<77 then 
X[p[G]]();else 
if W==78 then 
X[p[G]]=w[G];else 
C+=Y;
t=if Y<=0 then C>=U else C<=U;
if t then 
X[w[G]]=C;
G=p[G];else end;end;end;end;end;end;end;end;else 
if W>=123 then 
if W<143 then 
if W<133 then 
if W>=128 then 
if W>=130 then 
if W>=131 then 
if W==132 then 
X[_[G]]=X[p[G]]*w[G];else 
z,t=_[G],w[G]+1;
for a=1,p[G],1 do 
z=I(f(z,(B(z,13))),536870911);
z=f(z,(P(z,13)));
z=I(f(z,(B(z,14))),536870911);
_[t]=f(_[t],(I(P(z,0),127)));
p[t]=f(p[t],(I(P(z,7),127)));
w[t]=f(w[t],(I(P(z,14),127)));
y[t]=f(y[t],(I(P(z,21),127)));
t=t+1;end;
y[G]=54;end;else 
X[p[G]](S(X[_[G]],1,X[_[G]].n));end;else 
if W~=129 then 
local a,g,i=w[G],e[G],_[G];
local l,m=I(g,4294967295),I(i,4294967295);
local g,H,R,Qe=I(l,65535),P(l,16),I(m,65535),P(m,16);
i=I(g*R+B(I(g*Qe+H*R,65535),16),4294967295);
H=nil;
repeat 
m=i%4294967296;
if m~=m then 
H=0;
break;end;
H=m-m%1;until true;
X[a]=H;else 
X[p[G]](X[_[G]],S(X[w[G]],1,X[w[G]].n));end;end;else 
if W<125 then 
if W==124 then 
local a,g,i=p[G],q[G],X[_[G]];
local l,m=I(g,4294967295),I(i,4294967295);
local i,H,R,Qe=I(l,65535),P(l,16),I(m,65535),P(m,16);
l=I(i*R+B(I(i*Qe+H*R,65535),16),4294967295);
g=nil;
repeat 
i=l%4294967296;
if i~=i then 
g=0;
break;end;
g=i-i%1;until true;
X[a]=g;else 
X[_[G]]=b[w[G]][e[G]];end;
elseif W<126 then 
T[q[G]]=X[p[G]];
elseif W~=127 then 
X[_[G]]=X[w[G]]+p[G];else 
X[_[G]][q[G]]=X[p[G]];end;end;else 
if W>=138 then 
if W<140 then 
if W~=139 then 
X[p[G]]=X[w[G]]();else 
t=b[w[G]];
t[5][t[4]][O[G]]=p[G];end;else 
if W<141 then 
local a,g,i=_[G],X[p[G]],X[w[G]];
local l,m=I(g,4294967295),I(i,4294967295);
local H,R,Qe,ee=I(l,65535),P(l,16),I(m,65535),P(m,16);
l=I(H*Qe+B(I(H*ee+R*Qe,65535),16),4294967295);
i=nil;
repeat 
g=l%4294967296;
if g~=g then 
i=0;
break;end;
i=g-g%1;until true;
X[a]=i;else 
if W~=142 then 
local a,g,i=_[G],f(p[G],(I(f(K,(I(P(K,29),7))),536870911))),x[6];
local l=f(i[a],143377016);
i[a]=l;
i,a=x[5],l+1;
l=A(i,a);
local m,H;
if l<128 then 
m,H=l,a+1;else 
local R=A(i,a+1);
if R<128 then 
m,H=(l-128)*128+R,a+2;else 
local Qe=A(i,a+2);
if Qe<128 then 
m,H=(l-128)*16384+(R-128)+Qe*128,a+3;else 
local ee=A(i,a+3);
m,H=(l-128)*2097152+(R-128)*128+(Qe-128)*16384+ee%128+(ee-ee%128)*2097152,a+4;end;end;end;
a,l=g*16843009,H+m;
local R=l-m%4;
for m=H,R-1,4 do 
L(i,m,(f(E(i,m),a)));end;
for a=R,l-1,1 do 
Z(i,a,(f(A(i,a),g)));end;
_[G]=229;
p[G]=45;
w[G]=200;
y[G]=54;else 
G=if X[_[G]]then w[G]else p[G];end;end;end;else 
if W<135 then 
if W==134 then 
t,z,M,k=p[G],_[G],w[G],f(K,I(P(K,14),262143),(I(P(K,28),15)));
u=M<2097152 and 7 or 14;
N,F=I(M,B(1,u)-1),P(M,u);
_[G]=f(z,30,(I(k,127)));
w[G]=f(N,19,(I(P(k,14),127)));
p[G]=f(t,22,(I(P(k,7),127)));
y[G]=f(F,0,(I(P(k,21),127)));
G=G-1;else 
G=if X[p[G]]<=X[w[G]]then _[G]else G;end;else 
if W<136 then 
X[p[G]][_[G]]=q[G];
elseif W~=137 then 
X[p[G]]=X[w[G]](X[_[G]]);else 
local a,g,i=p[G],_[G],q[G];
local l,m=I(g,4294967295),I(i,4294967295);
local g,H,R,Qe=I(l,65535),P(l,16),I(m,65535),P(m,16);
m=I(g*R+B(I(g*Qe+H*R,65535),16),4294967295);
i=nil;
repeat 
Qe=m%4294967296;
if Qe~=Qe then 
i=0;
break;end;
i=Qe-Qe%1;until true;
X[a]=i;end;end;end;end;else 
if W>=153 then 
if W<158 then 
if W<155 then 
if W==154 then 
X[w[G]]=X[p[G]]/O[G];else 
X[w[G]]=X[p[G]]~=O[G];end;else 
if W<156 then 
X[w[G]]=X[p[G]]-_[G];else 
if W~=157 then 
K=X[w[G]];else 
local a,K,g=p[G],_[G],x[6];
local i=f(g[a],143377016);
g[a]=i;
a,g=x[5],i+1;
i=A(a,g);
local l,m;
if i<128 then 
l,m=i,g+1;else 
local H=A(a,g+1);
if H<128 then 
l,m=(i-128)*128+H,g+2;else 
local R=A(a,g+2);
if R<128 then 
l,m=(i-128)*16384+(H-128)+R*128,g+3;else 
local Qe=A(a,g+3);
l,m=(i-128)*2097152+(H-128)*128+(R-128)*16384+Qe%128+(Qe-Qe%128)*2097152,g+4;end;end;end;
i,g=K*16843009,m+l;
local H=g-l%4;
for l=m,H-1,4 do 
L(a,l,(f(E(a,l),i)));end;
for L=H,g-1,1 do 
Z(a,L,(f(A(a,L),K)));end;
p[G]=163;
_[G]=89;
w[G]=242;
y[G]=54;end;end;end;else 
if W>=161 then 
if W<162 then 
G=p[G];else 
if W==163 then 
X[w[G]](X[p[G]]);else 
X[_[G]]=X[p[G]]-X[w[G]];end;end;else 
if W<159 then 
X[_[G]]=x;
elseif W~=160 then 
X[w[G]]=e[G];else 
Q[e[G]]=X[_[G]];end;end;end;else 
if W<148 then 
if W<145 then 
if W==144 then 
X[p[G]]=X[_[G]]//w[G];else 
G=if X[p[G]]<X[w[G]]then _[G]else G;end;else 
if W>=146 then 
if W~=147 then 
t,z=_[G],X[w[G]];
X[t+1]=z;
X[t]=z[e[G]];else 
G=if X[p[G]]~=q[G]then _[G]else G;end;else 
c=V;
V,t={[9]=c,[8]=C,[7]=Y,[5]=U},_[G];
Y,U=X[t+2]+0,X[t+1]+0;
C=X[t]-Y;
G=w[G];end;end;else 
if W>=150 then 
if W<151 then 
X[w[G]]=#X[p[G]];
elseif W~=152 then 
X[_[G]]=w[G]+X[p[G]];else 
X[_[G]]=X[w[G]]+e[G];end;else 
if W==149 then 
X[w[G]](X[p[G]],O[G]);else 
t,z,M=_[G],p[G],w[G];
k,u=t+M-1,t+z;
N=X[u];
F=N.n;
s=z+F-1;
N.n=s;
D(N,1,F,z,N);
D(X,t+1,u-1,1,N);
r=o(X[t](S(N,1,N.n)));
D(r,1,M,t,X);end;end;end;end;end;else 
if W>=102 then 
if W>=112 then 
if W<117 then 
if W>=114 then 
if W>=115 then 
if W~=116 then 
if J then 
for Y in h,J,nil do 
if J then 
local x=J[Y];
if x then 
x[5]=x;
x[6]=X[Y];
x[4]=6;
J[Y]=nil;end;end;end;end;
if j then 
for Y,x in h,j,nil do 
local c=x[6];
if j then 
local x=j[Y];
if x then 
local a,s=Y+c,n(c);
D(X,Y,a-1,1,s);
x[5]=s;
x[4]=1;
j[Y]=nil;end;end;end;end;
return X[_[G]],X[w[G]];else 
X[_[G]]=X[p[G]]==q[G];end;else 
t=b[_[G]];
t[5][t[4]][e[G]]=q[G];end;else 
if W==113 then 
local Y,x,c=_[G],X[w[G]],p[G];
local a,s=I(x,4294967295),I(c,4294967295);
local c,u,r,U=I(a,65535),P(a,16),I(s,65535),P(s,16);
x=I(c*r+B(I(c*U+u*r,65535),16),4294967295);
U=nil;
repeat 
s=x%4294967296;
if s~=s then 
U=0;
break;end;
U=s-s%1;until true;
X[Y]=U;else 
X[w[G]]=X[_[G]]..e[G];end;end;else 
if W<120 then 
if W>=118 then 
if W~=119 then 
if J then 
for Y in h,J,nil do 
if J then 
local x=J[Y];
if x then 
x[5]=x;
x[6]=X[Y];
x[4]=6;
J[Y]=nil;end;end;end;end;
if j then 
for Y,x in h,j,nil do 
local c=x[6];
if j then 
local x=j[Y];
if x then 
local a,s=Y+c,n(c);
D(X,Y,a-1,1,s);
x[5]=s;
x[4]=1;
j[Y]=nil;end;end;end;end;
return X[p[G]](X[w[G]]);else 
X[_[G]]=q[G]~=e[G];end;else 
X[w[G]]=o(X[_[G]]());end;else 
if W<121 then 
t,z,M=p[G],w[G],_[G];
k=t+z;
X[t]=o(X[t](S(X,t+1,k)));else 
if W==122 then 
X[w[G]]=d;else 
X[p[G]]=X[w[G]]<=_[G];end;end;end;end;else 
if W<107 then 
if W>=104 then 
if W<105 then 
X[w[G]]=X[p[G]]<=X[_[G]];
elseif W==106 then 
X[w[G]]=X[_[G]][e[G]];else 
X[p[G]]=y;end;else 
if W==103 then 
X[p[G]]=v;else 
d=X[w[G]];end;end;else 
if W<109 then 
if W~=108 then 
X[_[G]]=o(X[p[G]](X[w[G]]));else 
t,z,M=w[G],_[G],p[G];
k=X[t];
D(X,t+1,t+z,M+1,k);end;else 
if W>=110 then 
if W~=111 then 
X[p[G]]=X[_[G]]+X[w[G]];else 
X[p[G]]=not X[_[G]];end;else 
X[w[G]]=T[e[G]];end;end;end;end;else 
if W<92 then 
if W>=87 then 
if W<89 then 
if W~=88 then 
X[_[G]][w[G]]=X[p[G]];else 
X[_[G]]=-X[w[G]];end;
elseif W<90 then 
X[_[G]][q[G]]=p[G];
elseif W==91 then 
X[_[G]]=_;else 
local Y,x,y=p[G],q[G],O[G];
local c,a=I(x,4294967295),I(y,4294967295);
local x,y,s,u=I(c,65535),P(c,16),I(a,65535),P(a,16);
a=I(x*s+B(I(x*u+y*s,65535),16),4294967295);
s=nil;
repeat 
u=a%4294967296;
if u~=u then 
s=0;
break;end;
s=u-u%1;until true;
X[Y]=s;end;else 
if W<84 then 
if W~=83 then 
t=b[p[G]];
t[5][t[4]]=X[_[G]];else 
X[w[G]]=X[_[G]]<p[G];end;else 
if W<85 then 
X[p[G]]=X[_[G]]==w[G];else 
if W~=86 then 
t=b[_[G]];
X[w[G]]=t[5][t[4]];else 
X[p[G]][q[G]]=O[G];end;end;end;end;else 
if W<97 then 
if W>=94 then 
if W>=95 then 
if W~=96 then 
X[_[G]]=X[p[G]+X[w[G]]];else 
X[_[G]]=X[p[G]]/X[w[G]];end;else 
G=if q[G]~=O[G]then p[G]else G;end;else 
if W==93 then 
X[p[G]]=X[_[G]]//X[w[G]];else 
X[w[G]]=Q[p[G]];end;end;else 
if W<99 then 
if W==98 then 
if J then 
for Q in h,J,nil do 
if J then 
local Y=J[Q];
if Y then 
Y[5]=Y;
Y[6]=X[Q];
Y[4]=6;
J[Q]=nil;end;end;end;end;
if j then 
for Q,Y in h,j,nil do 
local x=Y[6];
if j then 
local Y=j[Q];
if Y then 
local O=n(x);
D(X,Q,Q+x-1,1,O);
Y[5]=O;
Y[4]=1;
j[Q]=nil;end;end;end;end;
return X[_[G]],X[p[G]],q[G];else 
if J then 
for Q in h,J,nil do 
if J then 
local Y=J[Q];
if Y then 
Y[5]=Y;
Y[6]=X[Q];
Y[4]=6;
J[Q]=nil;end;end;end;end;
if j then 
for Q,Y in h,j,nil do 
local x=Y[6];
if j then 
local Y=j[Q];
if Y then 
local O,y=Q+x,n(x);
D(X,Q,O-1,1,y);
Y[5]=y;
Y[4]=1;
j[Q]=nil;end;end;end;end;
return X[w[G]](X[_[G]],X[p[G]]);end;
elseif W>=100 then 
if W==101 then 
X[p[G]]=X[w[G]][X[_[G]]];else 
if J then 
for Q in h,J,nil do 
if J then 
local Y=J[Q];
if Y then 
Y[5]=Y;
Y[6]=X[Q];
Y[4]=6;
J[Q]=nil;end;end;end;end;
if j then 
for Q,Y in h,j,nil do 
local x=Y[6];
if j then 
local Y=j[Q];
if Y then 
local O,y=Q+x,n(x);
D(X,Q,O-1,1,y);
Y[5]=y;
Y[4]=1;
j[Q]=nil;end;end;end;end;
return X[w[G]];end;else 
X[_[G]]=e[G]>q[G];end;end;end;end;end;end;
G=G+1;end;end;end;end;end,[60]=table.create,C=function(Q,e,Y,x,_,O,y,W)
if _<=131 then 
if _<=130 then 
local q,p,w=e[3],e[2],e[1];
local c,a=q+p,p<=0;
p,q=c>=w,c<=w;
w=a and p or not a and q;
e[3]=c;
if w then 
return 168,W,c;else 
return 108,W,Y;end;else 
return Y<128 and 259 or 26,W,Y;end;
elseif _<=132 then 
return 131,W,(Q[23](O,x+1));else 
local e=Q[23](O,y+1);
return not(e>=128)and 102 or 145,e,Y;end;end,h7=function(Q,e,Y,x,_,O,y,W,q)
if Y<=6 then 
local p=128*(y-128)+W;
return 30,x+2,p,W,e;
elseif Y<=7 then 
local Y=Q[23](O,3+x);
local Q,O,p,w=2097152*(W-128),128*(e-128),(q-128)*16384,Y%128;
local c=(Y-Y%128)*2097152+p+(w+(Q+O));
return 13,4+x,y,c,e;else 
local Q,Y=16384*(e-128),q-128;
local e=128*_+Y+Q;
return 32,x+3,y,W,e;end;end,L=function(Q,e,Y,x,_,O,y,W,q,p,w)
if x<=118 then 
if x<=117 then 
local c=O+(W-128)*128;
return 126,_,e+2,q,y,Y,c,w,p;else 
return 37,_,e,1+q,y,Y,W,w,p;end;
elseif x<=119 then 
local x=w-4891;
local O,c,a=Q[60](x),Q[60](x),1+0;
local s=1-a;
return 219,{x+0,s,a,_,nil},e,q,y,Y,W,O,c;else 
local Y=y-4891;
local x,O,y=Q[60](Y),Q[60](Y),1+0;
return 48,{y,1-y,Y+0,_,nil},e,q,x,O,W,w,p;end;end,[100]=function(Q,Q,Q,Q,Q)
return function(Q,e,e)
local e=Q[1];
local Y=Q[2];
local x=Q[3];
local _=Q[4];
local O=Q[5];
return function()
local Q=0;
while true do 
local y=Q<=0;
if y then 
local y,W=true;
e[5][e[4]]=y;
local e,e=Y[5][Y[4]][nil];
x[5][x[4]](204621016,4);
local e,Y=375908767;
_[5][_[4]]=e;
O[5][O[4]]();
Q=1;else 
return;end;end;end;end;end,M7=function(Q,e,Y,x,_,O,y,W,q)
if e<=33 then 
if e<=32 then 
x[q]=Y;
return 23,y,W,_,O;else 
local p=Q[23](W,_+3);
local w,c,a,s,u=(x-128)*2097152,(q-128)*128,16384*(Y-128),p%128,p%128;
local Y=(p-u)*2097152;
u=c+(s+a+w)+Y;
return 14,y,_+4,u,O;end;
elseif e<=34 then 
local Y=W+128*(x-128);
return 14,y,_+2,Y,O;
elseif e<=35 then 
local e=1+0;
return 17,{y,nil,0-e,255+0,e},109,159,O;else 
local e=Q[23](W,1+_);
return e<128 and 9 or 25,y,W,_,e;end;end,[63]=Color3.new,s7=function(Q,e,Y,x,_,O,y,W,q,p,w)
if W<=232 then 
if W<=231 then 
local c=Q[23](q,3+p);
local a,s,u,v,k=(Y-128)*2097152,128*(O-128),16384*(_-128),c%128,c%128;
local _=2097152*(c-k);
k=s+v+u+_+a;
return 94,x,4+p,k,O,w,y,e;else 
local _=Q[23](q,p);
return _<128 and 160 or 161,x,p,Y,O,w,y,_;end;
elseif W<=233 then 
local _=w-4891;
local W,c,a=Q[60](_),Q[60](_),1+0;
return 251,{1-a,a,_+0,x,nil},p,Y,O,W,c,e;else 
local _=Q[23](q,p+1);
return not not(128<=_)and 204 or 228,x,p,Y,_,w,y,e;end;end,i=function(Q,e,Y,x,_,O,y,W,q,p,w,c,a)
if e<=127 then 
local s=Q[23](_,3+O);
local u,v,k,M=(w-128)*2097152,128*(p-128),16384*(c-128),s%128;
local p=k+((s-s%128)*2097152+v)+u+M;
return 144,4+O,y,p,c,a;
elseif e<=128 then 
local e=Q[23](_,3+y);
local Q,_,p,s=(a-128)*2097152,(W-128)*128,(q-128)*16384,e%128;
local W=Q+2097152*(e-e%128)+s+(p+_);
return 119,O,4+y,w,c,W;else 
local Q,e=(c-128)*16384,x-128;
local x=128*Y+e+Q;
return 94,O,3+y,w,x,a;end;end,[17]=buffer.readi16,[32]=buffer.readi8,y7=function(Q,e,Y,x,_,O,y,W,q,...)
if W<=1 then 
if W<=0 then 
local p=(x+y*Y)%256;
local w=(x+p*Y)%256;
local c=(x+w*Y)%256;
local a=(Y*c+x)%256;
local s,u,v,k=Q.J7,w*256,c*65536,16777216*a;
s[y]=u+(v+p)+k;
Q.X7[y]=a;
return 17,_,Y,x,y,e,q,O;else 
local p=Q[23](Y,x+2);
return not(128>p)and 7 or 29,_,Y,x,y,e,q,p;end;
elseif W<=2 then 
local W=Q[23](Y,x+1);
return not(128>W)and 18 or 6,_,Y,x,y,e,W,O;else 
local e=_[1];
Q.G=...;
local Y,x=Q.G,Q[24];
local _=Q[23](Y,x);
return not(128<=_)and 28 or 2,e,Y,x,{},_,q,O;end;end,[59]=coroutine.isyieldable,[46]=string.gsub,[108]=buffer.readf64,R7=function(Q,e,Y,x,_,O,y,W,q,p)
if q<=256 then 
if q<=255 then 
local w=e+(p-128)*128;
return 120,Y,2+W,w,e,x,O;else 
local w=Q[23](_,3+Y);
local c,a,s,u=(x-128)*2097152,128*(O-128),(y-128)*16384,w%128;
local v=2097152*(w-w%128)+u+(s+a)+c;
return 126,Y+4,W,p,e,v,O;end;
elseif q<=257 then 
local w=Q[23](_,2+Y);
return not not(w>=128)and 31 or 100,Y,W,p,w,x,O;
elseif q<=258 then 
return 85,1+Y,W,p,e,x,O;else 
local Q=y+128*(O-128);
return 50,2+Y,W,p,e,x,Q;end;end,T=function(Q,e,Y,x,_,O,y,W)
if e<=151 then 
if e<=150 then 
local q=Q[23](Y,2+x);
return not(128>q)and 213 or 143,_,W,q,O;else 
return 51,_+1,W,y,O;end;
elseif e<=152 then 
local e=Q[23](Y,x+1);
return not(128>e)and 123 or 240,_,W,y,e;else 
local e=Q[23](Y,x+1);
return not(e<128)and 207 or 214,_,e,y,O;end;end,K7=function(Q,e,Y,x,_,O,y,W,q,p,w,c)
if e<=224 then 
if e<=223 then 
return 144,W,x+1,q,c,O,_;else 
local a=Q[23](Y,3+q);
local s,u,v,k=(O-128)*2097152,128*(w-128),(p-128)*16384,a%128;
local p=v+(u+(2097152*(a-a%128)+s+k));
return 120,W,x,4+q,c,p,_;end;
elseif e<=225 then 
local e=Q[23](Y,x+2);
return not(128<=e)and 71 or 97,W,x,q,c,O,e;else 
local Q;
local e=y[7];
if not not(0~=x)then 
return 140,W,x,q,Q,e,_;else 
return 55,e,x,q,c,O,_;end;end;end,a=function(Q,e,Y,x,_,O,y,W,q,p,w,c,a,s,u)
if W<=82 then 
if W<=81 then 
local v=Q[23](x,3+a);
local k,M,r,U,X=(Y-128)*2097152,(y-128)*128,16384*(q-128),v%128,v%128;
local y=(v-X)*2097152;
X=U+r+k+(M+y);
return 149,O,x,4+a,_,e,s,c,X;else 
local y=Q[23](x,p+1);
if not(y<128)then 
return 187,O,x,a,_,y,s,c,Y;else 
return 166,O,y,a,_,e,s,c,Y;end;end;
elseif W<=83 then 
local y=(a-128)*16384;
return 17,O,x,u-128+(128*w+y),_+3,e,s,c,Y;else 
local y,W,q=Q[42](x,_),4+_,1+0;
local Q=1-q;
return 130,{y+0,q,Q,nil,O},x,a,W,e,1,{},Y;end;end,[126]=buffer.writeu8,[88]=function(Q,e,e)
return function(e,Y,Y)
local Y=e[1];
local x=e[2];
local _=e[3];
return function()
local e,O,y,W,q,p,w,c,a,s,u,v,k,M,r=5;
while true do 
local U=e<=5;
if U then 
local U=e<=2;
if U then 
if e<=0 then 
local U,X,N=O[2],O[4],O[3];
local z,C=U+X,X<=0;
U,X=z>=N,z<=N;
N=C and U or not C and X;
O[2]=z;
if N then 
e,y=4,z;else 
e=6;end;
elseif e<=1 then 
local U,X=0,Q[2](q+1,255);
local N=Q[2](p+s[X],255);
s[X],s[N]=s[N],s[X];
e,y,W,q,p=8,U,N,Q[19](s[Q[2](s[X]+s[N],255)],0),X+1;else 
local U=O[1];
e,O=9,U;end;else 
local U=e<=3;
if U then 
local U=Q[2](W+s[M],255);
s[M],s[U]=s[U],s[M];
local X;
W,e,X=Q[19](s[Q[2](s[M]+s[U],255)],16),7,Q[2](M+1,255);
M,r=X,U+s[X];else 
local U,X,N=e<=4;
if U then 
X=Q[2](q+1,255);
N=Q[2](p+s[X],255);
s[X],s[N]=s[N],s[X];
local U=s[Q[2](s[X]+s[N],255)];
Q[126](u,y,(Q[121](Q[23](w,c+y),U)));
e,q,p=0,X,N;else 
local U;
local U,z=Y[5][Y[4]];
local Y=x[5][x[4]];
local x,z,z,C,V=Q[5](U)-Y;
z,X,N,C,V=_[5][_[4]],0,0,Q[7](x),x-x%4;
local _,X=V-1,4+0;
local N,d=0-X;
d,e={O,_+0,nil,N,X},10;
O,q,p,w,c,a,s,u,v=d,0,0,U,Y,x,z,C,V;end;end;end;
elseif e<=8 then 
if e<=6 then 
local Y=O[1];
e,O=11,Y;
elseif e<=7 then 
local Y=Q[2](r,255);
s[M],s[Y]=s[Y],s[M];
local x=Q[4](y,q,p,W,(Q[19](s[Q[2](s[M]+s[Y],255)],24)));
Q[82](u,k,(Q[121](Q[42](w,c+k),x)));
e,y,W,q,p=10,M,Y,M,Y;else 
local Y=Q[2](p,255);
local x=Q[2](W+s[Y],255);
s[Y],s[x]=s[x],s[Y];
local _;
p,e,W,_=Q[19](s[Q[2](s[Y]+s[x],255)],8),3,x,Q[2](Y+1,255);
M=_;end;
elseif e<=9 then 
local Q,Y=a-1,1+0;
local x={O,v-Y,Q+0,Y,nil};
e,O=0,x;
elseif e<=10 then 
local Q,Y,x=O[4],O[5],O[2];
local _,y=Q+Y,Y<=0;
Q,Y=_>=x,_<=x;
x=y and Q or not y and Y;
O[4]=_;
if x then 
e,k=1,_;else 
e=2;end;else 
return u;end;end;end;end;end,[35]=string.char,[118]=getmetatable,[21]=rawget,H7=function(Q,e,Y,x,_,O,y,W,q)
if y<=240 then 
if y<=239 then 
return 112,W,e,q+1;else 
local p=Y+128*(q-128);
return 119,W,e+2,p;end;
elseif y<=241 then 
return 233,W,1+e,q;else 
local Y=Q[23](W,3+e);
local Q,y,W,p,w=(O-128)*2097152,(x-128)*128,16384*(_-128),Y%128,(Y-Y%128)*2097152;
return 36,y+Q+(p+W)+w,e+4,q;end;end,k7=buffer.create(16),O=function(Q,...)
(...)[...]=nil;end,b7=function(Q,e,Y,x)
local _,O,y,W,q,p,w,c=Q[99],Q[47],Q[62],2,e,x,Y;
while true do 
if W<=3 then 
if W<=1 then 
if W<=0 then 
e=p[w];
if e then 
W,p,w,c=4,_,"LPH:",e;else 
W,p,w=3,_,"LPH:";end;else 
W=O(q,"[:][^%d%D]*([%d]+)[%:\13\10][^%a%A]*")and 0 or 7;end;
elseif W<=2 then 
W=y(q)=="string"and 1 or 5;else 
W,c=4,"?";end;
elseif W<=5 then 
if W<=4 then 
p(w..c..": "..q,0);
W=6;else 
_(q,1);
W=6;end;
elseif W<=6 then 
return;else 
_(q,0);
W=6;end;end;end,[83]=table.concat,[41]=bit32.rrotate,r=function(Q,e,Y,x,_,O,y,W,q,p)
if _<=13 then 
if _<=12 then 
local w=Q[23](e,1+x);
return not(w<128)and 205 or 42,q,W,p,y,w;else 
local w=Q[23](e,x+1);
return 128>w and 196 or 150,q,W,p,w,Y;end;
elseif _<=14 then 
local _,w,c,a=Q[23](e,3+W),2097152*(p-128),(O-128)*128,16384*(y-128);
local Q=_%128+((_-_%128)*2097152+w)+(c+a);
return 19,q,4+W,Q,y,Y;else 
return 218,x+4,W,p,y,Y;end;end,t7=function(Q,e,Y,x,_,O,y,W,q,p)
if W<=252 then 
if W<=251 then 
local w,c,a=e[1],e[2],e[3];
local s,u=w+c,c<=0;
w,c=s>=a,s<=a;
a=u and w or not u and c;
e[1]=s;
if a then 
return 232,Y,p,O,s;else 
return 56,Y,p,O,y;end;else 
return 180,1+Y,p,O,y;end;
elseif W<=253 then 
local e=Q[23](x,_);
return not(128<=e)and 250 or 174,Y,e,O,y;else 
local Q=q+(O-128)*128;
return 94,Y+2,p,Q,y;end;end,[116]=bit32.lrotate,[69]=buffer.writei16,[119]=1.40436227E8,[67]=bit32.countlz,J=function(Q,e,Y,x,_,O,y,W,q)
if y<=46 then 
local y,p,w=Q[23](x,e+3),(_-128)*2097152,128*(W-128);
return 146,16384*(Y-128)+(p+(y%128+(y-y%128)*2097152+w)),e+4,q;else 
local Q,e,Y=O[2],O[5],O[4];
local x,y=Q+e,e<=0;
Q,e=x>=Y,x<=Y;
Y=y and Q or not y and e;
O[2]=x;
if Y then 
return 52,_,W,x;else 
return 203,_,W,q;end;end;end,[54]=function(Q,Q)
return function(Q,e,e,e)
local e=Q[1];
local Y=Q[2];
return function()
local Q=2;
while true do 
local x,_=Q<=1;
if x then 
local x=Q<=0;
if x then 
e[5][e[4]]=(972275*e[5][e[4]]+201117069)%268435456;
e[5][e[4]]=(693985*e[5][e[4]]+487463)%268435456;
e[5][e[4]]=(453945*e[5][e[4]]+171705985)%268435456;
e[5][e[4]],Q=(56989*e[5][e[4]]+74150613)%268435456,3;else 
return;end;else 
local x=Q<=2;
if x then 
e[5][e[4]]=(509457*e[5][e[4]]+68361263)%268435456;
e[5][e[4]]=(543329*e[5][e[4]]+251711305)%268435456;
e[5][e[4]]=(432159*e[5][e[4]]+79050853)%268435456;
e[5][e[4]],Q=(416291*e[5][e[4]]+132460585)%268435456,0;else 
local x;
Y[5][Y[4]]=(1*Y[5][Y[4]]+218937654)%268435456;
e[5][e[4]]=(27515*e[5][e[4]]+90564627)%268435456;
e[5][e[4]]=(703457*e[5][e[4]]+82489175)%268435456;
e[5][e[4]],Q=(945999*e[5][e[4]]+136501995)%268435456,1;end;end;end;end;end;end,[65]=bit32.rshift,[122]=buffer.writestring,U7=function(Q,e,Y,x,_,O,y,W,q,p,w,c,a)
if Y<=183 then 
if Y<=182 then 
local s=w+(a-128)*128;
return 169,c,_,p+2,s,w,W,y,x;else 
q[e]=O;
return 28,c,_,p,a,w,W,y,x;end;
elseif Y<=184 then 
local e=Q[23](_,w+1);
if not(128<=e)then 
return 198,c,e,p,a,w,W,y,x;else 
return 96,c,_,p,a,w,W,y,e;end;else 
local e,Y=Q[42](_,w),w+4;
local O,y,q,w=Q[42](_,Y),Y+4,W-W%1,1+0;
return 157,{nil,c,q-w,w,e+0},_,p,a,e,O,y,x;end;end,l7=function(Q,e,Y,x,_,O,y,W)
if y<=196 then 
if y<=195 then 
return 218,e,x+1,x,O;else 
local q=128*(O-128)+Y;
return 18,e,W,x+2,q;end;
elseif y<=197 then 
local Y=Q[23](e,1);
return not not(128<=Y)and 75 or 22,e,W,Y,O;else 
return 36,e+128*(_-128),W,x+2,O;end;end,Q=function(Q,e,Y,x,_,O,y,W,q,p,w,c,a,s,u,v,k,M,r)
if O<=37 then 
if O<=36 then 
W[0]=s;
c[0]=q;
_[0]=r;
w[0]=x;
Q[34](W,e);
Q[34](c,e);
Q[34](_,e);
Q[34](w,e);
return 8,M,Q[v](Q,w,p,a,u,nil,q,c,s,M,_,x,nil,r,W,k),a,s;else 
r[x]=w;
return 219,M,p,a,s;end;
elseif O<=38 then 
local e=Q[23](Y,1+y);
return not(e>=128)and 115 or 164,M,p,a,e;else 
local e=Q[23](Y,3+M);
local Q,Y,x,_,O=2097152*(a-128),(k-128)*128,16384*(s-128),e%128,e%128;
local y=2097152*(e-O);
e=Q+(Y+(_+x+y));
return 50,M+4,p,e,s;end;end,[99]=error,j7=function(Q,e,Y,x)
local _=Q[85];
_();
for Q,O in e,Y,x do 
_(true,Q,O);end;end,_7=function(Q,e,Y,x,_,O,y)
local W,q=Q[23](O,_),1+_;
Q[51](y,e+Y,W,x);
return 2;end,[114]=coroutine.status,[78]=coroutine.running,P7=function(Q,e,Y)
local x=Q[23](e,Y+1);
return not not(x>=128)and 7 or 25,x;end,[15]=string.find,n=function(Q,e,Y,x,_,O,y,W,q)
if e<=155 then 
if e<=154 then 
local p=Q[23](_,Y);
return not(p>=128)and 249 or 152,x,p,W,O;else 
local p=Q[23](_,2+Y);
return not not(p>=128)and 216 or 33,x,q,W,p;end;
elseif e<=156 then 
local e=Q[23](_,Y);
return not(e<128)and 12 or 241,x,q,e,O;else 
local Q,e,Y=y[3],y[4],y[5];
local _,p=Q+e,e<=0;
e,Q=_>=Y,_<=Y;
Y=p and e or not p and Q;
y[3]=_;
if Y then 
return 64,_,q,W,O;else 
return 243,x,q,W,O;end;end;end,[76]=tonumber,C7=function(Q,e,Y,x,_,O,y,W,q,p)
if e<=15 then 
local w=(O-128)*128+q;
return 13,2+y,_,w,q;
elseif e<=16 then 
local e=Q[23](Y,y+3);
local Q,Y,w,c,a=2097152*(q-128),(x-128)*128,(W-128)*16384,e%128,e%128;
local x=2097152*(e-a);
a=Q+(c+Y)+(x+w);
return 32,y+4,_,O,a;else 
local Q,e,Y=p[3],p[5],p[4];
local x,W=Q+e,e<=0;
Q,e=x>=Y,x<=Y;
Y=W and Q or not W and e;
p[3]=x;
if Y then 
return 0,y,x,O,q;else 
return 3,y,_,O,q;end;end;end,K=function(Q,e,Y,x,_,O,y,W)
if y<=21 then 
if y<=20 then 
return 110,W,Y,1+e,_,O;else 
local q=Q[23](W,Y+1);
return q<128 and 148 or 78,W,Y,e,_,q;end;
elseif y<=22 then 
return 226,W,e+(Y-128)*128,2,_,O;else 
local y=Q[23](W,x);
if 128>y then 
return 77,y,Y,e,_,O;else 
return 82,W,Y,e,y,O;end;end;end,[70]=bit32.countrz,x7=function(Q,e,Y,x,_,O,y,W,q,p)
if O<=204 then 
if O<=203 then 
return 247,e[3],p,x,W;else 
local w=Q[23](q,2+Y);
return not(w<128)and 6 or 158,e,p,w,W;end;
elseif O<=205 then 
local O=Q[23](q,2+Y);
return not(128>O)and 136 or 9,e,p,x,O;else 
local Y=Q[23](q,p+3);
local Q,O,q,w=(W-128)*2097152,(y-128)*128,16384*(_-128),Y%128;
local _=(Y-Y%128)*2097152+Q+(O+w)+q;
return 74,e,4+p,x,_;end;end,[82]=buffer.writeu32,s=function(Q,e,Y,x,_,O,y,W)
if Y<=28 then 
local Y,q,p=_[3],_[2],_[1];
local w,c=Y+q,q<=0;
q,Y=w>=p,w<=p;
p=c and q or not c and Y;
_[3]=w;
if p then 
return 183,y,O,w;else 
return 217,y,O,x;end;else 
local Y=Q[23](W,3);
local Q,_,W,q,p=(y-128)*2097152,128*(O-128),(e-128)*16384,Y%128,Y%128;
local e,O=(Y-p)*2097152+(_+Q),q+W;
return 226,e+O,4,x;end;end,[72]=coroutine.create,[16]=string.format,[107]=table.move,[127]=buffer.readi32,g7=function(Q,e,Y,x,_,O,y,W,q,p,w)
if e<=200 then 
if e<=199 then 
local c=Q[23](q,1+O);
return not(c>=128)and 65 or 229,x,O,c,W;else 
local c=Q[23](q,p+3);
local a,s,u,v,k=2097152*(x-128),(w-128)*128,16384*(O-128),c%128,c%128;
local w,M=(c-k)*2097152,v+(a+s+u);
return 15,M+w,O,Y,W;end;
elseif e<=201 then 
local e,w,c=16384*(W-128),y-128,128*_;
local _=w+e+c;
return 74,x,3+O,Y,_;else 
local e=Q[23](q,p);
return not not(e>=128)and 133 or 195,e,O,Y,W;end;end,a7=function(Q,e,Y,x,_,O,y,W,q,p,w)
if O<=14 then 
if O<=13 then 
return 16,_[2],q,e,Y;else 
local c=(Y-128)*128+p;
return 28,_,q,2+e,c;end;
elseif O<=15 then 
local c,a=W[6][x],W[5];
local x=c+1;
c=Q[23](a,x);
return c<128 and 23 or 5,_,a,x,c;
elseif O<=16 then 
local x,O=Y-1,1+0;
local W=y-O;
return 30,{O,_,nil,x+0,W},q,e,Y;else 
local x=Q[23](q,3+e);
local Q,O,y,W=2097152*(Y-128),128*(p-128),16384*(w-128),x%128;
local Y=Q+(2097152*(x-x%128)+(W+y))+O;
return 28,_,q,4+e,Y;end;end,[53]=string.gmatch,[123]=function(Q,e,Y,x,_,_,O,y,y,y,W,W,q,p,p,w)
local w,c,a,s,u,v,k,M,r,U,X,N,z,C,V,d,j=Q[60],Q[25],Q[121],Q[2],Q[107],Q[102],Q[28],Q[65],Q[19],Q[75],Q[23],Q[82],Q[42],Q[126],Q[36],Q[55],Q.Bt;
return function(J,t,t)
local t,F,K,b,n,G,P,I,f,B,D,S,o,h,A,L,E=w,c,a,s,u,v,k,M,r,U,X,N,z,C,V,d,j;
return function(...)
local w,c,a,s;
local u,v=3352188879;
local k,M,r=2555909102,1596574329;
local U,X=133109744;
local N,z,C=992721479;
local V,d=F(),t(q);
local q,j,F;
if _==187 then 
q,j,F=W,x,_;
while true do 
local Z=y[q];
if Z>=47 then 
if Z<70 then 
if Z>=58 then 
if Z>=64 then 
if Z>=67 then 
if Z<68 then 
q,j=if d[j]then K(Y[q],(b(K(y[q],112),127)))else q,j-1;else 
if Z==69 then 
C=d[j-K(Y[q],(b(K(q,y[q]),127)))];
j+=1;
d[j]=C;else 
j+=1;
d[j]=V[O[q]];end;end;else 
if Z<65 then 
C=K(Y[q],(b(K(F,q),127)));
a=j-C+1;
n(d,a,j,x+1,d);
j=x+C;else 
if Z==66 then 
C,a=K(Y[q],(b(K(95,q,F),127))),d[j];
j-=1;
z=d[j-a];
n(d,j-a+1,j,C+1,z);
j=j-a;else 
C,a=K(Y[q],(b(K(q,y[q]),127))),d[j];
j-=1;
z=j-C;
r,j=G(d[z](P(d,z+1,j))),z+a-1;
n(r,1,a,z,d);end;end;end;else 
if Z>=61 then 
if Z>=62 then 
if Z~=63 then 
N=d[j];
j=j-1;else 
M=d[j];
j=j-1;end;else 
d[Y[q]]=d[j];
j-=1;
q+=1;
d[Y[q]]=d[j];
j-=1;
q+=1;
d[Y[q]]=d[j];
j=j-1;end;else 
if Z<59 then 
C,a,z=Y[q]+1,K(Y[q+1],(b(K(u,(b(I(u,29),7))),536870911))),Y[q+2];
for g=1,z,1 do 
a=b(K(a,(f(a,13))),536870911);
a=K(a,(I(a,13)));
a=b(K(a,(f(a,14))),536870911);
Y[C]=K(Y[C],(b(I(a,0),127)));
y[C]=K(y[C],(b(I(a,7),127)));
C=C+1;end;
y[q]=29;
q=q+2;else 
if Z==60 then 
if not d[j]then 
q=K(Y[q],(b(F,127)));else 
j=j-1;end;else 
local g;
local i=O[q];
if i then 
local l=#i/3;
if l>0 then 
g={};
local m,T=X,c;
for H=1,l,1 do 
local l=(H-1)*3;
local R,Qe=i[l+2],i[l+1];
if R==1 then 
m=if not m then{}else m;
local ee=m[Qe];
if not ee then 
ee={[4]=Qe,[5]=d};
m[Qe]=ee;else end;
g[H]=ee;else 
if R==3 then 
g[H]=d[Qe];else 
if R==2 then 
g[H]=J[Qe];else 
if R==0 then 
T=if not T then{}else T;
local R=T[Qe];
if not R then 
R={[6]=i[l+3],[5]=d,[4]=Qe};
T[Qe]=R;else end;
g[H]=R;else end;end;end;end;end;
X,c=m,T;else end;else end;
a=d[j](g);
B(a,V);
d[j]=a;
C=g;end;end;end;end;else 
if Z<52 then 
if Z>=49 then 
if Z>=50 then 
if Z==51 then 
C=d[j];
j-=1;
d[j]=d[j]//C;else 
C=d[j];
j-=1;
d[j]=d[j]%C;end;else 
j+=1;
d[j]=O[q];end;else 
if Z==48 then 
C,a,z=Y[q]+1,K(Y[q+1],(b(K(M,(b(I(M,29),7))),536870911))),Y[q+2];
for g=1,z,1 do 
a=b(K(a,(f(a,13))),536870911);
a=K(a,(I(a,13)));
a=b(K(a,(f(a,14))),536870911);
Y[C]=K(Y[C],(b(I(a,0),127)));
y[C]=K(y[C],(b(I(a,7),127)));
C=C+1;end;
y[q]=29;
q=q+2;else 
C=j-K(Y[q],(b(K(95,y[q]),127)));
a=d[C];
d[C]=d[j];
d[j]=a;end;end;else 
if Z<55 then 
if Z>=53 then 
if Z==54 then 
C=K(Y[q],(b(K(M,(b(I(M,29),7))),536870911)));
local g,i,l=I(C,8),b(C,255),p[6];
local m=K(l[g],143377016);
l[g]=m;
g,l=p[5],m+1;
m=D(g,l);
local T,H;
if m<128 then 
T,H=m,l+1;else 
local R=D(g,l+1);
if R<128 then 
T,H=(m-128)*128+R,l+2;else 
local Qe=D(g,l+2);
if Qe<128 then 
T,H=(m-128)*16384+(R-128)+Qe*128,l+3;else 
local ee=D(g,l+3);
T,H=(m-128)*2097152+(R-128)*128+(Qe-128)*16384+ee%128+(ee-ee%128)*2097152,l+4;end;end;end;
l,m=i*16843009,H+T;
local R=m-T%4;
for T=H,R-1,4 do 
S(g,T,(K(o(g,T),l)));end;
for l=R,m-1,1 do 
h(g,l,(K(D(g,l),i)));end;
Y[q]=167;
y[q]=29;else 
if d[j]then 
j-=1;
q=K(Y[q],(b(F,127)));else end;end;else 
C=d[j];
j-=1;
d[j]=d[j]<=C;end;else 
if Z<56 then 
C=j-1;
a=d[C];
d[C]=d[j];
d[j]=a;else 
if Z==57 then 
q=if not d[j]then K(Y[q],(b(K(61,y[q]),127)))else q;else 
C=K(Y[q],(b(K(u,(b(I(u,29),7))),536870911)));
local g,i,l=I(C,8),b(C,255),p[6];
local m=K(l[g],143377016);
l[g]=m;
g,l=p[5],m+1;
m=D(g,l);
local T,H;
if m<128 then 
T,H=m,l+1;else 
local R=D(g,l+1);
if R<128 then 
T,H=(m-128)*128+R,l+2;else 
local Qe=D(g,l+2);
if Qe<128 then 
T,H=(m-128)*16384+(R-128)+Qe*128,l+3;else 
local ee=D(g,l+3);
T,H=(m-128)*2097152+(R-128)*128+(Qe-128)*16384+ee%128+(ee-ee%128)*2097152,l+4;end;end;end;
l,m=i*16843009,H+T;
local R=m-T%4;
for T=H,R-1,4 do 
S(g,T,(K(o(g,T),l)));end;
for l=R,m-1,1 do 
h(g,l,(K(D(g,l),i)));end;
Y[q]=224;
y[q]=29;end;end;end;end;end;else 
if Z<82 then 
if Z<76 then 
if Z<73 then 
local g=q;
if Z<71 then 
d[K(Y[g],(b(K(g,y[g],F),127)))]=d[j];
j=j-1;else 
if Z~=72 then 
C=d[j];
j-=1;
d[j]=d[j]-C;else 
F=d[j];
j-=1;
q=K(Y[g],74)+1;
break;end;end;else 
if Z>=74 then 
if Z==75 then 
C,a,z=j-1,j-2,d[j];
r,s=d[C],d[a];
d[j]=r;
d[C]=s;
d[a]=z;else 
local g,i=d[j];
repeat 
local l=g%4294967296;
if l~=l then 
i=0;
break;end;
i=l-l%1;until true;
d[j]=i;end;else 
if d[j]then 
q=K(Y[q],(b(K(y[q],F,5),127)));else 
j=j-1;end;end;end;else 
if Z<79 then 
if Z<77 then 
C=d[j];
j-=1;
local g,i=b(d[j],4294967295),b(C,4294967295);
local l,m,T,H=b(g,65535),I(g,16),b(i,65535),I(i,16);
g=b(l*T+f(b(l*H+m*T,65535),16),4294967295);
l=nil;
repeat 
m=g%4294967296;
if m~=m then 
l=0;
break;end;
l=m-m%1;until true;
d[j]=l;else 
if Z==78 then 
j+=1;
d[j]=u;else 
j+=1;
d[j]=K(Y[q],(b(y[q],127)));end;end;else 
if Z<80 then 
C=K(Y[q],(b(K(U,(b(I(U,29),7))),536870911)));
local g,i,l=I(C,8),b(C,255),p[6];
local m=K(l[g],143377016);
l[g]=m;
l,g=p[5],m+1;
m=D(l,g);
local T,H;
if m<128 then 
T,H=m,g+1;else 
local R=D(l,g+1);
if R<128 then 
T,H=(m-128)*128+R,g+2;else 
local Qe=D(l,g+2);
if Qe<128 then 
T,H=(m-128)*16384+(R-128)+Qe*128,g+3;else 
local ee=D(l,g+3);
T,H=(m-128)*2097152+(R-128)*128+(Qe-128)*16384+ee%128+(ee-ee%128)*2097152,g+4;end;end;end;
m,g=i*16843009,H+T;
local R=g-T%4;
for T=H,R-1,4 do 
S(l,T,(K(o(l,T),m)));end;
for m=R,g-1,1 do 
h(l,m,(K(D(l,m),i)));end;
Y[q]=82;
y[q]=29;else 
if Z~=81 then 
d[j]=not d[j];else 
j+=1;
d[j]=J[K(Y[q],(b(K(39,F),127)))];end;end;end;end;else 
if Z<88 then 
if Z>=85 then 
if Z<86 then 
j+=1;
d[j]=N;else 
if Z==87 then 
j+=1;
d[j]=Q[K(Y[q],(b(q,127)))];else 
C=d[j];
j-=1;
d[j]=d[j]^C;end;end;else 
if Z>=83 then 
if Z==84 then 
j+=1;
d[j]=p;else 
C=d[j];
j-=1;
d[j]=d[j]>=C;end;else 
j+=1;
d[j]=Y;end;end;else 
if Z>=91 then 
if Z<92 then 
C=Y[q];
local g,i,l=I(C,8),b(C,255),p[6];
local m=K(l[g],143377016);
l[g]=m;
l,g=p[5],m+1;
m=D(l,g);
local T,H;
if m<128 then 
T,H=m,g+1;else 
local R=D(l,g+1);
if R<128 then 
T,H=(m-128)*128+R,g+2;else 
local Qe=D(l,g+2);
if Qe<128 then 
T,H=(m-128)*16384+(R-128)+Qe*128,g+3;else 
local ee=D(l,g+3);
T,H=(m-128)*2097152+(R-128)*128+(Qe-128)*16384+ee%128+(ee-ee%128)*2097152,g+4;end;end;end;
g,m=i*16843009,H+T;
local R=m-T%4;
for T=H,R-1,4 do 
S(l,T,(K(o(l,T),g)));end;
for g=R,m-1,1 do 
h(l,g,(K(D(l,g),i)));end;
Y[q]=233;
y[q]=29;else 
if Z==93 then 
j+=1;
d[j]=nil;else 
if not d[j]then 
j-=1;
q=K(Y[q],74);else end;end;end;else 
if Z<89 then 
d[j]=#d[j];else 
if Z==90 then 
C,a,z=d[j],d[j-1],d[j-2];
j-=3;
z[a]=C;else 
j+=1;
d[j]=y;end;end;end;end;end;end;else 
if Z<23 then 
if Z>=11 then 
if Z<17 then 
if Z>=14 then 
if Z>=15 then 
if Z==16 then 
C,a=d[j],d[j-1];
d[j-1]=a[C];
d[j]=a;else 
j+=1;
d[j]=U;end;else 
C=d[j];
q,j=C,j-1;end;else 
if Z<12 then 
j=j-1;else 
if Z==13 then 
C,a=Y[q],K(u,b(I(u,14),262143),(b(I(u,28),15)));
z=C<16384 and 7 or(C<2097152 and 14 or 21);
r,s=I(C,z),b(C,f(1,z)-1);
y[q]=K(r,33,(b(I(a,7),127)));
Y[q]=K(s,93,(b(a,127)));
q=q-1;else 
k=d[j];
j=j-1;end;end;end;else 
if Z<20 then 
if Z<18 then 
C=d[j];
j+=1;
d[j]=C;else 
if Z==19 then 
j+=1;
d[j]=d[K(Y[q],(b(K(q,91),127)))];else 
C=d[j];
j-=1;
d[j]=d[j]>C;end;end;else 
if Z<21 then 
C,a,z=Y[q]+1,K(Y[q+1],(b(K(U,(b(I(U,29),7))),536870911))),Y[q+2];
for g=1,z,1 do 
a=b(K(a,(f(a,13))),536870911);
a=K(a,(I(a,13)));
a=b(K(a,(f(a,14))),536870911);
Y[C]=K(Y[C],(b(I(a,0),127)));
y[C]=K(y[C],(b(I(a,7),127)));
C=C+1;end;
y[q]=29;
q=q+2;else 
if Z==22 then 
C,a=K(Y[q],(b(K(q,y[q],105),127))),d[j];
j-=1;
z,r=j-C,d[j];
s=r.n;
v=C-1+s;
r.n=v;
n(r,1,s,C,r);
n(d,z+1,j-1,1,r);
w,j=G(d[z](P(r,1,r.n))),z+a-1;
n(w,1,a,z,d);else 
j+=1;
d[j]=d[Y[q]];
q+=1;
j+=1;
d[j]=d[Y[q]];
q+=1;
j+=1;
d[j]=d[Y[q]];end;end;end;end;else 
if Z<5 then 
if Z>=2 then 
if Z<3 then 
j+=1;
d[j]=Y[q];else 
if Z~=4 then 
d[Y[q]]=d[j];
j-=1;
q+=1;
d[Y[q]]=d[j];
j-=1;
q+=1;
d[Y[q]]=d[j];
j-=1;
q+=1;
d[Y[q]]=d[j];
j=j-1;else 
C=d[j];
j-=1;
d[j]=d[j]*C;end;end;else 
if Z~=1 then 
u=d[j];
j=j-1;else 
C,a=K(Y[q],78),d[j];
j-=1;
z=j-C;
d[z]=G(d[z](P(d,z+1,j)));
j=z;end;end;else 
if Z>=8 then 
if Z<9 then 
U=d[j];
j=j-1;else 
if Z~=10 then 
C,a=J[K(Y[q],(b(y[q],127)))],d[j];
j-=1;
C[5][C[4]]=a;else 
j+=1;
d[j]=k;end;end;else 
if Z>=6 then 
if Z~=7 then 
C=d[j];
j-=1;
d[j]=d[j]..C;else 
C=d[j];
j-=1;
d[j]=d[j]+C;end;else 
C={...};
n(C,1,K(Y[q],(b(K(99,F,y[q]),127))),1,d);end;end;end;end;else 
if Z>=35 then 
if Z>=41 then 
if Z>=44 then 
if Z<45 then 
d[j-K(Y[q],77)]=d[j];
j-=1;else 
if Z~=46 then 
j+=1;
d[j]={};else 
j+=1;
d[j]=M;end;end;else 
if Z>=42 then 
if Z==43 then 
C,a,z=d[j],d[j-1],d[j-2];
j-=2;
z[a]=C;else 
q,j=if not d[j]then K(Y[q],(b(K(F,y[q],54),127)))else q,j-1;end;else 
C=d[j];
j-=1;
d[j]=d[j]~=C;end;end;else 
if Z>=38 then 
if Z<39 then 
C,a=Y[q],K(u,b(I(u,14),262143),(b(I(u,28),15)));
z=C<2097152 and 7 or 14;
r,s=b(C,f(1,z)-1),I(C,z);
y[q]=K(s,86,(b(I(a,7),127)));
Y[q]=K(r,82,(b(a,127)));
q=q-1;else 
if Z==40 then 
j+=1;
d[j]=d[Y[q]];
q+=1;
j+=1;
d[j]=d[Y[q]];else 
C,a,z=Y[q]+1,Y[q+1],Y[q+2];
for g=1,z,1 do 
a=b(K(a,(f(a,13))),536870911);
a=K(a,(I(a,13)));
a=b(K(a,(f(a,14))),536870911);
Y[C]=K(Y[C],(b(I(a,0),127)));
y[C]=K(y[C],(b(I(a,7),127)));
C=C+1;end;
y[q]=29;
q=q+2;end;end;else 
if Z>=36 then 
if Z~=37 then 
C=J[K(Y[q],(b(K(67,F,y[q]),127)))];
j+=1;
d[j]=C[5][C[4]];else 
q=if d[j]then K(Y[q],(b(K(21,F),127)))else q;end;else 
if X then 
for g in A,X,nil do 
if X then 
local i=X[g];
if i then 
i[5]=i;
i[6]=d[g];
i[4]=6;
X[g]=nil;end;end;end;end;
if c then 
for g,i in A,c,nil do 
local l=i[6];
if c then 
local i=c[g];
if i then 
local m,T=g+l,t(l);
n(d,g,m-1,1,T);
i[5]=T;
i[4]=1;
c[g]=nil;end;end;end;end;
C=K(Y[q],(b(y[q],127)));
if C==0 then 
return;end;
return P(d,j-C+1,j);end;end;end;else 
if Z>=29 then 
if Z>=32 then 
if Z<33 then 
C=d[j];
j-=1;
d[j]=d[j]==C;else 
if Z==34 then 
C=K(Y[q],(b(K(y[q],74,F),127)));
a={n=C};
n(d,j-C+1,j,1,a);
j=j-C+1;
d[j]=a;else 
C,j=d[j],x+1;
d[x+1]=C;end;end;else 
if Z<30 then else 
if Z==31 then 
C=d[j];
j-=1;
d[j]=d[j]<C;else 
C,a=K(Y[q],104),d[j];
j-=1;
z,r=j-C,d[j];
s=r.n;
v=C-1+s;
r.n=v;
n(r,1,s,C,r);
n(d,z+1,j-1,1,r);
d[z]=G(d[z](P(r,1,r.n)));
j=z;end;end;end;else 
if Z>=26 then 
if Z>=27 then 
if Z==28 then 
q=K(Y[q],(b(K(F,39,y[q]),127)));else 
C=d[j];
j-=1;
d[j]=d[j][C];end;else 
j+=1;
d[j]=d[Y[q]];
q+=1;
j+=1;
d[j]=d[Y[q]];
q+=1;
j+=1;
d[j]=d[Y[q]];
q+=1;
j+=1;
d[j]=d[Y[q]];end;else 
if Z<24 then 
C=d[j];
j-=1;
d[j]=d[j]/C;else 
if Z~=25 then 
j=j-K(Y[q],(b(y[q],127)));else 
d[Y[q]]=d[j];
j-=1;
q+=1;
d[Y[q]]=d[j];
j=j-1;end;end;end;end;end;end;end;
q=q+1;end;else 
j,q,F=x,W,_;end;
if F==61 then 
while true do 
local _=y[q];
if _>=44 then 
if _>=66 then 
if _>=77 then 
if _>=82 then 
if _>=85 then 
if _>=86 then 
if _~=87 then 
k=d[j];
j=j-1;else 
C,a=d[j],d[j-1];
d[j-1]=a[C];
d[j]=a;end;else 
C=d[j];
j-=1;
d[j]=d[j]<=C;end;else 
if _>=83 then 
if _~=84 then 
if d[j]then 
q=K(Y[q],(b(K(F,57),127)));else 
j=j-1;end;else 
j+=1;
d[j]=V[O[q]];end;else 
C=d[j];
j-=1;
d[j]=d[j][C];end;end;else 
if _>=79 then 
if _>=80 then 
if _~=81 then 
q=if d[j]then K(Y[q],(b(K(y[q],F),127)))else q;else 
if not d[j]then 
q=K(Y[q],(b(K(y[q],F),127)));else 
j=j-1;end;end;else 
local W,Z=d[j];
repeat 
local g=W%4294967296;
if g~=g then 
Z=0;
break;end;
Z=g-g%1;until true;
d[j]=Z;end;else 
if _~=78 then 
C=d[j];
j-=1;
d[j]=d[j]+C;else 
d[Y[q]]=d[j];
j-=1;
q+=1;
d[Y[q]]=d[j];
j-=1;
q+=1;
d[Y[q]]=d[j];
j-=1;
q+=1;
d[Y[q]]=d[j];
j=j-1;end;end;end;else 
if _<71 then 
if _>=68 then 
if _>=69 then 
if _~=70 then else 
j+=1;
d[j]=Y;end;else 
C=d[j];
j-=1;
d[j]=d[j]~=C;end;else 
if _~=67 then 
N=d[j];
j=j-1;else 
C,a=Y[q],K(M,b(I(M,14),262143),(b(I(M,28),15)));
z=C<16384 and 7 or(C<2097152 and 14 or 21);
r,s=I(C,z),b(C,f(1,z)-1);
Y[q]=K(s,11,(b(a,127)));
y[q]=K(r,110,(b(I(a,7),127)));
q=q-1;end;end;else 
if _>=74 then 
if _<75 then 
C,a=K(Y[q],(b(K(y[q],37),127))),d[j];
j-=1;
z=j-C;
d[z]=G(d[z](P(d,z+1,j)));
j=z;else 
if _==76 then 
j+=1;
d[j]=d[K(Y[q],(b(K(43,y[q],F),127)))];else 
C,a,z=Y[q]+1,K(Y[q+1],(b(K(M,(b(I(M,29),7))),536870911))),Y[q+2];
for W=1,z,1 do 
a=b(K(a,(f(a,13))),536870911);
a=K(a,(I(a,13)));
a=b(K(a,(f(a,14))),536870911);
Y[C]=K(Y[C],(b(I(a,0),127)));
y[C]=K(y[C],(b(I(a,7),127)));
C=C+1;end;
y[q]=69;
q=q+2;end;end;else 
if _<72 then 
C=d[j-K(Y[q],(b(K(y[q],29),127)))];
j+=1;
d[j]=C;else 
if _~=73 then 
d[j-K(Y[q],(b(q,127)))]=d[j];
j=j-1;else 
C=d[j];
j-=1;
d[j]=d[j]//C;end;end;end;end;end;else 
if _>=55 then 
local W=q;
if _>=60 then 
if _>=63 then 
if _>=64 then 
if _==65 then 
d[K(Y[W],32)]=d[j];
j=j-1;else 
local Z;
local g=O[W];
if g then 
local i=#g/3;
if i>0 then 
Z={};
local l,m=X,c;
for T=1,i,1 do 
local i=(T-1)*3;
local H,R=g[i+2],g[i+1];
if H==1 then 
l=if not l then{}else l;
local Qe=l[R];
if not Qe then 
Qe={[4]=R,[5]=d};
l[R]=Qe;else end;
Z[T]=Qe;else 
if H==3 then 
Z[T]=d[R];else 
if H==2 then 
Z[T]=J[R];else 
if H==0 then 
m=if not m then{}else m;
local H=m[R];
if not H then 
H={[6]=g[i+3],[5]=d,[4]=R};
m[R]=H;else end;
Z[T]=H;else end;end;end;end;end;
X,c=l,m;else end;else end;
a=d[j](Z);
B(a,V);
d[j]=a;
C=Z;end;else 
C=d[j];
j-=1;
d[j]=d[j]<C;end;else 
if _<61 then 
C,a,z=d[j],d[j-1],d[j-2];
j-=3;
z[a]=C;else 
if _~=62 then 
j+=1;
d[j]=u;else 
j+=1;
d[j]=y;end;end;end;else 
if _<57 then 
if _~=56 then 
C=d[j];
j-=1;
d[j]=d[j]==C;else 
j+=1;
d[j]=J[K(Y[W],(b(K(F,y[W],82),127)))];end;else 
if _<58 then 
j+=1;
d[j]=nil;else 
if _~=59 then 
F=d[j];
j-=1;
q=K(Y[W],(b(K(y[W],16),127)))+1;
break;else 
C=d[j];
j-=1;
d[j]=d[j]/C;end;end;end;end;else 
if _<49 then 
if _>=46 then 
if _<47 then 
j+=1;
d[j]={};else 
if _~=48 then 
q,j=if not d[j]then K(Y[q],(b(K(95,y[q],F),127)))else q,j-1;else 
C=d[j];
j-=1;
d[j]=d[j]>C;end;end;else 
if _~=45 then 
j+=1;
d[j]=k;else 
C,a,z,r,s=d[j],d[j-1],d[j-2],d[j-3],L(E);
s(Q,r,z,a);
a,z=nil,nil;
local W;
W,s=s,j-3;
d[s]=W;
d[s+1]=z;
d[s+2]=a;
d[s+3]=C;
d[s+4]=K(Y[q],(b(K(38,y[q]),127)));
j,r=s+4,s;end;end;else 
if _>=52 then 
if _>=53 then 
if _==54 then 
j+=1;
d[j]=Y[q];else 
C,a=K(Y[q],(b(K(31,F),127))),d[j];
j-=1;
z,r=j-C,d[j];
s=r.n;
v=C-1+s;
r.n=v;
n(r,1,s,C,r);
n(d,z+1,j-1,1,r);
w,j=G(d[z](P(r,1,r.n))),z+a-1;
n(w,1,a,z,d);end;else 
q=K(Y[q],(b(K(y[q],19),127)));end;else 
if _>=50 then 
if _~=51 then 
C,a,z=d[j],d[j-1],d[j-2];
j-=2;
z[a]=C;else 
j+=1;
d[j]=d;end;else 
if d[j]then 
j-=1;
q=K(Y[q],(b(K(y[q],F),127)));else end;end;end;end;end;end;else 
if _<22 then 
if _>=11 then 
if _>=16 then 
if _>=19 then 
if _>=20 then 
if _~=21 then 
C,a=J[K(Y[q],48)],d[j];
j-=1;
C[5][C[4]]=a;else 
C=d[j];
j-=1;
d[j]=d[j]*C;end;else 
local W=K(Y[q],(b(K(y[q],58),127)));
if X then 
local Z=X[W];
if Z then 
Z[5]=Z;
Z[6]=d[W];
Z[4]=6;
X[W]=nil;end;end;end;else 
if _<17 then 
C,a,z,r,s=d[j-4],d[j-3],d[j-2],d[j-1],d[j];
local W,Z=C();
if W then 
d[j-2]=z;
if s~=0 then 
for g=1,r,1 do 
d[s+g-1]=Z[g];end;else 
n(Z,1,r,j+1,d);
j+=r;end;
q=K(Y[q],(b(K(80,y[q]),127)));else 
j=j-5;end;
v,w=W,Z;else 
if _==18 then 
j+=1;
d[j]=U;else 
d[j]=not d[j];end;end;end;else 
if _>=13 then 
if _>=14 then 
if _==15 then 
M=d[j];
j=j-1;else 
C,a,z=j-1,j-2,d[j];
r,s=d[C],d[a];
d[j]=r;
d[C]=s;
d[a]=z;end;else 
j+=1;
d[j]=N;end;else 
if _~=12 then 
C=K(Y[q],(b(K(127,q,F),127)));
a=j-C+1;
n(d,a,j,x+1,d);
j=x+C;else 
C,a=K(M,b(I(M,14),262143),(b(I(M,28),15))),Y[q];
z=a<2097152 and 7 or 14;
r,s=I(a,z),b(a,f(1,z)-1);
y[q]=K(r,44,(b(I(C,7),127)));
Y[q]=K(s,41,(b(C,127)));
q=q-1;end;end;end;else 
if _<5 then 
if _>=2 then 
if _>=3 then 
if _~=4 then 
C=d[j];
j-=1;
d[j]=d[j]^C;else 
u=d[j];
j=j-1;end;else 
C=Y[q];
local W,Z,g=I(C,8),b(C,255),p[6];
local i=K(g[W],143377016);
g[W]=i;
W,g=p[5],i+1;
i=D(W,g);
local l,m;
if i<128 then 
l,m=i,g+1;else 
local T=D(W,g+1);
if T<128 then 
l,m=(i-128)*128+T,g+2;else 
local H=D(W,g+2);
if H<128 then 
l,m=(i-128)*16384+(T-128)+H*128,g+3;else 
local R=D(W,g+3);
l,m=(i-128)*2097152+(T-128)*128+(H-128)*16384+R%128+(R-R%128)*2097152,g+4;end;end;end;
g,i=Z*16843009,m+l;
local T=i-l%4;
for l=m,T-1,4 do 
S(W,l,(K(o(W,l),g)));end;
for g=T,i-1,1 do 
h(W,g,(K(D(W,g),Z)));end;
Y[q]=54;
y[q]=69;end;else 
if _~=1 then 
j+=1;
d[j]=O[q];else 
if X then 
for O in A,X,nil do 
if X then 
local W=X[O];
if W then 
W[5]=W;
W[6]=d[O];
W[4]=6;
X[O]=nil;end;end;end;end;
if c then 
for O,W in A,c,nil do 
local Z=W[6];
if c then 
local W=c[O];
if W then 
local g,i=O+Z,t(Z);
n(d,O,g-1,1,i);
W[5]=i;
W[4]=1;
c[O]=nil;end;end;end;end;
C=K(Y[q],(b(K(y[q],q,95),127)));
if C==0 then 
return;end;
return P(d,j-C+1,j);end;end;else 
if _>=8 then 
if _>=9 then 
if _==10 then 
C=d[j];
j-=1;
d[j]=d[j]-C;else 
j+=1;
d[j]=p;end;else 
C=d[j];
j-=1;
d[j]=d[j]%C;end;else 
if _<6 then 
j=j-K(Y[q],121);else 
if _==7 then 
C=d[j];
q,j=C,j-1;else 
C,a,z=Y[q]+1,K(Y[q+1],(b(K(U,(b(I(U,29),7))),536870911))),Y[q+2];
for O=1,z,1 do 
a=b(K(a,(f(a,13))),536870911);
a=K(a,(I(a,13)));
a=b(K(a,(f(a,14))),536870911);
Y[C]=K(Y[C],(b(I(a,0),127)));
y[C]=K(y[C],(b(I(a,7),127)));
C=C+1;end;
y[q]=69;
q=q+2;end;end;end;end;end;else 
if _>=33 then 
if _<38 then 
if _>=35 then 
if _>=36 then 
if _==37 then 
C=d[j];
j-=1;
d[j]=d[j]..C;else 
C,j=d[j],x+1;
d[x+1]=C;end;else 
C=d[j];
j-=1;
local O,W=b(d[j],4294967295),b(C,4294967295);
local Z,g,i,l=b(O,65535),I(O,16),b(W,65535),I(W,16);
W=b(Z*i+f(b(Z*l+g*i,65535),16),4294967295);
i=nil;
repeat 
l=W%4294967296;
if l~=l then 
i=0;
break;end;
i=l-l%1;until true;
d[j]=i;end;else 
if _==34 then 
C=K(Y[q],(b(y[q],127)));
a={n=C};
n(d,j-C+1,j,1,a);
j=j-C+1;
d[j]=a;else 
C=J[K(Y[q],(b(K(66,F),127)))];
j+=1;
d[j]=C[5][C[4]];end;end;else 
if _>=41 then 
if _>=42 then 
if _~=43 then 
C=j-1;
a=d[C];
d[C]=d[j];
d[j]=a;else 
q,j=if d[j]then K(Y[q],(b(K(y[q],F,36),127)))else q,j-1;end;else 
C,a,z=Y[q]+1,Y[q+1],Y[q+2];
for O=1,z,1 do 
a=b(K(a,(f(a,13))),536870911);
a=K(a,(I(a,13)));
a=b(K(a,(f(a,14))),536870911);
Y[C]=K(Y[C],(b(I(a,0),127)));
y[C]=K(y[C],(b(I(a,7),127)));
C=C+1;end;
y[q]=69;
q=q+2;end;else 
if _>=39 then 
if _~=40 then 
j+=1;
d[j]=Q[K(Y[q],(b(K(114,F,q),127)))];else 
if not d[j]then 
j-=1;
q=K(Y[q],(b(K(F,20),127)));else end;end;else 
C,a=K(Y[q],(b(K(81,q),127))),d[j];
j-=1;
z=j-C;
r,j=G(d[z](P(d,z+1,j))),z+a-1;
n(r,1,a,z,d);end;end;end;else 
if _>=27 then 
if _>=30 then 
if _>=31 then 
if _==32 then 
j=j-1;else 
U=d[j];
j=j-1;end;else 
C=d[j];
j-=1;
d[j]=d[j]>=C;end;else 
if _<28 then 
j+=1;
d[j]=M;else 
if _==29 then 
C,a,z=Y[q]+1,K(Y[q+1],(b(K(u,(b(I(u,29),7))),536870911))),Y[q+2];
for O=1,z,1 do 
a=b(K(a,(f(a,13))),536870911);
a=K(a,(I(a,13)));
a=b(K(a,(f(a,14))),536870911);
Y[C]=K(Y[C],(b(I(a,0),127)));
y[C]=K(y[C],(b(I(a,7),127)));
C=C+1;end;
y[q]=69;
q=q+2;else 
q=if not d[j]then K(Y[q],(b(K(19,F),127)))else q;end;end;end;else 
if _>=24 then 
if _<25 then 
d[j]=#d[j];else 
if _~=26 then 
C=j-K(Y[q],(b(F,127)));
a=d[C];
d[C]=d[j];
d[j]=a;else 
C=d[j];
j+=1;
d[j]=C;end;end;else 
if _==23 then 
j+=1;
d[j]=K(Y[q],(b(K(y[q],26,F),127)));else 
C,a=K(Y[q],(b(K(54,q),127))),d[j];
j-=1;
z=d[j-a];
n(d,j-a+1,j,C+1,z);
j=j-a;end;end;end;end;end;end;
q=q+1;end;else end;
if F==94 then 
while true do 
local _=Y[q];
if _<39 then 
if _>=19 then 
if _<29 then 
if _>=24 then 
if _<26 then 
if _~=25 then 
q=if not d[j]then K(y[q],(b(K(F,Y[q],109),127)))else q;else 
C=d[j];
j-=1;
d[j]=d[j]..C;end;else 
if _<27 then 
q=K(y[q],10);else 
if _==28 then 
q=if d[j]then K(y[q],(b(K(F,Y[q]),127)))else q;else 
q,j=if d[j]then K(y[q],(b(K(Y[q],102),127)))else q,j-1;end;end;end;else 
local O=q;
if _<21 then 
if _==20 then 
j+=1;
d[j]=k;else 
M=d[j];
j=j-1;end;else 
if _<22 then 
j=j-1;else 
if _==23 then 
C=K(y[O],(b(F,127)));
a=j-C+1;
n(d,a,j,x+1,d);
j=x+C;else 
F=d[j];
j-=1;
q=K(y[O],(b(K(Y[O],117),127)))+1;
break;end;end;end;end;else 
if _>=34 then 
if _<36 then 
if _==35 then 
j+=1;
d[j]=U;else 
j+=1;
d[j]=N;end;else 
if _>=37 then 
if _==38 then 
j+=1;
d[j]=nil;else 
if not d[j]then 
j-=1;
q=K(y[q],(b(K(F,4,Y[q]),127)));else end;end;else 
C=d[j];
j-=1;
d[j]=d[j]/C;end;end;else 
if _>=31 then 
if _<32 then 
C=d[j];
j-=1;
d[j]=d[j]//C;else 
if _~=33 then 
j+=1;
d[j]=Y;else 
j+=1;
d[j]=u;end;end;else 
if _==30 then 
local O;
local W=e[q];
if W then 
local Z=#W/3;
if Z>0 then 
O={};
local g,i=X,c;
for l=1,Z,1 do 
local Z=(l-1)*3;
local m,T=W[Z+2],W[Z+1];
if m==1 then 
g=if not g then{}else g;
local H=g[T];
if not H then 
H={[4]=T,[5]=d};
g[T]=H;else end;
O[l]=H;else 
if m==3 then 
O[l]=d[T];else 
if m==2 then 
O[l]=J[T];else 
if m==0 then 
i=if not i then{}else i;
local m=i[T];
if not m then 
m={[6]=W[Z+3],[5]=d,[4]=T};
i[T]=m;else end;
O[l]=m;else end;end;end;end;end;
X,c=g,i;else end;else end;
a=d[j](O);
B(a,V);
d[j]=a;
C=O;else 
j+=1;
d[j]=V[e[q]];end;end;end;end;else 
if _<9 then 
if _>=4 then 
if _>=6 then 
if _<7 then 
j+=1;
d[j]=M;else 
if _==8 then 
C,a,z=y[q]+1,K(y[q+1],(b(K(u,(b(I(u,29),7))),536870911))),y[q+2];
for O=1,z,1 do 
a=b(K(a,(f(a,13))),536870911);
a=K(a,(I(a,13)));
a=b(K(a,(f(a,14))),536870911);
y[C]=K(y[C],(b(I(a,0),127)));
Y[C]=K(Y[C],(b(I(a,7),127)));
C=C+1;end;
Y[q]=67;
q=q+2;else 
d[j]=#d[j];end;end;else 
if _~=5 then 
C=d[j];
j-=1;
local O,W=b(d[j],4294967295),b(C,4294967295);
local Z,g,i,l=b(O,65535),I(O,16),b(W,65535),I(W,16);
W=b(Z*i+f(b(Z*l+g*i,65535),16),4294967295);
l=nil;
repeat 
O=W%4294967296;
if O~=O then 
l=0;
break;end;
l=O-O%1;until true;
d[j]=l;else 
j+=1;
d[j]=K(y[q],(b(K(Y[q],F),127)));end;end;else 
if _>=2 then 
if _~=3 then 
k=d[j];
j=j-1;else 
d[K(y[q],75)]=d[j];
j=j-1;end;else 
if _~=1 then 
C,a,z=j-1,j-2,d[j];
r,s=d[C],d[a];
d[j]=r;
d[C]=s;
d[a]=z;else 
C,a=K(y[q],(b(K(85,Y[q]),127))),d[j];
j-=1;
z=j-C;
r,j=G(d[z](P(d,z+1,j))),z+a-1;
n(r,1,a,z,d);end;end;end;else 
if _>=14 then 
if _>=16 then 
if _<17 then 
C,a=K(M,b(I(M,14),262143),(b(I(M,28),15))),y[q];
z=a<16384 and 7 or(a<2097152 and 14 or 21);
r,s=b(a,f(1,z)-1),I(a,z);
y[q]=K(r,106,(b(C,127)));
Y[q]=K(s,106,(b(I(C,7),127)));
q=q-1;else 
if _==18 then 
C=d[j];
j-=1;
d[j]=d[j]~=C;else 
if d[j]then 
j-=1;
q=K(y[q],87);else end;end;end;else 
if _==15 then 
if d[j]then 
q=K(y[q],115);else 
j=j-1;end;else 
C,a=K(y[q],(b(K(q,F,Y[q]),127))),d[j];
j-=1;
z=j-C;
d[z]=G(d[z](P(d,z+1,j)));
j=z;end;end;else 
if _>=11 then 
if _<12 then 
u=d[j];
j=j-1;else 
if _~=13 then 
C=y[q];
local O,W,Z=I(C,8),b(C,255),p[6];
local g=K(Z[O],143377016);
Z[O]=g;
Z,O=p[5],g+1;
g=D(Z,O);
local i,l;
if g<128 then 
i,l=g,O+1;else 
local m=D(Z,O+1);
if m<128 then 
i,l=(g-128)*128+m,O+2;else 
local T=D(Z,O+2);
if T<128 then 
i,l=(g-128)*16384+(m-128)+T*128,O+3;else 
local H=D(Z,O+3);
i,l=(g-128)*2097152+(m-128)*128+(T-128)*16384+H%128+(H-H%128)*2097152,O+4;end;end;end;
O,g=W*16843009,l+i;
local m=g-i%4;
for i=l,m-1,4 do 
S(Z,i,(K(o(Z,i),O)));end;
for O=m,g-1,1 do 
h(Z,O,(K(D(Z,O),W)));end;
y[q]=43;
Y[q]=67;else 
C=d[j];
j-=1;
d[j]=d[j]<C;end;end;else 
if _==10 then 
C,a=K(y[q],(b(F,127))),d[j];
j-=1;
z=d[j-a];
n(d,j-a+1,j,C+1,z);
j=j-a;else 
d[j]=not d[j];end;end;end;end;end;else 
if _<59 then 
if _<49 then 
if _>=44 then 
if _<46 then 
if _==45 then 
j+=1;
d[j]={};else 
j+=1;
d[j]=Q[K(y[q],(b(K(q,Y[q]),127)))];end;else 
if _>=47 then 
if _==48 then 
C,a,z=y[q]+1,y[q+1],y[q+2];
for O=1,z,1 do 
a=b(K(a,(f(a,13))),536870911);
a=K(a,(I(a,13)));
a=b(K(a,(f(a,14))),536870911);
y[C]=K(y[C],(b(I(a,0),127)));
Y[C]=K(Y[C],(b(I(a,7),127)));
C=C+1;end;
Y[q]=67;
q=q+2;else 
local O=K(y[q],(b(K(q,Y[q]),127)));
if X then 
local W=X[O];
if W then 
W[5]=W;
W[6]=d[O];
W[4]=6;
X[O]=nil;end;end;end;else 
C,a,z=y[q]+1,K(y[q+1],(b(K(U,(b(I(U,29),7))),536870911))),y[q+2];
for O=1,z,1 do 
a=b(K(a,(f(a,13))),536870911);
a=K(a,(I(a,13)));
a=b(K(a,(f(a,14))),536870911);
y[C]=K(y[C],(b(I(a,0),127)));
Y[C]=K(Y[C],(b(I(a,7),127)));
C=C+1;end;
Y[q]=67;
q=q+2;end;end;else 
if _>=41 then 
if _>=42 then 
if _~=43 then 
C,a,z=d[j],d[j-1],d[j-2];
j-=3;
z[a]=C;else 
C=d[j];
j-=1;
d[j]=d[j]>=C;end;else 
C=d[j];
j-=1;
d[j]=d[j][C];end;else 
if _==40 then 
C=d[j];
q,j=C,j-1;else 
j+=1;
d[j]=d[K(y[q],(b(Y[q],127)))];end;end;end;else 
if _>=54 then 
if _<56 then 
if _==55 then 
C=d[j];
j-=1;
d[j]=d[j]==C;else 
C,a,z=y[q]+1,K(y[q+1],(b(K(M,(b(I(M,29),7))),536870911))),y[q+2];
for O=1,z,1 do 
a=b(K(a,(f(a,13))),536870911);
a=K(a,(I(a,13)));
a=b(K(a,(f(a,14))),536870911);
y[C]=K(y[C],(b(I(a,0),127)));
Y[C]=K(Y[C],(b(I(a,7),127)));
C=C+1;end;
Y[q]=67;
q=q+2;end;else 
if _<57 then 
C=d[j];
j-=1;
d[j]=d[j]>C;else 
if _==58 then 
C=J[K(y[q],(b(q,127)))];
j+=1;
d[j]=C[5][C[4]];else 
local O,W=d[j];
repeat 
local Z=O%4294967296;
if Z~=Z then 
W=0;
break;end;
W=Z-Z%1;until true;
d[j]=W;end;end;end;else 
if _>=51 then 
if _>=52 then 
if _~=53 then 
C=j-1;
a=d[C];
d[C]=d[j];
d[j]=a;else 
N=d[j];
j=j-1;end;else 
C,a=d[j],d[j-1];
d[j-1]=a[C];
d[j]=a;end;else 
if _==50 then 
C=d[j];
j+=1;
d[j]=C;else 
j+=1;
d[j]=y[q];end;end;end;end;else 
if _<69 then 
if _>=64 then 
if _>=66 then 
if _>=67 then 
if _~=68 then else 
C,a=K(M,b(I(M,14),262143),(b(I(M,28),15))),y[q];
z=a<2097152 and 7 or 14;
r,s=I(a,z),b(a,f(1,z)-1);
y[q]=K(s,62,(b(C,127)));
Y[q]=K(r,115,(b(I(C,7),127)));
q=q-1;end;else 
C=d[j];
j-=1;
d[j]=d[j]%C;end;else 
if _==65 then 
C=d[j];
j-=1;
d[j]=d[j]-C;else 
q,j=if not d[j]then K(y[q],(b(F,127)))else q,j-1;end;end;else 
if _>=61 then 
if _<62 then 
C=d[j];
j-=1;
d[j]=d[j]*C;else 
if _~=63 then 
C,j=d[j],x+1;
d[x+1]=C;else 
C=d[j];
j-=1;
d[j]=d[j]<=C;end;end;else 
if _==60 then 
j+=1;
d[j]=p;else 
j+=1;
d[j]=e[q];end;end;end;else 
if _>=74 then 
if _<76 then 
if _==75 then 
U=d[j];
j=j-1;else 
j=j-K(y[q],(b(K(Y[q],45,F),127)));end;else 
if _>=77 then 
if _==78 then 
d[j-K(y[q],(b(K(126,Y[q]),127)))]=d[j];
j=j-1;else 
C=d[j-K(y[q],(b(K(F,q),127)))];
j+=1;
d[j]=C;end;else 
C,a=K(y[q],112),d[j];
j-=1;
z,r=j-C,d[j];
s=r.n;
v=C-1+s;
r.n=v;
n(r,1,s,C,r);
n(d,z+1,j-1,1,r);
w,j=G(d[z](P(r,1,r.n))),z+a-1;
n(w,1,a,z,d);end;end;else 
if _<71 then 
if _~=70 then 
if not d[j]then 
q=K(y[q],(b(F,127)));else 
j=j-1;end;else 
j+=1;
d[j]=J[K(y[q],(b(q,127)))];end;else 
if _<72 then 
j+=1;
d[j]=y;else 
if _~=73 then 
if X then 
for _ in A,X,nil do 
if X then 
local O=X[_];
if O then 
O[5]=O;
O[6]=d[_];
O[4]=6;
X[_]=nil;end;end;end;end;
if c then 
for _,O in A,c,nil do 
local W=O[6];
if c then 
local O=c[_];
if O then 
local Z=t(W);
n(d,_,_+W-1,1,Z);
O[5]=Z;
O[4]=1;
c[_]=nil;end;end;end;end;
C=K(y[q],(b(q,127)));
if C==0 then 
return;end;
return P(d,j-C+1,j);else 
C=d[j];
j-=1;
d[j]=d[j]+C;end;end;end;end;end;end;end;
q=q+1;end;else end;
if F==205 then 
while true do 
local _=Y[q];
if _<45 then 
if _>=22 then 
if _<33 then 
if _<27 then 
if _>=24 then 
if _<25 then else 
if _~=26 then 
C=K(y[q],(b(K(U,(b(I(U,29),7))),536870911)));
local O,W,Z=I(C,8),b(C,255),p[6];
local g=K(Z[O],143377016);
Z[O]=g;
Z,O=p[5],g+1;
g=D(Z,O);
local i,l;
if g<128 then 
i,l=g,O+1;else 
local m=D(Z,O+1);
if m<128 then 
i,l=(g-128)*128+m,O+2;else 
local T=D(Z,O+2);
if T<128 then 
i,l=(g-128)*16384+(m-128)+T*128,O+3;else 
local H=D(Z,O+3);
i,l=(g-128)*2097152+(m-128)*128+(T-128)*16384+H%128+(H-H%128)*2097152,O+4;end;end;end;
O,g=W*16843009,l+i;
local m=g-i%4;
for i=l,m-1,4 do 
S(Z,i,(K(o(Z,i),O)));end;
for O=m,g-1,1 do 
h(Z,O,(K(D(Z,O),W)));end;
y[q]=129;
Y[q]=24;else 
C=d[j];
j-=1;
d[j]=d[j]-C;end;end;else 
if _~=23 then 
C,j=d[j],x+1;
d[x+1]=C;else 
C,a,z=d[j],d[j-1],d[j-2];
j-=3;
z[a]=C;end;end;else 
if _>=30 then 
if _>=31 then 
if _~=32 then 
C,a,z=j-1,j-2,d[j];
r,s=d[C],d[a];
d[j]=r;
d[C]=s;
d[a]=z;else 
k=d[j];
j=j-1;end;else 
C=d[j];
j-=1;
d[j]=d[j]*C;end;else 
if _<28 then 
C,a=y[q],K(u,b(I(u,14),262143),(b(I(u,28),15)));
z=C<2097152 and 7 or 14;
r,s=b(C,f(1,z)-1),I(C,z);
y[q]=K(r,102,(b(a,127)));
Y[q]=K(s,20,(b(I(a,7),127)));
q=q-1;else 
if _~=29 then 
d[j]=not d[j];else 
q,j=if not d[j]then K(y[q],(b(K(F,Y[q],109),127)))else q,j-1;end;end;end;end;else 
if _>=39 then 
if _>=42 then 
if _>=43 then 
if _==44 then 
q=K(y[q],(b(K(119,Y[q],F),127)));else 
if X then 
for O in A,X,nil do 
if X then 
local W=X[O];
if W then 
W[5]=W;
W[6]=d[O];
W[4]=6;
X[O]=nil;end;end;end;end;
if c then 
for O,W in A,c,nil do 
local Z=W[6];
if c then 
local W=c[O];
if W then 
local g=t(Z);
n(d,O,O+Z-1,1,g);
W[5]=g;
W[4]=1;
c[O]=nil;end;end;end;end;
C=K(y[q],(b(Y[q],127)));
if C==0 then 
return;end;
return P(d,j-C+1,j);end;else 
C,a=d[j],d[j-1];
d[j-1]=a[C];
d[j]=a;end;else 
if _<40 then 
if not d[j]then 
q=K(y[q],(b(K(66,Y[q]),127)));else 
j=j-1;end;else 
if _==41 then 
d[j-1]=d[K(y[q],(b(K(q,Y[q]),127)))+d[j]];
j=j-1;else 
if not d[j]then 
j-=1;
q=K(y[q],(b(K(F,38),127)));else end;end;end;end;else 
if _<36 then 
if _<34 then 
d[j]=#d[j];else 
if _==35 then 
C=d[j];
j+=1;
d[j]=C;else 
j+=1;
d[j]=nil;end;end;else 
if _>=37 then 
if _==38 then 
if d[j]then 
j-=1;
q=K(y[q],(b(K(Y[q],49,F),127)));else end;else 
C=d[j-K(y[q],(b(K(q,79),127)))];
j+=1;
d[j]=C;end;else 
N=d[j];
j=j-1;end;end;end;end;else 
if _<11 then 
if _>=5 then 
if _>=8 then 
if _>=9 then 
if _==10 then 
C,a=K(y[q],(b(K(q,58,Y[q]),127))),d[j];
j-=1;
z,r=j-C,d[j];
s=r.n;
v=C-1+s;
r.n=v;
n(r,1,s,C,r);
n(d,z+1,j-1,1,r);
w,j=G(d[z](P(r,1,r.n))),z+a-1;
n(w,1,a,z,d);else 
C=j-K(y[q],(b(K(Y[q],F),127)));
a=d[C];
d[C]=d[j];
d[j]=a;end;else 
if X then 
for O in A,X,nil do 
if X then 
local W=X[O];
if W then 
W[5]=W;
W[6]=d[O];
W[4]=6;
X[O]=nil;end;end;end;end;
if c then 
for O,W in A,c,nil do 
local Z=W[6];
if c then 
local W=c[O];
if W then 
local g=t(Z);
n(d,O,O+Z-1,1,g);
W[5]=g;
W[4]=1;
c[O]=nil;end;end;end;end;
C=K(y[q],(b(K(48,q,Y[q]),127)));
z,r=j-C+1,d[j];
s=r.n;
r.n=C+s-1;
n(r,1,s,C,r);
n(d,z,j-1,1,r);
return P(r,1,r.n);end;else 
if _>=6 then 
if _~=7 then 
j+=1;
d[j]=Q[K(y[q],(b(K(Y[q],71,q),127)))];else 
C,a,z=y[q]+1,K(y[q+1],(b(K(M,(b(I(M,29),7))),536870911))),y[q+2];
for O=1,z,1 do 
a=b(K(a,(f(a,13))),536870911);
a=K(a,(I(a,13)));
a=b(K(a,(f(a,14))),536870911);
y[C]=K(y[C],(b(I(a,0),127)));
Y[C]=K(Y[C],(b(I(a,7),127)));
C=C+1;end;
Y[q]=24;
q=q+2;end;else 
j+=1;
d[j]=d[y[q]];
q+=1;
j+=1;
d[j]=d[y[q]];
q+=1;
j+=1;
d[j]=d[y[q]];end;end;else 
if _<2 then 
if _==1 then 
j+=1;
d[j]=k;else 
j+=1;
d[j]=d[K(y[q],(b(Y[q],127)))];end;else 
if _>=3 then 
if _~=4 then 
j+=1;
d[j]=V[e[q]];else 
j+=1;
d[j]=U;end;else 
C,a,z,r,s=d[j],d[j-1],d[j-2],d[j-3],L(E);
s(Q,r,z,a);
a=nil;
local O;
O,s=s,j-3;
d[s]=O;
z=nil;
d[s+1]=z;
d[s+2]=a;
d[s+3]=C;
d[s+4]=K(y[q],(b(K(q,F,Y[q]),127)));
j,r=s+4,s;end;end;end;else 
if _>=16 then 
if _>=19 then 
if _>=20 then 
if _==21 then 
j+=1;
d[j]=p;else 
q=if not d[j]then K(y[q],(b(K(F,66),127)))else q;end;else 
j+=1;
d[j]={};end;else 
if _<17 then 
M=d[j];
j=j-1;else 
if _==18 then 
C=d[j];
j-=1;
d[j]=d[j]<C;else 
j+=1;
d[j]=J[K(y[q],(b(K(q,F,Y[q]),127)))];end;end;end;else 
local O=q;
if _>=13 then 
if _<14 then 
j=j-1;else 
if _~=15 then 
F=d[j];
j-=1;
q=K(y[O],(b(Y[O],127)))+1;
break;else 
C=J[K(y[O],(b(K(Y[O],O,F),127)))];
j+=1;
d[j]=C[5][C[4]];end;end;else 
if _==12 then 
C=d[j];
j-=1;
d[j]=d[j]<=C;else 
C=y[O];
local W,L,E=I(C,8),b(C,255),p[6];
local Z=K(E[W],143377016);
E[W]=Z;
W,E=p[5],Z+1;
Z=D(W,E);
local g,i;
if Z<128 then 
g,i=Z,E+1;else 
local l=D(W,E+1);
if l<128 then 
g,i=(Z-128)*128+l,E+2;else 
local m=D(W,E+2);
if m<128 then 
g,i=(Z-128)*16384+(l-128)+m*128,E+3;else 
local T=D(W,E+3);
g,i=(Z-128)*2097152+(l-128)*128+(m-128)*16384+T%128+(T-T%128)*2097152,E+4;end;end;end;
Z,E=L*16843009,i+g;
local l=E-g%4;
for g=i,l-1,4 do 
S(W,g,(K(o(W,g),Z)));end;
for Z=l,E-1,1 do 
h(W,Z,(K(D(W,Z),L)));end;
y[O]=7;
Y[O]=24;end;end;end;end;end;else 
if _>=67 then 
if _<78 then 
if _>=72 then 
if _<75 then 
if _<73 then 
C,a,z=d[j],d[j-1],d[j-2];
j-=2;
z[a]=C;else 
if _~=74 then 
d[K(y[q],(b(K(35,Y[q],F),127)))]=d[j];
j-=1;else 
j+=1;
d[j]=K(y[q],(b(Y[q],127)));end;end;else 
if _<76 then 
d[y[q]]=d[j];
j-=1;
q+=1;
d[y[q]]=d[j];
j-=1;
q+=1;
d[y[q]]=d[j];
j=j-1;else 
if _~=77 then 
d[j-K(y[q],33)]=d[j];
j-=1;else 
j+=1;
d[j]=Y;end;end;end;else 
if _>=69 then 
if _<70 then 
u=d[j];
j=j-1;else 
if _~=71 then 
C=d[j];
j-=1;
d[j]=d[j]>=C;else 
j+=1;
d[j]=u;end;end;else 
if _~=68 then 
j+=1;
d[j]=M;else 
j-=K(y[q],(b(F,127)));end;end;end;else 
if _<84 then 
if _>=81 then 
if _>=82 then 
if _~=83 then 
C,a=K(y[q],(b(K(84,F),127))),d[j];
j-=1;
z=j-C;
d[z]=G(d[z](P(d,z+1,j)));
j=z;else 
C=d[j];
j-=1;
d[j]=d[j]+C;end;else 
q,j=if d[j]then K(y[q],(b(K(Y[q],F),127)))else q,j-1;end;else 
if _>=79 then 
if _~=80 then 
j+=1;
d[j]=e[q];else 
C,a,z,r,s=d[j-4],d[j-3],d[j-2],d[j-1],d[j];
local O,W=C();
if O then 
d[j-2]=z;
if s~=0 then 
for L=1,r,1 do 
d[s+L-1]=W[L];end;else 
n(W,1,r,j+1,d);
j+=r;end;
q=K(y[q],(b(K(30,Y[q]),127)));else 
j=j-5;end;
v,w=O,W;end;else 
d[K(y[q],(b(K(39,Y[q],q),127)))+d[j-1]]=d[j];
j=j-2;end;end;else 
if _>=87 then 
if _>=88 then 
if _==89 then 
C=j-1;
a=d[C];
d[C]=d[j];
d[j]=a;else 
C=d[j];
j-=1;
d[j]=d[j]/C;end;else 
C,a=K(y[q],(b(Y[q],127))),d[j];
j-=1;
z=j-C;
r,j=G(d[z](P(d,z+1,j))),z+a-1;
n(r,1,a,z,d);end;else 
if _<85 then 
C,a=K(y[q],(b(K(F,6),127))),d[j];
j-=1;
z=d[j-a];
n(d,j-a+1,j,C+1,z);
j=j-a;else 
if _~=86 then 
C=d[j];
j-=1;
local O,W=b(d[j],4294967295),b(C,4294967295);
local w,v,L,E=b(O,65535),I(O,16),b(W,65535),I(W,16);
O=b(w*L+f(b(w*E+v*L,65535),16),4294967295);
W=nil;
repeat 
v=O%4294967296;
if v~=v then 
W=0;
break;end;
W=v-v%1;until true;
d[j]=W;else 
C=K(y[q],3);
a=j-C+1;
n(d,a,j,x+1,d);
j=x+C;end;end;end;end;end;else 
if _>=56 then 
if _<61 then 
if _>=58 then 
if _>=59 then 
if _~=60 then 
j+=1;
d[j]=N;else 
C=d[j];
j-=1;
d[j]=d[j]>C;end;else 
C,a=J[K(y[q],(b(K(F,94,Y[q]),127)))],d[j];
j-=1;
C[5][C[4]]=a;end;else 
if _==57 then 
U,j=d[j],j-1;else 
C=d[j];
j-=1;
d[j]=d[j]..C;end;end;else 
if _>=64 then 
if _<65 then 
j+=1;
d[j]=y;else 
if _==66 then 
d[y[q]]=d[j];
j-=1;
q+=1;
d[y[q]]=d[j];
j-=1;
q+=1;
d[y[q]]=d[j];
j-=1;
q+=1;
d[y[q]]=d[j];
j=j-1;else 
C=d[j];
j-=1;
d[j]=d[j]%C;end;end;else 
if _<62 then 
C,a,z=y[q]+1,y[q+1],y[q+2];
for O=1,z,1 do 
a=b(K(a,(f(a,13))),536870911);
a=K(a,(I(a,13)));
a=b(K(a,(f(a,14))),536870911);
y[C]=K(y[C],(b(I(a,0),127)));
Y[C]=K(Y[C],(b(I(a,7),127)));
C=C+1;end;
Y[q]=24;
q=q+2;else 
if _~=63 then 
C=d[j];
j-=1;
d[j]=d[j]==C;else 
j+=1;
d[j]=y[q];end;end;end;end;else 
if _<50 then 
if _>=47 then 
if _<48 then 
C=d[j];
j-=1;
for O=K(y[q],(b(K(48,q,Y[q]),127))),K(y[q],(b(K(48,q,Y[q]),127)))+C-1,1 do 
d[O]=nil;end;else 
if _==49 then 
C,a,z=y[q]+1,K(y[q+1],(b(K(U,(b(I(U,29),7))),536870911))),y[q+2];
for O=1,z,1 do 
a=b(K(a,(f(a,13))),536870911);
a=K(a,(I(a,13)));
a=b(K(a,(f(a,14))),536870911);
y[C]=K(y[C],(b(I(a,0),127)));
Y[C]=K(Y[C],(b(I(a,7),127)));
C=C+1;end;
Y[q]=24;
q=q+2;else 
C=d[j];
j-=1;
d[j]=d[j]~=C;end;end;else 
if _~=46 then 
C=d[j];
q,j=C,j-1;else 
C=d[j];
j-=1;
d[j]=d[j][C];end;end;else 
if _<53 then 
if _>=51 then 
if _==52 then 
local O;
local W=e[q];
if W then 
local w=#W/3;
if w>0 then 
O={};
local v,L=X,c;
for E=1,w,1 do 
local w=(E-1)*3;
local Z,g=W[w+2],W[w+1];
if Z==1 then 
v=if not v then{}else v;
local i=v[g];
if not i then 
i={[4]=g,[5]=d};
v[g]=i;else end;
O[E]=i;else 
if Z==3 then 
O[E]=d[g];else 
if Z==2 then 
O[E]=J[g];else 
if Z==0 then 
L=if not L then{}else L;
local Z=L[g];
if not Z then 
Z={[6]=W[w+3],[5]=d,[4]=g};
L[g]=Z;else end;
O[E]=Z;else end;end;end;end;end;
X,c=v,L;else end;else end;
a=d[j](O);
B(a,V);
d[j]=a;
C=O;else 
C=d[j];
j-=1;
d[j]=d[j]//C;end;else 
C,a=K(u,b(I(u,14),262143),(b(I(u,28),15))),y[q];
z=a<16384 and 7 or(a<2097152 and 14 or 21);
r,s=b(a,f(1,z)-1),I(a,z);
Y[q]=K(s,55,(b(I(C,7),127)));
y[q]=K(r,58,(b(C,127)));
q=q-1;end;else 
if _>=54 then 
if _==55 then 
q=if d[j]then K(y[q],(b(K(Y[q],F,2),127)))else q;else 
C,a,z=y[q]+1,K(y[q+1],(b(K(u,(b(I(u,29),7))),536870911))),y[q+2];
for _=1,z,1 do 
a=b(K(a,(f(a,13))),536870911);
a=K(a,(I(a,13)));
a=b(K(a,(f(a,14))),536870911);
y[C]=K(y[C],(b(I(a,0),127)));
Y[C]=K(Y[C],(b(I(a,7),127)));
C=C+1;end;
Y[q]=24;
q=q+2;end;else 
local _,O=d[j];
repeat 
local W=_%4294967296;
if W~=W then 
O=0;
break;end;
O=W-W%1;until true;
d[j]=O;end;end;end;end;end;end;
q=q+1;end;else end;
if F==47 then 
while true do 
local _=Y[q];
if _<43 then 
if _<21 then 
if _<10 then 
if _>=5 then 
if _>=7 then 
if _<8 then 
C=d[j];
j-=1;
d[j]=d[j]+C;else 
if _~=9 then 
j+=1;
d[j]=p;else 
d[j]=-d[j];end;end;else 
if _==6 then 
C=d[j];
j-=1;
d[j]=d[j]~=C;else 
C=d[j];
j-=1;
d[j]=d[j]==C;end;end;else 
if _>=2 then 
if _>=3 then 
if _==4 then 
j+=1;
d[j]={};else 
q=if d[j]then K(y[q],(b(K(44,F,Y[q]),127)))else q;end;else 
C,a=K(y[q],(b(K(F,Y[q]),127))),d[j];
j-=1;
z=j-C;
d[z]=G(d[z](P(d,z+1,j)));
j=z;end;else 
if _==1 then 
j+=1;
d[j]=M;else 
d[j-K(y[q],(b(K(q,F),127)))]=d[j];
j-=1;end;end;end;else 
if _>=15 then 
if _<18 then 
if _<16 then 
N=d[j];
j=j-1;else 
if _==17 then 
C=j-K(y[q],(b(K(Y[q],112),127)));
a=d[C];
d[C]=d[j];
d[j]=a;else 
q,j=if d[j]then K(y[q],2)else q,j-1;end;end;else 
if _>=19 then 
if _==20 then 
C=d[j];
j-=1;
d[j]=d[j]<C;else 
d[K(y[q],(b(Y[q],127)))]=d[j];
j=j-1;end;else 
j=j-K(y[q],(b(K(q,88,F),127)));end;end;else 
if _>=12 then 
if _<13 then 
j+=1;
d[j]=Y;else 
if _~=14 then 
j+=1;
d[j]=d[y[q]];
q+=1;
j+=1;
d[j]=d[y[q]];
q+=1;
j+=1;
d[j]=d[y[q]];
q+=1;
j+=1;
d[j]=d[y[q]];else 
C=d[j];
j-=1;
d[j]=d[j]%C;end;end;else 
if _==11 then 
j+=1;
d[j]=J[K(y[q],(b(K(q,F,Y[q]),127)))];else 
if X then 
for O in A,X,nil do 
if X then 
local W=X[O];
if W then 
W[5]=W;
W[6]=d[O];
W[4]=6;
X[O]=nil;end;end;end;end;
if c then 
for O,W in A,c,nil do 
local w=W[6];
if c then 
local W=c[O];
if W then 
local v,L=O+w-1,t(w);
n(d,O,v,1,L);
W[5]=L;
W[4]=1;
c[O]=nil;end;end;end;end;
C=K(y[q],(b(K(Y[q],108,q),127)));
if C==0 then 
return;end;
return P(d,j-C+1,j);end;end;end;end;else 
if _>=32 then 
if _<37 then 
if _>=34 then 
if _<35 then 
C,a=d[j],d[j-1];
d[j-1]=a[C];
d[j]=a;else 
if _~=36 then else 
j+=1;
d[j]=u;end;end;else 
if _~=33 then 
j+=1;
d[j]=y[q];else 
C=j-1;
a=d[C];
d[C]=d[j];
d[j]=a;end;end;else 
if _<40 then 
if _<38 then 
C=K(y[q],(b(K(u,(b(I(u,29),7))),536870911)));
local O,W,w=I(C,8),b(C,255),p[6];
local v=K(w[O],143377016);
w[O]=v;
w,O=p[5],v+1;
v=D(w,O);
local L,E;
if v<128 then 
L,E=v,O+1;else 
local Z=D(w,O+1);
if Z<128 then 
L,E=(v-128)*128+Z,O+2;else 
local g=D(w,O+2);
if g<128 then 
L,E=(v-128)*16384+(Z-128)+g*128,O+3;else 
local i=D(w,O+3);
L,E=(v-128)*2097152+(Z-128)*128+(g-128)*16384+i%128+(i-i%128)*2097152,O+4;end;end;end;
v,O=W*16843009,E+L;
local Z=O-L%4;
for L=E,Z-1,4 do 
S(w,L,(K(o(w,L),v)));end;
for v=Z,O-1,1 do 
h(w,v,(K(D(w,v),W)));end;
y[q]=53;
Y[q]=35;else 
if _~=39 then 
q=if not d[j]then K(y[q],(b(K(Y[q],F,98),127)))else q;else 
C,a=K(y[q],(b(K(q,F),127))),d[j];
j-=1;
z=d[j-a];
n(d,j-a+1,j,C+1,z);
j=j-a;end;end;else 
if _>=41 then 
if _==42 then 
C=d[j-K(y[q],(b(K(q,Y[q]),127)))];
j+=1;
d[j]=C;else 
j+=1;
d[j]=y;end;else 
q=K(y[q],(b(Y[q],127)));end;end;end;else 
if _>=26 then 
if _>=29 then 
if _<30 then 
C,a,z=d[j],d[j-1],d[j-2];
j-=3;
z[a]=C;else 
if _==31 then 
C,a,z=j-1,j-2,d[j];
r,s=d[C],d[a];
d[j]=r;
d[C]=s;
d[a]=z;else 
C=d[j];
j-=1;
d[j]=d[j]<=C;end;end;else 
if _>=27 then 
if _~=28 then 
j+=1;
d[j]=nil;else 
C=d[j];
j-=1;
d[j]=d[j][C];end;else 
j+=1;
d[j]=N;end;end;else 
if _<23 then 
if _==22 then 
C=K(y[q],(b(K(M,(b(I(M,29),7))),536870911)));
local O,W,w=I(C,8),b(C,255),p[6];
local v=K(w[O],143377016);
w[O]=v;
O,w=p[5],v+1;
v=D(O,w);
local N,L;
if v<128 then 
N,L=v,w+1;else 
local E=D(O,w+1);
if E<128 then 
N,L=(v-128)*128+E,w+2;else 
local Z=D(O,w+2);
if Z<128 then 
N,L=(v-128)*16384+(E-128)+Z*128,w+3;else 
local g=D(O,w+3);
N,L=(v-128)*2097152+(E-128)*128+(Z-128)*16384+g%128+(g-g%128)*2097152,w+4;end;end;end;
v,w=W*16843009,L+N;
local E=w-N%4;
for N=L,E-1,4 do 
S(O,N,(K(o(O,N),v)));end;
for v=E,w-1,1 do 
h(O,v,(K(D(O,v),W)));end;
y[q]=254;
Y[q]=35;else 
C,a,z=y[q]+1,y[q+1],y[q+2];
for O=1,z,1 do 
a=b(K(a,(f(a,13))),536870911);
a=K(a,(I(a,13)));
a=b(K(a,(f(a,14))),536870911);
y[C]=K(y[C],(b(I(a,0),127)));
Y[C]=K(Y[C],(b(I(a,7),127)));
C=C+1;end;
Y[q]=35;
q=q+2;end;else 
if _>=24 then 
if _~=25 then 
C,j=d[j],x+1;
d[x+1]=C;else 
C=d[j];
j+=1;
d[j]=C;end;else 
C=d[j];
j-=1;
d[j]=d[j]>C;end;end;end;end;end;else 
if _<64 then 
if _<53 then 
if _<48 then 
local O=q;
if _>=45 then 
if _<46 then 
C=J[K(y[O],(b(K(48,Y[O],O),127)))];
j+=1;
d[j]=C[5][C[4]];else 
if _==47 then 
C=d[j];
j-=1;
d[j]=d[j]//C;else 
j+=1;
d[j]=U;end;end;else 
local W=j;
if _~=44 then 
F,j=d[W],W-1;
q=K(y[O],(b(K(Y[O],103),127)))+1;
break;else 
C=y[O];
local W,w,v=I(C,8),b(C,255),p[6];
local N=K(v[W],143377016);
v[W]=N;
W,v=p[5],N+1;
N=D(W,v);
local L,E;
if N<128 then 
L,E=N,v+1;else 
local Z=D(W,v+1);
if Z<128 then 
L,E=(N-128)*128+Z,v+2;else 
local g=D(W,v+2);
if g<128 then 
L,E=(N-128)*16384+(Z-128)+g*128,v+3;else 
local i=D(W,v+3);
L,E=(N-128)*2097152+(Z-128)*128+(g-128)*16384+i%128+(i-i%128)*2097152,v+4;end;end;end;
v,N=w*16843009,E+L;
local Z=N-L%4;
for L=E,Z-1,4 do 
S(W,L,(K(o(W,L),v)));end;
for v=Z,N-1,1 do 
h(W,v,(K(D(W,v),w)));end;
y[O]=242;
Y[O]=35;end;end;else 
if _>=50 then 
if _<51 then 
C=d[j];
j-=1;
d[j]=d[j]..C;else 
if _~=52 then 
j+=1;
d[j]=K(y[q],(b(Y[q],127)));else 
C=d[j];
j-=1;
d[j]=d[j]-C;end;end;else 
if _==49 then 
C,a=y[q],K(M,b(I(M,14),262143),(b(I(M,28),15)));
z=C<16384 and 7 or(C<2097152 and 14 or 21);
r,s=b(C,f(1,z)-1),I(C,z);
y[q]=K(r,125,(b(a,127)));
Y[q]=K(s,98,(b(I(a,7),127)));
q=q-1;else 
j+=1;
d[j]=d[y[q]];
q+=1;
j+=1;
d[j]=d[y[q]];
q+=1;
j+=1;
d[j]=d[y[q]];end;end;end;else 
if _>=58 then 
if _<61 then 
if _>=59 then 
if _==60 then 
C,a=y[q],K(M,b(I(M,14),262143),(b(I(M,28),15)));
z=C<2097152 and 7 or 14;
r,s=b(C,f(1,z)-1),I(C,z);
y[q]=K(r,125,(b(a,127)));
Y[q]=K(s,62,(b(I(a,7),127)));
q=q-1;else 
if d[j]then 
j-=1;
q=K(y[q],(b(K(85,Y[q]),127)));else end;end;else 
j+=1;
d[j]=k;end;else 
if _<62 then 
d[y[q]]=d[j];
j-=1;
q+=1;
d[y[q]]=d[j];
j-=1;
q+=1;
d[y[q]]=d[j];
j=j-1;else 
if _~=63 then 
j=j-1;else 
U=d[j];
j=j-1;end;end;end;else 
if _>=55 then 
if _>=56 then 
if _~=57 then 
d[j]=not d[j];else 
C=d[j];
j-=1;
d[j]=d[j]>=C;end;else 
if not d[j]then 
q=K(y[q],93);else 
j=j-1;end;end;else 
if _==54 then 
C,a,z=y[q]+1,K(y[q+1],(b(K(U,(b(I(U,29),7))),536870911))),y[q+2];
for O=1,z,1 do 
a=b(K(a,(f(a,13))),536870911);
a=K(a,(I(a,13)));
a=b(K(a,(f(a,14))),536870911);
y[C]=K(y[C],(b(I(a,0),127)));
Y[C]=K(Y[C],(b(I(a,7),127)));
C=C+1;end;
Y[q]=35;
q=q+2;else 
j+=1;
d[j]=e[q];end;end;end;end;else 
if _<75 then 
if _>=69 then 
if _<72 then 
if _>=70 then 
if _==71 then 
j+=1;
d[j]=d[y[q]];
q+=1;
j+=1;
d[j]=d[y[q]];else 
C,a,z=y[q]+1,K(y[q+1],(b(K(u,(b(I(u,29),7))),536870911))),y[q+2];
for O=1,z,1 do 
a=b(K(a,(f(a,13))),536870911);
a=K(a,(I(a,13)));
a=b(K(a,(f(a,14))),536870911);
y[C]=K(y[C],(b(I(a,0),127)));
Y[C]=K(Y[C],(b(I(a,7),127)));
C=C+1;end;
Y[q]=35;
q=q+2;end;else 
local O;
local W=e[q];
if W then 
local w=#W/3;
if w>0 then 
O={};
local v,N=X,c;
for L=1,w,1 do 
local w=(L-1)*3;
local E,Z=W[w+2],W[w+1];
if E==1 then 
v=if not v then{}else v;
local g=v[Z];
if not g then 
g={[4]=Z,[5]=d};
v[Z]=g;else end;
O[L]=g;else 
if E==3 then 
O[L]=d[Z];else 
if E==2 then 
O[L]=J[Z];else 
if E==0 then 
N=if not N then{}else N;
local E=N[Z];
if not E then 
E={[6]=W[w+3],[5]=d,[4]=Z};
N[Z]=E;else end;
O[L]=E;else end;end;end;end;end;
X,c=v,N;else end;else end;
a=d[j](O);
B(a,V);
d[j]=a;
C=O;end;else 
if _<73 then 
C=K(y[q],(b(K(U,(b(I(U,29),7))),536870911)));
local O,W,w=I(C,8),b(C,255),p[6];
local v=K(w[O],143377016);
w[O]=v;
O,w=p[5],v+1;
v=D(O,w);
local N,L;
if v<128 then 
N,L=v,w+1;else 
local E=D(O,w+1);
if E<128 then 
N,L=(v-128)*128+E,w+2;else 
local Z=D(O,w+2);
if Z<128 then 
N,L=(v-128)*16384+(E-128)+Z*128,w+3;else 
local g=D(O,w+3);
N,L=(v-128)*2097152+(E-128)*128+(Z-128)*16384+g%128+(g-g%128)*2097152,w+4;end;end;end;
v,w=W*16843009,L+N;
local E=w-N%4;
for N=L,E-1,4 do 
S(O,N,(K(o(O,N),v)));end;
for v=E,w-1,1 do 
h(O,v,(K(D(O,v),W)));end;
y[q]=191;
Y[q]=35;else 
if _~=74 then 
j+=1;
d[j]=V[e[q]];else 
k=d[j];
j=j-1;end;end;end;else 
if _<66 then 
if _~=65 then 
local O,W=d[j];
repeat 
local w=O%4294967296;
if w~=w then 
W=0;
break;end;
W=w-w%1;until true;
d[j]=W;else 
C=d[j];
j-=1;
local O,W=b(d[j],4294967295),b(C,4294967295);
local w,v,k,N=b(O,65535),I(O,16),b(W,65535),I(W,16);
O=b(w*k+f(b(w*N+v*k,65535),16),4294967295);
k=nil;
repeat 
N=O%4294967296;
if N~=N then 
k=0;
break;end;
k=N-N%1;until true;
d[j]=k;end;else 
if _<67 then 
C,a=K(y[q],(b(F,127))),d[j];
j-=1;
z=j-C;
r,j=G(d[z](P(d,z+1,j))),z+a-1;
n(r,1,a,z,d);else 
if _~=68 then 
j+=1;
d[j]=Q[K(y[q],(b(K(112,q),127)))];else 
M=d[j];
j=j-1;end;end;end;end;else 
if _<80 then 
if _>=77 then 
if _<78 then 
C,a,z=y[q]+1,K(y[q+1],(b(K(M,(b(I(M,29),7))),536870911))),y[q+2];
for O=1,z,1 do 
a=b(K(a,(f(a,13))),536870911);
a=K(a,(I(a,13)));
a=b(K(a,(f(a,14))),536870911);
y[C]=K(y[C],(b(I(a,0),127)));
Y[C]=K(Y[C],(b(I(a,7),127)));
C=C+1;end;
Y[q]=35;
q=q+2;else 
if _~=79 then 
d[y[q]]=d[j];
j-=1;
q+=1;
d[y[q]]=d[j];
j-=1;
q+=1;
d[y[q]]=d[j];
j-=1;
q+=1;
d[y[q]]=d[j];
j=j-1;else 
j+=1;
d[j]=d[K(y[q],(b(K(Y[q],54,F),127)))];end;end;else 
if _==76 then 
d[y[q]]=d[j];
j-=1;
q+=1;
d[y[q]]=d[j];
j=j-1;else 
u=d[j];
j=j-1;end;end;else 
if _>=83 then 
if _>=84 then 
if _~=85 then 
q,j=if not d[j]then K(y[q],(b(Y[q],127)))else q,j-1;else 
C=K(y[q],(b(K(q,14),127)));
a=j-C+1;
n(d,a,j,x+1,d);
j=x+C;end;else 
C=d[j];
q,j=C,j-1;end;else 
if _>=81 then 
if _==82 then 
if not d[j]then 
j-=1;
q=K(y[q],67);else end;else 
C=d[j];
j-=1;
d[j]=d[j]*C;end;else 
d[j]=#d[j];end;end;end;end;end;end;
q=q+1;end;else end;
if F==172 then 
while true do 
local _=Y[q];
if _>=21 then 
if _>=31 then 
if _<36 then 
if _<33 then 
if _~=32 then 
j+=1;
d[j]=u;else 
C=d[j];
j-=1;
d[j]=d[j]-C;end;else 
if _<34 then 
local O,W=e[q];
if O then 
local w=#O/3;
if w>0 then 
W={};
local v,k=X,c;
for N=1,w,1 do 
local w=(N-1)*3;
local L,E=O[w+2],O[w+1];
if L==1 then 
v=if not v then{}else v;
local Z=v[E];
if not Z then 
Z={[4]=E,[5]=d};
v[E]=Z;else end;
W[N]=Z;else 
if L==3 then 
W[N]=d[E];else 
if L==2 then 
W[N]=J[E];else 
if L==0 then 
k=if not k then{}else k;
local L=k[E];
if not L then 
L={[6]=O[w+3],[5]=d,[4]=E};
k[E]=L;else end;
W[N]=L;else end;end;end;end;end;
X,c=v,k;else end;else end;
a=d[j](W);
B(a,V);
d[j]=a;
C=W;else 
if _==35 then else 
j+=1;
d[j]=U;end;end;end;else 
if _<39 then 
if _<37 then 
j+=1;
d[j]=Q[K(y[q],(b(F,127)))];else 
if _~=38 then 
C=J[K(y[q],100)];
j+=1;
d[j]=C[5][C[4]];else 
C,a,z=y[q]+1,K(y[q+1],(b(K(M,(b(I(M,29),7))),536870911))),y[q+2];
for Q=1,z,1 do 
a=b(K(a,(f(a,13))),536870911);
a=K(a,(I(a,13)));
a=b(K(a,(f(a,14))),536870911);
y[C]=K(y[C],(b(I(a,0),127)));
Y[C]=K(Y[C],(b(I(a,7),127)));
C=C+1;end;
Y[q]=35;
q=q+2;end;end;else 
if _<40 then 
q,j=if not d[j]then K(y[q],(b(K(79,Y[q]),127)))else q,j-1;else 
if _==41 then 
j+=1;
d[j]=Y;else 
C=d[j];
j+=1;
d[j]=C;end;end;end;end;else 
if _<26 then 
if _<23 then 
if _==22 then 
u=d[j];
j-=1;else 
if X then 
for Q in A,X,nil do 
if X then 
local O=X[Q];
if O then 
O[5]=O;
O[6]=d[Q];
O[4]=6;
X[Q]=nil;end;end;end;end;
if c then 
for Q,O in A,c,nil do 
local W=O[6];
if c then 
local O=c[Q];
if O then 
local w,v=Q+W-1,t(W);
n(d,Q,w,1,v);
O[5]=v;
O[4]=1;
c[Q]=nil;end;end;end;end;
C=K(y[q],(b(F,127)));
z,r=j-C+1,d[j];
s=r.n;
r.n=C+s-1;
n(r,1,s,C,r);
n(d,z,j-1,1,r);
return P(r,1,r.n);end;else 
if _<24 then 
j+=1;
d[j]=M;else 
if _==25 then 
C,j=d[j],x+1;
d[x+1]=C;else 
j+=1;
d[j]=K(y[q],(b(K(Y[q],q),127)));end;end;end;else 
if _>=28 then 
if _>=29 then 
if _==30 then 
C,a=y[q],K(u,b(I(u,14),262143),(b(I(u,28),15)));
z=C<16384 and 7 or(C<2097152 and 14 or 21);
r,s=I(C,z),b(C,f(1,z)-1);
y[q]=K(s,87,(b(a,127)));
Y[q]=K(r,125,(b(I(a,7),127)));
q=q-1;else 
local Q,x=d[j];
repeat 
local O=Q%4294967296;
if O~=O then 
x=0;
break;end;
x=O-O%1;until true;
d[j]=x;end;else 
j+=1;
d[j]=y[q];end;else 
if _==27 then 
C=d[j];
j-=1;
local Q,x=b(d[j],4294967295),b(C,4294967295);
local O,W,w,v=b(Q,65535),I(Q,16),b(x,65535),I(x,16);
x=b(O*w+f(b(O*v+W*w,65535),16),4294967295);
W=nil;
repeat 
w=x%4294967296;
if w~=w then 
W=0;
break;end;
W=w-w%1;until true;
d[j]=W;else 
d[K(y[q],(b(q,127)))]=d[j];
j=j-1;end;end;end;end;else 
if _<10 then 
if _<5 then 
if _<2 then 
if _==1 then 
M=d[j];
j=j-1;else 
U=d[j];
j=j-1;end;else 
if _>=3 then 
if _==4 then 
C=K(y[q],(b(K(u,(b(I(u,29),7))),536870911)));
local Q,x,O=I(C,8),b(C,255),p[6];
local W=K(O[Q],143377016);
O[Q]=W;
Q,O=p[5],W+1;
W=D(Q,O);
local w,v;
if W<128 then 
w,v=W,O+1;else 
local k=D(Q,O+1);
if k<128 then 
w,v=(W-128)*128+k,O+2;else 
local M=D(Q,O+2);
if M<128 then 
w,v=(W-128)*16384+(k-128)+M*128,O+3;else 
local U=D(Q,O+3);
w,v=(W-128)*2097152+(k-128)*128+(M-128)*16384+U%128+(U-U%128)*2097152,O+4;end;end;end;
W,O=x*16843009,v+w;
local k=O-w%4;
for w=v,k-1,4 do 
S(Q,w,(K(o(Q,w),W)));end;
for W=k,O-1,1 do 
h(Q,W,(K(D(Q,W),x)));end;
y[q]=5;
Y[q]=35;else 
j+=1;
d[j]=p;end;else 
j+=1;
d[j]=e[q];end;end;else 
if _<7 then 
if _~=6 then 
C,a=K(y[q],(b(K(4,q,F),127))),d[j];
j-=1;
z=j-C;
r,j=G(d[z](P(d,z+1,j))),z+a-1;
n(r,1,a,z,d);else 
C=d[j];
q,j=C,j-1;end;else 
if _>=8 then 
if _==9 then 
j+=1;
d[j]=nil;else 
C=d[j];
j-=1;
d[j]=d[j]..C;end;else 
C=d[j];
j-=1;
d[j]=d[j]//C;end;end;end;else 
if _>=15 then 
if _>=18 then 
if _<19 then 
j=j-1;else 
if _~=20 then 
q=K(y[q],(b(F,127)));else 
C,a,z=y[q]+1,y[q+1],y[q+2];
for Q=1,z,1 do 
a=b(K(a,(f(a,13))),536870911);
a=K(a,(I(a,13)));
a=b(K(a,(f(a,14))),536870911);
y[C]=K(y[C],(b(I(a,0),127)));
Y[C]=K(Y[C],(b(I(a,7),127)));
C=C+1;end;
Y[q]=35;
q=q+2;end;end;else 
if _>=16 then 
if _~=17 then 
C=d[j-K(y[q],73)];
j+=1;
d[j]=C;else 
if X then 
for Q in A,X,nil do 
if X then 
local e=X[Q];
if e then 
e[5]=e;
e[6]=d[Q];
e[4]=6;
X[Q]=nil;end;end;end;end;
if c then 
for Q,e in A,c,nil do 
local x=e[6];
if c then 
local e=c[Q];
if e then 
local O=t(x);
n(d,Q,Q+x-1,1,O);
e[5]=O;
e[4]=1;
c[Q]=nil;end;end;end;end;
C=K(y[q],(b(K(q,45,Y[q]),127)));
if C==0 then 
return;end;
return P(d,j-C+1,j);end;else 
C,a,z=y[q]+1,K(y[q+1],(b(K(u,(b(I(u,29),7))),536870911))),y[q+2];
for Q=1,z,1 do 
a=b(K(a,(f(a,13))),536870911);
a=K(a,(I(a,13)));
a=b(K(a,(f(a,14))),536870911);
y[C]=K(y[C],(b(I(a,0),127)));
Y[C]=K(Y[C],(b(I(a,7),127)));
C=C+1;end;
Y[q]=35;
q=q+2;end;end;else 
if _<12 then 
if _==11 then 
C=d[j];
j-=1;
d[j]=d[j]+C;else 
C=y[q];
local Q,e,x=I(C,8),b(C,255),p[6];
local O=K(x[Q],143377016);
x[Q]=O;
Q,x=p[5],O+1;
O=D(Q,x);
local W,p;
if O<128 then 
W,p=O,x+1;else 
local w=D(Q,x+1);
if w<128 then 
W,p=(O-128)*128+w,x+2;else 
local c=D(Q,x+2);
if c<128 then 
W,p=(O-128)*16384+(w-128)+c*128,x+3;else 
local u=D(Q,x+3);
W,p=(O-128)*2097152+(w-128)*128+(c-128)*16384+u%128+(u-u%128)*2097152,x+4;end;end;end;
O,x=e*16843009,p+W;
local w=x-W%4;
for W=p,w-1,4 do 
S(Q,W,(K(o(Q,W),O)));end;
for O=w,x-1,1 do 
h(Q,O,(K(D(Q,O),e)));end;
y[q]=246;
Y[q]=35;end;else 
if _<13 then 
C,a,z=j-1,j-2,d[j];
r,s=d[C],d[a];
d[j]=r;
d[C]=s;
d[a]=z;else 
if _==14 then 
j+=1;
d[j]=d[K(y[q],(b(K(F,85),127)))];else 
j+=1;
d[j]=y;end;end;end;end;end;end;
q=q+1;end;end;end;end;end,[47]=string.match,[61]=2.437891224E9,[77]=typeof,[71]=vector.create,V7=function(Q,e,Y,x,_,O,y,W,q,p,w,c,a)
if e then 
if p<=211 then 
local e=Q[23](_,Y+3);
local s,u,v,k=2097152*(O-128),128*(x-128),(w-128)*16384,e%128;
local w=(e-e%128)*2097152+(s+(k+u+v));
return 245,Y+4,w,y,a;else 
local e=Q[23](_,2+q);
return not(e>=128)and 34 or 177,Y,O,e,a;end;
elseif p<=213 then 
local e=Q[23](_,3+Y);
local Q,_,q,p,w=2097152*(a-128),(W-128)*128,16384*(c-128),e%128,e%128;
local W=2097152*(e-w);
e=_+(p+Q+(W+q));
return 18,Y+4,O,y,e;else 
local Q=x+(O-128)*128;
return 245,Y+2,Q,y,a;end;end,f7=function(Q,e,Y,x,_,O,y,W,q,p,w)
if e<=191 then 
if e<=190 then 
local c=x+(Y-128)*128;
return 37,q,_,2+O,p,W,c;else 
return 192,q[5],_,O,p,W,Y;end;
elseif e<=192 then 
local x,c,a=Q[42](w,_),4+_,1+0;
local s=1-a;
return 112,{a,nil,x+0,s,q},c,O,1,{},Y;
elseif e<=193 then 
return 245,q,_,1+O,p,W,Y;else 
local e=Q[23](w,_+3);
local Q,x,w,c,a=(W-128)*2097152,(y-128)*128,16384*(Y-128),e%128,e%128;
local y=2097152*(e-a);
e=c+x+(y+(Q+w));
return 51,q,4+_,O,p,e,Y;end;end,[98]=function(Q,Q,Q)
return function()
return function()
return{};end;end;end,[73]=UDim.new,[115]=function(Q,e,e,e)
return function(e,Y,Y,Y)
local Y=e[1];
return function(e,x)
local _=e[13];
for _=1,x,2 do 
for x=1,32,4 do 
local O,y=x-1;
local y,W=Q:n7(Y,O),x+1-1;
O,_=Q:n7(Y,W),x+2-1;
local q,p=Q:n7(Y,_),x+3-1;
local _,w,c,a=Q:n7(Y,p),e[y],e[O],e[q];
W=e[_];
w=(w+c)%4294967296;
x=Q[121](W,w);
W=Q[4](Q[19](x,16),(Q[65](x,16)))%4294967296;
a=(a+W)%4294967296;
x=Q[121](c,a);
c=Q[4](Q[19](x,12),(Q[65](x,20)))%4294967296;
w=Q[2](w+c,4294967295);
x=Q[121](W,w);
W=Q[4](Q[19](x,8),(Q[65](x,24)))%4294967296;
a=(a+W)%4294967296;
x=Q[121](c,a);
c=Q[4](Q[19](x,7),(Q[65](x,25)))%4294967296;
e[y]=w;
e[O]=c;
e[q]=a;
e[_]=W;end;end;end;end;end,v=function(Q,e,Y,x,_,O,y,W,q,p,w,c,a)
if W<=102 then 
if W<=101 then 
local s,u=(p-128)*16384,x-128;
local x=s+(e*128+u);
return 19,Y,_,y+3,O,a,x;else 
return 218,_+(Y-128)*128,O+2,y,O,a,p;end;
elseif W<=103 then 
local e=Q[23](w,O+1);
return not not(e>=128)and 159 or 254,Y,_,y,O,a,e;else 
local Q,e=16384*(a-128),q-128;
local x=c*128+e+Q;
return 245,Y,_,y,O+3,x,p;end;end,W=function(Q,e,Y,x,_,O,y,W,q)
if W<=106 then 
if W<=105 then 
return 36,y,1+_,q;else 
local p=Q[23](x,_+2);
return not not(p>=128)and 67 or 178,y,_,p;end;
elseif W<=107 then 
e[Y]=O-O%1;
return 25,y,_,q;else 
return 32,y[5],_,q;end;end,[12]=function(Q,e,Y,x,_,O,O,y,W,q,p,w,c,c,a,s,u,u)
local u,v,k,M,r,U,X,N,z,C,V,d,j,J,t=Q[60],Q[25],Q[124],Q[121],Q[23],Q[82],Q[42],Q[126],Q[36],Q[107],Q[19],Q[2],Q[65],Q[28],Q.b7;
local function F(K,b,b)
local b,n,G,P,I,f,B,D,S,o,h,A,L,E,Z=u,v,k,M,r,U,X,N,z,C,V,d,j,J,t;
local function u(...)
local v,k,M=b;
local r,U,X=v(Y),q,s;
local Y,q,s,N,z,C,V,d,j,J,t=n(),S,o,P,I,f,B,D,h,A,L;
local b,n,P,I,f=G(function(...)
local G,B,D,S;
local o=X==21;
if o then 
while true do 
local h=W[U];
local A=h>=8;
if A then 
local A=h>=12;
if A then 
local A=h<14;
if A then 
local A=h~=13;
if A then 
local A,L,g=O[U],w[U],_[6];
local i=N(g[A],143377016);
g[A]=i;
g,A=_[5],i+1;
i=z(g,A);
local l,m;
if i<128 then 
l,m=i,A+1;else 
local T=z(g,A+1);
if T<128 then 
l,m=(i-128)*128+T,A+2;else 
local H=z(g,A+2);
if H<128 then 
l,m=(i-128)*16384+(T-128)+H*128,A+3;else 
local R=z(g,A+3);
l,m=(i-128)*2097152+(T-128)*128+(H-128)*16384+R%128+(R-R%128)*2097152,A+4;end;end;end;
A,i=L*16843009,m+l;
local T=i-l%4;
for H=m,T-1,4 do 
C(g,H,(N(V(g,H),A)));end;
for A=T,i-1,1 do 
d(g,A,(N(z(g,A),L)));end;
m,L,l=U,U,U;
O[U]=237;
w[m]=166;
c[L]=104;
W[l]=4;else 
r[w[U]]=K[O[U]][p[U]];
r[w[U+1]]=r[c[U+1]][y[U+1]];
U+=1;end;else 
local A=h>=15;
if A then 
local A=h==16;
if A then 
r[w[U]]=r[c[U]][y[U]];
r[w[U+1]]=r[c[U+1]][y[U+1]];
r[O[U+2]]=r[w[U+2]](r[c[U+2]]);
U+=2;else 
r[c[U]]=y[U];end;else 
G=K[w[U]];
r[c[U]]=G[5][G[4]];end;end;else 
local A=h<10;
if A then 
local A=h==9;
if A then 
G=c[U];
S,D,B=r[G],r[G+1],r[G+2];
r[G]=S(D,B);else 
r[O[U]]=Y[e[U]];end;else 
local A=h==11;
if A then 
U=if r[O[U]]then c[U]else w[U];else 
if k then 
for A in q,k,nil do 
if k then 
local L=k[A];
if L then 
L[5]=L;
L[6]=r[A];
L[4]=6;
k[A]=nil;end;end;end;end;
if M then 
for A,L in q,M,nil do 
local g=L[6];
if M then 
local L=M[A];
if L then 
local i,l=A+g,v(g);
s(r,A,i-1,1,l);
L[5]=l;
L[4]=1;
M[A]=nil;end;end;end;end;
return false,false;end;end;end;else 
local A=h>=4;
if A then 
local A=h<6;
if A then 
local A=h~=5;
if not(A)then 
X=O[U];
U=c[U]+1;
break;end;else 
local A=h==7;
if A then 
G=K[w[U]];
G[5][G[4]]=r[O[U]];else 
G,S=w[U]+1,O[U];
local A=U;
for L=1,c[A],1 do 
S=J(N(S,(j(S,13))),536870911);
S=N(S,(t(S,13)));
S=J(N(S,(j(S,14))),536870911);
c[G]=N(c[G],(J(t(S,0),127)));
w[G]=N(w[G],(J(t(S,7),127)));
O[G]=N(O[G],(J(t(S,14),127)));
W[G]=N(W[G],(J(t(S,21),127)));
G=G+1;end;
W[U]=4;end;end;else 
local A=h<2;
if A then 
local A=h~=1;
if A then 
G,S=c[U],r[O[U]];
r[G+1]=S;
r[G]=S[e[U]];else 
r[w[U]]=r[c[U]][y[U]];end;else 
local e=h==3;
if e then 
r[w[U]]=K[O[U]][p[U]];else 
r[O[U]]=K[c[U]];end;end;end;end;
U+=1;end;else end;
o=X==220;
if o then 
while true do 
local e=W[U];
local p=e<4;
if p then 
local p=e<2;
if p then 
local p=e~=1;
if p then 
U=r[c[U]];else 
r[w[U]]=O[U];end;else 
local p=e~=3;
if p then 
G=K[w[U]];
G[5][G[4]]=r[c[U]];else 
U=O[U];end;end;else 
local p=e<6;
if p then 
local p=e==5;
if p then 
if k then 
for p in q,k,nil do 
if k then 
local h=k[p];
if h then 
h[5]=h;
h[6]=r[p];
h[4]=6;
k[p]=nil;end;end;end;end;
if M then 
for p,h in q,M,nil do 
local A=h[6];
if M then 
local h=M[p];
if h then 
local L,g=p+A,v(A);
s(r,p,L-1,1,g);
h[5]=g;
h[4]=1;
M[p]=nil;end;end;end;end;
return false,false;else 
r[w[U]](r[O[U]]);end;else 
local p=e<7;
if p then 
X=c[U];
U=w[U]+1;
break;else 
local p=e~=8;
if p then 
G,S=w[U],r[c[U]];
r[G+1]=S;
r[G]=S[y[U]];else 
r[O[U]]=r[c[U]](r[w[U]]);end;end;end;end;
U+=1;end;else end;
o=X==5;
if o then 
while true do 
local e=c[U];
local p=e<5;
if p then 
local p=e<2;
if p then 
local p=e==1;
if p then 
U=if r[W[U]]then w[U]else O[U];else 
G=O[U];
S,D,B=r[G],r[G+1],r[G+2];
r[G]=S(D,B);end;else 
local p=e<3;
if p then 
X=W[U];
U=w[U]+1;
break;else 
local p=e~=4;
if p then 
local p,B,D=O[U],W[U],_[6];
local h=N(D[p],143377016);
D[p]=h;
p,D=_[5],h+1;
h=z(p,D);
local _,A;
if h<128 then 
_,A=h,D+1;else 
local L=z(p,D+1);
if L<128 then 
_,A=(h-128)*128+L,D+2;else 
local g=z(p,D+2);
if g<128 then 
_,A=(h-128)*16384+(L-128)+g*128,D+3;else 
local i=z(p,D+3);
_,A=(h-128)*2097152+(L-128)*128+(g-128)*16384+i%128+(i-i%128)*2097152,D+4;end;end;end;
h,D=B*16843009,A+_;
local L=D-_%4;
for _=A,L-1,4 do 
C(p,_,(N(V(p,_),h)));end;
for _=L,D-1,1 do 
d(p,_,(N(z(p,_),B)));end;
h,p,A=U,U,U;
O[U]=63;
W[h]=54;
w[p]=214;
c[A]=5;else 
r[O[U]]=Y[a[U]];end;end;end;else 
local Y=e<8;
if Y then 
local Y=e>=6;
if Y then 
local Y=e~=7;
if Y then 
r[w[U]](r[O[U]]);else 
r[W[U]]=K[w[U]];end;end;else 
local Y=e<9;
if Y then 
G,S=w[U],r[W[U]];
r[G+1]=S;
r[G]=S[y[U]];else 
local Y=e~=10;
if Y then 
G,S=W[U]+1,O[U];
local e=U;
for Y=1,w[e],1 do 
S=J(N(S,(j(S,13))),536870911);
S=N(S,(t(S,13)));
S=J(N(S,(j(S,14))),536870911);
O[G]=N(O[G],(J(t(S,0),127)));
W[G]=N(W[G],(J(t(S,7),127)));
w[G]=N(w[G],(J(t(S,14),127)));
c[G]=N(c[G],(J(t(S,21),127)));
G=G+1;end;
c[U]=5;else 
r[w[U]](a[U]);end;end;end;end;
U+=1;end;end;
o=X==47;
if o then 
while true do 
G=c[U];
if k then 
for e in q,k,nil do 
if k then 
local Y=k[e];
if Y then 
Y[5]=Y;
Y[6]=r[e];
Y[4]=6;
k[e]=nil;end;end;end;end;
if M then 
for e,Y in q,M,nil do 
local _=Y[6];
if M then 
local Y=M[e];
if Y then 
local O,y=e+_,v(_);
s(r,e,O-1,1,y);
Y[5]=y;
Y[4]=1;
M[e]=nil;end;end;end;end;
return false,false;end;end;end,...);
if b then 
if n then 
if P then 
return r[I](E(f,1,f.n));else 
return r[I](E(r,I+1,f));end;
elseif I then 
if P then 
return E(I,1,I.n);else 
return E(r,I,f);end;end;else 
local e,Y,_=k,M,r;
if e then 
for O in q,e,nil do 
if e then 
local y=e[O];
if y then 
y[5]=y;
y[6]=_[O];
y[4]=6;
e[O]=nil;end;end;end;end;
if Y then 
for O,y in q,Y,nil do 
e=y[6];
if Y then 
local y=Y[O];
if y then 
local W=v(e);
s(_,O,O+e-1,1,W);
y[5]=W;
y[4]=1;
Y[O]=nil;end;end;end;end;
Z(Q,n,U,x);end;end;
return u;end;
return F;end,D7=function(Q,e,Y,x,_,O,y,W,q,p,w,c)
if O<=19 then 
if O<=18 then 
local a,s,u=16384*(w-128),q-128,128*p;
local v=s+a+u;
return 28,_,e,3+W,v;else 
local a,s=16384*(w-128),q-128;
local u=a+128*p+s;
return 34,_,3+e,W,u;end;
elseif O<=20 then 
local O=(q*_+p)%256;
Q[126](y,w,(Q[121](O,e,(Q[23](x,W+w)))));
return 30,O,e,W,w;else 
Q[82](y,Y,(Q[121](Q[42](x,W+Y),c,Q.J7[_])));
return 27,Q.X7[_],e,W,w;end;end,[28]=unpack,i7=function(Q,e,Y,x,_,O,y)
if y<=13 then 
local y=Q[7](e);
Q[94](y,0,_,O,e);
local W=O+e;
x[Y]=y;
local e,y=Q[23](_,W),1+W;
x[4]=e~=0;
e=Q[23](_,y);
if e<128 then 
return 22,y,e,Y;else 
return 20,_,y,e;end;else 
Q[24]=_;
return 10,Q:m7(x,O,180)(Q.f),O,Y;end;end,r7=function(Q,e,Y,x,_,O,y,W,q,p,w,c)
if q<=216 then 
if q<=215 then 
local a=Q[23](O,c+1);
return not(128>a)and 92 or 189,p,a,c,W,x;else 
local a=Q[23](O,c+3);
local s,u,v,k,M=(x-128)*2097152,(Y-128)*128,16384*(y-128),a%128,a%128;
local Y=(a-M)*2097152;
M=s+k+(v+(Y+u));
return 37,p,e,c+4,W,M;end;
elseif q<=217 then 
return 239,p[4],_,c,e,x;else 
local e=Q[23](O,w);
return not(e>=128)and 59 or 244,p,e,c,W,x;end;end,J7={},u=function(Q,e,Y,x,_,O,y,W,q,p,w)
if x<=17 then 
if x<=16 then 
local c=128*(w-128)+q;
return 85,p,O+2,e,c,y,Y;else 
local q=Q[23](_,W);
return not(q>=128)and 193 or 153,p,O,q,w,y,Y;end;
elseif x<=18 then 
local x=y-4891;
local y,W,q=Q[60](x),Q[60](x),1+0;
return 35,{p,1-q,q,nil,x+0},O,e,w,y,W;else 
local x=Q[23](_,O);
return x<128 and 246 or 170,p,O,e,w,x,Y;end;end,x=function(Q,e,Y,x,_,O,y,W,q,p,w,c)
if O<=1 then 
if O<=0 then 
return 17,y,1+Y,e,x,W;else 
local a,s,u=(x-128)*16384,c-128,128*_;
local _=s+a+u;
return 51,3+y,Y,e,_,W;end;
elseif O<=2 then 
local _=Q[23](p,w+2);
return not(128>_)and 109 or 175,y,Y,_,x,W;else 
local Q=q+128*(W-128);
return 116,y,Y+2,e,x,Q;end;end,W7=function(Q)
return true,35,nil,nil,nil,nil,nil,nil,nil,nil,nil;end,N7=function(Q,Q,e)
if Q<=2 then 
return 1;else 
return 2,9,e+1;end;end,[36]=next,[86]=3.830242446E9,[124]=pcall,[19]=bit32.lshift,[93]=buffer.readstring,u7=function(Q,e,Y,x,_,O,y,W,q,p)
if p<=220 then 
if p<=219 then 
local w,c,a=O[2],O[3],O[1];
local s,u=w+c,c<=0;
c,w=s>=a,s<=a;
a=u and c or not u and w;
O[2]=s;
if a then 
return 63,O,q,Y,_,s;else 
return 5,O,q,Y,_,y;end;else 
local w=Q[23](e,q);
return not(128>w)and 21 or 95,O,q,Y,w,y;end;
elseif p<=221 then 
return 154,O[1],q,Y,_,y;else 
local p,w,c,a=Q[23](e,3+q),(Y-128)*2097152,(x-128)*128,16384*(W-128);
local Q=p%128+2097152*(p-p%128)+c+(w+a);
return 85,O,4+q,Q,_,y;end;end,[33]=function(Q,e,Y,x,x,_,_,O,y,W,q,p,w,w,c,a,s)
local s,u,v,k,M,r,U,X,N,z,C,V,d=Q[60],Q[25],Q[2],Q[65],Q[19],Q[121],Q[107],Q[23],Q[82],Q[42],Q[126],Q[102],Q[28];
return function(j)
local J,t,F,K,b,n,G,P,I,f,B,D,S=s,u,v,k,M,r,U,X,N,z,C,V,d;
return function(...)
local s,u,v,k,M,r,U;
local X,N,z,C,V,d=4149236483;
local o,h=J(Y),t();
local Y,J;
if a==182 then 
Y,J=W,a;
while true do 
local t=_[Y];
if t<23 then 
if t>=11 then 
if t>=17 then 
if t>=20 then 
if t>=21 then 
if t~=22 then 
o[4]=o[5]+o[4];
local A,L,E=_[Y+2],o[4];
repeat 
local Z=L%4294967296;
if Z~=Z then 
E=0;
break;end;
E=Z-Z%1;until true;
o[A]=E;
o[5]=o[3];
o[6]=q[Y+2];
X=o[6];
E,A=o[5];
repeat 
L=E%4294967296;
if L~=L then 
A=0;
break;end;
A=L-L%1;until true;
o[5]=A;
o[_[Y+1]]=o[5]+e[Y];
E,A=e[Y+1],o[10];
local Z,g=F(E,4294967295),F(A,4294967295);
local i,l,m,T=F(Z,65535),K(Z,16),F(g,65535),K(g,16);
A=F(i*m+b(F(i*T+l*m,65535),16),4294967295);
E=nil;
repeat 
L=A%4294967296;
if L~=L then 
E=0;
break;end;
E=L-L%1;until true;
o[9]=E;
o[p[Y+2]]=q[Y]+o[9];
o[42]=o[5]+c[Y];
Y=Y+2;else 
v,o[41]=41,Q[121];
o[42]=c[Y+2];
o[v]=o[v](o[42],o[43]);
local A,L,E=_[Y+3],q[Y+1],o[41];
local Z,g=F(L,4294967295),F(E,4294967295);
local i,l,m,T=F(Z,65535),K(Z,16),F(g,65535),K(g,16);
L=F(i*m+b(F(i*T+l*m,65535),16),4294967295);
E=nil;
repeat 
local Z=L%4294967296;
if Z~=Z then 
E=0;
break;end;
E=Z-Z%1;until true;
o[A]=E;
o[_[Y+1]]=o[8]+o[6];
o[_[Y+2]]=o[7]+o[6];
L,E=o[6];
repeat 
A=L%4294967296;
if A~=A then 
E=0;
break;end;
E=A-A%1;until true;
o[6]=E;
o[41]=Q[121];
o[43]=351696429;
o[42]=o[2];
o[41]=o[41](o[42],o[43]);
v=41;
o[y[Y+1]]=o[41];
A,E,L=y[Y+3],o[3];
repeat 
local Z=E%4294967296;
if Z~=Z then 
L=0;
break;end;
L=Z-Z%1;until true;
o[A]=L;
o[9]=o[3]+w[Y];
L,A=e[Y],o[9];
local Z,g=F(L,4294967295),F(A,4294967295);
local i,l,m,T=F(Z,65535),K(Z,16),F(g,65535),K(g,16);
A=F(i*m+b(F(i*T+l*m,65535),16),4294967295);
E=nil;
repeat 
L=A%4294967296;
if L~=L then 
E=0;
break;end;
E=L-L%1;until true;
o[8]=E;
o[7]=q[Y+2]+o[8];
o[43]=o[3]+223606840;
o[41]=Q[4];
o[42]=e[Y+1];
M,k,r=o[v],o[42],o[43];
o[v]=M(k,r);
E,L=o[41],F(26754266,4294967295);
local Z,g,i=F(E,4294967295),F(L,65535),K(L,16);
A,L=F(Z,65535),K(Z,16);
E=F(g*A+b(F(g*L+i*A,65535),16),4294967295);
A=nil;
repeat 
L=E%4294967296;
if L~=L then 
A=0;
break;end;
A=L-L%1;until true;
o[8]=A;
o[10]=12726743;
X=o[10];
Y=w[Y+3]-3+3;end;else 
o[3]=c[Y];
X=o[3];
Y=p[Y];end;else 
if t>=18 then 
if t==19 then 
v=41;
o[3]=o[3]+o[4];
local A,L=o[_[Y+1]];
repeat 
local E=A%4294967296;
if E~=E then 
L=0;
break;end;
L=E-E%1;until true;
o[3]=L;
o[4]=o[w[Y]];
L,A=o[4];
repeat 
local E=L%4294967296;
if E~=E then 
A=0;
break;end;
A=E-E%1;until true;
o[4]=A;
o[p[Y]]=Q[121];
o[43]=84210186;
o[42]=o[y[Y]];
M,k,r=o[v],o[42],o[43];
o[v]=M(k,r);
o[2]=o[41];
Y=y[Y+1]-1+1;else 
local A,L=o[3];
repeat 
local E=A%4294967296;
if E~=E then 
L=0;
break;end;
L=E-E%1;until true;
o[3]=L;
o[9]=o[3]+q[Y+3];
L,A=o[9],F(27389121,4294967295);
local E,Z,g=F(L,4294967295),F(A,65535),K(A,16);
L,A=F(E,65535),K(E,16);
local E=F(Z*L+b(F(Z*A+g*L,65535),16),4294967295);
L=nil;
repeat 
A=E%4294967296;
if A~=A then 
L=0;
break;end;
L=A-A%1;until true;
o[8]=L;
o[7]=e[Y+1]+o[8];
o[_[Y+3]]=o[3]+c[Y+2];
o[39]=Q[_[Y+1]];
o[40]=c[Y+1];
o[39]=o[39](o[40],o[41]);
v=39;
E,A,L=_[Y+2],c[Y],o[39];
local Z,g=F(A,4294967295),F(L,4294967295);
local i,l,m,T=F(Z,65535),K(Z,16),F(g,65535),K(g,16);
L=F(i*m+b(F(i*T+l*m,65535),16),4294967295);
A=nil;
repeat 
local Z=L%4294967296;
if Z~=Z then 
A=0;
break;end;
A=Z-Z%1;until true;
o[E]=A;
o[41]=o[3]+q[Y+2];
o[39]=Q[2];
o[p[Y]]=e[Y+2];
M,k,r=o[v],o[40],o[41];
o[v]=M(k,r);
L,A=e[Y+3],o[39];
local Z,g=F(L,4294967295),F(A,4294967295);
local i,l,m,T=F(Z,65535),K(Z,16),F(g,65535),K(g,16);
A=F(i*m+b(F(i*T+l*m,65535),16),4294967295);
L=nil;
repeat 
E=A%4294967296;
if E~=E then 
L=0;
break;end;
L=E-E%1;until true;
o[3]=L;
o[3]=o[8]+o[w[Y+1]];
o[39]=Q[121];
Y=w[Y]-3+3;end;else 
o[_[Y+2]]=c[Y+1];
v=_[Y+1];
o[v]=o[v](o[v+1],o[v+2]);
v,o[41]=41,Q[w[Y+2]];
o[43]=c[Y];
o[42]=o[3];
M,k,r=o[v],o[42],o[43];
o[v]=M(k,r);
o[3]=o[40]+o[p[Y+1]];
o[3]=c[Y+2]+o[3];
o[40]=Q[121];
o[42]=q[Y];
Y=p[Y]-2+2;end;end;else 
if t<14 then 
if t>=12 then 
if t~=13 then 
local A;
v,A=41,o[_[Y+2]];
local L;
repeat 
local E=A%4294967296;
if E~=E then 
L=0;
break;end;
L=E-E%1;until true;
o[6]=L;
o[9]=o[6]+e[Y+1];
local E,Z,g=_[Y+1],q[Y+2],Y+3;
L,A=o[_[g]],F(Z,4294967295);
local i,l,m=F(L,4294967295),F(A,65535),K(A,16);
Z,L=F(i,65535),K(i,16);
g=F(l*Z+b(F(l*L+m*Z,65535),16),4294967295);
L=nil;
repeat 
Z=g%4294967296;
if Z~=Z then 
L=0;
break;end;
L=Z-Z%1;until true;
o[E]=L;
o[7]=q[Y]+o[8];
o[43]=o[w[Y+3]]+c[Y+1];
o[41]=Q[y[Y]];
o[y[Y+3]]=c[Y+2];
M,k,r=o[v],o[42],o[43];
o[v]=M(k,r);
A,g=q[Y+1],Y+2;
E,Z=o[p[g]],F(A,4294967295);
A,L,g=F(E,4294967295),F(Z,65535),K(Z,16);
Z,E=F(A,65535),K(A,16);
A=F(L*Z+b(F(L*E+g*Z,65535),16),4294967295);
Z=nil;
repeat 
E=A%4294967296;
if E~=E then 
Z=0;
break;end;
Z=E-E%1;until true;
o[8]=Z;
o[43]=o[6]+e[Y+3];
Y=p[Y]-3+3;else 
o[_[Y+2]]=q[Y+2];
o[_[Y+1]]=o[3];
v=_[Y+3];
o[v]=o[v](o[v+1],o[v+2]);
o[3]=o[p[Y]]+o[39];
o[3]=c[Y+1]+o[w[Y]];
o[p[Y+2]]=Q[121];
o[p[Y+3]]=c[Y+2];
o[39]=o[4];
o[38]=o[38](o[39],o[40]);
v,o[39]=39,Q[121];
o[41]=q[Y+3];
o[40]=o[y[Y]];
M,k,r=o[v],o[40],o[41];
o[v]=M(k,r);
Y=Y+3;end;else end;else 
if t>=15 then 
if t==16 then 
Y=if o[w[Y]]then y[Y]else p[Y];else 
J=p[Y];
Y=w[Y]+1;
break;end;else 
v=40;
o[2]=o[41];
o[p[Y]]=not o[40];
o[40]=Q[121];
o[42]=274536174;
o[41]=o[y[Y]];
M,k,r=o[v],o[41],o[42];
o[v]=M(k,r);
o[2]=o[40];
Y=w[Y];end;end;end;else 
if t>=5 then 
if t>=8 then 
if t>=9 then 
if t==10 then 
o[_[Y+1]]=Q[86];
o[4]=Q[61];
o[5]=Q[120];
o[6]=Q[119];
o[_[Y+2]]=Q[106];
local A,L=o[p[Y]];
repeat 
local E=A%4294967296;
if E~=E then 
L=0;
break;end;
L=E-E%1;until true;
o[41]=L;
L,A=o[w[Y+1]];
repeat 
local E=L%4294967296;
if E~=E then 
A=0;
break;end;
A=E-E%1;until true;
o[3]=A;
L,A=o[5];
repeat 
local E=L%4294967296;
if E~=E then 
A=0;
break;end;
A=E-E%1;until true;
o[4]=A;
o[p[Y+2]]=e[Y+1];
X=o[5];
A,L=o[y[Y]];
repeat 
local E=A%4294967296;
if E~=E then 
L=0;
break;end;
L=E-E%1;until true;
o[5]=L;
A,L=o[7];
repeat 
local E=A%4294967296;
if E~=E then 
L=0;
break;end;
L=E-E%1;until true;
o[6]=L;
o[40]=Q[121];
Y=w[Y+2]-2+2;else 
M,v=(n(w[Y],(F(n(X,(F(K(X,29),7))),536870911)))),y[Y]+1;
for A=1,p[Y],1 do 
M=F(n(M,(b(M,13))),536870911);
M=n(M,(K(M,13)));
M=F(n(M,(b(M,14))),536870911);
y[v]=n(y[v],(F(K(M,0),127)));
w[v]=n(w[v],(F(K(M,7),127)));
p[v]=n(p[v],(F(K(M,14),127)));
_[v]=n(_[v],(F(K(M,21),127)));
v=v+1;end;
_[Y]=11;end;else 
v,o[41]=39,o[4]+c[Y];
o[39]=Q[2];
o[40]=360467205;
o[v]=o[v](o[40],o[41]);
v=40;
o[40]=Q[121];
o[42]=238232156;
o[41]=o[2];
M,k,r=o[v],o[41],o[42];
o[v]=M(k,r);
o[2]=o[p[Y]];
Y=w[Y];end;else 
if t<6 then 
local A,L,E=_[Y+1],o[3];
repeat 
local Z=L%4294967296;
if Z~=Z then 
E=0;
break;end;
E=Z-Z%1;until true;
o[A]=E;
o[4]=o[3];
E,A=o[4];
repeat 
L=E%4294967296;
if L~=L then 
A=0;
break;end;
A=L-L%1;until true;
o[4]=A;
o[5]=e[Y+1];
X=o[5];
o[9]=o[4]+w[Y+1];
L,E=q[Y],o[9];
local Z,g=F(L,4294967295),F(E,4294967295);
local L,E,i,l=F(Z,65535),K(Z,16),F(g,65535),K(g,16);
A=F(L*i+b(F(L*l+E*i,65535),16),4294967295);
i=nil;
repeat 
E=A%4294967296;
if E~=E then 
i=0;
break;end;
i=E-E%1;until true;
o[6]=i;
o[5]=c[Y]+o[p[Y]];
Y=y[Y+1]-1+1;else 
if t~=7 then 
v,M,k,r=p[Y],n(X,F(K(X,14),262143),(F(K(X,28),15))),w[Y],y[Y];
N=r<16384 and 7 or(r<2097152 and 14 or 21);
s,z=K(r,N),F(r,b(1,N)-1);
w[Y]=n(k,91,(F(K(M,7),127)));
y[Y]=n(z,15,(F(M,127)));
_[Y]=n(s,66,(F(K(M,21),127)));
p[Y]=n(v,120,(F(K(M,14),127)));
Y=Y-1;else 
o[3]=h[e[Y]];
o[3]=o[_[Y+1]](o[31]);
o[p[Y+1]]=o[3]~=q[Y];
Y=y[Y+1]-1+1;end;end;end;else 
if t<2 then 
if t==1 then 
local A,L;
A,v,L=o[40],40,F(397777006,4294967295);
local E,Z,g=F(A,4294967295),F(L,65535),K(L,16);
local L,i=F(E,65535),K(E,16);
A=F(Z*L+b(F(Z*i+g*L,65535),16),4294967295);
local L;
repeat 
local E=A%4294967296;
if E~=E then 
L=0;
break;end;
L=E-E%1;until true;
o[6]=L;
o[6]=o[10]+o[6];
o[6]=o[9]+o[6];
local E,Z,g=_[Y+1],o[_[Y+2]];
repeat 
L=Z%4294967296;
if L~=L then 
g=0;
break;end;
g=L-L%1;until true;
o[E]=g;
g,L=o[3];
repeat 
Z=g%4294967296;
if Z~=Z then 
L=0;
break;end;
L=Z-Z%1;until true;
o[3]=L;
o[11]=o[3]+q[Y+1];
E,L=e[Y],o[11];
A,Z=F(E,4294967295),F(L,4294967295);
local E,g,i,l=F(A,65535),K(A,16),F(Z,65535),K(Z,16);
L=F(E*i+b(F(E*l+g*i,65535),16),4294967295);
Z=nil;
repeat 
A=L%4294967296;
if A~=A then 
Z=0;
break;end;
Z=A-A%1;until true;
o[10]=Z;
o[9]=c[Y]+o[10];
o[42]=o[3]+e[Y+1];
o[w[Y]]=Q[y[Y+2]];
o[41]=q[Y+2];
M,k,r=o[v],o[41],o[42];
o[v]=M(k,r);
Y=p[Y+2]-2+2;else 
o[39]=o[39](o[40],o[41]);
o[40]=Q[121];
o[42]=c[Y];
o[41]=o[5];
o[40]=o[40](o[41],o[42]);
o[_[Y+1]]=Q[121];
o[43]=c[Y+1];
o[42]=o[6];
v=w[Y];
M,k,r=o[v],o[v+1],o[v+2];
o[v]=M(k,r);
o[4]=o[40]+o[41];
o[4]=o[39]+o[w[Y+1]];
o[3]=o[p[Y]]+o[4];
Y=p[Y+1]-1+1;end;else 
if t>=3 then 
if t~=4 then 
o[40]=Q[_[Y+4]];
o[_[Y+2]]=q[Y];
o[41]=o[6];
v=_[Y+1];
o[v]=o[v](o[v+1],o[v+2]);
v,o[4]=39,o[39]+o[40];
o[4]=o[38]+o[4];
o[3]=o[_[Y+3]]+o[y[Y+2]];
local A,L=o[3];
repeat 
local E=A%4294967296;
if E~=E then 
L=0;
break;end;
L=E-E%1;until true;
o[3]=L;
o[4]=o[p[Y+1]];
A,L=o[w[Y+1]];
repeat 
local E=A%4294967296;
if E~=E then 
L=0;
break;end;
L=E-E%1;until true;
o[4]=L;
o[7]=o[4]+c[Y];
A,L=p[Y],Y+1;
local E,Z=o[y[L]],F(A,4294967295);
local g,i,l=F(E,4294967295),F(Z,65535),K(Z,16);
A,L=F(g,65535),K(g,16);
E=F(i*A+b(F(i*L+l*A,65535),16),4294967295);
L=nil;
repeat 
A=E%4294967296;
if A~=A then 
L=0;
break;end;
L=A-A%1;until true;
o[6]=L;
o[5]=e[Y+4]+o[6];
o[w[Y+3]]=o[4]+q[Y+4];
o[39]=Q[4];
o[40]=360467205;
M,k,r=o[v],o[40],o[41];
o[v]=M(k,r);
E,L,A=p[Y+3],e[Y+2],Y+2;
local Z,g=o[w[A]],F(L,4294967295);
local i,l,m=F(Z,4294967295),F(g,65535),K(g,16);
Z,L=F(i,65535),K(i,16);
A=F(l*Z+b(F(l*L+m*Z,65535),16),4294967295);
Z=nil;
repeat 
L=A%4294967296;
if L~=L then 
Z=0;
break;end;
Z=L-L%1;until true;
o[E]=Z;
Y=Y+4;else 
v=_[Y+1];
o[v]=o[v](o[v+1],o[v+2]);
v,o[40]=40,Q[121];
o[42]=e[Y+1];
o[41]=o[3];
M,k,r=o[v],o[41],o[42];
o[v]=M(k,r);
o[3]=o[39]+o[p[Y]];
o[3]=q[Y+1]+o[3];
o[39]=Q[121];
o[y[Y+1]]=q[Y];
o[40]=o[4];
Y=y[Y]-1+1;end;else 
v=3;
o[5]=0;
o[3]=o[_[Y+1]];
M,k,r=o[v],o[4],o[5];
o[v]=M(k,r);
o[2]=o[3];
o[w[Y+1]]=Q[86];
o[4]=Q[61];
o[5]=Q[120];
o[6]=Q[119];
o[7]=Q[106];
local A,L=o[y[Y+1]];
repeat 
local E=A%4294967296;
if E~=E then 
L=0;
break;end;
L=E-E%1;until true;
o[39]=L;
Y=w[Y]-1+1;end;end;end;end;else 
if t<34 then 
if t>=28 then 
if t>=31 then 
if t<32 then 
Y=y[Y];else 
if t==33 then 
v=40;
local A,L,E=_[Y+1],o[w[Y+1]];
repeat 
local Z=L%4294967296;
if Z~=Z then 
E=0;
break;end;
E=Z-Z%1;until true;
o[A]=E;
E,L=e[Y+1],o[40];
local A,Z=F(E,4294967295),F(L,4294967295);
local E,g,i,l=F(A,65535),K(A,16),F(Z,65535),K(Z,16);
A=F(E*i+b(F(E*l+g*i,65535),16),4294967295);
i=nil;
repeat 
L=A%4294967296;
if L~=L then 
i=0;
break;end;
i=L-L%1;until true;
o[10]=i;
o[42]=o[6]+p[Y];
o[40]=Q[y[Y+1]];
o[41]=q[Y];
M,k,r=o[v],o[41],o[42];
o[v]=M(k,r);
o[6]=47303260;
X=o[y[Y]];
Y=Y+1;else 
v=40;
local A,L=c[Y+1],o[40];
local E,Z=F(A,4294967295),F(L,4294967295);
local g,i,l,m=F(E,65535),K(E,16),F(Z,65535),K(Z,16);
L=F(g*l+b(F(g*m+i*l,65535),16),4294967295);
A=nil;
repeat 
local E=L%4294967296;
if E~=E then 
A=0;
break;end;
A=E-E%1;until true;
o[10]=A;
o[42]=o[3]+q[Y];
o[40]=Q[121];
o[41]=e[Y+2];
M,k,r=o[v],o[41],o[42];
o[v]=M(k,r);
L,A=e[Y+1],o[40];
local E,Z=F(L,4294967295),F(A,4294967295);
local g,i,l,m=F(E,65535),K(E,16),F(Z,65535),K(Z,16);
L=F(g*l+b(F(g*m+i*l,65535),16),4294967295);
A=nil;
repeat 
local E=L%4294967296;
if E~=E then 
A=0;
break;end;
A=E-E%1;until true;
o[3]=A;
o[3]=o[10]+o[3];
o[3]=o[_[Y+2]]+o[_[Y+1]];
A,L=o[y[Y+2]];
repeat 
local E=A%4294967296;
if E~=E then 
L=0;
break;end;
L=E-E%1;until true;
o[3]=L;
o[6]=o[6]*67108864;
o[3]=o[6]+o[3];
o[3]=o[3]/q[Y+2];
o[3]=1+o[w[Y+1]];
o[5]=o[5]-1023;
Y=y[Y]-2+2;end;end;else 
if t>=29 then 
if t~=30 then 
v=38;
local A,L,E=_[Y+2],o[4];
repeat 
local Z=L%4294967296;
if Z~=Z then 
E=0;
break;end;
E=Z-Z%1;until true;
o[A]=E;
E,A=o[_[Y+1]];
repeat 
L=E%4294967296;
if L~=L then 
A=0;
break;end;
A=L-L%1;until true;
o[4]=A;
E,A=o[6];
repeat 
L=E%4294967296;
if L~=L then 
A=0;
break;end;
A=L-L%1;until true;
o[5]=A;
o[y[Y+1]]=q[Y];
X=o[w[Y+2]];
L,A=o[y[Y]];
repeat 
E=L%4294967296;
if E~=E then 
A=0;
break;end;
A=E-E%1;until true;
o[6]=A;
o[38]=Q[121];
o[w[Y+1]]=c[Y+2];
M,k,r=o[v],o[39],o[40];
o[v]=M(k,r);
o[39]=Q[p[Y+1]];
Y=p[Y+2]-2+2;else 
local A,L=e[Y],o[39];
local E,Z=F(A,4294967295),F(L,4294967295);
local g,i,l,m=F(E,65535),K(E,16),F(Z,65535),K(Z,16);
L=F(g*l+b(F(g*m+i*l,65535),16),4294967295);
A=nil;
repeat 
local E=L%4294967296;
if E~=E then 
A=0;
break;end;
A=E-E%1;until true;
o[4]=A;
o[4]=o[6]+o[4];
o[_[Y+1]]=o[y[Y]]+o[4];
L,A=o[4];
repeat 
local E=L%4294967296;
if E~=E then 
A=0;
break;end;
A=E-E%1;until true;
o[4]=A;
o[5]=o[3];
L,A=o[5];
repeat 
local E=L%4294967296;
if E~=E then 
A=0;
break;end;
A=E-E%1;until true;
o[5]=A;
o[w[Y]]=o[5]+c[Y+1];
L,A=o[8],F(100012492,4294967295);
local E,Z,g=F(L,4294967295),F(A,65535),K(A,16);
L,A=F(E,65535),K(E,16);
local E=F(Z*L+b(F(Z*A+g*L,65535),16),4294967295);
L=nil;
repeat 
A=E%4294967296;
if A~=A then 
L=0;
break;end;
L=A-A%1;until true;
o[7]=L;
o[6]=e[Y+1]+o[7];
Y=w[Y+1]-1+1;end;else 
o[_[Y+2]]=o[5]+c[Y+5];
o[39]=Q[_[Y+3]];
o[40]=q[Y];
o[39]=o[39](o[40],o[41]);
local A,L=c[Y+1],Y+1;
local E,Z=o[_[L]],F(A,4294967295);
local g,i,l=F(E,4294967295),F(Z,65535),K(Z,16);
L,E=F(g,65535),K(g,16);
A=F(i*L+b(F(i*E+l*L,65535),16),4294967295);
L=nil;
repeat 
E=A%4294967296;
if E~=E then 
L=0;
break;end;
L=E-E%1;until true;
o[7]=L;
o[_[Y+5]]=o[5]+e[Y+3];
o[39]=Q[2];
o[_[Y+4]]=e[Y+4];
v=y[Y+3];
M,k,r=o[v],o[v+1],o[v+2];
o[v]=M(k,r);
E,L=q[Y+2],o[39];
local Z,g=F(E,4294967295),F(L,4294967295);
local i,l,m,T=F(Z,65535),K(Z,16),F(g,65535),K(g,16);
A=F(i*m+b(F(i*T+l*m,65535),16),4294967295);
L=nil;
repeat 
E=A%4294967296;
if E~=E then 
L=0;
break;end;
L=E-E%1;until true;
o[5]=L;
o[p[Y+1]]=o[7]+o[y[Y]];
o[5]=o[w[Y+1]]+o[5];
o[6]=q[Y+5];
X=o[6];
E,A,L=p[Y+2],o[w[Y+4]];
repeat 
local Z=A%4294967296;
if Z~=Z then 
L=0;
break;end;
L=Z-Z%1;until true;
o[E]=L;
o[y[Y+2]]=o[p[Y]];
A,E,L=p[Y+5],o[w[Y+3]];
repeat 
local Z=E%4294967296;
if Z~=Z then 
L=0;
break;end;
L=Z-Z%1;until true;
o[A]=L;
Y=y[Y+4]-5+5;end;end;else 
if t<25 then 
if t~=24 then 
o[_[Y+2]]=o[5]+o[4];
local A,L=o[4];
repeat 
local E=A%4294967296;
if E~=E then 
L=0;
break;end;
L=E-E%1;until true;
o[4]=L;
o[5]=o[_[Y+1]];
L,A=o[5];
repeat 
local E=L%4294967296;
if E~=E then 
A=0;
break;end;
A=E-E%1;until true;
o[5]=A;
o[6]=c[Y];
X=o[w[Y]];
o[8]=o[5]+c[Y+1];
A,L=q[Y+2],o[8];
local E,Z=F(A,4294967295),F(L,4294967295);
local L,g,i,l=F(E,65535),K(E,16),F(Z,65535),K(Z,16);
A=F(L*i+b(F(L*l+g*i,65535),16),4294967295);
Z=nil;
repeat 
l=A%4294967296;
if l~=l then 
Z=0;
break;end;
Z=l-l%1;until true;
o[7]=Z;
o[6]=c[Y+2]+o[7];
Y=p[Y+2]-2+2;else 
G({...},1,3,30,o);
v,o[3]=38,j[w[Y+1]];
local A,L=o[3];
repeat 
local E=A%4294967296;
if E~=E then 
L=0;
break;end;
L=E-E%1;until true;
o[39]=L;
o[38]=Q[121];
o[40]=c[Y];
M,k,r=o[v],o[39],o[40];
o[v]=M(k,r);
X=o[38];
o[_[Y+1]]=Q[121];
o[p[Y]]=429849538;
Y=w[Y]-1+1;end;else 
if t>=26 then 
if t==27 then 
o[40]=Q[4];
o[41]=e[Y+3];
o[40]=o[40](o[41],o[42]);
local A,L=e[Y+1],Y+2;
local E,Z=o[_[L]],F(A,4294967295);
local g,i,l=F(E,4294967295),F(Z,65535),K(Z,16);
L,A=F(g,65535),K(g,16);
E=F(i*L+b(F(i*A+l*L,65535),16),4294967295);
A=nil;
repeat 
L=E%4294967296;
if L~=L then 
A=0;
break;end;
A=L-L%1;until true;
o[9]=A;
o[42]=o[5]+e[Y+2];
o[40]=Q[_[Y+1]];
o[41]=q[Y+1];
v=_[Y+3];
M,k,r=o[v],o[v+1],o[v+2];
o[v]=M(k,r);
E,A,L=y[Y+1],c[Y+3],o[40];
local Z,g=F(A,4294967295),F(L,4294967295);
local i,l,m,T=F(Z,65535),K(Z,16),F(g,65535),K(g,16);
L=F(i*m+b(F(i*T+l*m,65535),16),4294967295);
A=nil;
repeat 
local Z=L%4294967296;
if Z~=Z then 
A=0;
break;end;
A=Z-Z%1;until true;
o[E]=A;
o[5]=o[9]+o[5];
o[5]=o[y[Y+2]]+o[y[Y]];
Y=w[Y]-3+3;else 
v,o[5]=40,2^o[_[Y+1]];
o[6]=e[Y];
X=o[6];
o[3]=o[3]*o[5];
o[w[Y]]=2*o[4];
o[4]=1-o[4];
o[42]=o[4]*o[3];
o[40]=o[7];
o[41]=o[31];
o[v]=o[v](o[41],o[42]);
v=41;
o[41]=Q[121];
o[43]=431393861;
o[42]=o[y[Y]];
M,k,r=o[v],o[42],o[43];
o[v]=M(k,r);
Y=p[Y+1]-1+1;end;else 
o[7]=h[e[Y]];
o[3]=Q[_[Y+1]];
o[_[Y+3]]=Q[61];
o[5]=Q[_[Y+2]];
o[y[Y+2]]=Q[119];
o[w[Y+3]]=Q[106];
local A,L=o[w[Y+2]];
repeat 
local E=A%4294967296;
if E~=E then 
L=0;
break;end;
L=E-E%1;until true;
o[40]=L;
L,A=o[y[Y+3]];
repeat 
local E=L%4294967296;
if E~=E then 
A=0;
break;end;
A=E-E%1;until true;
o[3]=A;
local E,Z,g=p[Y+2],o[w[Y+1]];
repeat 
A=Z%4294967296;
if A~=A then 
g=0;
break;end;
g=A-A%1;until true;
o[E]=g;
L,E=o[6];
repeat 
A=L%4294967296;
if A~=A then 
E=0;
break;end;
E=A-A%1;until true;
o[5]=E;
g,Z=o[9];
repeat 
A=g%4294967296;
if A~=A then 
Z=0;
break;end;
Z=A-A%1;until true;
o[6]=Z;
o[39]=Q[y[Y]];
o[41]=c[Y+1];
Y=w[Y]-3+3;end;end;end;else 
if t<40 then 
if t>=37 then 
if t>=38 then 
if t==39 then 
o[9]=o[6]+c[Y+3];
local A,L=e[Y+3],o[9];
local E,Z=F(A,4294967295),F(L,4294967295);
local g,i,l,m=F(E,65535),K(E,16),F(Z,65535),K(Z,16);
A=F(g*l+b(F(g*m+i*l,65535),16),4294967295);
L=nil;
repeat 
local E=A%4294967296;
if E~=E then 
L=0;
break;end;
L=E-E%1;until true;
o[8]=L;
o[7]=c[Y]+o[8];
o[_[Y+1]]=o[_[Y+3]]+q[Y];
o[_[Y+4]]=c[Y+2];
X=o[9];
o[39]=Q[_[Y+2]];
o[40]=e[Y];
o[39]=o[39](o[40],o[41]);
v=39;
A,L=o[p[Y+1]],F(106166966,4294967295);
local E,Z,g=F(A,4294967295),F(L,65535),K(L,16);
L,A=F(E,65535),K(E,16);
local E=F(Z*L+b(F(Z*A+g*L,65535),16),4294967295);
L=nil;
repeat 
A=E%4294967296;
if A~=A then 
L=0;
break;end;
L=A-A%1;until true;
o[8]=L;
o[41]=o[6]+e[Y+2];
o[39]=Q[121];
o[40]=q[Y+1];
M,k,r=o[v],o[40],o[41];
o[v]=M(k,r);
E,L=e[Y+4],o[39];
local Z,g=F(E,4294967295),F(L,4294967295);
local i,l,m,T=F(Z,65535),K(Z,16),F(g,65535),K(g,16);
L=F(i*m+b(F(i*T+l*m,65535),16),4294967295);
E=nil;
repeat 
A=L%4294967296;
if A~=A then 
E=0;
break;end;
E=A-A%1;until true;
o[6]=E;
o[y[Y+1]]=o[8]+o[6];
o[6]=o[7]+o[6];
A,E=o[w[Y+3]];
repeat 
L=A%4294967296;
if L~=L then 
E=0;
break;end;
E=L-L%1;until true;
o[6]=E;
Y=w[Y+4]-4+4;else 
v,o[_[Y+2]]=41,o[5]+q[Y];
o[41]=Q[4];
o[42]=334716894;
o[v]=o[v](o[42],o[43]);
v=41;
local A,L,E=_[Y+1],c[Y+2],o[41];
local Z,g=F(L,4294967295),F(E,4294967295);
local i,l,m,T=F(Z,65535),K(Z,16),F(g,65535),K(g,16);
L=F(i*m+b(F(i*T+l*m,65535),16),4294967295);
E=nil;
repeat 
local Z=L%4294967296;
if Z~=Z then 
E=0;
break;end;
E=Z-Z%1;until true;
o[A]=E;
o[p[Y+1]]=o[5]+c[Y];
o[41]=Q[2];
o[42]=334716894;
M,k,r=o[v],o[42],o[43];
o[v]=M(k,r);
A,L=e[Y],o[41];
local Z,g=F(A,4294967295),F(L,4294967295);
local i,l,m,T=F(Z,65535),K(Z,16),F(g,65535),K(g,16);
L=F(i*m+b(F(i*T+l*m,65535),16),4294967295);
E=nil;
repeat 
A=L%4294967296;
if A~=A then 
E=0;
break;end;
E=A-A%1;until true;
o[5]=E;
o[5]=o[7]+o[5];
o[5]=o[6]+o[w[Y+1]];
A,E=o[5];
repeat 
L=A%4294967296;
if L~=L then 
E=0;
break;end;
E=L-L%1;until true;
o[5]=E;
o[6]=o[3];
Y=Y+2;end;else 
v,o[7]=41,o[4]+c[Y+2];
local A,L=q[Y+2],Y+3;
local E,Z=o[_[L]],F(A,4294967295);
local g,i,l=F(E,4294967295),F(Z,65535),K(Z,16);
E,A=F(g,65535),K(g,16);
L=F(i*E+b(F(i*A+l*E,65535),16),4294967295);
E=nil;
repeat 
A=L%4294967296;
if A~=A then 
E=0;
break;end;
E=A-A%1;until true;
o[6]=E;
o[5]=c[Y+3]+o[6];
o[43]=o[4]+c[Y];
o[41]=Q[_[Y+1]];
o[42]=q[Y+1];
o[v]=o[v](o[42],o[43]);
v=41;
A,E,L=_[Y+2],q[Y+3],o[41];
local Z,g=F(E,4294967295),F(L,4294967295);
local i,l,m,T=F(Z,65535),K(Z,16),F(g,65535),K(g,16);
L=F(i*m+b(F(i*T+l*m,65535),16),4294967295);
E=nil;
repeat 
local Z=L%4294967296;
if Z~=Z then 
E=0;
break;end;
E=Z-Z%1;until true;
o[A]=E;
o[43]=o[p[Y]]+q[Y];
o[41]=Q[p[Y+1]];
o[42]=e[Y+2];
M,k,r=o[v],o[42],o[43];
o[v]=M(k,r);
A,L=c[Y+1],o[41];
local Z,g=F(A,4294967295),F(L,4294967295);
local i,l,m,T=F(Z,65535),K(Z,16),F(g,65535),K(g,16);
E=F(i*m+b(F(i*T+l*m,65535),16),4294967295);
A=nil;
repeat 
L=E%4294967296;
if L~=L then 
A=0;
break;end;
A=L-L%1;until true;
o[4]=A;
o[4]=o[6]+o[4];
Y=p[Y+3]-3+3;end;else 
if t>=35 then 
if t~=36 then 
M,v=p[Y],w[Y]+1;
for A=1,y[Y],1 do 
M=F(n(M,(b(M,13))),536870911);
M=n(M,(K(M,13)));
M=F(n(M,(b(M,14))),536870911);
y[v]=n(y[v],(F(K(M,0),127)));
w[v]=n(w[v],(F(K(M,7),127)));
p[v]=n(p[v],(F(K(M,14),127)));
_[v]=n(_[v],(F(K(M,21),127)));
v=v+1;end;
_[Y]=11;else 
o[_[Y+3]]=o[_[Y+1]]+223606840;
o[41]=Q[121];
o[_[Y+2]]=e[Y];
v=y[Y+3];
M,k,r=o[v],o[v+1],o[v+2];
o[v]=M(k,r);
local A,L=c[Y],o[41];
local E,Z=F(A,4294967295),F(L,4294967295);
local g,i,l,m=F(E,65535),K(E,16),F(Z,65535),K(Z,16);
A=F(g*l+b(F(g*m+i*l,65535),16),4294967295);
i=nil;
repeat 
Z=A%4294967296;
if Z~=Z then 
i=0;
break;end;
i=Z-Z%1;until true;
o[3]=i;
o[3]=o[8]+o[3];
o[p[Y+3]]=o[7]+o[3];
Z,L,l=p[Y+1],o[w[Y]];
repeat 
m=L%4294967296;
if m~=m then 
l=0;
break;end;
l=m-m%1;until true;
o[Z]=l;
o[6]=o[6]*w[Y+3];
o[3]=o[6]+o[3];
o[3]=o[3]/c[Y+1];
o[3]=1+o[3];
Y=w[Y+2]-3+3;end;else 
o[5]=o[5]-1023;
o[5]=2^o[5];
o[3]=o[3]*o[_[Y+1]];
o[4]=2*o[4];
o[p[Y]]=1-o[4];
o[3]=o[4]*o[3];
o[w[Y+1]]=o[32]~=o[3];
Y=(if o[7]then y[Y]-1 else y[Y+1]-1)+1;end;end;else 
if t<43 then 
if t<41 then 
o[_[Y+1]]=o[2];
o[41]=o[41](o[42],o[43]);
local A,L=q[Y+1],Y+1;
local E,Z=o[y[L]],F(A,4294967295);
local g,i,l=F(E,4294967295),F(Z,65535),K(Z,16);
E,A=F(g,65535),K(g,16);
L=F(i*E+b(F(i*A+l*E,65535),16),4294967295);
E=nil;
repeat 
A=L%4294967296;
if A~=A then 
E=0;
break;end;
E=A-A%1;until true;
o[12]=E;
o[41]=Q[2];
o[43]=166435499;
o[42]=o[2];
v=w[Y];
M,k,r=o[v],o[v+1],o[v+2];
o[v]=M(k,r);
A,E=e[Y],o[41];
local Z,g=F(A,4294967295),F(E,4294967295);
local i,l,m,T=F(Z,65535),K(Z,16),F(g,65535),K(g,16);
L=F(i*m+b(F(i*T+l*m,65535),16),4294967295);
A=nil;
repeat 
E=L%4294967296;
if E~=E then 
A=0;
break;end;
A=E-E%1;until true;
o[13]=A;
o[12]=o[12]+o[13];
o[11]=o[p[Y+1]]+o[12];
Y=y[Y]-1+1;else 
if t~=42 then 
o[42]=o[4]+91187575;
o[40]=Q[4];
o[41]=q[Y+1];
v=_[Y+1];
o[v]=o[v](o[v+1],o[v+2]);
v=40;
local A,L=e[Y+2],o[40];
local E,Z=F(A,4294967295),F(L,4294967295);
local g,i,l,m=F(E,65535),K(E,16),F(Z,65535),K(Z,16);
L=F(g*l+b(F(g*m+i*l,65535),16),4294967295);
A=nil;
repeat 
local E=L%4294967296;
if E~=E then 
A=0;
break;end;
A=E-E%1;until true;
o[6]=A;
o[_[Y+2]]=o[4]+91187575;
o[p[Y]]=Q[2];
o[41]=q[Y+2];
M,k,r=o[v],o[41],o[42];
o[v]=M(k,r);
A,L=c[Y],o[40];
local E,Z=F(A,4294967295),F(L,4294967295);
local g,i,l,m=F(E,65535),K(E,16),F(Z,65535),K(Z,16);
L=F(g*l+b(F(g*m+i*l,65535),16),4294967295);
A=nil;
repeat 
local E=L%4294967296;
if E~=E then 
A=0;
break;end;
A=E-E%1;until true;
o[4]=A;
o[y[Y+2]]=o[p[Y+1]]+o[4];
Y=w[Y]-2+2;else 
v=39;
o[5]=o[5]-1023;
o[5]=2^o[5];
o[3]=o[3]*o[5];
o[4]=2*o[4];
o[_[Y+1]]=Q[121];
o[y[Y+1]]=180587663;
o[40]=o[2];
M,k,r=o[v],o[40],o[41];
o[v]=M(k,r);
o[2]=o[39];
o[4]=1-o[w[Y]];
o[w[Y+1]]=o[4]*o[3];
o[8]=o[31]~=o[3];
Y=(if o[8]then y[Y]-1 else p[Y]-1)+1;end;end;else 
if t>=44 then 
if t==45 then 
local t,A=o[5];
repeat 
local L=t%4294967296;
if L~=L then 
A=0;
break;end;
A=L-L%1;until true;
o[5]=A;
o[_[Y+1]]=o[_[Y+3]];
A,t=o[_[Y+2]];
repeat 
local L=A%4294967296;
if L~=L then 
t=0;
break;end;
t=L-L%1;until true;
o[6]=t;
o[11]=o[6]+72192415;
local L,E,Z=y[Y+2],o[11],F(397777005,4294967295);
local g,i,l=F(E,4294967295),F(Z,65535),K(Z,16);
E,A=F(g,65535),K(g,16);
t=F(i*E+b(F(i*A+l*E,65535),16),4294967295);
E=nil;
repeat 
A=t%4294967296;
if A~=A then 
E=0;
break;end;
E=A-A%1;until true;
o[L]=E;
o[9]=e[Y+3]+o[10];
o[42]=o[6]+72192415;
o[y[Y+3]]=Q[4];
o[41]=c[Y+1];
v=w[Y];
M,k,r=o[v],o[v+1],o[v+2];
o[v]=M(k,r);
E,A=y[Y],Y+2;
L,t=o[p[A]],F(E,4294967295);
local E,Z,g=F(L,4294967295),F(t,65535),K(t,16);
A,t=F(E,65535),K(E,16);
L=F(Z*A+b(F(Z*t+g*A,65535),16),4294967295);
A=nil;
repeat 
t=L%4294967296;
if t~=t then 
A=0;
break;end;
A=t-t%1;until true;
o[11]=A;
o[11]=o[w[Y+3]]+e[Y];
o[41]=Q[4];
o[43]=166435499;
Y=w[Y+1]-3+3;else 
o[41]=o[4];
v=_[Y+1];
o[v]=o[v](o[v+1],o[v+2]);
o[41]=Q[121];
o[43]=q[Y];
o[42]=o[y[Y]];
o[41]=o[41](o[42],o[43]);
v=42;
o[42]=Q[p[Y]];
o[44]=e[Y+1];
o[43]=o[y[Y+1]];
M,k,r=o[v],o[43],o[44];
o[v]=M(k,r);
o[4]=o[41]+o[42];
o[4]=o[40]+o[4];
Y=w[Y+1]-1+1;end;else 
v=39;
o[41]=503494133;
o[40]=o[2];
M,k,r=o[v],o[40],o[41];
o[v]=M(k,r);
o[_[Y+1]]=o[39];
o[3]=o[7]+o[_[Y+2]];
local e,t=o[y[Y]];
repeat 
local A=e%4294967296;
if A~=A then 
t=0;
break;end;
t=A-A%1;until true;
o[3]=t;
o[6]=o[6]*67108864;
o[3]=o[y[Y+1]]+o[3];
o[3]=o[3]/q[Y+2];
o[p[Y]]=1+o[p[Y+1]];
Y=p[Y+2]-2+2;end;end;end;end;end;
Y=Y+1;end;else 
Y,J=W,a;end;
if J==185 then 
while true do 
local e,W=p[Y];
if e<20 then 
if e>=10 then 
if e>=15 then 
if e>=17 then 
if e>=18 then 
if e==19 then 
o[3](c[Y]);
Y=_[Y];else 
o[31]=h[q[Y+1]];
o[3]=Q[86];
o[4]=Q[61];
o[5]=Q[p[Y+1]];
o[6]=Q[119];
o[8]=Q[106];
local a,J=o[w[Y]];
repeat 
local t=a%4294967296;
if t~=t then 
J=0;
break;end;
J=t-t%1;until true;
o[42]=J;
local t,A,L=y[Y+1],o[4];
repeat 
a=A%4294967296;
if a~=a then 
L=0;
break;end;
L=a-a%1;until true;
o[t]=L;
t,A=o[_[Y]];
repeat 
L=t%4294967296;
if L~=L then 
A=0;
break;end;
A=L-L%1;until true;
o[4]=A;
a,L=o[6];
repeat 
A=a%4294967296;
if A~=A then 
L=0;
break;end;
L=A-A%1;until true;
o[5]=L;
t,A,a=y[Y],o[8];
repeat 
J=A%4294967296;
if J~=J then 
a=0;
break;end;
a=J-J%1;until true;
o[t]=a;
o[_[Y+1]]=Q[121];
Y+=1;end;else 
d,u,V,U=U[8],U[5],U[7],U[9];
o[p[Y+2]]=j[_[Y+1]];
o[22]=#o[3];
o[20]={};
o[p[Y+1]]=O[Y+2];
o[p[Y+3]]=q[Y+1];
o[6]=O[Y];
o[7]=q[Y];
o[8]=c[Y+3];
o[9]=q[Y+2];
o[10]=c[Y+1];
o[11]=O[Y+3];
o[12]=c[Y+2];
o[13]=c[Y];
Y=w[Y+3]-3+3;end;else 
if e~=16 then 
M,v=(n(_[Y],(F(n(X,(F(K(X,29),7))),536870911)))),w[Y]+1;
for a=1,y[Y],1 do 
M=F(n(M,(b(M,13))),536870911);
M=n(M,(K(M,13)));
M=F(n(M,(b(M,14))),536870911);
w[v]=n(w[v],(F(K(M,0),127)));
_[v]=n(_[v],(F(K(M,7),127)));
y[v]=n(y[v],(F(K(M,14),127)));
p[v]=n(p[v],(F(K(M,21),127)));
v=v+1;end;
p[Y]=21;else 
o[3]=h[O[Y]];
o[3]=o[3][q[Y]];
return o[3](o[5]);end;end;else 
if e>=12 then 
if e>=13 then 
if e~=14 then 
Y=w[Y];else 
o[8]=q[Y+1]+o[9];
o[44]=o[6]+10101364;
o[42]=Q[4];
o[p[Y+2]]=c[Y+1];
o[42]=o[42](o[43],o[44]);
v=42;
local a,J,t=p[Y+1],c[Y],o[42];
local A,L=F(J,4294967295),F(t,4294967295);
local J,E,Z,g=F(A,65535),K(A,16),F(L,65535),K(L,16);
t=F(J*Z+b(F(J*g+E*Z,65535),16),4294967295);
E=nil;
repeat 
A=t%4294967296;
if A~=A then 
E=0;
break;end;
E=A-A%1;until true;
o[a]=E;
o[w[Y]]=o[_[Y+2]]+10101364;
o[42]=Q[y[Y+2]];
o[_[Y+1]]=O[Y];
M,k,r=o[v],o[43],o[44];
o[v]=M(k,r);
Y=w[Y+2]-2+2;end;else 
local a,J,t=w[Y],n(_[Y],(F(n(X,(F(K(X,29),7))),536870911))),x[6];
local A=n(t[a],143377016);
t[a]=A;
a,t=x[5],A+1;
A=P(a,t);
local x,L;
if A<128 then 
x,L=A,t+1;else 
local E=P(a,t+1);
if E<128 then 
x,L=(A-128)*128+E,t+2;else 
local Z=P(a,t+2);
if Z<128 then 
x,L=(A-128)*16384+(E-128)+Z*128,t+3;else 
local g=P(a,t+3);
x,L=(A-128)*2097152+(E-128)*128+(Z-128)*16384+g%128+(g-g%128)*2097152,t+4;end;end;end;
A,t=J*16843009,L+x;
local E=t-x%4;
for x=L,E-1,4 do 
I(a,x,(n(f(a,x),A)));end;
for x=E,t-1,1 do 
B(a,x,(n(P(a,x),J)));end;
w[Y]=18;
_[Y]=236;
y[Y]=135;
p[Y]=21;end;else 
if e==11 then 
o[2]=o[42];
o[y[Y]]=12726743;
X=o[3];
Y=_[Y];else 
v=j[y[Y]];
o[p[Y+1]]=v[5][v[4]];
o[3](q[Y]);
Y=_[Y+1]-1+1;end;end;end;else 
if e<5 then 
if e<2 then 
if e~=1 then 
X=o[3];
o[42]=Q[121];
o[p[Y+2]]=O[Y+3];
v=p[Y+3];
M,k,r=o[v],o[v+1],o[v+2];
o[v]=M(k,r);
local x,a=p[Y+1],o[42];
local J,t=F(x,4294967295),F(a,4294967295);
local P,I,f,B=F(J,65535),K(J,16),F(t,65535),K(t,16);
J=F(P*f+b(F(P*B+I*f,65535),16),4294967295);
x=nil;
repeat 
B=J%4294967296;
if B~=B then 
x=0;
break;end;
x=B-B%1;until true;
o[3]=x;
o[3]=o[y[Y]]+o[3];
o[3]=o[8]+o[w[Y]];
I,t,J=y[Y+3],o[3];
repeat 
a=t%4294967296;
if a~=a then 
J=0;
break;end;
J=a-a%1;until true;
o[I]=J;
o[6]=o[_[Y+2]]*w[Y+3];
o[3]=o[6]+o[3];
o[3]=o[3]/q[Y+2];
o[3]=1+o[3];
o[5]=o[_[Y]]-1023;
Y=_[Y+1]-3+3;else 
o[p[Y+1]]=o[p[Y+2]]+o[6];
o[3]=o[y[Y]]+o[4];
local x,a,J=_[Y+2],o[3];
repeat 
local t=a%4294967296;
if t~=t then 
J=0;
break;end;
J=t-t%1;until true;
o[x]=J;
o[42]=_[Y+1];
o[43]=253;
o[44]=w[Y+1];
W=U;
U,v={[8]=d,[7]=V,[9]=W,[5]=u},_[Y];
V,u=o[v+2]+0,o[v+1]+0;
d=o[v]-V;
Y=y[Y+2]-2+2;end;else 
if e<3 then 
o[5][o[4]]=o[p[Y+1]];
o[4]=o[w[Y+1]]%16;
o[_[Y]]=o[4]+_[Y+1];
o[4]=o[y[Y]][o[4]];
o[5][o[3]]=o[w[Y]];
Y=y[Y+1]-1+1;else 
if e==4 then 
d+=V;
v=if V<=0 then d>=u else d<=u;
if v then 
o[y[Y]]=d;
Y=w[Y];else end;else 
d,u,v,V,U=U[8],U[5],42,U[7],U[9];
o[42]=Q[121];
o[44]=454200500;
o[43]=o[_[Y]];
M,k,r=o[v],o[43],o[44];
o[v]=M(k,r);
o[2]=o[42];
Y=w[Y];end;end;end;else 
if e<7 then 
if e~=6 then 
v=42;
o[p[Y+1]]=j[_[Y+1]];
o[43]=#o[3];
o[42]=1;
o[44]=1;
o[w[Y]]=w[Y+1];
W=U;
U,V,u={[8]=d,[7]=V,[9]=W,[5]=u},o[44]+0,o[43]+0;
d=o[v]-V;
Y=y[Y+1]-1+1;else 
o[44]=168432820;
o[43]=o[2];
v=p[Y+1];
o[v]=o[v](o[v+1],o[v+2]);
v,o[p[Y+2]]=42,o[42];
local x,a=o[4];
repeat 
local J=x%4294967296;
if J~=J then 
a=0;
break;end;
a=J-J%1;until true;
o[4]=a;
o[p[Y+3]]=o[3];
x,a=o[5];
repeat 
local J=x%4294967296;
if J~=J then 
a=0;
break;end;
a=J-J%1;until true;
o[5]=a;
o[9]=o[5]+c[Y+2];
local J,t,P=_[Y+3],q[Y+1],o[9];
x,a=F(t,4294967295),F(P,4294967295);
local I,f,B,A=F(x,65535),K(x,16),F(a,65535),K(a,16);
P=F(I*B+b(F(I*A+f*B,65535),16),4294967295);
a=nil;
repeat 
t=P%4294967296;
if t~=t then 
a=0;
break;end;
a=t-t%1;until true;
o[J]=a;
o[6]=O[Y+1]+o[8];
o[44]=o[w[Y+3]]+O[Y+2];
o[42]=Q[4];
o[43]=q[Y+2];
M,k,r=o[v],o[43],o[44];
o[v]=M(k,r);
J,x,t=_[Y],c[Y+1],o[42];
a,P=F(x,4294967295),F(t,4294967295);
local I,f,B,A=F(a,65535),K(a,16),F(P,65535),K(P,16);
x=F(I*B+b(F(I*A+f*B,65535),16),4294967295);
t=nil;
repeat 
P=x%4294967296;
if P~=P then 
t=0;
break;end;
t=P-P%1;until true;
o[J]=t;
o[44]=o[5]+c[Y];
Y=w[Y]-3+3;end;else 
if e<8 then 
o[42]=Q[p[Y+2]];
o[43]=q[Y];
o[42]=o[42](o[43],o[44]);
local x,a,J=p[Y+3],c[Y+1],Y+1;
local t,P=o[p[J]],F(a,4294967295);
local I,f,B=F(t,4294967295),F(P,65535),K(P,16);
t,J=F(I,65535),K(I,16);
a=F(f*t+b(F(f*J+B*t,65535),16),4294967295);
t=nil;
repeat 
J=a%4294967296;
if J~=J then 
t=0;
break;end;
t=J-J%1;until true;
o[x]=t;
o[y[Y]]=o[4]+c[Y+2];
o[42]=Q[_[Y]];
o[43]=q[Y+3];
v=_[Y+1];
M,k,r=o[v],o[v+1],o[v+2];
o[v]=M(k,r);
t,a,J=w[Y+1],O[Y+2],o[42];
local P,I=F(a,4294967295),F(J,4294967295);
local f,B,A,L=F(P,65535),K(P,16),F(I,65535),K(I,16);
J=F(f*A+b(F(f*L+B*A,65535),16),4294967295);
a=nil;
repeat 
x=J%4294967296;
if x~=x then 
a=0;
break;end;
a=x-x%1;until true;
o[t]=a;
o[4]=o[y[Y+3]]+o[4];
o[4]=o[5]+o[4];
o[42]=Q[121];
Y=Y+3;else 
if e~=9 then 
Y=if o[_[Y]]then y[Y]else w[Y];else 
o[p[Y+1]]=o[3];
local x,a=o[4];
repeat 
local J=x%4294967296;
if J~=J then 
a=0;
break;end;
a=J-J%1;until true;
o[4]=a;
o[8]=o[p[Y+2]]+q[Y];
local J,t,P=y[Y+1],O[Y],Y+2;
a,x=o[y[P]],F(t,4294967295);
local P,I,f=F(a,4294967295),F(x,65535),K(x,16);
t,x=F(P,65535),K(P,16);
a=F(I*t+b(F(I*x+f*t,65535),16),4294967295);
P=nil;
repeat 
f=a%4294967296;
if f~=f then 
P=0;
break;end;
P=f-f%1;until true;
o[J]=P;
o[5]=O[Y+1]+o[6];
o[w[Y+2]]=o[w[Y+1]]+c[Y];
o[8]=_[Y+2];
X=o[8];
Y=Y+2;end;end;end;end;end;else 
if e>=30 then 
if e<35 then 
if e<32 then 
if e~=31 then 
M,v=w[Y],y[Y]+1;
for x=1,_[Y],1 do 
M=F(n(M,(b(M,13))),536870911);
M=n(M,(K(M,13)));
M=F(n(M,(b(M,14))),536870911);
w[v]=n(w[v],(F(K(M,0),127)));
_[v]=n(_[v],(F(K(M,7),127)));
y[v]=n(y[v],(F(K(M,14),127)));
p[v]=n(p[v],(F(K(M,21),127)));
v=v+1;end;
p[Y]=21;else 
o[3]=h[q[Y]];
o[p[Y+1]]=o[3](o[32]);
o[7]=o[3]~=O[Y];
Y=y[Y]-1+1;end;else 
if e<33 then 
local x,a=p[Y+2],o[2];
local J,t=F(x,4294967295),F(a,4294967295);
local P,I,f,B=F(J,65535),K(J,16),F(t,65535),K(t,16);
x=F(P*f+b(F(P*B+I*f,65535),16),4294967295);
a=nil;
repeat 
local J=x%4294967296;
if J~=J then 
a=0;
break;end;
a=J-J%1;until true;
o[3]=a;
o[3]=o[p[Y+1]]+c[Y];
o[w[Y+2]]=Q[4];
o[44]=454200500;
o[_[Y+2]]=o[2];
v=_[Y+1];
o[v]=o[v](o[v+1],o[v+2]);
v=41;
a,x=c[Y+2],o[42];
local J,t=F(a,4294967295),F(x,4294967295);
local P,I,f,B=F(J,65535),K(J,16),F(t,65535),K(t,16);
a=F(P*f+b(F(P*B+I*f,65535),16),4294967295);
x=nil;
repeat 
local J=a%4294967296;
if J~=J then 
x=0;
break;end;
x=J-J%1;until true;
o[4]=x;
o[41]=Q[w[Y]];
o[43]=_[Y];
o[42]=o[2];
M,k,r=o[v],o[42],o[43];
o[v]=M(k,r);
a,x=o[41],F(137882026,4294967295);
local J,t,P=F(a,4294967295),F(x,65535),K(x,16);
x,a=F(J,65535),K(J,16);
local J=F(t*x+b(F(t*a+P*x,65535),16),4294967295);
x=nil;
repeat 
a=J%4294967296;
if a~=a then 
x=0;
break;end;
x=a-a%1;until true;
o[6]=x;
Y=y[Y+1]-2+2;else 
if e==34 then 
o[42]=Q[121];
o[43]=c[Y];
v=p[Y+1];
M,k,r=o[v],o[v+1],o[v+2];
o[v]=M(k,r);
local x,a,J=p[Y+2],c[Y+2],o[42];
local t,P=F(a,4294967295),F(J,4294967295);
local I,f,B,A=F(t,65535),K(t,16),F(P,65535),K(P,16);
a=F(I*B+b(F(I*A+f*B,65535),16),4294967295);
J=nil;
repeat 
local t=a%4294967296;
if t~=t then 
J=0;
break;end;
J=t-t%1;until true;
o[x]=J;
o[y[Y+1]]=o[8]+o[5];
o[5]=o[6]+o[5];
a,x=o[5];
repeat 
J=a%4294967296;
if J~=J then 
x=0;
break;end;
x=J-J%1;until true;
o[5]=x;
o[w[Y+2]]=o[3];
J,x=o[6];
repeat 
a=J%4294967296;
if a~=a then 
x=0;
break;end;
x=a-a%1;until true;
o[6]=x;
o[10]=o[6]+10101364;
o[_[Y+2]]=O[Y];
X=o[11];
J,x,a=_[Y+1],q[Y],o[10];
local t,P=F(x,4294967295),F(a,4294967295);
local I,f,B,A=F(t,65535),K(t,16),F(P,65535),K(P,16);
x=F(I*B+b(F(I*A+f*B,65535),16),4294967295);
a=nil;
repeat 
local t=x%4294967296;
if t~=t then 
a=0;
break;end;
a=t-t%1;until true;
o[J]=a;
Y=w[Y+1]-2+2;else 
o[3]=h[q[Y+2]];
o[3]=o[3][O[Y+3]];
o[4]=h[O[Y+1]];
o[33]=o[4][c[Y+3]];
o[35]=5;
v=p[Y+3];
o[v]=o[v](o[v+1],o[v+2]);
k=1;
o[37]=j[_[Y+2]];
M=o[p[Y+2]];
o[37]=M;
o[36]=M[q[Y+3]];
v=p[Y+1];
r,M=v+y[Y+1],2;
r,o[v]=34,D(o[v](S(o,v+1,r)));
v=34;
o[w[Y+1]]=o[y[Y]];
o[_[Y]]=o[33];
s=o[36];
z=s.n;
C=M+z-1;
s.n=C;
G(s,1,z,M,s);
G(o,35,35,1,s);
N=D(o[v](S(s,1,s.n)));
G(N,1,k,v,o);
o[42]=Q[y[Y+2]];
o[44]=276420755;
Y=w[Y]-3+3;end;end;end;else 
if e>=37 then 
if e<38 then 
d,u,V,U=U[8],U[5],U[7],U[9];
Y=_[Y];else 
if e~=39 then 
v=42;
local x,a=c[Y+1],o[42];
local J,t=F(x,4294967295),F(a,4294967295);
local a,P,I,f=F(J,65535),K(J,16),F(t,65535),K(t,16);
t=F(a*I+b(F(a*f+P*I,65535),16),4294967295);
I=nil;
repeat 
J=t%4294967296;
if J~=J then 
I=0;
break;end;
I=J-J%1;until true;
o[6]=I;
o[p[Y+1]]=o[9]+o[6];
o[6]=o[8]+o[_[Y]];
o[42]=Q[y[Y]];
o[44]=374519798;
o[43]=o[w[Y]];
M,k,r=o[v],o[43],o[44];
o[v]=M(k,r);
o[2]=o[w[Y+1]];
x,I=o[6];
repeat 
f=x%4294967296;
if f~=f then 
I=0;
break;end;
I=f-f%1;until true;
o[6]=I;
P,x=o[3];
repeat 
I=P%4294967296;
if I~=I then 
x=0;
break;end;
x=I-I%1;until true;
o[3]=x;
Y=_[Y+1]-1+1;else 
v,M=34,2;
o[34]=o[4];
o[35]=o[3];
o[36]=o[p[Y+2]];
s=o[36];
z=s.n;
s.n=M+z-1;
G(s,1,z,M,s);
G(o,35,35,1,s);
C=D(o[v](S(s,1,s.n)));
G(C,1,1,v,o);
k,v=1,j[_[Y+1]];
v,o[p[Y+1]]=40,v[5][v[4]];
o[p[Y+3]]=o[34]%256;
o[42]=358820455;
o[44]=w[Y+1];
M=y[Y+2];
N,s=v+M,D(o[v](S(o,41,v+M)));
G(s,1,k,v,o);
o[3]=o[38]*y[Y+1];
o[4]=o[3]-1;
o[6]=o[w[Y+3]]//16;
o[6]=o[_[Y+2]]+_[Y];
o[6]=o[y[Y]][o[6]];
Y,r=_[Y+3]-3+3,40;end;end;else 
if e~=36 then 
o[43]=q[Y+1];
o[41]=o[41](o[42],o[43]);
v=42;
o[42]=Q[p[Y+1]];
o[p[Y+2]]=c[Y+1];
o[43]=o[_[Y]];
M,k,r=o[v],o[43],o[44];
o[v]=M(k,r);
o[y[Y+2]]=o[41]+o[42];
o[_[Y+1]]=c[Y]+o[w[Y]];
o[41]=Q[121];
o[43]=q[Y+2];
o[42]=o[4];
Y=Y+2;else 
o[p[Y+1]]=2^o[5];
o[p[Y+2]]=o[3]*o[5];
o[4]=_[Y]*o[4];
o[4]=y[Y+1]-o[w[Y]];
o[33]=o[4]*o[y[Y]];
v=_[Y+1];
o[v]=o[v](o[v+1],o[v+2]);
o[7]=not o[31];
v=42;
o[w[Y+1]]=Q[121];
o[44]=475571010;
o[43]=o[2];
M,k,r=o[v],o[43],o[44];
o[v]=M(k,r);
Y=w[Y+2]-2+2;end;end;end;else 
if e>=25 then 
if e<27 then 
if e~=26 then 
v=j[w[Y]];
o[3]=v[5][v[4]];
o[4]=O[Y];
X=o[4];else 
M=16;
o[14]=O[Y+1];
o[15]=q[Y+3];
o[16]=c[Y+3];
o[17]=O[Y+3];
o[p[Y+3]]=O[Y+2];
o[p[Y+2]]=q[Y];
o[3]=o[20];
v,k=p[Y+1],_[Y];
r=o[v];
G(o,v+1,v+M,k+1,r);
o[y[Y+1]]=h[c[Y]];
o[3]=o[3][q[Y+2]];
o[w[Y+1]]=#o[30];
Y=y[Y+2]-3+3;end;else 
if e<28 then 
v,M,k,r=y[Y],w[Y],n(X,F(K(X,14),262143),(F(K(X,28),15))),_[Y];
N=M<16384 and 7 or(M<2097152 and 14 or 21);
s,z=K(M,N),F(M,b(1,N)-1);
y[Y]=n(v,70,(F(K(k,14),127)));
w[Y]=n(z,111,(F(k,127)));
p[Y]=n(s,6,(F(K(k,21),127)));
_[Y]=n(r,0,(F(K(k,7),127)));
Y=Y-1;else 
if e==29 then 
o[41]=o[41](o[42],o[43]);
o[p[Y+3]]=Q[p[Y+2]];
o[44]=O[Y+2];
o[43]=o[p[Y+1]];
v=y[Y+3];
o[v]=o[v](o[v+1],o[v+2]);
v=43;
o[43]=Q[w[Y]];
o[45]=q[Y+1];
o[44]=o[_[Y+1]];
M,k,r=o[v],o[44],o[45];
o[v]=M(k,r);
o[4]=o[42]+o[y[Y]];
o[4]=o[w[Y+3]]+o[_[Y+3]];
o[3]=o[3]+o[4];
local x,a=o[3];
repeat 
local s=x%4294967296;
if s~=s then 
a=0;
break;end;
a=s-s%1;until true;
o[3]=a;
Y=_[Y]-3+3;else 
o[4]=o[4]*2;
o[5]=o[3](o[p[Y+1]]);
o[43]=#o[30];
o[_[Y+1]]=y[Y];
o[44]=_[Y];
W=U;
U,v={[8]=d,[7]=V,[9]=W,[5]=u},y[Y+1];
V,u=o[v+2]+0,o[v+1]+0;
d=o[v]-V;
Y=w[Y+1]-1+1;end;end;end;else 
if e<22 then 
if e==21 then else 
o[4]=o[3][O[Y+1]];
o[3]=h[q[Y+1]];
o[33]=o[3][c[Y+2]];
o[35]=p[Y+1];
o[33]=o[33](o[34],o[35]);
M=2;
o[3]=o[33];
o[6]=h[O[Y]];
o[p[Y+2]]=o[w[Y+2]][c[Y+1]];
o[35]=c[Y];
v=w[Y];
r=v+M;
o[v]=D(o[v](S(o,v+1,r)));
Y,k=_[Y+2]-2+2,1;end;else 
if e<23 then 
o[43]=o[2];
o[42]=o[42](o[43],o[44]);
v=42;
o[p[Y+1]]=o[42];
o[42]=Q[121];
o[_[Y]]=w[Y+1];
o[43]=o[2];
M,k,r=o[v],o[43],o[44];
o[v]=M(k,r);
o[y[Y]]=o[w[Y]];
Y=_[Y+1]-1+1;else 
if e~=24 then 
v=42;
o[p[Y+2]]=o[3]+O[Y+2];
local e,x=p[Y+1],o[10];
local W,a=F(e,4294967295),F(x,4294967295);
local s,u,U,X=F(W,65535),K(W,16),F(a,65535),K(a,16);
e=F(s*U+b(F(s*X+u*U,65535),16),4294967295);
x=nil;
repeat 
local W=e%4294967296;
if W~=W then 
x=0;
break;end;
x=W-W%1;until true;
o[9]=x;
o[8]=q[Y+2]+o[9];
o[44]=o[3]+c[Y+2];
o[42]=Q[4];
o[43]=O[Y+1];
M,k,r=o[v],o[43],o[44];
o[v]=M(k,r);
x,e=q[Y],o[42];
local Q,W=F(x,4294967295),F(e,4294967295);
local a,s,u,U=F(Q,65535),K(Q,16),F(W,65535),K(W,16);
x=F(a*u+b(F(a*U+s*u,65535),16),4294967295);
e=nil;
repeat 
local Q=x%4294967296;
if Q~=Q then 
e=0;
break;end;
e=Q-Q%1;until true;
o[9]=e;
o[w[Y+1]]=o[3]+O[Y];
o[3]=c[Y];
Y=y[Y+1]-2+2;else 
o[37]=o[30];
M=o[37];
o[37]=M;
o[36]=M[O[Y+2]];
o[36]=o[36](o[37],o[38]);
o[40]=j[_[Y]];
M=o[40];
o[40]=M;
o[39]=M[c[Y+1]];
o[3]=o[38]-1;
o[3]=o[3]%o[22];
o[p[Y+1]]=o[3]+1;
v=p[Y+2];
M,k,r=o[v],o[v+1],o[v+2];
o[v]=M(k,r);
o[3]=o[36]+o[39];
o[41]=o[y[Y]]%256;
o[3]=h[q[Y+2]];
Y=y[Y+2]-2+2;end;end;end;end;end;end;
Y=Y+1;end;end;end;end;end,B7=function(Q,e,Y,x,_,O,y,W,q,p)
if q<=167 then 
if q<=166 then 
return 70,Y,128*(y-128)+e,2+p,x,O,_,W;else 
return 87,Y,e,p,1+x,O,_,W;end;
elseif q<=168 then 
local y,q=Q[42](e,O),O+4;
local O=y/2;
if y%2~=0 then 
return 185,Y,e,p,x,q,O,W;else 
return 107,Y,e,p,x,q,_,O;end;else 
local O,y,q=Q[60](x),Q[60](x),1+0;
return 236,{Y,1-q,nil,q,x+0},e,p,O,y,_,W;end;end,[34]=setmetatable,d=function(Q,e,Y,x,_,O,y,W,q,p)
if q<=98 then 
if q<=97 then 
local w=Q[23](W,3+Y);
local Q,W,c,a,s=(p-128)*2097152,128*(_-128),16384*(x-128),w%128,w%128;
local x=(w-s)*2097152;
w=a+c+(W+(Q+x));
return 147,4+Y,O,e,w;else 
return 18,Y,O+1,e,p;end;
elseif q<=99 then 
local Q=128*(e-128)+y;
return 144,Y+2,O,Q,p;else 
local Q,x=16384*(O-128),e-128;
local _=y*128+Q+x;
return 87,3+Y,_,e,p;end;end,[55]=coroutine.wrap,V=function(Q,e,Y,x,_,O,y,W,q,p,w,c)
if w<=9 then 
if w<=8 then 
return 1;else 
local a=16384*(e-128)+(W-128+128*q);
return 2,233,Y,c+3,p,_,a;end;
elseif w<=10 then 
local W=(p-128)*16384;
local q=x-128+O*128+W;
return 2,144,3+Y,c,q,_,e;else 
local x=Q[23](y,2+Y);
return 2,not(128>x)and 256 or 53,Y,c,p,x,e;end;end,[79]=ipairs,E7=function(Q,e,Y,x,_,O,y,W)
if x<=23 then 
if x<=22 then 
local q=Q[23](W,2+y);
return not(q<128)and 17 or 18,O,y,_,q;else 
return 28,O,y+1,_,e;end;
elseif x<=24 then 
local W=Q[23](Y,O+2);
return not(W>=128)and 19 or 12,O,y,_,W;
elseif x<=25 then 
local Q=e+(_-128)*128;
return 9,2+O,y,Q,e;else 
return 34,O+1,y,_,e;end;end,[18]=Rect.new,q7=function(Q,e,Y,x,_,O,y,W,q,p,w,c,a,s)
if W<=179 then 
if W<=178 then 
local u=16384*(e-128);
local v=y-128+(O*128+u);
return 116,_,x,s,a+3,q,Y,v;else 
local O=Q[23](c,0);
return not(128<=O)and 41 or 197,_,nil,O,a,q,Y,e;end;
elseif W<=180 then 
p[q]=w;
return 35,_,x,s,a,q,Y,e;else 
local Y,O=Q[42](c,s),4+s;
local y,W,p,w=Q[42](c,O),4+O,q-q%1,1+0;
O=p-w;
return 28,{Y+0,w,O,_,nil},x,Y,a,y,W,e;end;end,Y=function(Q,e,Y,x,_,O,y,W,q,p,w)
if x<=135 then 
if x<=134 then 
local c=(e-128)*16384;
local a=w-128+(128*y+c);
return 120,_+3,a,w,p,W;else 
local y=Q[23](q,1+_);
return not(128<=y)and 255 or 86,_,e,y,p,W;end;
elseif x<=136 then 
local x=Q[23](q,_+3);
local y,c,a,s=(p-128)*2097152,(W-128)*128,16384*(O-128),x%128;
local O=2097152*(x-x%128)+(c+(s+y))+a;
return 233,_+4,e,w,O,W;else 
local x=Q[23](q,2+Y);
return not(x>=128)and 1 or 194,_,e,w,p,x;end;end,[5]=buffer.len,[106]=3.29474355E8,[23]=buffer.readu8,[25]=getfenv,Y7=function(Q,e,Y,x,_,O,y)
if y<=19 then 
if y<=18 then 
local W=Q[23](e,Y+2);
return not not(128<=W)and 4 or 12,e,Y,x,W;else 
return 32,e,Y+1,x,_;end;
elseif y<=20 then 
local y=Q[23](e,1+Y);
if not(y>=128)then 
return 34,y,Y,x,_;else 
return 5,e,Y,y,_;end;else 
local Q=(O-128)*16384;
local O=x-128+(128*e+Q);
return 14,Y+3,O,x,_;end;end,[38]=string.byte,c7=function(Q,e,Y,x,_,O,y,W)
if O<=23 then 
if O<=22 then 
return 14,1+x,e,y,W,Y;else 
local q,p,w=_[1],_[2],_[4];
local c,a=q+p,p<=0;
q,p=c>=w,c<=w;
w=a and q or not a and p;
_[1]=c;
if w then 
return 27,x,e,y,c,Y;else 
return 11,x,e,y,W,Y;end;end;
elseif O<=24 then 
local _=Q[23](x,e);
return _<128 and 26 or 31,x,e,5,_,Y;
elseif O<=25 then 
local _=Q[23](x,e+2);
return _<128 and 8 or 16,x,e,y,W,_;else 
return 13,x,1+e,y,W,Y;end;end,H=function(Q,e,Y,x,_,O,y,W,q,p,w,c,a)
if _<=33 then 
if _<=32 then 
local s=Q[23](p,y);
return not(128<=s)and 138 or 103,x,y,a,s,W,e;else 
local Q,p,s=16384*(e-128),Y-128,128*O;
local Y=p+Q+s;
return 37,x,3+y,a,q,W,Y;end;
elseif _<=34 then 
local Q=16384*(a-128);
local Y=q-128+(Q+w*128);
return 88,3+x,y,Y,q,W,e;else 
local Q,Y,_=c[2],c[3],c[5];
local O,p=Q+Y,Y<=0;
Y,Q=O>=_,O<=_;
_=p and Y or not p and Q;
c[2]=O;
if _ then 
return 66,x,y,a,q,O,e;else 
return 221,x,y,a,q,W,e;end;end;end,[84]=buffer.readu16,F7=function(Q,e,Y,x,_,O,y,W,q)
if y<=228 then 
if y<=227 then 
return 126,Y+1,_,q,O,x;else 
local p=O+(q-128)*128;
return 110,Y,2+_,p,O,x;end;
elseif y<=229 then 
local y=Q[23](e,2+Y);
return not(y>=128)and 101 or 14,Y,_,q,O,y;else 
local Q,e=16384*(O-128),W-128;
local O=128*x+(Q+e);
return 24,Y,_+3,q,O,x;end;end,[97]=table.clear},{}):Ot(...);