#!/bin/bash
# one run, resumed from its checkpoint until it finishes: run.sh BRAIN SEED
cd /tmp/claude-0/-home-user-3dproject/4db7e567-5529-5795-9b08-c7b02441b831/scratchpad/wt7
D=../ch3; N=$1-$2
for try in $(seq 1 20); do [ -f $D/$N.json ] && break
  START=2026-11-12T08:00:00+09:00 EPOCH=2026-11-12T08:00:00+09:00 SEED=$2 BRAIN=$1 HOURS=720 CKPT=$D/$N.ck OUT=$D/$N.json \
    npx tsx --import ./scripts/node-assets.mjs scripts/zz-island.ts > $D/$N.log 2>&1 || sleep 5
done
