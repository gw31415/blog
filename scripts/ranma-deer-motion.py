"""Generate fixed-length deer joint angles. Run from the repository root."""
import json
import math
from pathlib import Path

COUNT = 400
TRAVEL = 14
LIFT = 2.5
BOB = .6
ROCK = .3
ROOTS = [(-61, -70), (41, -77), (-63, -70), (37, -77)]
LENGTHS = [(29, 27, 27), (27, 29, 27), (29, 27, 27), (27, 29, 27)]
FEET = [-69, 43, -59, 30]
STARTS = [.025, .275, .525, .775]

def root_at(p, i):
    angle = math.radians(math.sin(p * math.tau) * ROCK)
    x, y = ROOTS[i]
    y += 68
    return (x * math.cos(angle) - y * math.sin(angle),
            x * math.sin(angle) + y * math.cos(angle) - 68 - BOB * math.sin(p * math.tau) ** 2)

def solve(p, i):
    t = min(1, max(0, (p - STARTS[i]) / .20))
    ease = t*t*t*(10 + t*(-15 + 6*t))
    foot = (FEET[i] + TRAVEL*ease - TRAVEL*p, -5 - LIFT*math.sin(math.pi*t)**2)
    root = root_at(p, i)
    lengths = LENGTHS[i]
    a = (1.02 if i % 2 == 0 else 1.92) + .07*math.sin(math.pi*t)
    elbow = (root[0] + lengths[0]*math.cos(a), root[1] + lengths[0]*math.sin(a))
    dx, dy = foot[0]-elbow[0], foot[1]-elbow[1]
    d = math.hypot(dx, dy)
    l1, l2 = lengths[1:]
    assert abs(l1-l2) < d < l1+l2, (p, i, d)
    along = (l1*l1-l2*l2+d*d)/(2*d)
    height = math.sqrt(l1*l1-along*along)
    side = -1 if i % 2 == 0 else 1
    knee = (elbow[0]+along*dx/d+side*height*dy/d,
            elbow[1]+along*dy/d-side*height*dx/d)
    angles = [a, math.atan2(knee[1]-elbow[1], knee[0]-elbow[0]),
              math.atan2(foot[1]-knee[1], foot[0]-knee[0])]
    return angles, foot, t

def forward(p, i, angles):
    points = [root_at(p, i)]
    for length, angle in zip(LENGTHS[i], angles):
        x,y=points[-1]
        points.append((x+length*math.cos(angle), y+length*math.sin(angle)))
    return points

samples = [[ [round(a, 9) for a in solve(n/COUNT,i)[0]] for i in range(4)] for n in range(COUNT+1)]
max_bone_error = max_contact_error = 0
for n in range(10001):
    p=n/10000
    frame=min(COUNT-1, int(p*COUNT)); blend=p*COUNT-frame
    for i in range(4):
        angles=[a+(b-a)*blend for a,b in zip(samples[frame][i],samples[frame+1][i])]
        points=forward(p,i,angles)
        max_bone_error=max(max_bone_error, *(abs(math.dist(a,b)-length) for a,b,length in zip(points,points[1:],LENGTHS[i])))
        _, target, t=solve(p,i)
        if t in (0,1):
            max_contact_error=max(max_contact_error, math.dist(points[-1],target))
assert max_bone_error < 1e-10
assert max_contact_error < .002
out=Path('src/components/organisms/ranma-deer-motion.json')
out.write_text(json.dumps({'travel':TRAVEL,'bob':BOB,'rock':ROCK,'roots':ROOTS,'lengths':LENGTHS,'angles':samples}, separators=(',',':'))+'\n')
print(json.dumps({'samples':COUNT+1,'validation_positions':10001,'max_bone_length_error':max_bone_error,'max_planted_hoof_error':max_contact_error},indent=2))
